# back-end/backend/app/routers/chat.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session
from typing import Optional

from ..database import get_session
from ..models import Game, Player, Npc
from ..services.memory_services import MemoryService
from ..services.llm_service import call_llm_for_chat

router = APIRouter(
    prefix="/api/games/{game_id}/players",
    tags=["chat"],
)

class ChatRequest(BaseModel):
    text: str = Field(..., description="玩家說的話")
    model: str = Field("gemini-2.0-flash", description="LLM 模型名稱")
    temperature: float = Field(0.7, ge=0, le=1, description="隨機性控制 (0~1)")

class ChatResponse(BaseModel):
    dialogue: str = Field(..., description="NPC 的完整對話回應")
    hint: Optional[str] = Field(None, description="NPC 提供的線索提示")
    evidence: Optional[dict] = Field(None, description="NPC 提供的新證據 (id, name, description)")

@router.post("/{player_id}/chat/{npc_id}", response_model=ChatResponse)
async def chat_with_npc(
    game_id: int,
    player_id: int,
    npc_id: int,
    req: ChatRequest,
    session: Session = Depends(get_session),
):
    # 1. 檢查遊戲
    game = session.get(Game, game_id)
    if not game:
        raise HTTPException(404, "Game not found")
    if not game.background:
        raise HTTPException(400, "請先生成並確認故事背景")

    # 2. 取得玩家
    player = session.get(Player, player_id)
    if not player or player.game_id != game_id:
        raise HTTPException(404, "Player not found in this game")

    # 3. 取得 NPC
    npc = session.get(Npc, npc_id)
    if not npc or npc.game_id != game_id:
        raise HTTPException(404, "NPC not found in this game")

    # 4. 撈對話歷史
    mem = MemoryService(session)
    history = mem.get_conversation_context(player_id)

    # 5. 呼叫 LLM
    result = await call_llm_for_chat(
        background  = game.background,
        character   = {
            "name":        npc.name,
            "role":        "NPC",
            "public_info": npc.description,
            "secret":      "",
            "mission":     ""
        },
        history      = history,
        user_text    = req.text,
        model        = req.model,
        temperature  = req.temperature
    )

    # 6. 解析結果
    dialogue = result.get("dialogue", "")
    hint     = result.get("hint")
    evidence = result.get("evidence")

    # 7. 存入對話
    mem.append_message(player_id, "user",      req.text)
    mem.append_message(player_id, "assistant", dialogue)

    # 若有新證據，更新玩家紀錄
    if evidence and isinstance(evidence, dict):
        player.discovered_evidence = (player.discovered_evidence or []) + [evidence.get("id")]
        session.add(player)
        session.commit()

    return ChatResponse(dialogue=dialogue, hint=hint, evidence=evidence)
