# back-end/backend/app/routers/world_gen.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from sqlmodel import Session
from typing import List, Dict, Any

from ..database import get_session
from ..models import Game, Character, Npc, Location, GameObj
from ..services.memory_services import MemoryService
from ..services.llm_service import (
    call_llm_for_characters,
    call_llm_for_npcs,
    call_llm_for_scenes_and_ending,
    call_llm_for_locations,
)

router = APIRouter(prefix="/world/games", tags=["world-gen"])

class WorldGenRequest(BaseModel):
    num_characters: int = Field(4, ge=3, le=6, description="生成角色數量")
    num_npcs:       int = Field(3, ge=1, description="生成 NPC 數量")
    num_acts:       int = Field(3, ge=1, le=10, description="生成幕數")
    model:          str = Field("gemini-2.0-flash", description="LLM 模型名稱")
    temperature:    float = Field(0.7, ge=0, le=1, description="隨機性控制 (0~1)")

class CharacterInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:           int
    name:         str
    role:         str
    public_info:  str
    secret:       str
    mission:      str

class NpcInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:           int
    name:         str
    description:  str

class Script(BaseModel):
    character: str
    dialogue:  str

class ActInfo(BaseModel):
    act_number: int
    scripts:    List[Script]
    
class GameObjectInfo(BaseModel):
    id:   int = Field(..., description="物件唯一識別")
    name: str = Field(..., description="物件名稱")
    lock: bool = Field(..., description="是否上鎖")
    clue:  str | None = Field(None, description="解鎖提示")
    owner_id: int | None = Field(
        None, description="已解鎖此物品的玩家 ID"
    )
    
class LocationInfo(BaseModel):
    id:      int = Field(..., description="地點唯一識別")
    name:    str               = Field(..., description="地點名稱")
    npcs:    List[int]         = Field(..., description="此地點包含的 NPC id 清單")
    objects: List[GameObjectInfo] = Field(..., description="此地點可互動的物件列表")
    
class WorldGenResponse(BaseModel):
    characters: List[CharacterInfo]
    npcs:       List[NpcInfo]
    acts:       List[ActInfo]
    ending:     str
    locations:  List[LocationInfo]

@router.post("/{game_id}/generate_full", response_model=WorldGenResponse)
async def generate_full_content(
    game_id: int,
    req: WorldGenRequest,
    session: Session = Depends(get_session),
):
    # 1. 檢查遊戲
    game = session.get(Game, game_id)
    if not game:
        raise HTTPException(404, "Game not found")
    if not game.background:
        raise HTTPException(400, "請先生成並確認故事背景")

    # 2. 清除舊資料
    mem = MemoryService(session)
    mem.clear_roles(game_id)
    mem._clear_players_and_messages(game_id)
    mem._clear_locations(game_id)
    

    # 3. 生成角色
    raw_chars = await call_llm_for_characters(
        background=game.background,
        num_characters=req.num_characters,
        model=req.model,
        temperature=req.temperature,
    )
    created_chars = []
    for ch in raw_chars:
        c = Character(game_id=game_id, **ch)
        session.add(c)
        session.commit()
        session.refresh(c)
        created_chars.append(c)

    # 4. 生成 NPC
    raw_npcs = await call_llm_for_npcs(
        background=game.background,
        num_npcs=req.num_npcs,
        model=req.model,
        temperature=req.temperature,
    )
    created_npcs = []
    for n in raw_npcs:
        npc = Npc(game_id=game_id, **n)
        session.add(npc)
        session.commit()
        session.refresh(npc)
        created_npcs.append(npc)

    # 5. 生成每一幕劇本 + 結局
    scenes, ending = await call_llm_for_scenes_and_ending(
        background=game.background,
        characters=[{"name": c.name} for c in created_chars],
        locations=[{"name": loc.name} for loc in game.locations],
        npcs=[{"name": n.name} for n in created_npcs],
        num_acts=req.num_acts,
        model=req.model,
        temperature=req.temperature,
    )

    # 6. 生成地點與物件
    locations_data = await call_llm_for_locations(
        background=game.background,
        characters=[{"name": c.name} for c in created_chars],
        npcs=[{"id": n.id} for n in created_npcs],
        model=req.model,
        temperature=req.temperature,
    )

    # 7. 更新 game 的 acts 與 ending
    game.acts = scenes
    game.ending = ending
    session.add(game)
    session.commit()

        # 8. 把每個地點和物件存成 ORM
    persisted_locations = []
    for loc_dict in locations_data:
        # 建立 Location（使用最上方匯入的 Location）
        loc = Location(game_id=game_id, name=loc_dict["name"])
        session.add(loc)
        session.commit()
        session.refresh(loc)

        # 更新這個地點的 NPC
        for npc_id in loc_dict["npcs"]:
            obj_npc = session.get(Npc, npc_id)
            if obj_npc:
                obj_npc.location_id = loc.id
                session.add(obj_npc)

        # 建立此地點的物件
        for obj_dict in loc_dict["objects"]:
            o = GameObj(
                location_id=loc.id,
                name=obj_dict["name"],
                lock=obj_dict["lock"],
                clue=obj_dict.get("clue"),
                owner_id=obj_dict.get("owner_id", None),  # 新增 owner_id
            )
            session.add(o)

        session.commit()
        session.refresh(loc)
        persisted_locations.append(loc)

    # 9. 準備回傳資料（直接用本檔定義的 LocationInfo、GameObjectInfo）
    response_locations = []
    for loc in persisted_locations:
        objects_info = [
            GameObjectInfo(id=o.id, name=o.name, lock=o.lock, clue=o.clue, owner_id=o.owner_id)
            for o in loc.objects
        ]
        response_locations.append(
            LocationInfo(
                id=loc.id,
                name=loc.name,
                npcs=[n.id for n in loc.npcs],
                objects=objects_info,
            )
        )

    # 10. 回傳最終結果
    return WorldGenResponse(
        characters=[CharacterInfo.from_orm(c) for c in created_chars],
        npcs=[NpcInfo.from_orm(n) for n in created_npcs],
        acts=scenes,
        ending=ending,
        locations=response_locations,
    )

