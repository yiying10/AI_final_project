import uuid
from typing import Dict, List, Any

from ..models import (
    GameSettings,
    Scenario,
    PlayerInfo,
    CharacterScript,
    Location,
    Evidence
)
from ..services.llm_service import call_llm_for_generation, call_llm_for_chat
from ..utils.redis_client import save_session, load_session

# 使用 Redis 持久化 Session
class GameService:
    async def create_game(self, settings: GameSettings) -> Scenario:
        # 1. 呼叫 LLM 生成世界設定
        scene = await call_llm_for_generation(
            theme="一般推理劇本",
            tone="懸疑",
            model="gemini-2.0-flash"
        )
        # 處理 LLM 回傳為 list 的狀況
        if isinstance(scene, list):
            if not scene:
                raise RuntimeError("LLM 回傳空 list，無法建立遊戲場景")
            scene = scene[0]
        if not isinstance(scene, dict):
            raise RuntimeError(f"LLM 回傳格式錯誤，預期 dict，但拿到 {type(scene)}")

        # 2. 選擇角色並抽取兇手
        characters = scene.get("characters")
        if not isinstance(characters, list) or len(characters) == 0:
            raise RuntimeError("LLM 回傳格式錯誤：缺少 characters 列表")
        murderer = characters[0].get("name", "")
        full_story = scene.get("full_story", "")

        # 3. 建立角色腳本清單
        scripts: List[CharacterScript] = []
        for char in characters:
            if not isinstance(char, dict):
                continue
            scripts.append(CharacterScript(
                player_id="",
                role=char.get("name", ""),
                backstory=char.get("description", ""),
                tasks=char.get("tasks", [])
            ))

        # 4. 自動編號並建立地點清單
        locations: List[Location] = []
        for idx, loc in enumerate(scene.get("locations", []) or []):
            if not isinstance(loc, dict):
                continue
            locations.append(Location(
                id=str(idx + 1),
                name=loc.get("name", ""),
                description=loc.get("description", "")
            ))

        # 5. 自動編號並建立證據清單
        evidence_list: List[Evidence] = []
        for idx, ev in enumerate(scene.get("evidence", []) or []):
            if not isinstance(ev, dict):
                continue
            evidence_list.append(Evidence(
                id=str(idx + 1),
                name=ev.get("name", ""),
                description=ev.get("description", "")
            ))

        # 6. 建立 Scenario 並儲存至 Redis
        code = uuid.uuid4().hex[:6]
        scenario = Scenario(
            game_code=code,
            background=scene.get("background", ""),
            locations=locations,
            evidence=evidence_list,
            scripts=scripts,
            murderer=murderer,
            full_story=full_story
        )
        session = {
            "settings": settings.dict(),
            "scenario": scenario.dict(),
            "players": [],
            "memory": {}
        }
        await save_session(code, session)
        return scenario

    async def join_player(self, game_code: str, name: str) -> PlayerInfo:
        session = await load_session(game_code)
        if not session:
            raise ValueError("Game not found")
        scripts = session["scenario"].get("scripts", [])
        idx = len(session["players"] or [])
        if idx >= len(scripts):
            raise ValueError("所有角色已被分配完畢")
        script = scripts[idx]
        pid = uuid.uuid4().hex[:8]
        script["player_id"] = pid
        info = PlayerInfo(player_id=pid, name=name, role=script.get("role", ""))
        session["players"].append(info.dict())
        session["memory"][pid] = []
        await save_session(game_code, session)
        return info

    async def get_script(self, game_code: str, pid: str) -> CharacterScript:
        session = await load_session(game_code)
        if not session:
            raise ValueError("Game not found")
        for s in session["scenario"].get("scripts", []):
            if isinstance(s, dict) and s.get("player_id") == pid:
                return CharacterScript(**s)
        raise ValueError("Script not found")

    async def get_map(self, game_code: str) -> List[Location]:
        session = await load_session(game_code)
        if not session:
            raise ValueError("Game not found")
        return [Location(**l) for l in session["scenario"].get("locations", [])]

    async def get_evidence(self, game_code: str) -> List[Evidence]:
        session = await load_session(game_code)
        if not session:
            raise ValueError("Game not found")
        return [Evidence(**e) for e in session["scenario"].get("evidence", [])]

    async def chat(self, game_code: str, pid: str, message: str) -> Dict[str, Any]:
        # 1. 載入 session
        session = await load_session(game_code)
        if not session:
            raise ValueError("Game not found")

        # 2. 取出該玩家的角色腳本
        scripts = session["scenario"].get("scripts", [])
        script_data = next(
            (s for s in scripts if isinstance(s, dict) and s.get("player_id") == pid),
            None
        )
        if not script_data:
            raise ValueError("Script not found")

        # 3. 取位置
        locs = session["scenario"].get("locations", [])
        loc_data = locs[0] if locs and isinstance(locs[0], dict) else {}
        
        # 4. 準備 history：把純字串升級成 dict
        raw = session.get("memory", {}).get(pid, []) or []
        history: List[Dict[str, Any]] = []
        for ent in raw:
            if isinstance(ent, dict) and "role" in ent and "content" in ent:
                history.append(ent)
            elif isinstance(ent, str):
                history.append({"role": "user", "content": ent})

        # 5. 呼叫 LLM
        resp = await call_llm_for_chat(script_data, loc_data, history, message)
        if not isinstance(resp, dict):
            raise RuntimeError(f"LLM 回傳格式錯誤，預期 dict，但拿到 {type(resp)}")

        # 6. 更新記憶：user + assistant
        session.setdefault("memory", {})
        session["memory"].setdefault(pid, [])
        session["memory"][pid].append({"role": "user", "content": message})
        dialogue = resp.get("dialogue")
        if isinstance(dialogue, str):
            session["memory"][pid].append({"role": "assistant", "content": dialogue})

        # 7. 寫回 Redis
        await save_session(game_code, session)

        # 8. 回傳結果，保證非 None
        return resp

    async def get_state(self, game_code: str) -> Dict[str, Any]:
        session = await load_session(game_code)
        if not session:
            raise ValueError("Game not found")
        return session["memory"]

    async def get_solution(self, game_code: str) -> Dict[str, str]:
        session = await load_session(game_code)
        if not session:
            raise ValueError("Game not found")
        sc = session["scenario"]
        return {"murderer": sc.get("murderer", ""), "full_story": sc.get("full_story", "")}
