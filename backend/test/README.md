# API Testing dengan REST Client

Folder ini berisi file-file `.rest` untuk menguji API menggunakan ekstensi [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) di Visual Studio Code.

## Cara Penggunaan

1. Pastikan ekstensi REST Client sudah terinstal di VS Code Anda
2. Buka salah satu file `.rest`
3. Klik "Send Request" yang muncul di atas setiap definisi request

## File Test yang Tersedia

### auth.rest
Berisi test untuk endpoint autentikasi (login).

### rekon_wt_harian.rest
Berisi test untuk modul rekonsiliasi WT harian, termasuk:
- Memulai proses rekonsiliasi
- Mendapatkan hasil rekonsiliasi dengan berbagai filter
- Mendapatkan ringkasan hasil rekonsiliasi
- Menghapus hasil rekonsiliasi
- Test untuk validasi input

### rekon_wt_harian.env.rest
Versi alternatif dari `rekon_wt_harian.rest` yang menggunakan variabel lingkungan untuk menyimpan token autentikasi. File ini menunjukkan cara:
1. Login untuk mendapatkan token
2. Menyimpan token dalam variabel lingkungan
3. Menggunakan token tersebut untuk request berikutnya

## Variabel Lingkungan

Beberapa file test menggunakan variabel lingkungan seperti `{{authToken}}`. Untuk menggunakan variabel ini:

1. Jalankan request login terlebih dahulu
2. Token akan otomatis disimpan dalam variabel `authToken`
3. Request berikutnya akan menggunakan token tersebut

## Catatan

- Pastikan server backend berjalan di port yang sesuai (default: 3000)
- Ganti nilai parameter seperti `cab`, `periode`, dll. sesuai dengan data yang ada di sistem Anda