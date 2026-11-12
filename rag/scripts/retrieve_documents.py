
import os

# Aktifkan offline mode sebelum mengimpor library Hugging Face.
os.environ["HF_HUB_OFFLINE"] = "1"

from pathlib import Path
import sys

import chromadb
from sentence_transformers import SentenceTransformer


ROOT = Path(__file__).resolve().parents[1]
CHROMA_DIR = ROOT / "chroma_db"

COLLECTION_NAME = "pantryoven_knowledge"

MODEL_NAME = (
    "sentence-transformers/"
    "paraphrase-multilingual-MiniLM-L12-v2"
)


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

    # Memuat embedding model dari cache lokal.
    model = SentenceTransformer(
        MODEL_NAME,
        local_files_only=True,
    )

    # Menghubungkan ke vector database lokal.
    client = chromadb.PersistentClient(
        path=str(CHROMA_DIR)
    )

    collection = client.get_collection(
        name=COLLECTION_NAME
    )

    total_documents = collection.count()

    if total_documents == 0:
        return []

    # Mengubah pertanyaan menjadi embedding.
    query_embedding = model.encode(
        [query],
        normalize_embeddings=True,
        show_progress_bar=False,
    ).tolist()

    # Mencari dokumen berdasarkan cosine distance.
    results = collection.query(
        query_embeddings=query_embedding,
        n_results=min(top_k, total_documents),
        include=[
            "documents",
            "metadatas",
            "distances",
        ],
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
