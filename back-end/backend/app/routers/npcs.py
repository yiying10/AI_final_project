# back-end/backend/app/routers/npcs.py

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import List
from pydantic import BaseModel, ConfigDict

from ..database import get_session
from ..models import Game, Npc
from ..services.memory_services import MemoryService

router = APIRouter(
    prefix="/games/{game_id}/npcs",
    tags=["npcs"],
)

class NpcInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str

@router.get("", response_model=List[NpcInfo])
def list_npcs(
    game_id: int,
    session: Session = Depends(get_session),
):
    # 確認遊戲存在
    game = session.get(Game, game_id)
    if not game:
        raise HTTPException(404, "Game not found")

    mem = MemoryService(session)
    npcs = mem.get_npcs(game_id)
    return npcs
