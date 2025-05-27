from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from ..services.llm_service import call_llm_for_chat

router = APIRouter(
    prefix="/api/games/{game_id}/players",
    tags=["chat"],
)

class UnlockableObject(BaseModel):
    id: str = Field(..., description="物件 ID")
    name: str = Field(..., description="物件名稱")
    content: Optional[str] = Field(None, description="物件內容")
    location_name: str = Field(..., description="物件所在地點名稱")

class ChatRequest(BaseModel):
    text: str = Field(..., description="玩家說的話")
    model: str = Field("gemini-2.0-flash", description="LLM 模型名稱")
    temperature: float = Field(0.7, ge=0, le=1, description="隨機性控制 (0~1)")
    unlockable_objects: List[UnlockableObject] = Field(default_factory=list, description="NPC 可解鎖的物件列表")
    
    # 新增：從前端傳來的遊戲和角色資訊
    background: str = Field(..., description="遊戲故事背景")
    npc_info: Dict[str, Any] = Field(..., description="NPC 資訊")
    chat_history: List[Dict[str, str]] = Field(default_factory=list, description="對話歷史")

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
):
    """
    與 NPC 對話的 API
    所有資料都從前端 Supabase 傳入，後端只負責調用 LLM
    """
    try:
        # 準備可解鎖物件信息
        unlockable_objects_info = []
        for obj in req.unlockable_objects:
            unlockable_objects_info.append({
                "id": obj.id,
                "name": obj.name,
                "content": obj.content,
                "location": obj.location_name
            })

        # 呼叫 LLM 服務
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
            unlockable_objects=unlockable_objects_info,
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
        raise HTTPException(
            status_code=500, 
            detail=f"對話處理失敗: {str(e)}"
        )