
import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)

from rag.scripts.generate_summary import (
    generate_summary,
    InventoryContext,
)

from rag.scripts.bready_chat import (
    ChatRequest,
    ChatResponse,
    answer_chat,
)


# ==========================================
# LOGGING
# ==========================================

logger = logging.getLogger(__name__)


# ==========================================
# ROUTER
# ==========================================

router = APIRouter(
    prefix="/rag",
    tags=["RAG"],
)


# ==========================================
# TYPES
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
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    item_name: str = Field(
        ...,
        min_length=1,
        max_length=150,
    )

    category: str | None = Field(
        default=None,
        max_length=50,
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

    average_daily_usage: float = Field(
        ...,
        ge=0,
        allow_inf_nan=False,
    )

    average_daily_waste: float = Field(
        ...,
        ge=0,
        allow_inf_nan=False,
    )

    usage_count: int = Field(
        ...,
        ge=0,
        le=10000,
    )

    usage_days: int = Field(
        ...,
        ge=0,
        le=31,
    )

    @model_validator(mode="after")
    def validate_data_quality(self):
        """
        Memastikan kualitas data sesuai
        dengan jumlah transaksi dan hari penggunaan.
        """

        if self.usage_days > self.usage_count:
            raise ValueError(
                "Jumlah hari penggunaan tidak boleh "
                "melebihi jumlah transaksi penggunaan."
            )

        if self.usage_count == 0:
            expected_quality = "insufficient"

        elif (
            self.usage_count < 5
            or self.usage_days < 3
        ):
            expected_quality = "limited"

        else:
            expected_quality = "adequate"

        if self.data_quality != expected_quality:
            raise ValueError(
                "data_quality tidak sesuai dengan "
                "jumlah transaksi dan hari penggunaan. "
                f"Kualitas yang diharapkan: {expected_quality}."
            )

        return self


# ==========================================
# RESPONSE
# ==========================================

class RAGResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )

    summary: str = Field(
        ...,
        min_length=1,
    )


# ==========================================
# RAG GENERATION
# ==========================================

@router.post(
    "/generate",
    response_model=RAGResponse,
)
def generate_rag_summary(
    payload: RAGRequest,
) -> RAGResponse:
    """
    Generate rekomendasi inventaris berdasarkan:

    1. Data aktual inventaris.
    2. Hasil prediksi ML.
    3. Riwayat penggunaan dan waste.
    4. Knowledge base PantryOven.
    """

    inventory_context = InventoryContext(
        item_name=payload.item_name,
        category=payload.category,
        current_stock=payload.current_stock,
        minimum_stock=payload.minimum_stock,
        unit=payload.unit,
        stock_status=payload.stock_status,
        data_quality=payload.data_quality,
        lead_time_days=payload.lead_time_days,
        average_daily_usage=payload.average_daily_usage,
        average_daily_waste=payload.average_daily_waste,
        usage_count=payload.usage_count,
        usage_days=payload.usage_days,
    )

    question = (
        f"Buat rekomendasi operasional untuk "
        f"bahan {payload.item_name}. "
        "Jelaskan kondisi stok, riwayat penggunaan, "
        "dan tindakan yang sebaiknya dilakukan "
        "pengelola bakery."
    )

    try:
        logger.info(
            "Starting RAG generation | item=%s | "
            "status=%s | quality=%s | usage_count=%s",
            payload.item_name,
            payload.stock_status,
            payload.data_quality,
            payload.usage_count,
        )

        summary = generate_summary(
            question=question,
            inventory_context=inventory_context,
        )

        if not summary or not summary.strip():
            raise RuntimeError(
                "Generator menghasilkan jawaban kosong."
            )

        logger.info(
            "RAG generation completed | item=%s",
            payload.item_name,
        )

        return RAGResponse(
            summary=summary.strip(),
        )

    except Exception as error:
        logger.exception(
            "RAG generation failed | item=%s",
            payload.item_name,
        )

        raise HTTPException(
            status_code=502,
            detail="Gagal menghasilkan rekomendasi RAG.",
        ) from error


# ==========================================
# GENERAL BREADY CHAT
# ==========================================

@router.post(
    "/chat",
    response_model=ChatResponse,
)
def chat_with_bready(
    payload: ChatRequest,
) -> ChatResponse:
    """
    Chat umum Bready tetap menggunakan
    alur chatbot yang sudah tersedia.
    """

    try:
        return answer_chat(payload)

    except HTTPException:
        raise

    except Exception as error:
        logger.exception(
            "Bready chat failed."
        )

        raise HTTPException(
            status_code=502,
            detail="Bready sedang mengalami gangguan.",
        ) from error
