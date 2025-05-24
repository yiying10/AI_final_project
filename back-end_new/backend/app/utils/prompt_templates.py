from typing import Dict, Any

def build_system_prompt(char: Dict[str, Any], loc: Dict[str, Any]) -> str:
    return (
        f"你是一位扮演角色 {char['role']} 的玩家。\n"
        f"角色背景：{char['backstory']}\n"
        f"目前所在位置：{loc['name']}，{loc['description']}\n"
        "請根據你的角色身份回應玩家發言。"
    )