
import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from rag.scripts.generate_summary import generate_summary


# ==========================================
# LOGGING CONFIGURATION
# ==========================================

logger = logging.getLogger(__name__)


# ==========================================
# ROUTER CONFIGURATION
# ==========================================

router = APIRouter(
    prefix="/rag",
    tags=["RAG"],
)


# ==========================================
# TYPE DEFINITIONS
# ==========================================

StockStatus = Literal[
    "Restock",
    "Sufficient",
    "Excess",
]

DataQuality = Literal[
    "insufficient",
    "limited",
    "adequate",
]


# ==========================================
# REQUEST SCHEMA
# ==========================================

class RAGRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item_name: str = Field(
        ...,
        min_length=1,
        max_length=150,
    )

    current_stock: float = Field(
        ...,
        ge=0,
        allow_inf_nan=False,
    )

    minimum_stock: float = Field(
        ...,
        ge=0,
        allow_inf_nan=False,
    )

    unit: str = Field(
        ...,
        min_length=1,
        max_length=30,
    )

    stock_status: StockStatus

    data_quality: DataQuality

    lead_time_days: int = Field(
        ...,
        ge=1,
        le=365,
    )


# ==========================================
# RESPONSE SCHEMA
# ==========================================

class RAGResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str


# ==========================================
# RAG GENERATION ENDPOINT
# ==========================================

@router.post(
    "/generate",
    response_model=RAGResponse,
)
def generate_rag_summary(
    payload: RAGRequest,
) -> RAGResponse:
    """
    Generate rekomendasi inventory menggunakan
    Knowledge Base, ChromaDB, dan Gemini.
    """

    question = f"""
Buat rekomendasi inventory untuk item berikut.

DATA INVENTORY:
Item: {payload.item_name}
Current stock: {payload.current_stock} {payload.unit}
Minimum stock: {payload.minimum_stock} {payload.unit}
Prediksi ML: {payload.stock_status}
Kualitas data: {payload.data_quality}
Lead time: {payload.lead_time_days} hari

INSTRUKSI:
Gunakan data inventory dan Knowledge Base
PantryOven sebagai dasar rekomendasi.

Jika current stock <= minimum stock,
prioritaskan evaluasi restock.

Jika kualitas data insufficient atau limited,
jelaskan keterbatasan hasil prediksi.

Jangan mengarang jumlah pembelian,
riwayat transaksi, atau informasi supplier.

Berikan rekomendasi yang realistis.
"""

    try:
        logger.info(
            "Starting RAG generation for item: %s",
            payload.item_name,
        )

        summary = generate_summary(
            question=question,
        )

        logger.info(
            "RAG generation completed for item: %s",
            payload.item_name,
        )

        return RAGResponse(
            summary=summary,
        )

    except Exception as error:
        logger.exception(
            "RAG generation failed for item: %s",
            payload.item_name,
        )

        raise HTTPException(
            status_code=502,
            detail="Gagal menghasilkan RAG summary.",
        ) from error
