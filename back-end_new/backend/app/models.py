from pydantic import BaseModel, Field
from typing import List, Optional

class GameSettings(BaseModel):
    num_players: int = Field(..., ge=4, le=6)
    duration_min: int = Field(..., ge=10)
    map_count: int = Field(..., ge=1, le=3)

class PlayerInfo(BaseModel):
    player_id: str
    name: str
    role: str

class Location(BaseModel):
    id: str
    name: str
    description: str

class Evidence(BaseModel):
    id: str
    name: str
    description: str

class CharacterScript(BaseModel):
    player_id: str
    role: str
    backstory: str
    tasks: Optional[List[str]]

class Scenario(BaseModel):
    game_code: str
    background: str
    locations: List[Location]
    evidence: List[Evidence]
    scripts: List[CharacterScript]
    murderer: str
    full_story: str

class ChatMessage(BaseModel):
    player_id: str = Field(..., description="玩家 ID")
    message: str   = Field(..., description="玩家本次發送的訊息")
