# back-end/backend/app/routers/world_gen.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from sqlmodel import Session, delete
from ..database import get_session
from ..models import Game, Character, Npc
from ..services.memory_services import MemoryService
from ..services.llm_service import call_llm_for_characters, call_llm_for_npcs

router = APIRouter(prefix="/world/games", tags=["world-gen"])

class CharacterGenRequest(BaseModel):
    num_characters: int = Field(4, ge=3, le=6, description="生成角色數量")
    num_npcs:       int = Field(3, ge=1, description="生成 NPC 數量")

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

class CharacterGenResponse(BaseModel):
    characters: list[CharacterInfo]
    npcs:       list[NpcInfo]

@router.post("/{game_id}/characters", response_model=CharacterGenResponse)
async def generate_characters_and_npcs(
    game_id: int,
    req: CharacterGenRequest,
    session: Session = Depends(get_session),
):
    mem = MemoryService(session)

    # 1. 確認遊戲存在並已有背景
    game = session.get(Game, game_id)
    if not game:
        raise HTTPException(404, "Game not found")
    if not game.background:
        raise HTTPException(400, "請先生成並確認故事背景")

    # 2. 清除舊角色、舊 NPC、舊玩家對應
    mem.clear_roles(game_id)
    mem._clear_players_and_messages(game_id)

    # 3. 透過 LLM 生成角色
    raw_chars = await call_llm_for_characters(
        background=game.background,
        num_characters=req.num_characters,
    )
    created_chars = []
    for ch in raw_chars:
        c = Character(game_id=game_id, **ch)
        session.add(c); session.commit(); session.refresh(c)
        created_chars.append(c)
    
    # 4. 透過 LLM 生成 NPC
    raw_npcs = await call_llm_for_npcs(
        background=game.background,
        num_npcs=req.num_npcs,
    )
    created_npcs = []
    for n in raw_npcs:
        npc = Npc(game_id=game_id, **n)
        session.add(npc); session.commit(); session.refresh(npc)
        created_npcs.append(npc)

    # 5. 回傳結果
    return CharacterGenResponse(
        characters=[CharacterInfo.from_orm(c) for c in created_chars],
        npcs      =[NpcInfo.from_orm(n)       for n in created_npcs],
    )
