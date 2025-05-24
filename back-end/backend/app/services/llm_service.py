import os
import json
from fastapi import HTTPException
from typing import Any, Dict, List
from google import genai                         # 官方 SDK
from google.genai import types

from dotenv import load_dotenv
# 載入 .env
basedir = os.path.dirname(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '..', '.env'))

# 讀取金鑰
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise RuntimeError("請先在 .env 設定 GOOGLE_API_KEY")
# 建立 Gemini 客戶端
client = genai.Client(api_key=api_key)

async def call_llm_for_chat(
    char: Dict[str, Any],
    loc:  Dict[str, Any],
    history: List[Dict[str, Any]],
    user_text: str,
    model: str = "gemini-2.0-flash",
    temperature: float = 0.7
) -> Dict[str, Any]:
    """呼叫 Gemini 同步 API，再在 thread pool 中執行"""
    # A. 系統指令
    from ..utils.prompt_templates import build_system_prompt
    system_prompt = build_system_prompt(char, loc)

    # B. 組 contents：system + 歷史對話 + 最新 user
    contents = [system_prompt]
    for msg in history:
        role = "player" if msg["role"]=="user" else "assistant"
        contents.append(f"{role}: {msg['content']}")
    contents.append(f"player: {user_text}")

    # C. 設定回傳 JSON schema
    schema = {
        "type":"object",
        "properties":{
            "dialogue":{"type":"string"},
            "hint":    {"type":"string"},
            "evidence":{
                "oneOf":[
                    {"type":"object",
                     "properties":{
                         "id":{"type":"string"},
                         "name":{"type":"string"},
                         "description":{"type":"string"}},
                     "required":["id","name","description"]},
                    {"type":"null"}
                ]
            }
        },
        "required":["dialogue","hint","evidence"]
    }
    cfg = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=schema,
        temperature=temperature
    )

    # D. 在 thread pool 中呼同步 API
    import asyncio
    def _sync_call():
        return client.models.generate_content(
            model=model,
            contents=contents,
            config=cfg
        )
    resp = await asyncio.to_thread(_sync_call)

    # E. 解析回傳
    text = resp.text
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise HTTPException(502, f"解析 Gemini JSON 失敗：{e}")

async def call_llm_for_generation(
    theme: str,
    tone:  str,
    model: str = "gemini-2.0-flash"
) -> Dict[str, Any]:
    """自動生成 world.json 結構"""
    # A. 系統指令 + user prompt
    system = (
        "你是一個劇本殺世界設定生成器，"
        "請按照 characters, locations, evidence ,npc,這4個結構"
        "每個npc會有自己對應的location"
        "以純 JSON 回傳，所有文字請使用中文。"
    )
    user = f"主題：{theme}；風格：{tone}；"

    # B. 同步呼叫
    resp = client.models.generate_content(
        model=model,
        contents=[system, user],
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )
    return json.loads(resp.text)
