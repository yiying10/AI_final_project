import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from ..utils import read_json, DATA_FILE
from ..services.llm_service import call_llm_for_generation

router = APIRouter()

class WorldGenRequest(BaseModel):
    world_id: int
    crime: str
    tone: Optional[str] = "懸疑"
    model: Optional[str] = "gemini-2.0-flash"

class ScenarioResponse(BaseModel):
    characters: List[Dict[str, Any]]
    locations: List[Dict[str, Any]]
    evidence: List[Dict[str, Any]]
    npc: List[Dict[str, Any]]

@router.post(
    "/generate",
    response_model=ScenarioResponse,
    summary="產生並儲存新場景"
)
async def generate_world(req: WorldGenRequest):
    DATA = read_json()
    # 1. 找到場景，先用 id，再 fallback 到 index
    world = next((w for w in DATA if w.get("id") == req.world_id), None)
    if not world and 1 <= req.world_id <= len(DATA):
        world = DATA[req.world_id - 1]
    if not world:
        raise HTTPException(404, "World not found")

    # 2. 安全地取得場景名稱
    scene_name = world.get("scene")
    if not scene_name:
        locs = world.get("locations") or []
        if isinstance(locs, list) and locs:
            first = locs[0]
            if isinstance(first, dict):
                scene_name = first.get("name", "")
            elif isinstance(first, str):
                scene_name = first
    if not scene_name:
        raise HTTPException(500, "無法取得場景名稱，locations 資料為空或格式錯誤")

    # 3. 組主題
    theme = f"{scene_name}中的{req.crime}"

    # 4. 呼叫 LLM
    try:
        result = await call_llm_for_generation(
            theme=theme,
            tone=req.tone,
            model=req.model
        )
    except Exception as e:
        raise HTTPException(500, f"LLM 生成失敗：{e}")

    # 5. 處理 LLM 回傳格式
    if isinstance(result, list):
        if not result:
            raise HTTPException(500, "LLM 生成回傳空 list")
        result = result[0]

    # 6. 寫入並回傳
    existing_ids = [w.get("id") for w in DATA if isinstance(w.get("id"), int)]
    new_id = max(existing_ids, default=0) + 1
    new_entry = {"id": new_id, **result}
    DATA.append(new_entry)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(DATA, f, ensure_ascii=False, indent=2)

    return result