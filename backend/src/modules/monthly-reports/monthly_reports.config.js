/**
 * Konfigurasi Module Monthly Reports
 *
 * Mengatur perilaku export async:
 *  - export.stagingDir           : lokasi staging file hasil export (relatif backend/)
 *  - export.ttlHours             : umur maksimal file export sebelum dihapus
 *  - export.cleanupIntervalMinutes : interval pembersihan file kedaluwarsa
 *  - wrc.queryTimeoutMs          : timeout per statement WRC (mencegah query hang
 *                                  menahan koneksi pool selamanya). Nilai besar
 *                                  karena proses WRC memang lambat.
 */
export default {
  export: {
    stagingDir: "data/exports",
    ttlHours: 24,
    cleanupIntervalMinutes: 60,
  },
  wrc: {
    queryTimeoutMs: 5400000, // 90 menit per statement — hanya sebagai safety net
    // (mencegah query hang menahan koneksi pool selamanya; nilai sengaja sangat
    // longgar karena proses WRC memang lambat)
  },
};
