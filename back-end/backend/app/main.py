from fastapi import FastAPI
from .database import init_db
from .routers import world, world_gen, chat,players,npcs
import os
from dotenv import load_dotenv
from sqlalchemy import text

from fastapi.middleware.cors import CORSMiddleware

# 讀取根目錄下的 .env
basedir = os.path.dirname(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '..', '.env'))

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 或 ["*"]，若你測試階段可開放所有
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event('startup')
async def on_startup():
    init_db()

app.include_router(world.router,     prefix='/api/world',   tags=['world'])
app.include_router(world_gen.router, prefix='/api/world',   tags=['world-gen'])
app.include_router(chat.router,      prefix='/api/chat',    tags=['chat'])
app.include_router(players.router,    prefix="/api",       tags=["players"]) 
app.include_router(npcs.router, prefix="/api",    tags=["npcs"])  

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 或 ["http://localhost:3000", "http://127.0.0.1:3000"] 視需求而定
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)