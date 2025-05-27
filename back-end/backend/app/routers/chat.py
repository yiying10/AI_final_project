from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from ..services.llm_service import call_llm_for_chat

router = APIRouter(
    prefix="",
    tags=["chat"],
)

class ChatRequest(BaseModel):
    game_id: str = Field(..., description="遊戲 ID")
    player_id: str = Field(..., description="玩家 ID")
    npc_id: str = Field(..., description="NPC ID")
    text: str = Field(..., description="玩家說的話")
    model: str = Field(default="gemini-2.0-flash", description="LLM 模型名稱")
    temperature: float = Field(default=0.7, ge=0, le=1, description="隨機性控制 (0~1)")
    background: str = Field(..., description="遊戲故事背景")
    npc_info: Dict[str, Any] = Field(..., description="NPC 資訊")
    chat_history: List[Dict[str, str]] = Field(default_factory=list, description="對話歷史")

class ChatResponse(BaseModel):
    dialogue: str = Field(..., description="NPC 的完整對話回應")
    hint: Optional[str] = Field(None, description="線索提示")
    evidence: Optional[dict] = Field(None, description="新證據 (id, name, description)")

@router.post("/npc", response_model=ChatResponse)
async def chat_with_npc(req: ChatRequest):
    """
    與 NPC 對話的 API
    所有資料都從前端 Supabase 傳入，後端只負責調用 LLM
    """
    try:
        print(f"Received request: {req}")
        print(f"Text content: '{req.text}'")
        print(f"Text length: {len(req.text)}")
        
        if not req.text or not req.text.strip():
            raise HTTPException(
                status_code=400,
                detail="對話內容不能為空"
            )

        # 呼叫 LLM 服務 (移除 unlockable_objects 參數)
        result = await call_llm_for_chat(
            background=req.background,
            character={
                "name": req.npc_info.get("name", ""),
                "role": "NPC",
                "public_info": req.npc_info.get("description", ""),
                "secret": req.npc_info.get("secret", ""),
                "mission": req.npc_info.get("mission", "")
            },
            history=req.chat_history,
            user_text=req.text,
            model=req.model,
            temperature=req.temperature
        )

        # 解析結果並回傳
        return ChatResponse(
            dialogue=result.get("dialogue", ""),
            hint=result.get("hint"),
            evidence=result.get("evidence")
        )

    except Exception as e:
        print(f"Error in chat_with_npc: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"對話處理失敗: {str(e)}"
        )
