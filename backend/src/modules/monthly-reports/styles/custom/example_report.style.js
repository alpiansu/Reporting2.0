/**
 * Contoh Custom Style untuk satu id-reports tertentu.
 *
 * CARA PENGGUNAAN:
 *   1. Rename file ini menjadi: {id-reports-anda}.style.js
 *      Contoh: "rpt-penjualan-2024".style.js
 *   2. Edit bagian `global` dan/atau `sheets` sesuai kebutuhan
 *   3. Simpan di folder: styles/custom/
 *   4. Tidak perlu mengubah file lain — sistem mendeteksi otomatis!
 *
 * STRUKTUR:
 *   - global : override styling untuk SEMUA sheet pada laporan ini
 *   - sheets  : override styling untuk sheet TERTENTU saja (by nama sheet/key)
 *
 * Anda hanya perlu mengisi properti yang ingin di-override.
 * Properti yang tidak ada akan otomatis menggunakan nilai dari default.style.js
 */

export default {
  // ─── Override global untuk seluruh sheet laporan ini ─────────────────────────
  global: {
    // Contoh: ganti warna header dari biru ke hijau
    headerFill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF27AE60" }, // Hijau
    },
    headerFont: {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 12,
    },
    // Contoh: baris data lebih tinggi
    dataRowHeight: 20,
  },

  // ─── Override per sheet (key = nama sheet / queries-export[].key) ─────────────
  sheets: {
    // Contoh override khusus sheet "Rekap Penjualan"
    "Rekap Penjualan": {
      freezeRow: 2, // freeze 2 baris teratas (misal ada title + header)
      minColWidth: 12,
      maxColWidth: 50,
    },

    // Contoh override khusus sheet "Detail Per Toko"
    "Detail Per Toko": {
      // Header merah untuk sheet ini saja
      headerFill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE74C3C" }, // Merah
      },
      headerFont: {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 10,
      },
    },
  },
};
