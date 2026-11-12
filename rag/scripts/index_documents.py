
from pathlib import Path
import hashlib
import re

import chromadb
from sentence_transformers import SentenceTransformer


ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE_DIR = ROOT / "knowledge_base"
CHROMA_DIR = ROOT / "chroma_db"

COLLECTION_NAME = "pantryoven_knowledge"
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

# sources.md adalah katalog referensi, bukan materi retrieval.
DOCUMENTS = [
    "inventory_guidelines.md",
    "restock_guidelines.md",
    "waste_guidelines.md",
]


def split_document(content: str, max_chars: int = 900):
    paragraphs = [
        paragraph.strip()
        for paragraph in re.split(r"\n\s*\n", content)
        if paragraph.strip()
    ]

    chunks = []
    current = ""

    for paragraph in paragraphs:
        if len(paragraph) > max_chars:
            if current:
                chunks.append(current)
                current = ""

            # Hindari membuang teks yang panjang.
            for start in range(0, len(paragraph), max_chars):
                chunks.append(paragraph[start:start + max_chars])
            continue

        combined = f"{current}\n\n{paragraph}" if current else paragraph

        if len(combined) > max_chars:
            if current:
                chunks.append(current)
            current = paragraph
        else:
            current = combined

    if current:
        chunks.append(current)

    return chunks


def main():
    print("Loading embedding model...")
    model = SentenceTransformer(MODEL_NAME)

    client = chromadb.PersistentClient(path=str(CHROMA_DIR))

    # Koleksi dikhususkan untuk model embedding ini.
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={
            "hnsw:space": "cosine",
            "embedding_model": MODEL_NAME,
        },
    )

    ids = []
    documents = []
    metadatas = []

    for filename in DOCUMENTS:
        path = KNOWLEDGE_DIR / filename

        if not path.is_file():
            raise FileNotFoundError(f"Missing document: {path}")

        content = path.read_text(encoding="utf-8").strip()

        if not content:
            raise ValueError(f"Empty document: {filename}")

        source_match = re.search(
            r"Source ID:\s*(\S+)",
            content,
            flags=re.IGNORECASE,
        )

        if not source_match:
            raise ValueError(f"Missing Source ID: {filename}")

        source_id = source_match.group(1)
        chunks = split_document(content)

        for index, chunk in enumerate(chunks):
            chunk_id = hashlib.sha256(
                f"{filename}:{index}".encode("utf-8")
            ).hexdigest()

            ids.append(chunk_id)
            documents.append(chunk)
            metadatas.append({
                "source": filename,
                "source_id": source_id,
                "chunk_index": index,
            })

        print(f"Loaded {filename}: {len(chunks)} chunks")

    if not documents:
        raise ValueError("No documents available for indexing.")

    print(f"Generating embeddings for {len(documents)} chunks...")

    embeddings = model.encode(
        documents,
        normalize_embeddings=True,
        show_progress_bar=True,
    ).tolist()

    # Upsert memungkinkan indexing ulang tanpa menduplikasi ID.
    collection.upsert(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    # Bersihkan chunk lama jika dokumen berubah.
    existing = collection.get(include=[])
    stale_ids = [
        existing_id
        for existing_id in existing["ids"]
        if existing_id not in set(ids)
    ]

    if stale_ids:
        collection.delete(ids=stale_ids)

    print(f"Indexing completed: {collection.count()} chunks.")


if __name__ == "__main__":
    main()
