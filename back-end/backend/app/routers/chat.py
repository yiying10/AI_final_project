from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session as DBSession
from ..database import get_session
from ..models import Session as SessionModel
from ..services.llm_service import call_llm_for_chat
import json, os

router = APIRouter()

class ChatRequest(BaseModel):
    npc: str = Field(..., description="NPC 的角色 ID")
    text: str = Field(..., description="玩家說的話")
    model: str = Field('gpt-4o', description="LLM 模型名稱")
    temperature: float = Field(0.7, ge=0, le=1, description="隨機性控制 (0~1)")

@router.post('/{session_id}', response_model=dict)
async def chat(
    session_id: str,
    req: ChatRequest,
    db: DBSession = Depends(get_session)
):
    # 1. 取得 session
    sess = db.get(SessionModel, session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    # 2. 讀 world.json
    base = os.path.dirname(__file__)
    path = os.path.normpath(os.path.join(base, '..', '..', 'data', 'world.json'))
    with open(path, encoding='utf-8') as f:
        world = json.load(f)
    loc = next((l for l in world['locations'] if l['id']==sess.player_position), None)
    char = next((c for c in world['characters'] if c['id']==req.npc), None)
    if not loc or not char:
        raise HTTPException(status_code=400, detail='Invalid location or NPC')

    # 3. 組裝歷史
    history = [
        {'role':'user','content':msg['text']} if msg['role']=='player'
        else {'role':'assistant','content':msg['text']}
        for msg in sess.chat_history or []
    ]

    # 4. 呼叫 LLM
    result = await call_llm_for_chat(
        char, loc, history, req.text,
        model=req.model, temperature=req.temperature
    )

    # 5. 更新 session
    sess.chat_history = sess.chat_history or []
    sess.chat_history.append({'role':'player','text':req.text})
    sess.chat_history.append({'role':'npc','text':result.get('dialogue','')})
    if result.get('evidence'):
        sess.discovered_evidence = sess.discovered_evidence or []
        sess.discovered_evidence.append(result['evidence']['id'])
    db.add(sess); db.commit(); db.refresh(sess)

    return result