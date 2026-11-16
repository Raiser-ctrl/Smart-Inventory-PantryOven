
import os

# Aktifkan offline mode sebelum mengimpor library Hugging Face.
os.environ["HF_HUB_OFFLINE"] = "1"

from pathlib import Path
import sys
from threading import Lock
from time import perf_counter

import chromadb
from sentence_transformers import SentenceTransformer


ROOT = Path(__file__).resolve().parents[1]
CHROMA_DIR = ROOT / "chroma_db"

COLLECTION_NAME = "pantryoven_knowledge"

MODEL_NAME = (
    "sentence-transformers/"
    "paraphrase-multilingual-MiniLM-L12-v2"
)


_embedding_model: SentenceTransformer | None = None
_model_lock = Lock()


def _get_embedding_model() -> SentenceTransformer:
    global _embedding_model

    with _model_lock:
        if _embedding_model is None:
            started = perf_counter()
            _embedding_model = SentenceTransformer(
                MODEL_NAME,
                local_files_only=True,
            )
            print(f"[RAG] Embedding model loaded in {perf_counter() - started:.2f}s")

        return _embedding_model


def retrieve_documents(query: str, top_k: int = 3):
    """Cari dokumen Knowledge Base berdasarkan makna pertanyaan."""

    query = query.strip()

    if not query:
        raise ValueError("Pertanyaan tidak boleh kosong.")

    if not isinstance(top_k, int) or not 1 <= top_k <= 10:
        raise ValueError("top_k harus antara 1 dan 10.")

    if not CHROMA_DIR.exists():
        raise FileNotFoundError(
            "ChromaDB belum tersedia. "
            "Jalankan indexing terlebih dahulu."
        )

    started = perf_counter()
    model = _get_embedding_model()
    model_seconds = perf_counter() - started

    started = perf_counter()
    client = chromadb.PersistentClient(
        path=str(CHROMA_DIR)
    )

    collection = client.get_collection(
        name=COLLECTION_NAME
    )

    total_documents = collection.count()
    collection_seconds = perf_counter() - started

    if total_documents == 0:
        return []

    # Mengubah pertanyaan menjadi embedding.
    started = perf_counter()
    query_embedding = model.encode(
        [query],
        normalize_embeddings=True,
        show_progress_bar=False,
    ).tolist()

    embedding_seconds = perf_counter() - started

    # Mencari dokumen berdasarkan cosine distance.
    started = perf_counter()
    results = collection.query(
        query_embeddings=query_embedding,
        n_results=min(top_k, total_documents),
        include=[
            "documents",
            "metadatas",
            "distances",
        ],
    )

    search_seconds = perf_counter() - started
    print(
        f"[RAG] Retrieval timing | model={model_seconds:.3f}s "
        f"collection={collection_seconds:.3f}s "
        f"embedding={embedding_seconds:.3f}s search={search_seconds:.3f}s"
    )

    # Validasi hasil query agar aman dari nilai None.
    documents = results["documents"]
    metadatas = results["metadatas"]
    distances = results["distances"]

    if (
        documents is None
        or metadatas is None
        or distances is None
        or not documents
        or not metadatas
        or not distances
    ):
        return []

    retrieved = []

    for document, metadata, distance in zip(
        documents[0],
        metadatas[0],
        distances[0],
        strict=True,
    ):
        if metadata is None:
            continue

        source = metadata.get("source")
        source_id = metadata.get("source_id")

        if not isinstance(source, str):
            continue

        if not isinstance(source_id, str):
            continue

        if not isinstance(document, str):
            continue

        retrieved.append({
            "content": document,
            "source": source,
            "source_id": source_id,
            "distance": float(distance),
        })

    return retrieved


def main():
    question = " ".join(sys.argv[1:]).strip()

    if not question:
        question = (
            "Apa yang harus dilakukan jika "
            "stok tepung hampir habis?"
        )

    print("\n=== PantryOven RAG Retrieval ===")
    print(f"Pertanyaan: {question}\n")

    try:
        documents = retrieve_documents(question)

        if not documents:
            print("Tidak ditemukan dokumen yang relevan.")
            return

        print(f"Total hasil: {len(documents)}\n")

        for index, document in enumerate(
            documents,
            start=1,
        ):
            print(f"--- Result {index} ---")
            print(f"Source ID: {document['source_id']}")
            print(f"File: {document['source']}")
            print(
                f"Cosine distance: "
                f"{document['distance']:.4f}"
            )
            print(f"Content:\n{document['content']}\n")

    except Exception as error:
        print(
            f"Retrieval gagal: "
            f"{type(error).__name__}: {error}"
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
