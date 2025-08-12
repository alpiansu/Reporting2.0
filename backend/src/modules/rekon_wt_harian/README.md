# Modul Rekonsiliasi WT Harian

Modul ini digunakan untuk melakukan rekonsiliasi data transaksi antara data di WRC (tabel WT_) dengan data di toko (tabel MSTRAN) per tanggal.

## Fitur

- Rekonsiliasi data transaksi antara WRC dan toko
- Pengecekan selisih nilai gross, ppn, gross_idm, dan ppn_idm
- Penyimpanan data selisih untuk analisis lebih lanjut
- Laporan ringkasan hasil rekonsiliasi

## Cara Kerja

1. Modul mengambil data dari tabel WT_ di WRC untuk periode yang ditentukan
2. Data disimpan sementara dalam file JSON untuk mengurangi penggunaan memori
3. Modul melakukan koneksi ke setiap toko dan mengambil data dari tabel MSTRAN
4. Data dari toko dibandingkan dengan data dari WRC
5. Jika ditemukan selisih, data disimpan ke dalam tabel rekon_wt_harian

## API Endpoints

### POST /api/rekon-wt-harian

Memulai proses rekonsiliasi untuk cabang dan periode tertentu.

**Request Body:**
```json
{
  "cab": "G001",
  "periode": "2507"
}
```

### GET /api/rekon-wt-harian/:cab/:periode

Mendapatkan hasil rekonsiliasi untuk cabang dan periode tertentu.

**Query Parameters:**
- `page`: Nomor halaman (default: 1)
- `limit`: Jumlah data per halaman (default: 10)
- `source`: Filter berdasarkan sumber data (WRC, STORE, BOTH)
- `tipe`: Filter berdasarkan tipe transaksi
- `toko`: Filter berdasarkan kode toko
- `tgl1`: Filter berdasarkan tanggal

### GET /api/rekon-wt-harian/:cab/:periode/summary

Mendapatkan ringkasan hasil rekonsiliasi untuk cabang dan periode tertentu.

### DELETE /api/rekon-wt-harian/:cab/:periode

Menghapus hasil rekonsiliasi untuk cabang dan periode tertentu.

## Struktur Tabel

Tabel `rekon_wt_harian` memiliki struktur sebagai berikut:

- `id`: ID record (auto-increment)
- `cab`: Kode cabang
- `periode`: Periode dalam format YYMM
- `tipe`: Tipe transaksi (NKL, BRK, PCAFE, dll)
- `toko`: Kode toko
- `shop`: Kode shop
- `tgl1`: Tanggal transaksi
- `gross_wrc`: Nilai gross dari WRC
- `ppn_wrc`: Nilai PPN dari WRC
- `gross_idm_wrc`: Nilai gross IDM dari WRC
- `ppn_idm_wrc`: Nilai PPN IDM dari WRC
- `gross_store`: Nilai gross dari toko
- `ppn_store`: Nilai PPN dari toko
- `gross_idm_store`: Nilai gross IDM dari toko
- `ppn_idm_store`: Nilai PPN IDM dari toko
- `selisih_gross`: Selisih nilai gross
- `selisih_ppn`: Selisih nilai PPN
- `selisih_gross_idm`: Selisih nilai gross IDM
- `selisih_ppn_idm`: Selisih nilai PPN IDM
- `source`: Sumber data (WRC, STORE, BOTH)
- `addtime`: Waktu penambahan data
- `updtime`: Waktu update data