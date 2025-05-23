from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from ..services.llm_service import call_llm_for_generation

router = APIRouter()

class WorldGenRequest(BaseModel):
    theme: str = Field(..., description="劇本主題，例如：豪宅謀殺")
    tone: str = Field('懸疑', description="故事風格，例如：恐怖、懸疑、幽默")
    model: str = Field('gemini-2.0-flash', description="LLM 模型名稱")

@router.post('/generate', response_model=dict)
async def generate_world(req: WorldGenRequest):
    try:
        world = await call_llm_for_generation(
            theme=req.theme,
            tone=req.tone,
            model=req.model
        )
        return world
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失敗：{e}")