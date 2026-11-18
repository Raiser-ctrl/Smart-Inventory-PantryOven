# PantryOven — Sistem Manajemen Inventaris dan Pemantauan Stok

PantryOven adalah aplikasi berbasis web yang dirancang untuk membantu usaha bakery skala kecil dalam mengelola persediaan bahan baku, memantau kondisi stok, dan mencatat aktivitas inventaris secara lebih terstruktur.

Aplikasi ini dikembangkan menggunakan Next.js, Supabase, serta backend Python yang mengintegrasikan Machine Learning dan AI Assistant bernama **Bready**.

## Fitur Utama

- **Manajemen Inventaris** — Mengelola data bahan baku dan produk inventaris.
- **Pemantauan Stok** — Memantau jumlah persediaan dan mengidentifikasi bahan yang perlu diisi kembali.
- **Transaksi Stok** — Mencatat aktivitas stok masuk, stok keluar, penggunaan, dan bahan terbuang.
- **Status Inventaris** — Mengelompokkan kondisi stok menjadi Restock, Sufficient, dan Excess.
- **Dashboard Analitik** — Menampilkan ringkasan inventaris dan informasi kondisi stok.
- **Manajemen Hak Akses** — Memisahkan hak akses Admin dan Staff.
- **Bready AI Assistant** — Asisten AI untuk membantu menjawab pertanyaan seputar inventaris dan kebutuhan bakery.
- **Integrasi Machine Learning** — Menggunakan model Decision Tree yang dilatih secara khusus untuk klasifikasi kondisi stok.

## Teknologi yang Digunakan

### Frontend
- Next.js 16
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

### Backend
- Python
- FastAPI
- REST API

### Database dan Autentikasi
- Supabase
- PostgreSQL
- Supabase Authentication
- Row Level Security (RLS)

### Machine Learning dan AI
- Python
- Scikit-learn
- Decision Tree Classifier
- Sentence Transformers
- ChromaDB
- Google Gemini API

## Arsitektur Sistem

PantryOven menggunakan arsitektur frontend dan backend yang terpisah.

1. **Aplikasi Next.js** menangani antarmuka pengguna, proses autentikasi, dan API aplikasi.
2. **Supabase** digunakan untuk mengelola penyimpanan data PostgreSQL dan autentikasi pengguna.
3. **FastAPI** menyediakan layanan Machine Learning dan AI berbasis RAG.
4. **Model Machine Learning** melakukan klasifikasi kondisi inventaris berdasarkan fitur yang berkaitan dengan persediaan.
5. **Bready AI Assistant** menggabungkan pencarian informasi dari basis pengetahuan dengan generasi bahasa untuk memberikan jawaban yang relevan.

## Hak Akses Pengguna

| Peran | Hak Akses |
|---|---|
| Admin | Mengelola inventaris, transaksi, pengguna, dan pengaturan administratif. |
| Staff | Melihat inventaris dan mencatat transaksi stok. |

Setiap operasi administratif dilindungi melalui pemeriksaan autentikasi dan otorisasi pada sisi server.

## Struktur Proyek

Proyek PantryOven memiliki beberapa direktori utama:

- `src/` — Berisi aplikasi Next.js, halaman, komponen, dan API routes.
- `ml_model/` — Berisi model Machine Learning dan API Python.
- `rag/` — Berisi implementasi Retrieval-Augmented Generation (RAG) dan skrip pendukung.

File konfigurasi lainnya berada di direktori utama proyek.

## Persiapan dan Instalasi

### Prasyarat

Pastikan perangkat telah memiliki:

- Node.js
- npm
- Python 3
- Proyek Supabase
- Google Gemini API Key

### 1. Clone Repository

```bash
git clone https://github.com/Raiser-ctrl/Smart-Inventory-PantryOven.git
cd Smart-Inventory-PantryOven
```

### 2. Instal Dependensi Frontend

```bash
npm install
```

### 3. Konfigurasi Environment Variables

Buat file `.env.local` pada direktori utama proyek.

Isi variabel berikut sesuai konfigurasi masing-masing:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
APP_ORIGIN=
ML_API_URL=
```

Untuk backend Python, konfigurasikan variabel lingkungan yang diperlukan secara terpisah, termasuk:

```env
GEMINI_API_KEY=
GEMINI_MODEL=
```

**Penting:** Jangan pernah mengunggah API Key, secret database, atau kredensial pribadi ke repository publik.

### 4. Menjalankan Aplikasi Next.js

```bash
npm run dev
```

Buka aplikasi melalui:

```text
http://localhost:3000
```

### 5. Menjalankan Backend Python

Instal dependensi Python sesuai file konfigurasi dependensi proyek, kemudian jalankan:

```bash
python -m uvicorn ml_model.app_ml_api:app --host 127.0.0.1 --port 8000
```

Backend akan berjalan pada:

```text
http://127.0.0.1:8000
```

Pastikan konfigurasi `ML_API_URL` pada frontend mengarah ke alamat backend yang aktif.

## Pemeriksaan Production Build

Untuk memeriksa aplikasi Next.js sebelum deployment:

```bash
npm run build
```

Untuk menjalankan hasil production build secara lokal:

```bash
npm run start
```

## Keamanan Sistem

PantryOven menerapkan beberapa mekanisme keamanan, antara lain:

- Autentikasi dan otorisasi pada sisi server.
- Pembatasan hak akses berdasarkan peran Admin dan Staff.
- Row Level Security pada Supabase.
- Penggunaan kredensial Supabase dengan hak istimewa hanya pada sisi server.
- Validasi input pada API.
- Operasi inventaris melalui fungsi database yang terlindungi.
- Perlindungan idempotensi pada pembuatan inventaris dan transaksi stok.
- Pengarsipan inventaris tanpa menghilangkan referensi transaksi.
- Pencatatan audit untuk perubahan peran pengguna.

## Status Pengembangan

PantryOven merupakan proyek pengembangan sistem manajemen inventaris untuk membantu usaha bakery skala kecil dalam mengelola persediaan bahan baku.

Sistem ini dikembangkan untuk meningkatkan keteraturan pencatatan inventaris, pemantauan kondisi stok, dan pengelolaan transaksi dengan dukungan teknologi web, Machine Learning, serta AI.

## Repository

GitHub: [Smart-Inventory-PantryOven](https://github.com/Raiser-ctrl/Smart-Inventory-PantryOven)

## Lisensi

MIT License.
