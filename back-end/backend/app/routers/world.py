# back-end/backend/app/routers/world.py
from fastapi import APIRouter, HTTPException
import json, random
from pathlib import Path

router = APIRouter(prefix="", tags=["world"])

DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "world.json"
DATA = json.loads(DATA_PATH.read_text(encoding="utf-8"))

@router.get("/", summary="Get a random world")
def get_world():
    return random.choice(DATA)

@router.get("/{world_id}", summary="Get world by ID")
def get_world_by_id(world_id: int):
    for w in DATA:
        if w.get("id") == world_id:
            return w
    raise HTTPException(404, "World not found")
