# backend/app/main.py

from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from .routers import world, world_gen, game

app = FastAPI(
    title="劇本殺平台 API",
    version="0.1.0"
)

# CORS (如需跨域)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 路由
app.include_router(world.router,    prefix="/api/world")
app.include_router(world_gen.router, prefix="/api/world")
app.include_router(game.router,     prefix="/api/game")

# 靜態前端目錄
# __file__ = .../backend/app/main.py
BASE_DIR   = Path(__file__).resolve().parent.parent   # -> .../backend
STATIC_DIR = BASE_DIR / "front-end"                    # -> .../backend/front-end

if not STATIC_DIR.exists():
    raise RuntimeError(f"找不到前端目錄：{STATIC_DIR}")

app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
