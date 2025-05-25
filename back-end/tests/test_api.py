# backend/tests/test_api.py
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from jsonschema import validate


CHAT_SCHEMA = {
    "type": "object",
    "properties": {
        "dialogue": {"type": "string"},
        "hint":     {"type": "string"},
        "evidence": {"oneOf": [{"type": "null"}, {"type": "object"}]}
    },
    "required": ["dialogue", "hint", "evidence"]
}

@pytest.mark.asyncio
async def test_get_world():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/api/world/")
        assert r.status_code == 200
        data = r.json()
        assert "characters" in data and "locations" in data

@pytest.mark.asyncio
async def test_session_move_and_chat(monkeypatch):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 建 session
        r1 = await ac.post("/api/session/", json={})
        sid = r1.json()['session_id']

        # 移動位置
        r2 = await ac.post(f"/api/session/{sid}/move", json={"location":"loc01"})
        assert r2.json()['player_position'] == 'loc01'

        # Patch LLM 服務為固定回傳
        fake = {"dialogue":"你好","hint":"提示","evidence":None}
        monkeypatch.setattr(
            'backend.app.services.llm_service.call_llm_for_chat',
            lambda *args, **kwargs: fake
        )

        # 發起聊天
        r3 = await ac.post(f"/api/chat/{sid}", json={"npc":"char01","text":"你好"})
        assert r3.status_code == 200
        validate(instance=r3.json(), schema=CHAT_SCHEMA)
