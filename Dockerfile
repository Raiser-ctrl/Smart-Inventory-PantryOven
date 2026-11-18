
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/app/.cache/huggingface

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy backend source and required assets
COPY ml_model/ ./ml_model/
COPY rag/ ./rag/

# Remove local-only files and data
RUN rm -rf \
    /app/ml_model/.venv \
    /app/ml_model/__pycache__ \
    /app/rag/__pycache__ \
    /app/rag/chroma_db \
    /app/rag/.env

# Download embedding model during image build
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"

# Build ChromaDB index from knowledge base
RUN python -m rag.scripts.index_documents

# Start FastAPI
CMD ["sh", "-c", "uvicorn ml_model.app_ml_api:app --host 0.0.0.0 --port ${PORT:-8000}"]
