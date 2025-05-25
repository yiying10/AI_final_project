import os
import json,asyncio
import re
from typing import Any, Dict, List, Tuple
from google import genai                         # 官方 SDK
from google.genai import types
from fastapi import HTTPException

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

def call_llm_for_background(
    prompt: str,
    model: str = "gemini-2.0-flash",
    temperature: float = 0.7,
    max_tokens: int = 300
) -> str:
    """
    根據前端傳入的 prompt（關鍵字或場景），呼叫 Google GenAI 生成
    劇本殺的故事背景文字，並且不做任何澄清問題。
    """
    # 完全用中文提示更貼合你的使用習慣，或依喜好切換中／英
    system_prompt = (
        "你是一個專業的劇本殺編劇，"
        "當我給你一個「場景」或「主題」，請不要再問任何澄清問題，"
        "直接生成一段生動、引人入勝的故事背景，"
        "設定場景、埋伏筆、留下玩家探索的空間。"
    )

    # 把使用者傳進來的關鍵字包成「場景：…」的格式，並指示「只回傳文字，不要格式」
    user_instruction = (
        f"場景：{prompt}\n"
        "200字以內並請確保文意通順句子完整"
        "請直接回傳純文字的劇本殺故事背景，不要包含任何其他說明或格式標籤。"
        "不要使用任何換行符號。"
    )

    resp = client.models.generate_content(
        model=model,
        contents=[system_prompt, user_instruction],
        config=types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
            candidate_count=1
        )
    )

    # resp.text 裡就是單純的回應文字
    return resp.text.strip()

async def call_llm_for_characters(
    background: str,
    num_characters: int,
    model: str = "gemini-2.0-flash",
    temperature: float = 0.7
) -> list[dict]:
    system = (
        "你是一個專業的劇本殺編劇，"
        "請根據以下故事背景，生成指定數量的角色。"
        "每個角色請以 JSON 物件回傳，包含欄位："
        "name, role, public_info, secret, mission。"
    )
    user = f"故事背景：{background}\n請生成 {num_characters} 位角色。"

    schema = {
        "type": "array",
        "items": {
            "type":"object",
            "properties":{
                "name":        {"type":"string"},
                "role":        {"type":"string"},
                "public_info": {"type":"string"},
                "secret":      {"type":"string"},
                "mission":     {"type":"string"},
            },
            "required":["name","role","public_info","secret","mission"]
        }
    }
    cfg = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=schema,
        temperature=temperature,
    )

    def _sync_call():
        return client.models.generate_content(
            model    = model,
            contents = [system, user],
            config   = cfg,
        )

    resp = await asyncio.to_thread(_sync_call)
    try:
        return json.loads(resp.text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"解析 LLM 回傳的 JSON 失敗：{e}")
    
    
async def call_llm_for_chat(
    background: str,
    character: Dict[str, Any],
    history: List[Any],  # Message ORM 或 dict
    user_text: str,
    model: str = "gemini-2.0-flash",
    temperature: float = 0.7,
    max_tokens: int = 500,
) -> Dict[str, Any]:
    """
    根據遊戲背景、角色設定及對話歷史，呼叫 Gemini 生成 NPC 回應。
    回傳包含 dialogue, hint, evidence 三個欄位。
    """
    # 1. 系統指令
    system_instruction_text = (
        f"你現在扮演劇本殺遊戲中的角色。你的角色是：{character['name']} ({character['role']})。\n"
        f"遊戲背景如下：\n{background}\n\n"
        f"角色的公開資訊：{character['public_info']}。\n"
        f"角色的秘密任務是：{character['mission']}。\n\n"
        "請完全以此角色的身份和口吻回應玩家，並嚴格以 JSON 物件格式回傳，"
        "只包含欄位 dialogue, hint, evidence。"
    )

    # 2. 構建對話內容（只放 user 和 assistant）
    gemini_contents: List[types.Content] = []
    for msg in history:
        role = getattr(msg, 'role', None) or msg.get('role')
        text = getattr(msg, 'content', None) or msg.get('content', '')
        gemini_role = 'user' if role == 'user' else 'assistant'
        gemini_contents.append(
            types.Content(parts=[types.Part(text=text)], role=gemini_role)
        )
    gemini_contents.append(
        types.Content(parts=[types.Part(text=user_text)], role='user')
    )

    # 3. 定義回傳的 JSON schema
    response_schema = types.Schema(
        type=types.Type.OBJECT,
        properties={
            'dialogue': types.Schema(type=types.Type.STRING, description="角色對話"),
            'hint':     types.Schema(type=types.Type.STRING, nullable=True, description="提示，可為 null"),
            'evidence': types.Schema(type=types.Type.STRING, nullable=True, description="證據，可為 null"),
        },
        required=['dialogue']
    )

    # 4. 配置生成參數，並將系統指令放到 system_instruction
    gen_config = types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_tokens,
        response_mime_type="application/json",
        response_schema=response_schema,
        candidate_count=1,
        system_instruction=system_instruction_text
    )

    # 5. 同步呼叫 Gemini
    def _sync_call():
        return client.models.generate_content(
            model=model,
            contents=gemini_contents,
            config=gen_config
        )

    resp = await asyncio.to_thread(_sync_call)

    # 6. 解析回傳
    text = resp.text.strip()
    try:
        data = json.loads(text)
        return {
            "dialogue": data.get("dialogue", ""),
            "hint":     data.get("hint"),
            "evidence": data.get("evidence"),
        }
    except json.JSONDecodeError:
        return {"dialogue": text, "hint": None, "evidence": None}

async def call_llm_for_npcs(
    background: str,
    num_npcs: int,
    model: str = "gemini-2.0-flash",
    temperature: float = 0.7
) -> List[dict]:
    system = (
        "你是一名劇本殺編劇，根據以下故事背景生成指定數量的 NPC 角色。"
        "請以純 JSON 陣列回傳，每個元素包含 name, description 兩個欄位。"
    )
    user = f"故事背景：{background}\\n請生成 {num_npcs} 位 NPC。"
    schema = {
        "type":"array",
        "items":{
            "type":"object",
            "properties":{
                "name":        {"type":"string"},
                "description": {"type":"string"}
            },
            "required":["name","description"]
        }
    }
    cfg = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=schema,
        temperature=temperature
    )
    def _sync_call():
        return client.models.generate_content(
            model=model,
            contents=[system, user],
            config=cfg
        )
    resp = await asyncio.to_thread(_sync_call)
    return json.loads(resp.text)

async def call_llm_for_scenes_and_ending(
    background: str,
    characters: List[Dict[str, Any]],
    num_acts: int,
    model: str = "gemini-2.0-flash",
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> Tuple[List[Dict[str, Any]], str]:
    # 1️⃣ 强调纯 JSON 输出的 system prompt
    system = (
        "你是一個專業的劇本殺編劇，"
        "請為每個角色在每一幕生成對白腳本，並最終給出一段結局文字。"
        "**務必只輸出一個完整的 JSON 物件，不能包含任何說明文字、尾逗號、代碼區塊標記或多餘的換行**。"
        "輸出格式必須符合 { acts: [...], ending: string }。"
    )
    # 2️⃣ user prompt 描述任务
    user = (
        f"故事背景：{background}\n"
        f"角色清單：{json.dumps(characters, ensure_ascii=False)}\n"
        f"請生成 {num_acts} 幕，每幕物件需包含 act_number (整數) 及 scripts (陣列)，"
        "每個 script 包含 character (字串) 及 dialogue (字串)。"
        "最後再給一個 ending (字串)。"
    )

    # 3️⃣ 定义 JSON schema
    schema = {
        "type": "object",
        "properties": {
            "acts": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "act_number": {"type": "integer"},
                        "scripts": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "character": {"type": "string"},
                                    "dialogue":  {"type": "string"}
                                },
                                "required": ["character", "dialogue"]
                            }
                        }
                    },
                    "required": ["act_number", "scripts"]
                }
            },
            "ending": {"type": "string"}
        },
        "required": ["acts", "ending"]
    }
    cfg = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=schema,
        temperature=temperature,
        max_output_tokens=max_tokens
    )

    # 4️⃣ 同步调用 Gemini
    def _sync_call():
        return client.models.generate_content(
            model=model,
            contents=[system, user],
            config=cfg
        )
    resp = await asyncio.to_thread(_sync_call)

    #print("LLM 原始回傳：", resp.text)

    raw = resp.text.strip()
    # 直接嘗試解析整段 JSON
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        # 如果真的還有多餘文字，可以做最小化的 fallback
        import re
        m = re.search(r"(\{.*\})", raw, re.S)
        if not m:
            raise RuntimeError(f"解析 JSON 失敗，原始回傳：\n{raw}") from e
        data = json.loads(m.group(1))

    # 取出 acts 與 ending 回傳
    return data["acts"], data["ending"]