from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any

from ..models import (
    GameSettings,
    Scenario,
    PlayerInfo,
    CharacterScript,
    Location,
    Evidence,
    ChatMessage
)
from ..services.game_service import GameService

router = APIRouter()
service = GameService()

@router.post("/create", response_model=Scenario)
async def create_game(settings: GameSettings):
    try:
        return await service.create_game(settings)
    except Exception as e:
        raise HTTPException(500, f"建立遊戲失敗：{e}")

@router.post("/{game_code}/join", response_model=PlayerInfo)
async def join_game(game_code: str, payload: Dict[str, str]):
    try:
        return await service.join_player(game_code, payload['name'])
    except ValueError:
        raise HTTPException(404, "Game not found")
    except Exception as e:
        raise HTTPException(500, f"加入遊戲失敗：{e}")

@router.get("/{game_code}/player/{pid}/script", response_model=CharacterScript)
async def get_script(game_code: str, pid: str):
    try:
        return await service.get_script(game_code, pid)
    except ValueError:
        raise HTTPException(404, "Script not found")
    except Exception as e:
        raise HTTPException(500, f"取得劇本失敗：{e}")

@router.get("/{game_code}/map", response_model=List[Location])
async def get_map(game_code: str):
    try:
        return await service.get_map(game_code)
    except ValueError:
        raise HTTPException(404, "Game not found")
    except Exception as e:
        raise HTTPException(500, f"取得地圖失敗：{e}")

@router.get("/{game_code}/evidence", response_model=List[Evidence])
async def get_evidence(game_code: str):
    try:
        return await service.get_evidence(game_code)
    except ValueError:
        raise HTTPException(404, "Game not found")
    except Exception as e:
        raise HTTPException(500, f"取得證據失敗：{e}")

@router.post("/{game_code}/chat", response_model=Dict[str, Any], summary="玩家聊天互動")
async def chat(game_code: str, payload: ChatMessage):
    """
    接收玩家訊息並透過 LLM 回應。
    """
    try:
        result = await service.chat(game_code, payload.player_id, payload.message)
        if result is None:
            raise HTTPException(500, "聊天失敗：LLM 未回傳任何內容")
        return result
    except ValueError as e:
        raise HTTPException(404, str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"聊天失敗：{e}")

@router.get("/{game_code}/state", response_model=Dict[str, Any])
async def get_state(game_code: str):
    try:
        return await service.get_state(game_code)
    except ValueError:
        raise HTTPException(404, "Game not found")
    except Exception as e:
        raise HTTPException(500, f"取得狀態失敗：{e}")

@router.get("/{game_code}/solution", response_model=Dict[str, Any])
async def get_solution(game_code: str):
    try:
        return await service.get_solution(game_code)
    except ValueError:
        raise HTTPException(404, "Game not found")
    except Exception as e:
        raise HTTPException(500, f"取得答案失敗：{e}")
