from sqlmodel import SQLModel, Field, Relationship
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.types import JSON
from sqlalchemy import Column
import datetime

class Game(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    background: Optional[str] = None                       # 故事背景
    characters: List["Character"] = Relationship(back_populates="game")
    npcs:       List["Npc"]       = Relationship(back_populates="game")
    players: List["Player"] = Relationship(back_populates="game")
     # 新增：每一幕的腳本（JSON 陣列，每個元素包含 act_number, scripts）
    acts: Optional[List[Dict[str, Any]]] = Field(
        sa_column=Column(JSON), default_factory=list
    )
    # 新增：最終結局
    ending: Optional[str] = Field(default=None)
    
    # 新增：遊戲中的地點＋物件列表 (JSON 陣列)
    locations: List["Location"] = Relationship(back_populates="game")

class Character(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    game_id: int = Field(foreign_key="game.id")
    name: str
    role: str
    public_info: str
    secret: str
    mission: str
    game: "Game" = Relationship(back_populates="characters")
   
   
    
class Player(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    game_id: int = Field(foreign_key="game.id")
    user_id: str                                         # 前端的玩家識別
    character_id: Optional[int] = Field(foreign_key="character.id")
    joined_at: datetime.datetime = Field(default_factory=datetime.datetime.now)

    game: Game = Relationship(back_populates="players")
    messages: List["Message"] = Relationship(back_populates="player")
    # 新增：玩家已解鎖的物件
    unlocked_objects: List["GameObj"] = Relationship(back_populates="owner")
    


class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    player_id: int = Field(foreign_key="player.id")
    role: str                                            # "user" or "assistant" or "system"
    content: str
    timestamp: datetime.datetime = Field(default_factory=datetime.datetime.now)

    player: Player = Relationship(back_populates="messages")
    
class Location(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    game_id: int       = Field(foreign_key="game.id")
    name: str

    # 這裡關聯 NPC、Object
    game:       Game   = Relationship(back_populates="locations")
    npcs:     List["Npc"]    = Relationship(back_populates="location")
    objects:  List["GameObj"] = Relationship(back_populates="location")

class GameObj(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    location_id: int  = Field(foreign_key="location.id")
    name: str
    lock: int = Field(
        default=None, 
        description="可解鎖此物件的 NPC ID，若為 None 則表示無需解鎖"
    )
    clue: Optional[str] = None
    
     # 新增：owner_id 記錄解鎖此物件的 Player
    owner_id:     Optional[int]      = Field(
        foreign_key="player.id",
        default=None,
        description="已解鎖此物件的玩家 ID"
    )
    owner:        Optional["Player"] = Relationship(back_populates="unlocked_objects")

    location: Location = Relationship(back_populates="objects")
    
class Npc(SQLModel, table=True):
    id:          Optional[int] = Field(default=None, primary_key=True)
    game_id:     int           = Field(foreign_key="game.id")
    name:        str
    description: str           # NPC 的簡短介紹或立場

    # 新增關聯到 Location
    location_id: Optional[int] = Field(foreign_key="location.id", default=None)
    location: Optional[Location] = Relationship(back_populates="npcs")
    
    game: Game = Relationship(back_populates="npcs")
