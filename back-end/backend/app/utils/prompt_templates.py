from typing import Dict, Any

# 定義 function-calling schema（JSON 回傳格式）
function_schema = {
    "name": "npc_response",
    "description": "以 JSON 格式回傳 NPC 的回應",
    "parameters": {
        "type": "object",
        "properties": {
            "dialogue": { "type": "string" },
            "hint":     { "type": "string" },
            "evidence": {
                "oneOf": [
                    {
                        "type": "object",
                        "properties": {
                            "id":          { "type": "string" },
                            "name":        { "type": "string" },
                            "description": { "type": "string" }
                        },
                        "required": ["id", "name", "description"]
                    },
                    { "type": "null" }
                ]
            }
        },
        "required": ["dialogue", "hint", "evidence"]
    }
}

# 建立中文的 system prompt
def build_system_prompt(char: Dict[str, Any], loc: Dict[str, Any]) -> str:
    return (
        f"你是角色「{char['name']}」（{char['role']}），\n"
        f"公開資訊：{char['public_info']}、秘密：{char['secret']}。\n"
        f"當前地點：{loc['name']}，描述：{loc.get('description','')}。\n"
        "規則：只有當玩家提到與證據(reveal_condition)相關的關鍵字時，才在 JSON 的 evidence 欄返回該證據；否則 evidence 為 null，並在 hint 欄提供提示。\n"
        "回應格式請嚴格遵守以下 JSON schema：\n"
        "{\n"
        '    "dialogue": "NPC 的回答",\n'
        '    "hint":     "提示文字",\n'
        '    "evidence": { "id":..., "name":..., "description":... } 或 null\n'
        "}"
    )