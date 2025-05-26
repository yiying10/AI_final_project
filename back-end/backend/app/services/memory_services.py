from typing import List, Dict, Any, Optional
from sqlmodel import Session, select, delete
import datetime

from ..models import Game, Character, Npc, Player, Message, Location, GameObj

class MemoryService:
    def __init__(self, db: Session):
        self.db = db

    def create_game(self) -> Game:
        game = Game()
        self.db.add(game)
        self.db.commit()
        self.db.refresh(game)
        return game

    def get_game(self, game_id: int) -> Optional[Game]:
        return self.db.get(Game, game_id)

    def save_background(self, game_id: int, background: Optional[str]) -> None:
        game = self.get_game(game_id)
        if game:
            game.background = background
            self.db.add(game)
            self.db.commit()

    def _clear_characters(self, game_id: int) -> None:
        self.db.exec(delete(Character).where(Character.game_id == game_id))
        self.db.commit()

    def save_characters(self, game_id: int, characters: List[Dict[str, Any]]) -> None:
        # 清除並儲存角色
        self._clear_characters(game_id)
        for ch in characters:
            self.db.add(Character(game_id=game_id, **ch))
        self.db.commit()

    def _clear_npcs(self, game_id: int) -> None:
        self.db.exec(delete(Npc).where(Npc.game_id == game_id))
        self.db.commit()

    def save_npcs(self, game_id: int, npcs: List[Dict[str, Any]]) -> None:
        # 清除並儲存 NPC
        self._clear_npcs(game_id)
        for npc_data in npcs:
            self.db.add(Npc(game_id=game_id, **npc_data))
        self.db.commit()
    def get_npcs(self, game_id: int) -> List[Npc]:
        """
        拿這場遊戲下所有 NPC
        """
        result = self.db.exec(
            select(Npc).where(Npc.game_id == game_id)
        )
        return result.all()
    
    def clear_roles(self, game_id: int) -> None:
        """
        同時清除本遊戲的角色 (Character) 與 NPC
        """
        self._clear_characters(game_id)
        self._clear_npcs(game_id)

    def _clear_players_and_messages(self, game_id: int) -> None:
        # 刪除所有玩家的訊息
        result = self.db.exec(
            select(Player.id).where(Player.game_id == game_id)
        )
        player_ids = result.all()
        if player_ids:
            self.db.exec(delete(Message).where(Message.player_id.in_(player_ids)))
        # 刪除玩家
        self.db.exec(delete(Player).where(Player.game_id == game_id))
        self.db.commit()

    def clear_game(self, game_id: int) -> None:
        """
        完整清空一場遊戲：背景、角色、NPC、玩家及對話
        """
        self.save_background(game_id, None)
        self._clear_characters(game_id)
        self._clear_npcs(game_id)
        self._clear_players_and_messages(game_id)
        self._clear_locations(game_id)

    def assign_player(self, game_id: int, user_id: str, character_id: int) -> Player:
        player = Player(game_id=game_id, user_id=user_id, character_id=character_id)
        self.db.add(player)
        self.db.commit()
        self.db.refresh(player)
        return player

    def append_message(self, player_id: int, role: str, content: str) -> None:
        msg = Message(player_id=player_id, role=role, content=content)
        self.db.add(msg)
        self.db.commit()

    def get_conversation_context(self, player_id: int, limit: int = 20) -> List[Message]:
        result = self.db.exec(
            select(Message)
            .where(Message.player_id == player_id)
            .order_by(Message.timestamp.desc())
            .limit(limit)
        )
        return result.all()[::-1]
    
    # 以下為地點與物件的處理

    def _clear_locations(self, game_id: int) -> None:
        # 先刪除所有物件，再刪除地點
        self.db.exec(delete(GameObj).where(
            GameObj.location_id.in_(
                select(Location.id).where(Location.game_id == game_id)
            )
        ))
        self.db.exec(delete(Location).where(Location.game_id == game_id))
        self.db.commit()

    def save_locations(self, game_id: int, locations: List[Dict[str, Any]]) -> None:
        self._clear_locations(game_id)
        for loc in locations:
            # 建立地點
            location = Location(game_id=game_id, name=loc["name"])
            self.db.add(location)
            self.db.commit()
            self.db.refresh(location)
            # 更新 NPC 所在地
            for npc_id in loc.get("npcs", []):
                npc = self.db.get(Npc, npc_id)
                if npc:
                    npc.location_id = location.id
                    self.db.add(npc)
            # 建立該地點物件
            for obj in loc.get("objects", []):
                game_obj = GameObj(
                    location_id=location.id,
                    name=obj.get("name"),
                    lock=obj.get("lock", False),
                    clue=obj.get("clue"),
                    owner_id=obj.get("owner_id"),
                )
                self.db.add(game_obj)
        self.db.commit()

    def get_locations(self, game_id: int) -> List[Location]:
        result = self.db.exec(
            select(Location).where(Location.game_id == game_id)
        )
        return result.all()
