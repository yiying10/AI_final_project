# back-end/backend/app/routers/chat.py

import json, os
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session as DBSession

from ..database import get_session
from ..models import Session as SessionModel
from ..services.llm_service import call_llm_for_chat

router = APIRouter(
    prefix="/api/session",
    tags=["session-chat"],
)

class ChatRequest(BaseModel):
    npc: str = Field(..., description="NPC 的角色 ID")
    text: str = Field(..., description="玩家說的話")
    model: str = Field("gpt-4o", description="LLM 模型名稱")
    temperature: float = Field(0.7, ge=0, le=1, description="隨機性控制 (0~1)")

class ChatResponse(BaseModel):
    dialogue: str = Field(..., description="NPC 的完整對話回應")
    hint: str     = Field(..., description="NPC 提供的線索提示")
    evidence: Optional[Dict[str, Any]] = Field(
        None, description="NPC 提供的新證據 (id, name, description)，若無則為 null"
    )

@router.post("/{session_id}/chat", response_model=ChatResponse)
async def chat(
    session_id: str,
    req: ChatRequest,
    db: DBSession = Depends(get_session)
):
    # 1️⃣ 取得 session
    sess = db.get(SessionModel, session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    # 2️⃣ 讀取 world.json（多場景列表）
    base = os.path.dirname(__file__)
    path = os.path.normpath(os.path.join(base, "..", "..", "data", "world.json"))
    with open(path, encoding="utf-8") as f:
        worlds = json.load(f)

    # 3️⃣ 找到包含此 player_position 的世界物件
    world = next(
        (w for w in worlds
         if any(loc["id"] == sess.player_position for loc in w.get("locations", []))),
        worlds[0]
    )

    # 4️⃣ 找 location & character
    loc  = next((l for l in world["locations"]   if l["id"] == sess.player_position), None)
    char = next((c for c in world["characters"]  if c["id"] == req.npc),           None)
    if not loc or not char:
        raise HTTPException(status_code=400, detail="Invalid location or NPC")

    # 5️⃣ 組裝歷史對話，用 LLM chat API 的格式
    history: List[Dict[str, str]] = []
    for msg in sess.chat_history or []:
        if msg["role"] == "player":
            history.append({"role": "user",      "content": msg["text"]})
        else:
            history.append({"role": "assistant", "content": msg["text"]})

    # 6️⃣ 呼叫 LLM，讓 NPC 根據場景與已有線索一步步引導
    result = await call_llm_for_chat(
        char=char,
        loc=loc,
        history=history,
        user_text=req.text,
        model=req.model,
        temperature=req.temperature
    )

    # 如果 LLM 回了一個長度為 1 的列表，拆開
    if isinstance(result, list) and len(result) == 1 and isinstance(result[0], dict):
        result = result[0]

    # 確保有這三個欄位
    dialogue = result.get("dialogue", "")
    hint     = result.get("hint", "")
    evidence = result.get("evidence", None)

    # 7️⃣ 更新 session：存對話與可能的新證據
    sess.chat_history = (sess.chat_history or []) + [
        {"role": "player", "text": req.text},
        {"role": "npc",    "text": dialogue},
    ]
    if evidence:
        sess.discovered_evidence = (sess.discovered_evidence or []) + [evidence["id"]]

    db.add(sess)
    db.commit()
    db.refresh(sess)

    # 8️⃣ 回傳包含 dialogue、hint、evidence
    return ChatResponse(dialogue=dialogue, hint=hint, evidence=evidence)
