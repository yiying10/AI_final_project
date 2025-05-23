from typing import List, Dict, Any, Optional
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON

class Session(SQLModel, table=True):
    id: str = Field(default=None, primary_key=True)
    player_position: str
    discovered_evidence: List[str] = Field(sa_column=Column(JSON), default_factory=list)
    chat_history: List[Dict[str, Any]] = Field(sa_column=Column(JSON), default_factory=list)