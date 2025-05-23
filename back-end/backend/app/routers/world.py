from fastapi import APIRouter
from pydantic import BaseModel
import json, os

router = APIRouter()

class WorldRequest(BaseModel):
    # 若未來要支援更多參數，可加在這裡；目前無需 body
    pass

@router.get("/", response_model=dict)
async def get_world():
    base = os.path.dirname(__file__)
    path = os.path.normpath(os.path.join(base, '..', '..', 'data', 'world.json'))
    with open(path, encoding='utf-8') as f:
        return json.load(f)