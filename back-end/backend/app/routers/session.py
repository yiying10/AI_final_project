from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from uuid import uuid4
from sqlmodel import Session as DBSession
from ..database import get_session
from ..models import Session as SessionModel

router = APIRouter()

class MoveRequest(BaseModel):
    location: str = Field(..., description="目標地點 ID")

@router.post('/', response_model=dict)
async def create_session(db: DBSession = Depends(get_session)):
    sid = str(uuid4())
    sess = SessionModel(id=sid, player_position='loc01')
    db.add(sess); db.commit()
    return {'session_id': sid}

@router.get('/{session_id}', response_model=SessionModel)
async def read_session(session_id: str, db: DBSession = Depends(get_session)):
    sess = db.get(SessionModel, session_id)
    if not sess:
        raise HTTPException(status_code=404, detail='Session not found')
    return sess

@router.post('/{session_id}/move', response_model=dict)
async def move(session_id: str, req: MoveRequest, db: DBSession = Depends(get_session)):
    sess = db.get(SessionModel, session_id)
    if not sess:
        raise HTTPException(status_code=404, detail='Session not found')
    sess.player_position = req.location
    db.add(sess); db.commit(); db.refresh(sess)
    return {'player_position': sess.player_position}