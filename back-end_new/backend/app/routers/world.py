from fastapi import APIRouter, HTTPException
from ..utils import read_json

router = APIRouter()

@router.get("/", summary="列出所有場景")
async def list_worlds():
    return read_json()

@router.get("/{world_id}", summary="取得單一場景")
async def get_world(world_id: int):
    data = read_json()
    if 1 <= world_id <= len(data):
        return data[world_id-1]
    raise HTTPException(404, "World not found")