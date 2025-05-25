from sqlmodel import SQLModel, Field, Relationship
from typing import List, Optional
import datetime

class Game(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    background: Optional[str] = None                       # 故事背景
    characters: List["Character"] = Relationship(back_populates="game")
    npcs:       List["Npc"]       = Relationship(back_populates="game")
    players: List["Player"] = Relationship(back_populates="game")

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
    
class Npc(SQLModel, table=True):
    id:          Optional[int] = Field(default=None, primary_key=True)
    game_id:     int           = Field(foreign_key="game.id")
    name:        str
    description: str           # NPC 的簡短介紹或立場

    game: Game = Relationship(back_populates="npcs")

class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    player_id: int = Field(foreign_key="player.id")
    role: str                                            # "user" or "assistant" or "system"
    content: str
    timestamp: datetime.datetime = Field(default_factory=datetime.datetime.now)

    player: Player = Relationship(back_populates="messages")