
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal, cast

import joblib
import numpy as np
import pandas as pd

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sklearn.tree import DecisionTreeClassifier

# Router RAG PantryOven
from rag.rag_router import router as rag_router


# ==========================================
# CONFIGURATION
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = (
    BASE_DIR / "models" / "stock_classifier.joblib"
)

EXPECTED_FEATURES = [
    "current_stock",
    "minimum_stock",
    "average_daily_usage",
    "average_daily_waste",
    "lead_time_days",
]

StockStatus = Literal[
    "Restock",
    "Sufficient",
    "Excess",
]

VALID_STATUSES = {
    "Restock",
    "Sufficient",
    "Excess",
}

model_bundle: dict | None = None


# ==========================================
# REQUEST SCHEMA
# ==========================================

class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_stock: float = Field(
        ...,
        ge=0,
        allow_inf_nan=False,
        description="Current inventory stock",
    )

    minimum_stock: float = Field(
        ...,
        ge=0,
        allow_inf_nan=False,
        description="Minimum stock threshold",
    )

    average_daily_usage: float = Field(
        ...,
        ge=0,
        allow_inf_nan=False,
        description="Average production usage per day",
    )

    average_daily_waste: float = Field(
        ...,
        ge=0,
        allow_inf_nan=False,
        description="Average waste per day",
    )

    lead_time_days: int = Field(
        ...,
        ge=1,
        le=365,
        description="Supplier lead time in days",
    )


# ==========================================
# RESPONSE SCHEMA
# ==========================================

class PredictionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stock_status: StockStatus

    confidence: float = Field(
        ge=0,
        le=1,
    )

    probabilities: dict[str, float]

    model_type: str

    dataset_type: str


# ==========================================
# MODEL VALIDATION
# ==========================================

def validate_model_bundle(
    bundle: object,
) -> dict:
    """
    Validasi struktur model ML sebelum digunakan.
    """

    if not isinstance(bundle, dict):
        raise RuntimeError(
            "Format model bundle tidak valid."
        )

    features = bundle.get("feature_columns")

    if features != EXPECTED_FEATURES:
        raise RuntimeError(
            "Urutan fitur model tidak sesuai."
        )

    model = bundle.get("model")

    if not isinstance(
        model,
        DecisionTreeClassifier,
    ):
        raise RuntimeError(
            "Model harus berupa DecisionTreeClassifier."
        )

    if not hasattr(model, "classes_"):
        raise RuntimeError(
            "Model belum dilatih."
        )

    if not hasattr(model, "predict_proba"):
        raise RuntimeError(
            "Model tidak mendukung predict_proba."
        )

    model_classes = {
        str(label)
        for label in model.classes_
    }

    if model_classes != VALID_STATUSES:
        raise RuntimeError(
            "Kelas model tidak sesuai dengan "
            "Restock, Sufficient, dan Excess."
        )

    return bundle


# ==========================================
# FASTAPI LIFESPAN
# ==========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model_bundle

    if not MODEL_PATH.is_file():
        raise RuntimeError(
            f"Model tidak ditemukan: {MODEL_PATH}. "
            "Jalankan train_model.py terlebih dahulu."
        )

    # Hanya muat file joblib dari sumber tepercaya.
    loaded_bundle = joblib.load(MODEL_PATH)

    model_bundle = validate_model_bundle(
        loaded_bundle
    )

    print(
        "PantryOven ML model loaded successfully."
    )

    try:
        yield
    finally:
        model_bundle = None


# ==========================================
# FASTAPI APPLICATION
# ==========================================

app = FastAPI(
    title="PantryOven AI API",
    description=(
        "Machine learning inference and "
        "retrieval-augmented generation API "
        "for bakery inventory management."
    ),
    version="1.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)


# ==========================================
# REGISTER RAG ROUTER
# ==========================================

app.include_router(rag_router)


# ==========================================
# HEALTH CHECK
# ==========================================

@app.get("/health")
def health():
    return {
        "status": (
            "ok"
            if model_bundle is not None
            else "unavailable"
        ),
        "model_loaded": model_bundle is not None,
    }


# ==========================================
# ML PREDICTION ENDPOINT
# ==========================================

@app.post(
    "/predict",
    response_model=PredictionResponse,
)
def predict_stock(
    payload: PredictionRequest,
) -> PredictionResponse:

    if model_bundle is None:
        raise HTTPException(
            status_code=503,
            detail="Model belum tersedia.",
        )

    model = model_bundle["model"]

    input_data = pd.DataFrame(
        [
            {
                "current_stock": (
                    payload.current_stock
                ),
                "minimum_stock": (
                    payload.minimum_stock
                ),
                "average_daily_usage": (
                    payload.average_daily_usage
                ),
                "average_daily_waste": (
                    payload.average_daily_waste
                ),
                "lead_time_days": (
                    payload.lead_time_days
                ),
            }
        ],
        columns=EXPECTED_FEATURES,
    )

    if not np.isfinite(
        input_data.to_numpy(dtype=float)
    ).all():
        raise HTTPException(
            status_code=422,
            detail=(
                "Input mengandung angka tidak valid."
            ),
        )

    try:
        raw_prediction = model.predict(
            input_data
        )[0]

        prediction = str(raw_prediction)

        raw_probabilities = (
            model.predict_proba(input_data)[0]
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Prediksi model gagal.",
        ) from error

    # Validasi output sebelum digunakan sebagai Literal.
    if prediction not in VALID_STATUSES:
        raise HTTPException(
            status_code=500,
            detail=(
                "Model menghasilkan status "
                "tidak dikenal."
            ),
        )

    validated_prediction = cast(
        StockStatus,
        prediction,
    )

    probabilities = {
        str(label): round(
            float(probability),
            4,
        )
        for label, probability in zip(
            model.classes_,
            raw_probabilities,
        )
    }

    confidence = probabilities.get(
        validated_prediction,
        0.0,
    )

    return PredictionResponse(
        stock_status=validated_prediction,
        confidence=confidence,
        probabilities=probabilities,
        model_type=str(
            model_bundle.get(
                "model_type",
                "DecisionTreeClassifier",
            )
        ),
        dataset_type=str(
            model_bundle.get(
                "dataset_type",
                "unknown",
            )
        ),
    )
