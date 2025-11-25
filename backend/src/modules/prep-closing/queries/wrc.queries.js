/**
 * WRC (Warehouse/POS Cabang) Query Templates
 *
 * Query templates untuk mengambil data dari database WRC.
 * Menggunakan placeholder yang akan diganti saat runtime:
 * - {date}  : Periode dalam format YYMM (contoh: 2411)
 * - {month} : Bulan dalam format MM (contoh: 12)
 * - {year}  : Tahun dalam format YYYY (contoh: 2024)
 *
 * PENTING: Semua query di sini adalah untuk DATA FETCHING,
 * bukan untuk VALIDATION. Hasil query digunakan untuk populate
 * context yang kemudian digunakan oleh rule validators.
 */

export default {
  /**
   * Tarik data saldo filet dari WRC
   *
   * Purpose: Mengambil baseline data saldo untuk validasi
   * Table: kodetoko_{date} (dynamic table based on period)
   *
   * Returns:
   * - KODE_TOKO: Store code
   * - SALDO_AKH_BLN: Total saldo akhir quantity
   * - RP_SLD_AKH_BLN: Total saldo akhir dalam rupiah
   * - bln_sls: Bulan sales aktif dari bln_akt
   * - terakhir_bln_akt: Periode terakhir bulan aktif (YYYYMM)
   *
   * Used by: prep_closing.service.js -> tarikSaldoFltWrc()
   *
   * Note: Query ini akan diproses oleh wrcUtils.getWrcData()
   * yang akan handle:
   * - Replace {date} dengan periode YYMM
   * - Replace {month} dan {year} dengan nilai yang sesuai
   * - Add shop filter jika diperlukan
   * - Union multiple dates dalam 1 bulan
   */
  tarikSaldoFltWrc: `
    SELECT 
      KODE_TOKO, 
      SUM(SALDO_AKH) AS SALDO_AKH_BLN, 
      SUM(RP_SLD_AKH) AS RP_SLD_AKH_BLN, 
      bln_sls, 
      terakhir_bln_akt 
    FROM kodetoko_{period} a 
    LEFT JOIN (
      SELECT 
        (SELECT bln_sls FROM bln_akt WHERE bulan = '{month}' AND tahun = '{year}') AS bln_sls, 
        MAX(CONCAT(tahun, bulan)) AS terakhir_bln_akt 
      FROM bln_akt
    ) b ON 1=1
    GROUP BY KODE_TOKO
  `,

  /**
   * PLACEHOLDER untuk future WRC queries
   *
   * Contoh queries yang mungkin ditambahkan:
   *
   * - fetchPromoData: Query untuk ambil data promo dari WRC
   * - fetchProductMaster: Query untuk ambil master produk
   * - fetchPriceHistory: Query untuk ambil history harga
   * - fetchStockMovement: Query untuk ambil pergerakan stok
   *
   * Pattern yang sama:
   * 1. Gunakan placeholder {date}, {month}, {year}
   * 2. Return data mentah (bukan validation result)
   * 3. Dokumentasi jelas tentang purpose dan return value
   */
};
