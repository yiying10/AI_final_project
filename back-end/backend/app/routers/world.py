from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session
from ..database import get_session
from ..models import Game
from ..services.memory_services import MemoryService
from ..services.llm_service import call_llm_for_background  # 你自己包的 LLM 呼叫

router = APIRouter()

class BackgroundRequest(BaseModel):
    prompt: str

class BackgroundResponse(BaseModel):
    background: str

@router.post("/games/{game_id}/background")
def generate_background(
    game_id: int,
    req: BackgroundRequest,
    session: Session = Depends(get_session)
):
    mem = MemoryService(session)

    # 1. 嘗試拿 Game，若不存在就自動建立一筆
    game = session.get(Game,game_id)
    if game:
        mem.clear_game(game_id)
    if not game:
        game = mem.create_game()
        # 如果前端 path 裡給的 id 和實際 auto-increment id 不同，
        # 你可以選擇忽略 path 裡的 game_id，只用新建的 game.id
        game_id = game.id

    # 2. 呼叫 LLM 產生背景
    background_text = call_llm_for_background(req.prompt)

    # 3. 存到 database
    mem.save_background(game_id, background_text)

    # 4. 回傳
    return {"background": background_text}
