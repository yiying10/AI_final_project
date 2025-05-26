from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import List

from ..services.llm_service import (
    call_llm_for_characters,
    call_llm_for_npcs,
    call_llm_for_scenes_and_ending,
    call_llm_for_locations,
)

router = APIRouter(prefix="/world/games", tags=["world-gen"])

class WorldGenRequest(BaseModel):
    background:     str = Field(..., description="故事背景")
    num_characters: int = Field(4, ge=3, le=6, description="生成角色數量")
    num_npcs:       int = Field(3, ge=1, description="生成 NPC 數量")
    num_acts:       int = Field(2, ge=1, le=10, description="生成幕數")
    model:          str = Field("gemini-2.0-flash", description="LLM 模型名稱")
    temperature:    float = Field(0.7, ge=0, le=1, description="隨機性控制 (0~1)")

class CharacterInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:           int
    name:         str
    role:         str
    public_info:  str
    secret:       str
    mission:      str

class NpcInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:           int
    name:         str
    description:  str

class Script(BaseModel):
    character: str
    dialogue:  str

class ActInfo(BaseModel):
    act_number: int
    scripts:    List[Script]

class GameObjectInfo(BaseModel):
    id:       int
    name:     str
    lock:     bool
    clue:     str | None
    owner_id: int | None

class LocationInfo(BaseModel):
    id:      int
    name:    str
    npcs:    List[int]
    objects: List[GameObjectInfo]

class WorldGenResponse(BaseModel):
    characters: List[CharacterInfo]
    npcs:       List[NpcInfo]
    acts:       List[ActInfo]
    ending:     str
    locations:  List[LocationInfo]

@router.post("/generate_full", response_model=WorldGenResponse)
async def generate_full_content(req: WorldGenRequest):
    background = req.background

    # 生成角色
    raw_chars = await call_llm_for_characters(
        background=background,
        num_characters=req.num_characters,
        model=req.model,
        temperature=req.temperature,
    )
    for i, ch in enumerate(raw_chars):
        ch["id"] = i + 1

    # 生成 NPC
    raw_npcs = await call_llm_for_npcs(
        background=background,
        num_npcs=req.num_npcs,
        model=req.model,
        temperature=req.temperature,
    )
    for i, n in enumerate(raw_npcs):
        n["id"] = i + 1

    # 生成每一幕劇本 + 結局
    scenes, ending = await call_llm_for_scenes_and_ending(
        background=background,
        characters=[{"name": c["name"]} for c in raw_chars],
        locations=[],  # 空列表，因為沒資料庫地點
        npcs=[{"name": n["name"]} for n in raw_npcs],
        num_acts=req.num_acts,
        model=req.model,
        temperature=req.temperature,
    )

    # 生成地點與物件
    locations_data = await call_llm_for_locations(
        background=background,
        characters=[{"name": c["name"]} for c in raw_chars],
        npcs=[{"id": n["id"]} for n in raw_npcs],
        model=req.model,
        temperature=req.temperature,
    )

    # 準備回傳資料
    response_locations = []
    for i, loc_dict in enumerate(locations_data):
        objects_info = [
            GameObjectInfo(
                id=j + 1,
                name=o["name"],
                lock=o["lock"],
                clue=o.get("clue"),
                owner_id=o.get("owner_id"),
            )
            for j, o in enumerate(loc_dict["objects"])
        ]
        response_locations.append(
            LocationInfo(
                id=i + 1,
                name=loc_dict["name"],
                npcs=loc_dict["npcs"],
                objects=objects_info,
            )
        )

    return WorldGenResponse(
        characters=[CharacterInfo(**c) for c in raw_chars],
        npcs=[NpcInfo(**n) for n in raw_npcs],
        acts=scenes,
        ending=ending,
        locations=response_locations,
    )
