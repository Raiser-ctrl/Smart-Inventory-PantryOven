# Deployment Guide — PantryOven

Panduan menjalankan PantryOven dari lingkungan lokal hingga production.

## 1. Prasyarat

- Node.js dan npm
- Python 3.12
- Git
- Project Supabase
- Gemini API Key

## 2. Clone Repository

```bash
git clone https://github.com/Raiser-ctrl/Smart-Inventory-PantryOven.git
cd Smart-Inventory-PantryOven
```

## 3. Setup Next.js

```bash
npm install
```

Salin `.env.example` menjadi `.env.local`, kemudian isi:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
APP_ORIGIN=http://localhost:3000
ML_API_URL=http://127.0.0.1:8000
```

Gunakan nilai dari dashboard Supabase. Jangan membagikan secret key.

## 4. Setup Python Environment

Buat virtual environment:

```bash
python -m venv ml_model/.venv
```

Aktifkan environment di Git Bash:

```bash
source ml_model/.venv/Scripts/activate
```

Install dependency:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

## 5. Konfigurasi Gemini

Salin `rag/.env.example` menjadi `rag/.env`.

Isi konfigurasi:

```env
GEMINI_API_KEY=
GEMINI_MODEL=
```

Gunakan API key dan nama model Gemini yang tersedia pada Google AI Studio.

Jangan commit file `rag/.env` ke Git.

## 6. Persiapan Model Machine Learning

Generate dataset:

```bash
python ml_model/generate_data.py
```

Latih model:

```bash
python ml_model/train_model.py
```

Model akan disimpan di:

```text
ml_model/models/stock_classifier.joblib
```

Model wajib tersedia sebelum FastAPI dijalankan.

## 7. Persiapan RAG

Bangun vector database:

```bash
python -m rag.scripts.index_documents
```

Script membaca dokumen dari `rag/knowledge_base/`, membuat embedding menggunakan Sentence Transformers, lalu menyimpan hasilnya ke `rag/chroma_db/`.

Pastikan proses indexing berhasil sebelum menjalankan FastAPI.

## 8. Menjalankan FastAPI

Dari root repository, jalankan:

```bash id="z3b0jd"
python -m uvicorn ml_model.app_ml_api:app --host 127.0.0.1 --port 8000
```

Health check:

```text id="f3e8dh"
http://127.0.0.1:8000/health
```

Dokumentasi API:

```text id="u2gdqk"
http://127.0.0.1:8000/docs
```

Endpoint utama:
- `GET /health`
- `POST /predict`
- Endpoint RAG melalui router terintegrasi.

## 9. Menjalankan Next.js

Buka terminal baru, lalu jalankan:

```bash id="n1b5kd"
npm run dev
```

Aplikasi lokal:

```text id="f0g5oa"
http://localhost:3000
```

Untuk pengujian production:

```bash id="r6f3xy"
npm run build
npm run start
```

## 10. Deployment Production

### Supabase
- Gunakan project Supabase production.
- Terapkan schema, functions, triggers, indexes, grants, dan RLS yang sudah diverifikasi.
- Konfigurasikan environment variables.
- Lihat `SUPABASE_SETUP.md`.

Catatan: migration lama belum mencakup seluruh schema produksi saat ini. Jangan gunakan migration lama sebagai satu-satunya proses setup database baru.

### FastAPI
- Deploy backend pada layanan Python yang mendukung persistent storage.
- Siapkan model ML dan ChromaDB sebelum menerima request.
- Simpan `GEMINI_API_KEY` sebagai secret.
- Atur `ML_API_URL` agar menunjuk ke alamat FastAPI yang dapat dijangkau Next.js.
- Jangan gunakan `127.0.0.1` jika kedua layanan berjalan pada server berbeda.

### Next.js
- Deploy aplikasi pada platform yang mendukung Next.js, misalnya Vercel.
- Isi seluruh environment variables production.
- Atur `APP_ORIGIN` ke domain production.
- Pastikan koneksi ke FastAPI tersedia melalui HTTPS atau jaringan privat yang aman.

## 11. Catatan Penting

- Dataset, model ML, dan ChromaDB diabaikan oleh Git.
- Generate ulang artifact ML dan RAG pada lingkungan deployment.
- Jangan commit file `.env`, API key, atau secret key.
- `SUPABASE_SECRET_KEY` hanya digunakan di server.
- Pastikan backend tidak terekspos tanpa pembatasan jaringan atau autentikasi yang sesuai.
- Dataset ML saat ini bersifat sintetis dengan label berdasarkan aturan simulasi, bukan data historis permintaan bakery.