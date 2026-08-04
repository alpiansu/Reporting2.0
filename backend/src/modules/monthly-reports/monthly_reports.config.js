/**
 * Konfigurasi Module Monthly Reports
 *
 * Mengatur perilaku export async:
 *  - export.stagingDir             : lokasi staging file hasil export (relatif backend/)
 *  - export.ttlHours               : umur maksimal file export sebelum dihapus
 *  - export.cleanupIntervalMinutes : interval pembersihan file kedaluwarsa
 *  - export.maxConcurrentExports   : jumlah export yang boleh jalan paralel
 *                                    (INDEPENDEN dari pool screening/progress).
 *                                    Sisanya masuk antrian FIFO.
 *  - export.sseKeepAliveMs         : interval heartbeat SSE (mencegah proxy
 *                                    memutus koneksi yang diam).
 *  - wrc.queryTimeoutMs            : timeout per statement WRC (mencegah query hang
 *                                    menahan koneksi pool selamanya). Nilai besar
 *                                    karena proses WRC memang lambat.
 */
export default {
  export: {
    stagingDir: "data/exports",
    ttlHours: 24,
    cleanupIntervalMinutes: 60,
    maxConcurrentExports: 2, // 2 export berjalan sekaligus, sisanya antri FIFO
    sseKeepAliveMs: 15000,   // heartbeat SSE export setiap 15 detik
  },
  wrc: {
    queryTimeoutMs: 5400000, // 90 menit per statement — hanya sebagai safety net
    // (mencegah query hang menahan koneksi pool selamanya; nilai sengaja sangat
    // longgar karena proses WRC memang lambat)
  },
};
