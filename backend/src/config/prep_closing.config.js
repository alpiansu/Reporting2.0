/**
 * Configuration for Prep Closing module
 */

export default {
  // Temporary storage for WRC data
  tempStorage: {
    filePath: "data/temp/prep_closing_wrc_data.json", // Relative to project root
  },

  // Query templates for prep closing screening
  queries: {
    // WRC query template for checking saldo data
    wrcSaldo: `SELECT 
      KDTK as store_code,
      SALDO_AWAL,
      SALDO_AKHIR,
      TOTAL_PENJUALAN,
      TOTAL_PEMBELIAN,
      LAST_UPDATE
      FROM saldo_wrc 
      WHERE CAB = ? 
      AND PERIODE = ?
      ORDER BY KDTK`,

    // Store query template for checking readiness - UNION ALL format for vertical structure
    storeReadiness: `
      SELECT '{cab}' as cab, kdtk, 'bln_sls_check' as \`key\`, 
             CASE WHEN bln_sls IS NOT NULL THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN bln_sls IS NOT NULL THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT bln_sls FROM bln_akt WHERE tahun='{year}' AND bulan='{month}' AND bln_sls!='{strBlnSlsWrc}') a ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'vir_disc05_check' as \`key\`,
             CASE WHEN vir_disc05!='ON' THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN vir_disc05!='ON' THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT filter AS vir_disc05 FROM vir_bacaprod WHERE jenis='DISCOUNT_05') b ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'const_prd_check' as \`key\`,
             CASE WHEN const_prd IS NOT NULL THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN const_prd IS NOT NULL THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT docno AS const_prd FROM const WHERE rkey='PRD' AND docno!='{strPrd}') c ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'const_cpi_check' as \`key\`,
             CASE WHEN const_cpi IS NULL OR const_cpi = '0000-00-00' THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN const_cpi IS NULL OR const_cpi = '0000-00-00' THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT period as const_cpi FROM const WHERE rkey='CPI') s ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'const_brk_check' as \`key\`,
             CASE WHEN const_brk !='BA-BAIV' THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN const_brk !='BA-BAIV' THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT REPLACE(\`desc\`,',','-') AS const_brk FROM const WHERE rkey='BRK') c2 ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'tgl_initial_check' as \`key\`,
             CASE WHEN tgl_Initial IS NOT NULL THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN tgl_Initial IS NOT NULL THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT CAST(GROUP_CONCAT(DISTINCT tanggal) AS CHAR) tgl_Initial FROM initial WHERE tanggal !=CURDATE() AND recid!='C') d ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'trx_commit_check' as \`key\`,
             CASE WHEN trx_commit=1 THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN trx_commit=1 THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT @@innodb_flush_log_at_trx_commit AS trx_commit) e ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'filet_lama_check' as \`key\`,
             CASE WHEN filet_lama=0 THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN filet_lama=0 THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT COUNT(*) AS filet_lama FROM information_schema.tables WHERE table_name='{tblFilet}') f ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'filet_baru_check' as \`key\`,
             CASE WHEN filetbaru_baru=1 THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN filetbaru_baru=1 THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT COUNT(*) AS filetbaru_baru FROM information_schema.tables WHERE table_name='{tblFiletMaju}') g ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'ada_bln_akt_check' as \`key\`,
             CASE WHEN ada_bln_akt=0 THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN ada_bln_akt=0 THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT COUNT(*) ada_bln_akt FROM bln_akt WHERE tahun='{year}' AND bulan='{month}') h ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'terakhir_bln_akt_check' as \`key\`,
             CASE WHEN terakhir_bln_akt!='{strMaxBlnAktWrc}' THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN terakhir_bln_akt!='{strMaxBlnAktWrc}' THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT MAX(CONCAT(tahun,bulan)) terakhir_bln_akt FROM bln_akt) j ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'berbayar_check' as \`key\`,
             CASE WHEN berbayar NOT IN('Y','') THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN berbayar NOT IN('Y','') THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT DISTINCT berbayar FROM plastik) k ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'so_produk_khusus_check' as \`key\`,
             CASE WHEN so_produk_khusus=0 THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN so_produk_khusus=0 THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT COUNT(PLU) AS so_produk_khusus FROM so_produk_khusus) l ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'bebasppn_check' as \`key\`,
             CASE WHEN BEBASPPN_PERSUBBKP!='ON' THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN BEBASPPN_PERSUBBKP!='ON' THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT filter AS BEBASPPN_PERSUBBKP FROM vir_bacaprod WHERE jenis='BEBASPPN_PERSUBBKP') m ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'flagprodpot_check' as \`key\`,
             CASE WHEN MULAI_FLAGPRODPOT!='ON' THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN MULAI_FLAGPRODPOT!='ON' THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT filter AS MULAI_FLAGPRODPOT FROM vir_bacaprod WHERE jenis='MULAI_FLAGPRODPOT') n ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'cek_pajak_ws_check' as \`key\`,
             CASE WHEN cek_pajak_ws!='OK' THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN cek_pajak_ws!='OK' THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT IF((SELECT IFNULL(SUM(qty),0) AS jml FROM mtran WHERE tanggal RLIKE '{year}-{month}' AND sub_bkp IN('I','O'))>0 AND filter="", "NOK","OK") cek_pajak_ws FROM vir_bacaprod WHERE jenis='STS_PAJAK') p ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'saldo_qty_check' as \`key\`,
             CASE WHEN {saldoBlnQty} - saldo != 0 THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN {saldoBlnQty} - saldo != 0 THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT sum(saldo_akh) as saldo, sum(rp_sld_akh) as rp_sld FROM {tblFilet}) tbl_flt ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'saldo_rp_check' as \`key\`,
             CASE WHEN {saldoBlnRp} - rp_sld > 50 OR {saldoBlnRp} - rp_sld < -50 THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN {saldoBlnRp} - rp_sld > 50 OR {saldoBlnRp} - rp_sld < -50 THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT sum(saldo_akh) as saldo, sum(rp_sld_akh) as rp_sld FROM {tblFilet}) tbl_flt ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'period1_shi_check' as \`key\`,
             CASE WHEN period1_SHI IS NULL THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN period1_SHI IS NULL THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT period1 as period1_SHI FROM const WHERE rkey='SHI') q ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, kdtk, 'const_hih_check' as \`key\`,
             CASE WHEN const_hih IS NULL THEN 'FAIL' ELSE 'OK' END as nilai,
             CASE WHEN const_hih IS NULL THEN 0 ELSE 1 END as valid
      FROM toko LEFT JOIN 
           (SELECT rkey as const_hih FROM const WHERE rkey='HIH') r ON 1=1
      
      UNION ALL
      
      SELECT '{cab}' as cab, (SELECT kdtk FROM toko) as kdtk, 'trx_commit_check' as \`key\`,
             CASE WHEN @@innodb_flush_log_at_trx_commit=1 THEN 'NOK' ELSE 'OK' END as nilai,
             CASE WHEN @@innodb_flush_log_at_trx_commit=1 THEN 0 ELSE 1 END as valid
      
      UNION ALL
      
      SELECT '{cab}' as cab, (SELECT kdtk FROM toko) as kdtk, 'filet_lama_check' as \`key\`,
             CASE WHEN COUNT(*)=0 THEN 'NOK' ELSE 'OK' END as nilai,
             CASE WHEN COUNT(*)=0 THEN 0 ELSE 1 END as valid
      FROM information_schema.tables WHERE table_name='{tblFilet}'
      
      UNION ALL
      
      SELECT '{cab}' as cab, (SELECT kdtk FROM toko) as kdtk, 'filet_baru_check' as \`key\`,
             CASE WHEN COUNT(*)=1 THEN 'NOK' ELSE 'OK' END as nilai,
             CASE WHEN COUNT(*)=1 THEN 0 ELSE 1 END as valid
      FROM information_schema.tables WHERE table_name='{tblFiletMaju}'
      
      UNION ALL
      
      SELECT '{cab}' as cab, (SELECT kdtk FROM toko) as kdtk, 'bln_akt_check' as \`key\`,
             CASE WHEN COUNT(*)=0 THEN 'NOK' ELSE 'OK' END as nilai,
             CASE WHEN COUNT(*)=0 THEN 0 ELSE 1 END as valid
      FROM bln_akt WHERE tahun='{year}' AND bulan='{month}'
      
      UNION ALL
      
      SELECT '{cab}' as cab, (SELECT kdtk FROM toko) as kdtk, 'terakhir_bln_akt_check' as \`key\`,
             CASE WHEN MAX(CONCAT(tahun,bulan))!='{strMaxBlnAktWrc}' THEN 'NOK' ELSE 'OK' END as nilai,
             CASE WHEN MAX(CONCAT(tahun,bulan))!='{strMaxBlnAktWrc}' THEN 0 ELSE 1 END as valid
      FROM bln_akt
      
      UNION ALL
      
      SELECT '{cab}' as cab, (SELECT kdtk FROM toko) as kdtk, 'plastik_berbayar_check' as \`key\`,
             CASE WHEN berbayar NOT IN('Y','') THEN 'NOK' ELSE 'OK' END as nilai,
             CASE WHEN berbayar NOT IN('Y','') THEN 0 ELSE 1 END as valid
      FROM plastik
      
      UNION ALL
      
      SELECT '{cab}' as cab, (SELECT kdtk FROM toko) as kdtk, 'so_produk_khusus_check' as \`key\`,
             CASE WHEN COUNT(PLU)=0 THEN 'NOK' ELSE 'OK' END as nilai,
             CASE WHEN COUNT(PLU)=0 THEN 0 ELSE 1 END as valid
      FROM so_produk_khusus
      
      UNION ALL
      
      SELECT '{cab}' as cab, (SELECT kdtk FROM toko) as kdtk, 'bebasppn_persubbkp_check' as \`key\`,
             CASE WHEN filter!='ON' THEN 'NOK' ELSE 'OK' END as nilai,
             CASE WHEN filter!='ON' THEN 0 ELSE 1 END as valid
      FROM vir_bacaprod WHERE jenis='BEBASPPN_PERSUBBKP'
      
      UNION ALL
      
      SELECT '{cab}' as cab, (SELECT kdtk FROM toko) as kdtk, 'mulai_flagprodpot_check' as \`key\`,
             CASE WHEN filter!='ON' THEN 'NOK' ELSE 'OK' END as nilai,
             CASE WHEN filter!='ON' THEN 0 ELSE 1 END as valid
      FROM vir_bacaprod WHERE jenis='MULAI_FLAGPRODPOT'
      
      UNION ALL
      
      SELECT '{cab}' as cab, (SELECT kdtk FROM toko) as kdtk, 'db_backup_check' as \`key\`,
             'OK' as nilai, 1 as valid
      FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'backup'
      
      UNION ALL
      
      SELECT '{cab}' as cab, (SELECT kdtk FROM toko) as kdtk, 'cek_pajak_ws_check' as \`key\`,
             CASE WHEN (SELECT IF((SELECT IFNULL(SUM(qty),0) AS jml FROM mtran WHERE tanggal RLIKE '{year}-{month}' AND sub_bkp IN('I','O'))>0 AND filter="", "NOK","OK") FROM vir_bacaprod WHERE jenis='STS_PAJAK')!='OK' THEN 'NOK' ELSE 'OK' END as nilai,
             CASE WHEN (SELECT IF((SELECT IFNULL(SUM(qty),0) AS jml FROM mtran WHERE tanggal RLIKE '{year}-{month}' AND sub_bkp IN('I','O'))>0 AND filter="", "NOK","OK") FROM vir_bacaprod WHERE jenis='STS_PAJAK')!='OK' THEN 0 ELSE 1 END as valid
      
      UNION ALL
      
      SELECT '{cab}' as cab, (SELECT kdtk FROM toko) as kdtk, 'period1_shi_check' as \`key\`,
             CASE WHEN period1 IS NULL THEN 'NOK' ELSE 'OK' END as nilai,
             CASE WHEN period1 IS NULL THEN 0 ELSE 1 END as valid
      FROM const WHERE rkey='SHI'
      
      UNION ALL
      
      SELECT '{cab}' as cab, (SELECT kdtk FROM toko) as kdtk, 'const_hih_check' as \`key\`,
             CASE WHEN rkey IS NULL THEN 'NOK' ELSE 'OK' END as nilai,
             CASE WHEN rkey IS NULL THEN 0 ELSE 1 END as valid
      FROM const WHERE rkey='HIH'
      
      UNION ALL
      
      SELECT '{cab}' as cab, (SELECT kdtk FROM toko) as kdtk, 'saldo_qty_check' as \`key\`,
             CASE WHEN ABS('{saldoBlnQty}' - (SELECT IFNULL(sum(saldo_akh),0) FROM {tblFilet})) != 0 THEN 'NOK' ELSE 'OK' END as nilai,
             CASE WHEN ABS('{saldoBlnQty}' - (SELECT IFNULL(sum(saldo_akh),0) FROM {tblFilet})) != 0 THEN 0 ELSE 1 END as valid
      
      UNION ALL
      
      SELECT '{cab}' as cab, (SELECT kdtk FROM toko) as kdtk, 'saldo_rp_check' as \`key\`,
             CASE WHEN ABS('{saldoBlnRp}' - (SELECT IFNULL(sum(rp_sld_akh),0) FROM {tblFilet})) > 50 THEN 'NOK' ELSE 'OK' END as nilai,
             CASE WHEN ABS('{saldoBlnRp}' - (SELECT IFNULL(sum(rp_sld_akh),0) FROM {tblFilet})) > 50 THEN 0 ELSE 1 END as valid`,

    // Check if closing process can be started
    closingReadiness: `SELECT 
      (SELECT kdtk FROM toko) as store_code,
      (SELECT namtk FROM toko) as store_name,
      COUNT(DISTINCT DATE(bukti_tgl)) as active_days,
      MAX(DATE(bukti_tgl)) as last_active_date,
      CASE 
        WHEN MAX(DATE(bukti_tgl)) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN 'READY'
        ELSE 'NOT_READY'
      END as status
      FROM mstran 
      WHERE bukti_tgl RLIKE '{period}' 
      AND date(bukti_tgl) != curdate() 
      AND ISTYPE NOT IN('RMB','GGC') 
      AND QTY<>0`,
  },

  // Parameter placeholders for storeReadiness query
  queryParameters: {
    // These will be replaced in the query string
    placeholders: [
      '{cab}',        // Cabang code
      '{year}',       // Year (4 digits)
      '{month}',      // Month (2 digits)
      '{strBlnSlsWrc}', // String bulan sales WRC
      '{strPrd}',     // String periode
      '{tblFilet}',   // Table filet name
      '{tblFiletMaju}', // Table filet maju name
      '{strMaxBlnAktWrc}', // String max bulan aktif WRC
      '{saldoBlnQty}', // Saldo bulan quantity
      '{saldoBlnRp}'   // Saldo bulan rupiah
    ]
  },

  // Connection retry settings
  connectionRetry: {
    maxRetries: 3,
    retryDelay: 2000, // milliseconds
  },

  // Pagination defaults
  pagination: {
    defaultLimit: 10,
    maxLimit: 100,
  },

  // Screening thresholds
  screening: {
    // Minimum transaction count for store to be considered active
    minTransactionCount: 1,
    // Maximum days since last transaction to be considered ready
    maxDaysSinceLastTransaction: 1,
    // Minimum active days in period to be considered ready
    minActiveDays: 1,
  },

  // Parallel processing configuration
  parallelProcessing: {
    // Maximum number of stores to process concurrently
    concurrencyLimit: 5,
    // Maximum number of branches to process concurrently
    branchConcurrencyLimit: 3,
    // Timeout for individual store processing (milliseconds)
    storeTimeoutMs: 10000, // 10 seconds
    // Timeout for individual query execution (milliseconds)
    queryTimeoutMs: 8000, // 8 seconds
  },

  // Wave processing configuration
  waveProcessing: {
    maxWaves: 3,
    delayBetweenWaves: 2000, // milliseconds
  },

  // Testing configuration
  testing: {
    // Stores that will be artificially timed out for wave system testing
    simulateTimeoutStores: [],
    // Example: simulateTimeoutStores: ['0001', '0002'],
  },
};