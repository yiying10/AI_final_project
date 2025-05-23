from fastapi import FastAPI
from .database import init_db
from .routers import world, world_gen, session, chat
import os
from dotenv import load_dotenv

# 讀取根目錄下的 .env
basedir = os.path.dirname(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '..', '.env'))

app = FastAPI()

@app.on_event('startup')
async def on_startup():
    init_db()

app.include_router(world.router,     prefix='/api/world',   tags=['world'])
app.include_router(world_gen.router, prefix='/api/world',   tags=['world-gen'])
app.include_router(session.router,   prefix='/api/session', tags=['session'])
app.include_router(chat.router,      prefix='/api/chat',    tags=['chat'])
