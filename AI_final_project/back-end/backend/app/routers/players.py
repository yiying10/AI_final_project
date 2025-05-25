# app/routers/player.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session

from ..database import get_session
from ..models import Game, Character, Player
from ..services.memory_services import MemoryService

router = APIRouter(prefix="/api/games/{game_id}/players", tags=["players"])

class ClaimRequest(BaseModel):
    user_id: str = Field(..., description="前端玩家自己的一個識別，比如 username 或 UUID")
    character_id: int = Field(..., description="要認領的角色 ID")

class ClaimResponse(BaseModel):
    player_id: int
    game_id: int
    character_id: int

@router.post("", response_model=ClaimResponse)
def claim_character(
    game_id: int,
    req: ClaimRequest,
    session: Session = Depends(get_session)
):
    # 1. 確保遊戲存在
    game = session.get(Game, game_id)
    if not game:
        raise HTTPException(404, "Game not found")

    # 2. 確保角色存在且屬於這場遊戲
    char = session.get(Character, req.character_id)
    if not char or char.game_id != game_id:
        raise HTTPException(400, "Invalid character for this game")

    # 3. 建立 Player 紀錄
    mem = MemoryService(session)
    player = mem.assign_player(
        game_id      = game_id,
        user_id      = req.user_id,
        character_id = req.character_id
    )

    return ClaimResponse(
        player_id    = player.id,
        game_id      = player.game_id,
        character_id = player.character_id
    )
