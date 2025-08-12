/**
 * Configuration for WT reconciliation module
 */

module.exports = {
  // Temporary storage for WRC data
  tempStorage: {
    filePath: "data/temp/wrc_data.json", // Relative to project root
  },

  // Query templates
  queries: {
    // WRC query template
    wrc: `SELECT 
      CASE 
        WHEN rtype = 'X' AND ( Istype IN ('BM', 'KO', 'SG', 'SO', 'BS', 'BABKL') OR Istype = '' ) THEN 'NKL' 
        WHEN rtype = 'X' AND  Istype IN ('BA', 'BAIV')   THEN 'BRK' 
        WHEN rtype = 'X' AND Istype IN ('BAKLB','BATLJ','BASMP','BARD','BARSK','BACSP') THEN 'PCAFE' 
        WHEN rtype = 'X' AND Istype = 'BA SPL' THEN 'BASPL' 
        WHEN rtype = 'B' THEN 'BPB' 
        WHEN rtype = 'K' THEN 'NRB' 
        ELSE rtype 
      END AS TIPE, 
      TOKO, shop, date(TGL1) as TGL1, 
      ABS(SUM(CAST(GROSS AS DECIMAL(25,0)))) AS GROSS, 
      ABS(SUM(CAST(PPn AS DECIMAL(25,7)))) AS PPN, 
      ABS(SUM(CAST(Price_Idm AS DECIMAL(25,3)) * QTY)) AS GROSS_IDM, 
      ABS(SUM(CAST(PPnRp_Idm AS DECIMAL(25,3)))) AS PPN_IDM FROM wt_{date} 
      GROUP BY tipe,toko,shop,date(tgl1)`,

    // Store query template
    store: `SELECT 
      CASE 
        WHEN rtype = 'X' AND ( Istype IN ('BM', 'KO', 'SG', 'SO', 'BS', 'BABKL') OR Istype = '' ) THEN 'NKL' 
        WHEN rtype = 'X' AND  Istype IN ('BA', 'BAIV')   THEN 'BRK' 
        WHEN rtype = 'X' AND Istype IN ('BAKLB','BATLJ','BASMP','BARD','BARSK','BACSP') THEN 'PCAFE' 
        WHEN rtype = 'X' AND Istype = 'BA SPL' THEN 'BASPL' 
        WHEN rtype = 'BPB' THEN 'BPB' 
        WHEN rtype = 'K' THEN 'NRB' 
        ELSE rtype 
      END AS TIPE,IF(A.RTYPE='X' AND (A.SUPCO IS NULL OR A.SUPCO=''),(SELECT KDTK FROM TOKO),IF(A.SUPCO IS NULL OR A.SUPCO='',IF(A.GUDANG IS NULL OR A.GUDANG='',(SELECT KDTK FROM TOKO),A.GUDANG),A.SUPCO)) AS TOKO, 
      (SELECT kdtk FROM toko) AS shop,DATE(bukti_tgl) AS TGL1, 
      ABS(SUM(CAST(a.GROSS AS DECIMAL(25,0)))) AS GROSS, 
      ABS(SUM(CAST(a.PPn AS DECIMAL(25,7)))) AS PPN, 
      ABS(SUM(CAST(A.Price_Idm AS DECIMAL(25,3)) * QTY)) AS GROSS_IDM, 
      ABS(SUM(CAST(A.PPn_Rp_Idm AS DECIMAL(25,3)))) AS PPN_IDM FROM mstran A WHERE 
      bukti_tgl RLIKE '{period}' and date(bukti_tgl) != curdate() AND ISTYPE NOT IN('RMB','GGC') AND QTY<>0 
      GROUP BY tipe,toko,shop,tgl1`,
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

  // Threshold for considering values as different (to handle floating point precision issues)
  differenceThreshold: 50.01,

  // Parallel processing configuration
  parallelProcessing: {
    // Maximum number of stores to process concurrently
    concurrencyLimit: 5,
    // Maximum number of branches to process concurrently (for reconcileAllBranches)
    branchConcurrencyLimit: 3,
    // Timeout for individual store processing (milliseconds)
    storeTimeoutMs: 30000, // 30 seconds
    // Timeout for individual query execution (milliseconds)
    queryTimeoutMs: 15000, // 15 seconds
  },
};
