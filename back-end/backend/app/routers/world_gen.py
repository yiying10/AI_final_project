# back-end/backend/app/routers/world_gen.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from ..services.llm_service import call_llm_for_generation
from .world import DATA  # 載入剛才 world.py 讀好的 DATA list

router = APIRouter(
    prefix="",
    tags=["world-gen"],
)

class WorldGenRequest(BaseModel):
    world_id: int = Field(..., description="場景 ID (對應 world.json 的 id)")
    crime: str = Field(..., description="犯罪類型，例如：謀殺、盜竊、綁架")
    tone: str = Field('懸疑', description="故事風格，例如：恐怖、懸疑、幽默")
    model: str = Field('gemini-2.0-flash', description="LLM 模型名稱")

@router.post("/generate", response_model=dict)
async def generate_world(req: WorldGenRequest):
    """
    1. 根據 world_id 從 DATA 拿到場景
    2. 組出 theme = "{場景名稱}中的{crime}"
    3. 用 tone/model + prompt 呼叫 LLM，回傳純 JSON
    """
    # 1. 拿場景
    world = next((w for w in DATA if w.get("id") == req.world_id), None)
    if not world:
        raise HTTPException(status_code=404, detail="World not found")

    # 2. 取得場景名稱
    #    假設 world.json 每筆若無 "scene" 欄位，就以第一個 location 的 name 當場景名
    scene_name = world.get("scene") or (world["locations"][0].get("name") if world.get("locations") else "")
    if not scene_name:
        raise HTTPException(status_code=500, detail="無法取得場景名稱")

    # 3. 組主題
    theme = f"{scene_name}中的{req.crime}"

    # 4. 建 prompt
    prompt = f"""
你是一位專業的劇本殺編劇。
主題：{theme}
風格：{req.tone}

請根據以上設定，生成完整的劇本殺遊戲場景，包含：
- 故事背景
- {req.tone} 風格的角色（4~6 位）
- {theme} 有關的npc
- 角色間的互動衝突點
- 線索與證據
- 解謎提示

最終請以純 JSON 格式回傳，結構請參考 ScenarioResponse 模型。
"""

    # 5. 呼叫 LLM
    try:
        result = await call_llm_for_generation(
            theme=theme,
            tone=req.tone,
            model=req.model,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 生成失敗：{e}")
