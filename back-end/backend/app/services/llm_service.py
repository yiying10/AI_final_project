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
        "禁止出現「故事背景:」之類的標題，直接輸出內容"
        "只能用繁體中文"
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
        "所有輸出只能用繁體中文"
        """每一位角色產生一段 `public_info`，並且：
        1. **語氣**：全部使用第二人稱「你是…」開頭，例如「你是一位…」，帶入角色身份。  
        2. **內容**：包含角色的背景（身份或出身）、主要性格特質、當前動機，約 1–2 句話。 """
        "name：請**只能**填寫人物的「個人姓名」，**不要**加上任何職位、頭銜或敬稱（例如「陳院長」、「王護士長」都不行，只能寫「陳」、「王」或「陳先生」、「王女士」）。"
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
        "所有輸出只能用繁體中文"
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
    characters: Dict[str, Any],
    num_npcs: int,
    model: str = "gemini-2.0-flash",
    temperature: float = 0.7
) -> List[dict]:
    system = (
        "你是一名劇本殺編劇，根據以下故事背景生成指定數量的 NPC 角色。"
        "請以純 JSON 陣列回傳，每個元素包含 name, description 兩個欄位。"
        "所有輸出只能用繁體中文"
        "name：請**只能**填寫人物的「個人姓名」，**不要**加上任何職位、頭銜或敬稱（例如「陳院長」、「王護士長」都不行，只能寫「陳」、「王」或「陳先生」、「王女士」）。"
        f"NPC角色不可以和已生成的{characters}有重複"
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
    locations: List[Dict[str, Any]],
    npcs: List[Dict[str, Any]],
    num_acts: int,
    model: str = "gemini-2.0-flash",
    temperature: float = 0.7,
    max_tokens: int = 3000,
) -> Tuple[List[Dict[str, Any]], str]:
    # 1️⃣ 强调纯 JSON 输出的 system prompt
    names = [ch["name"] for ch in characters]
    names_str = "、".join(names)
    system = (
       f"只能用{names_str}當作角色編寫劇本"
       f"故事地點只能用：{locations}\n"
        f"故事內容融入 NPC ：{npcs}\n"
        f"兇手不能是{characters}裡的角色也不能是{npcs}"
        "只能用繁體中文"
       " 你是一個專業的劇本殺編劇："
        """
        1. 劇本結構：輸出一個 JSON 物件 {"acts":[...],"ending":string}，嚴格遵守格式，不要多餘文字或標記。
            -**所有 JSON 鍵和字串值都必須使用**雙引號 `"`** 括起來。
            -**請確保所有字串內容中的特殊字元（例如雙引號本身、換行符等）都進行** **JSON 逸出 (escaped)**。例如：`"This is a \"quote\"."` 或 `"Line1\nLine2"`。
            -**所有逗號 `,` 和括號 `[]` `{}` 都必須正確配對。**
        
        3. 解謎氛圍：
        - 每幕至少隱藏 1–2 個「關鍵線索」，以及 1 個「迷惑線索」（red herring），不要用括號或標籤標示，只要以銜接語直接寫進敘事中。
        - 線索形式可以是：書信暗號、拼圖碎片、對話暗示等，並在文本中給出簡要解謎提示。
        4. 角色動機：
        - 每個角色腳本中要包含一句「隱藏動機」，增加討論衝突，一樣不要用括號或標籤標示，只要以銜接語直接寫進敘事中。。
        5. 漸進揭露：
        - 幕與幕之間要有連貫性：第一幕揭開事件冰山一角，第二幕拼湊部分真相，第三幕提供最後兇手線索。
        6. 每幕腳本長度：
        -“dialogue” 中 **禁止** 出现“我是李明”之類的自我介紹句子；請直接以角色的語氣進入對話。
        - 每個角色在每幕的專屬劇本 100–200 字，保證足夠細節。
        7. 嵌入謎題：
        - 部分線索請以「謎題」形式出現（例如：『密碼是屋頂牌匾上的三個字母』），讓玩家必須解題才能進入下一步。
        """
    )
    # 2️⃣ user prompt 描述任务
    user = (
        f"故事背景：{background}\n"
        f"角色清單（必須依此順序輸出）：{json.dumps([c['name'] for c in characters], ensure_ascii=False)}\n"
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
                                    "character": {
                                        "type":"string",
                                        "enum": [ c["name"] for c in characters ]   # 只允許角色清單裡的名字
                                    },
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

async def call_llm_for_locations(
    background: str,
    characters: List[Dict[str, Any]],
    npcs: List[Dict[str, Any]],
    model: str = "gemini-2.0-flash",
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> List[Dict[str, Any]]:
    """
    產生遊戲裡的地點列表，每個地點包含：
    - id:   地點唯一識別 (整數)
    - name: 地點名稱
    - npcs: 該地點的 NPC id 清單
    - objects: 該地點可互動的物件 (name, lock, clue)
    """
    system = (
        "你是一個專業的劇本殺編劇，"
        "請根據故事背景、角色列表和 NPC 列表，生成遊戲中所有的「地點」。"
        "每個地點要包含四個欄位："
        " 1) id (整數，地點識別，從 1 開始)、"
        " 2) name (地點名稱)、"
        " 3) npcs (整數陣列，對應 NPC 的 id)、"
        " 4) objects (物件陣列，每個物件要有 id, name, lock(boolean), clue(string或null), owner_id(integer, 預設為null))。"
        "務必只回傳純 JSON 陣列，不要多任何說明文字。"
        "只能用繁體中文"
    )
    user = (
        f"故事背景：{background}\n"
        f"角色列表：{json.dumps(characters, ensure_ascii=False)}\n"
        f"NPC 列表：{json.dumps(npcs, ensure_ascii=False)}"
    )

    schema = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "id":      {"type": "integer"},
                "name":    {"type": "string"},
                "npcs":    {"type": "array", "items": {"type": "integer"}},
                "objects": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id":   {"type": "integer"},
                            "name": {"type": "string"},
                            "lock": {"type": "boolean"},
                            "clue": {"type": "string", "nullable": True},
                            "owner_id": {"type": "integer", "nullable": True, "description": "已解鎖此物件的玩家 ID"}
                        },
                        "required": ["id","name", "lock"]
                    }
                }
            },
            "required": ["id", "name", "npcs", "objects"]
        }
    }

    cfg = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=schema,
        temperature=temperature,
        max_output_tokens=max_tokens
    )

    def _sync_call():
        return client.models.generate_content(
            model=model,
            contents=[system, user],
            config=cfg
        )

    resp = await asyncio.to_thread(_sync_call)
    try:
        return json.loads(resp.text)
    except json.JSONDecodeError as e:
        # 如果 LLM 偶爾多出雜訊，再用最簡正則擷取
        m = re.search(r"(\[.*\])", resp.text, re.S)
        if not m:
            raise RuntimeError(f"解析地點 JSON 失敗\n原始回傳：{resp.text}") from e
        return json.loads(m.group(1))