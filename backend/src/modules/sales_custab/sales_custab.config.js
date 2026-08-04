export default {
  maxPluCount: 5000,
  maxFileSize: 1 * 1024 * 1024,
  maxRangeDays: 31,

  // Timeout per query WRC (ms) — safety net agar query hang tidak menahan koneksi
  // selamanya. Nilai sengaja sangat longgar (90 menit) karena query harian bisa
  // berat (UNION ALL hingga 31 tabel × 96 kolom agregat).
  queryTimeoutMs: 5400000, // 90 menit

  ppn: {
    bebasPpnBkp: 'Y',
    bebasPpnSubBkp: 'Y',
  },

  wrc: {
    sourceName: 'wrc_dt',
    tablePrefix: 'DT_',
  },
};
