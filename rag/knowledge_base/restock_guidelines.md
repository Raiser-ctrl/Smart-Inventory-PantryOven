# PantryOven Restock Guidelines

Source ID: KB-RESTOCK-001
Source type: Internal application guidelines

## Purpose
Panduan ini digunakan untuk menjelaskan rekomendasi pengadaan stok.

## Decision rules
1. Jika current stock &lt;= minimum stock, tandai item untuk evaluasi restock segera.
2. Jika prediksi ML adalah Restock, periksa kebutuhan operasional dan lead time supplier.
3. Jika prediksi ML adalah Sufficient, tetap pantau penggunaan stok.
4. Jika prediksi ML adalah Excess, evaluasi potensi stok berlebih dan risiko waste.
5. Jangan menentukan jumlah pembelian tanpa data penggunaan dan kebutuhan yang memadai.

## Lead time
Lead time adalah estimasi jumlah hari yang diperlukan sampai barang tersedia setelah dipesan.

## Data limitations
Jika riwayat penggunaan tidak tersedia atau terbatas, rekomendasi harus menyebutkan ketidakpastian tersebut.