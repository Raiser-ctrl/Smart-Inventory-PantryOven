# Supabase Setup — PantryOven

Dokumen ini menjelaskan struktur database dan konfigurasi keamanan Supabase yang digunakan PantryOven.

## 1. Teknologi

- Supabase PostgreSQL sebagai database.
- Supabase Auth untuk autentikasi pengguna.
- Row Level Security (RLS) untuk pembatasan akses.
- Supabase RPC untuk operasi database yang terkontrol.

## 2. Struktur Database

### `profiles`
Menyimpan profil dan hak akses pengguna.

| Kolom | Keterangan |
|---|---|
| id | ID pengguna, terhubung ke `auth.users` |
| full_name | Nama lengkap |
| avatar_path | Lokasi avatar, nullable |
| role | `admin` atau `staff` |
| status | `pending`, `active`, atau `suspended` |
| created_at | Waktu pembuatan |
| updated_at | Waktu perubahan |

Relasi: `profiles.id` → `auth.users.id` dengan `ON DELETE CASCADE`.

### `items`
Menyimpan bahan baku dan produk.

| Kolom | Keterangan |
|---|---|
| id | UUID primary key |
| name | Nama item |
| category | `raw_material` atau `finished_product` |
| unit | Satuan item |
| initial_stock | Stok awal |
| minimum_stock | Batas minimum stok |
| created_at | Waktu pembuatan |
| updated_at | Waktu perubahan |
| archived_at | Waktu arsip, nullable |

Item menggunakan soft archive melalui `archived_at`, bukan penghapusan permanen dari aplikasi.

### `stock_transactions`
Menyimpan riwayat perubahan stok.

| Kolom | Keterangan |
|---|---|
| id | UUID primary key |
| item_id | Referensi ke `items.id` |
| transaction_type | `stock_in`, `stock_out`, `usage`, atau `waste` |
| quantity | Jumlah perubahan, harus lebih dari 0 |
| notes | Catatan, nullable |
| created_at | Waktu transaksi |
| idempotency_key | Kunci pencegah transaksi ganda, nullable |

Relasi: `stock_transactions.item_id` → `items.id` dengan `ON DELETE RESTRICT`.

### `item_creation_requests`
Menyimpan data idempotensi untuk permintaan pembuatan item.

| Kolom | Keterangan |
|---|---|
| idempotency_key | UUID primary key |
| request_payload | Data permintaan dalam JSONB |
| response_payload | Hasil permintaan dalam JSONB, nullable |
| created_at | Waktu pembuatan |

### `user_role_audit_logs`
Mencatat perubahan role pengguna.

| Kolom | Keterangan |
|---|---|
| id | ID log |
| actor_id | Pengguna yang melakukan perubahan |
| target_id | Pengguna yang diubah |
| old_role | Role sebelumnya |
| new_role | Role baru |
| created_at | Waktu perubahan |
| actor_name_snapshot | Nama pelaku saat perubahan |
| target_name_snapshot | Nama target saat perubahan |

Referensi pengguna menggunakan `ON DELETE SET NULL`. Snapshot nama menjaga informasi audit tetap terbaca setelah akun dihapus.

## 3. View Stok

### `inventory_current_stock`

View ini menghitung stok terkini berdasarkan stok awal dan transaksi.

Perhitungan:

`current_stock = initial_stock + stock_in - stock_out - usage - waste`

View menggunakan `security_invoker = true` dan menyertakan informasi `archived_at`.

## 4. Aturan Keamanan

RLS aktif pada kelima tabel utama:
- `profiles`
- `items`
- `stock_transactions`
- `item_creation_requests`
- `user_role_audit_logs`

Policy pada `profiles`:
- Admin aktif dapat membaca seluruh profil.
- Pengguna dapat membaca profil miliknya sendiri.

Role `anon` tidak memiliki akses tabel.
Role `authenticated` hanya memiliki hak SELECT pada `profiles`.
Operasi inventory dilakukan melalui API server menggunakan Supabase Admin client.

**Penting:** `SUPABASE_SECRET_KEY` hanya boleh digunakan di server. Jangan pernah menggunakan atau mengekspos secret key pada kode browser maupun variabel `NEXT_PUBLIC_`.

Setiap API yang menggunakan Admin client wajib memverifikasi sesi dan role pengguna terlebih dahulu.

## 5. Database Functions / RPC

| Function | Kegunaan |
|---|---|
| `create_inventory_item` | Membuat item dengan idempotensi |
| `update_inventory_item` | Memperbarui data item |
| `archive_inventory_item` | Mengarsipkan item |
| `restore_inventory_item` | Memulihkan item arsip |
| `create_stock_transaction` | Mencatat transaksi stok |
| `change_user_role` | Mengubah role dengan audit log |
| `is_active_admin` | Memeriksa status admin aktif |
| `handle_new_user` | Membuat profil saat pengguna mendaftar |
| `touch_profile_updated_at` | Memperbarui timestamp profil |
| `rls_auto_enable` | Mengaktifkan RLS otomatis pada tabel baru di schema public |

RPC inventory dibatasi untuk `service_role`.
`change_user_role` dapat dieksekusi oleh `authenticated`, tetapi fungsi memvalidasi admin aktif dan menolak perubahan yang tidak diizinkan.
Fungsi trigger dan event trigger merupakan mekanisme internal database, bukan endpoint aplikasi.

## 6. Konfigurasi Environment

Tambahkan konfigurasi berikut ke environment aplikasi:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

Gunakan nilai dari dashboard Supabase project masing-masing. Jangan memasukkan secret asli ke dokumentasi atau repository.

## 7. Catatan Deployment

1. Buat project Supabase.
2. Konfigurasikan environment variables.
3. Terapkan schema, view, functions, triggers, indexes, dan policies sesuai konfigurasi database PantryOven.
4. Pastikan seluruh tabel memiliki RLS aktif.
5. Verifikasi privilege dan RPC sebelum aplikasi digunakan.

**Catatan:** Migration lama di `supabase/migrations/` belum merepresentasikan keseluruhan schema produksi saat ini. Jangan menjalankan migration lama sebagai satu-satunya proses setup database baru. Lengkapi dan verifikasi migration sebelum deployment ke project Supabase baru.
