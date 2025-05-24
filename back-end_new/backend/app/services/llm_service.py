import os, json
from fastapi import HTTPException
from typing import Any, Dict, List
from google import genai
from google.genai import types
from dotenv import load_dotenv

basedir = os.path.dirname(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '..', '.env'))
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key: raise RuntimeError("請先設置 GOOGLE_API_KEY")
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
        role = "player" if msg.get("role") == "user" else "assistant"
        contents.append(f"{role}: {msg.get('content')}")
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

async def call_llm_for_generation(theme: str, tone: str, model: str="gemini-2.0-flash"):
    system = (
        "你是一個劇本殺世界設定生成器，"
        "請按照 characters, locations, evidence, npc 四個結構，"
        "以純 JSON 回傳，中文描述。"
    )
    user = f"主題：{theme}；風格：{tone}；"
    resp = client.models.generate_content(
        model=model,
        contents=[system, user],
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )
    try:
        return json.loads(resp.text)
    except json.JSONDecodeError as e:
        raise HTTPException(502, f"解析 LLM JSON 失敗：{e}")