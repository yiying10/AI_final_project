import os, json
import redis.asyncio as redis
from dotenv import load_dotenv

load_dotenv()
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)

async def save_session(game_code: str, session_data: dict, expire: int = 6*3600):
    key = f"session:{game_code}"
    await redis_client.set(key, json.dumps(session_data), ex=expire)

async def load_session(game_code: str) -> dict | None:
    key = f"session:{game_code}"
    data = await redis_client.get(key)
    return json.loads(data) if data else None

async def delete_session(game_code: str):
    await redis_client.delete(f"session:{game_code}")
