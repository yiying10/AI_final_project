# back-end/backend/app/routers/world_gen.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from sqlmodel import Session
from typing import List, Dict, Any

from ..database import get_session
from ..models import Game, Character, Npc
from ..services.memory_services import MemoryService
from ..services.llm_service import (
    call_llm_for_characters,
    call_llm_for_npcs,
    call_llm_for_scenes_and_ending,
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

class WorldGenResponse(BaseModel):
    characters: List[CharacterInfo]
    npcs:       List[NpcInfo]
    acts:       List[ActInfo]
    ending:     str

@router.post("/{game_id}/generate_full", response_model=WorldGenResponse)
async def generate_full_content(
    game_id: int,
    req: WorldGenRequest,
    session: Session = Depends(get_session),
):
    # 檢查 game
    game = session.get(Game, game_id)
    if not game:
        raise HTTPException(404, "Game not found")
    if not game.background:
        raise HTTPException(400, "請先生成並確認故事背景")

    # 清除舊資料
    mem = MemoryService(session)
    mem.clear_roles(game_id)
    mem._clear_players_and_messages(game_id)

    # 生成角色
    raw_chars = await call_llm_for_characters(
        background=game.background,
        num_characters=req.num_characters,
        model=req.model,
        temperature=req.temperature,
    )
    created_chars = []
    for ch in raw_chars:
        c = Character(game_id=game_id, **ch)
        session.add(c); session.commit(); session.refresh(c)
        created_chars.append(c)

    # 生成 NPC
    raw_npcs = await call_llm_for_npcs(
        background=game.background,
        num_npcs=req.num_npcs,
        model=req.model,
        temperature=req.temperature,
    )
    created_npcs = []
    for n in raw_npcs:
        npc = Npc(game_id=game_id, **n)
        session.add(npc); session.commit(); session.refresh(npc)
        created_npcs.append(npc)

    # 生成每一幕腳本 + 最終結局
    scenes, ending = await call_llm_for_scenes_and_ending(
        background=game.background,
        characters=[c.dict() for c in created_chars],
        num_acts=req.num_acts,
        model=req.model,
        temperature=req.temperature,
    )

    # 存回 DB
    game.acts   = scenes
    game.ending = ending
    session.add(game)
    session.commit()
    session.refresh(game)

    return WorldGenResponse(
        characters=[CharacterInfo.from_orm(c) for c in created_chars],
        npcs=[NpcInfo.from_orm(n) for n in created_npcs],
        acts=scenes,
        ending=ending,
    )
