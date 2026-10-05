from pydantic import BaseModel, Field
from typing import Optional


class GenerateRequest(BaseModel):
    session_id: str
    scenario: str = "balanced"
    n_samples: int = Field(default=2000, ge=100, le=100000)


class AnalyzeRequest(BaseModel):
    session_id: str
    n_trees: int = Field(default=30, ge=10, le=100)
    damage_mode: str = "numeric"
    weights: Optional[dict] = None
    ling_values: Optional[dict] = None


class PreviewResponse(BaseModel):
    page: int
    page_size: int
    total: int
    columns: list
    rows: list