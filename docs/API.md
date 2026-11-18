\# API Documentation — PantryOven



Dokumentasi endpoint API aplikasi PantryOven.



\## 1. Authentication



API menggunakan Supabase Authentication.



Setiap endpoint yang membutuhkan akses pengguna memverifikasi:

\- Sesi pengguna.

\- Status akun.

\- Role pengguna (Admin atau Staff).



Request yang tidak memiliki sesi valid akan ditolak.



\## 2. Inventory API



\### GET `/api/v1/items`



Mengambil daftar item inventory.



Akses: Admin dan Staff aktif.



\### POST `/api/v1/items`



Membuat item inventory baru.



Akses: Admin dan Staff aktif.



Data utama:

\- `name`

\- `category`

\- `unit`

\- `initial\_stock`

\- `minimum\_stock`



Mendukung idempotency key untuk mencegah pembuatan item ganda.



\### PATCH `/api/v1/items/{id}`



Memperbarui informasi item.



Akses: Admin dan Staff aktif.



\### DELETE `/api/v1/items/{id}`



Mengarsipkan item, bukan menghapus permanen.



Akses: Admin aktif saja.



\### POST `/api/v1/items/{id}/restore`



Memulihkan item yang diarsipkan.



Akses: Admin aktif saja.

## 3. Stock Transaction API



\### GET `/api/v1/transactions`



Mengambil riwayat transaksi stok.



Akses: Admin dan Staff aktif.



Mendukung pencarian, filter, dan pagination.



\### POST `/api/v1/transactions`



Mencatat transaksi stok.



Akses: Admin dan Staff aktif.



Data utama:

\- `item\_id`

\- `transaction\_type`

\- `quantity`

\- `notes`

\- `idempotency\_key`



Jenis transaksi:

\- `stock\_in`

\- `stock\_out`

\- `usage`

\- `waste`



Validasi dilakukan untuk mencegah jumlah transaksi tidak valid dan stok keluar melebihi stok tersedia.



\## 4. AI API



\### POST `/api/v1/ai/chat`



Endpoint percakapan dengan Bready (Bakery Copilot).



Akses: Admin dan Staff aktif.



Fitur:

\- Menjawab pertanyaan seputar inventory.

\- Memberikan saran pengelolaan stok.

\- Mengakses pengetahuan bakery melalui RAG.

\- Mendukung pertanyaan umum terkait bakery.



Backend AI menggunakan FastAPI, Gemini, Sentence Transformers, dan ChromaDB.



\### Backend ML



| Endpoint | Kegunaan |

|---|---|

| `GET /health` | Memeriksa status backend dan model |

| `POST /predict` | Mengklasifikasikan status stok |



Prediksi menghasilkan salah satu status:

\- `Restock`

\- `Sufficient`

\- `Excess`



\## 5. HTTP Status Codes



| Status | Keterangan |

|---|---|

| 200 | Request berhasil |

| 201 | Data berhasil dibuat |

| 400 | Request tidak valid |

| 401 | Belum terautentikasi |

| 403 | Tidak memiliki izin |

| 404 | Data tidak ditemukan |

| 409 | Konflik data atau idempotensi |

| 413 | Request terlalu besar |

| 422 | Validasi input gagal |

| 429 | Terlalu banyak request |

| 502 | Backend AI bermasalah |

| 503 | Layanan sementara tidak tersedia |

| 504 | Backend mengalami timeout |



\## 6. Security



\- Validasi autentikasi dan role dilakukan pada server.

\- Request perubahan data memvalidasi Origin dan Content-Type.

\- Input divalidasi sebelum diproses.

\- Idempotency digunakan untuk mencegah operasi ganda.

\- Secret key tidak boleh dikirim ke browser.
