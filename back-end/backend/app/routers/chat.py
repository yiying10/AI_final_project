from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from ..services.llm_service import call_llm_for_chat

router = APIRouter(
    prefix="",
    tags=["chat"],
)

class PlayerInfo(BaseModel):
    name: str
    role: str
    public_info: str
    secret: str
    mission: str

class NpcInfo(BaseModel):
    name: str
    description: str

class ChatRequest(BaseModel):
    game_id: str = Field(..., description="遊戲 ID")
    player_id: str = Field(..., description="玩家 ID")
    npc_id: str = Field(..., description="NPC ID")
    text: str = Field(..., description="玩家說的話")
    model: str = Field(default="gemini-2.0-flash", description="LLM 模型名稱")
    temperature: float = Field(default=0.7, ge=0, le=1, description="隨機性控制 (0~1)")
    background: str = Field(..., description="遊戲故事背景")
    npc_info: NpcInfo = Field(..., description="NPC 資訊")
    player_info: PlayerInfo = Field(..., description="玩家角色資訊")  # 新增
    chat_history: List[Dict[str, str]] = Field(default_factory=list, description="對話歷史")

class ChatResponse(BaseModel):
    dialogue: str = Field(..., description="NPC 的完整對話回應")
    hint: Optional[str] = Field(None, description="線索提示")
    evidence: Optional[str] = Field(None, description="證據")

@router.post("/npc", response_model=ChatResponse)
async def chat_with_npc(req: ChatRequest):
    """
    與 NPC 對話的 API
    """
    try:
        print(f"=== Chat API Called ===")
        print(f"Received request: {req}")
        
        if not req.text or not req.text.strip():
            raise HTTPException(
                status_code=400,
                detail="對話內容不能為空"
            )

        # 直接使用前端傳來的玩家角色資訊
        player_info = {
            "name": req.player_info.name,
            "role": req.player_info.role,
            "public_info": req.player_info.public_info,
            "secret": req.player_info.secret,
            "mission": req.player_info.mission
        }

        # 直接使用前端傳來的 NPC 資訊
        npc_info = {
            "name": req.npc_info.name,
            "description": req.npc_info.description
        }

        print(f"玩家角色資訊: {player_info}")
        print(f"NPC 資訊: {npc_info}")

        # 呼叫 LLM 服務
        result = await call_llm_for_chat(
            background=req.background,
            player_character=player_info,
            npc_character=npc_info,
            history=req.chat_history,
            user_text=req.text,
            model=req.model,
            temperature=req.temperature
        )

        print(f"LLM result: {result}")

        response = ChatResponse(
            dialogue=result.get("dialogue", "抱歉，我現在無法回應。"),
            hint=result.get("hint"),
            evidence=result.get("evidence")
        )
        
        print(f"Returning response: {response}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in chat_with_npc: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"對話處理失敗: {str(e)}"
        )
