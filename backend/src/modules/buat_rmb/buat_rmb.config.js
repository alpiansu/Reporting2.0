/**
 * Configuration for buat_rmb module
 */

export default {
  // Query templates
  queries: {
    store: {
      prep: [
        `DROP TABLE IF EXISTS mstrmb`,
        `CREATE TABLE IF NOT EXISTS mstrmb LIKE mstran`,
        `DROP TABLE IF EXISTS rmbcek`,
      ],
      safetyCek: `
        CREATE TABLE rmbcek 
        SELECT pr.PRDCD, IFNULL(QTY_MTR,0) AS QTY_MTR, IFNULL(QTY_MSTR,0) AS QTY_MSTR, IFNULL(QTY_MSTR_X,0) AS QTY_MSTR_X, IFNULL(QTY_MSTR,0) - IFNULL(QTY_MTR,0) + IFNULL(QTY_MSTR_X,0) AS SALDO 
          FROM prodmast pr 
          LEFT JOIN 
          (SELECT PLU, SUM(IF(RTYPE = 'J', QTY, QTY*-1)) AS QTY_MTR FROM MTRAN WHERE TANGGAL = ? GROUP BY PLU) mt ON pr.PRDCD = mt.PLU -- tanggal from file
          LEFT JOIN
          (SELECT PRDCD, SUM(QTY) AS QTY_MSTR FROM MSTRAN WHERE BUKTI_TGL RLIKE ? AND RTYPE = 'BPB' AND ISTYPE = 'RMB' GROUP BY PRDCD) ms ON pr.PRDCD = ms.PRDCD -- tanggal from file
          LEFT JOIN 
          (SELECT PRDCD, SUM(QTY) AS QTY_MSTR_X FROM MSTRAN WHERE INV_DATE RLIKE ? AND RTYPE = 'X' AND ISTYPE = 'SO' AND KETER RLIKE 'BA VIR') msx ON pr.PRDCD = msx.PRDCD -- tanggal from file
          WHERE pr.PRDCD = ? -- prdcd from file
      `,
      init: `INSERT INTO mstrmb(lokasi,rtype,bukti_no,bukti_tgl,supco,inv_date,prdcd,plu_nas,istype,bkp,sub_bkp,price,gross,ppn,qty,jam,keter)
              SELECT 
                '01', 'BPB', 
                (SELECT docno FROM const WHERE rkey = 'BPB')+1,
                COALESCE(NULLIF(?, ''), CURRENT_DATE()), -- tanggal from file
                IFNULL(pm.supco,''),
                COALESCE(NULLIF(?, ''), CURRENT_DATE()), -- tanggal from file
                ?,   -- prdcd from file
                ?,   -- prdcd from file
                'RMB',
                pm.bkp,
                pm.sub_bkp,
                pm.acost,
                pm.acost * ?,                                                          -- qty from file
                CASE WHEN CAST(tp.PPN AS CHAR) = '1' 
                  THEN pm.acost * ? * (CASE WHEN CAST(tp.PPN_RATE AS CHAR) = '1' THEN 0.11 ELSE 0 END) -- qty from file
                  ELSE 0 END,                                                          -- ppn
                ?,                                                                     -- qty from file
                CURTIME(),
                ?                                                                      -- nohp from file
              FROM prodmast pm
              LEFT JOIN supmast sm ON pm.supco = sm.supco
              LEFT JOIN toko tk ON tk.kdtk = ?                                         -- kdtk from file
              LEFT JOIN table_ppn tp 
                ON CAST(tp.TOKO_REG AS CHAR)  = IF(LEFT(tk.kdtk,1) = 'T', 'Y', 'N')
              AND CAST(tp.TOKO_PKP AS CHAR)  = IFNULL(tk.pkp, 'N')
              AND CAST(tp.SUP_PKP AS CHAR)   = IFNULL(sm.pkp, 'N')
              AND CAST(tp.PROD_BKP AS CHAR)  = IFNULL(pm.bkp, 'N')
              AND CAST(tp.REGION_BATAM AS CHAR) = 'N'                                               
              WHERE pm.prdcd = ?                                                      -- prdcd from file
              `,                                                    
      insertTran: `
        INSERT IGNORE INTO mstran SELECT * FROM mstrmb where prdcd in (SELECT a.prdcd from rmbcek a inner join mstrmb b using(prdcd) WHERE a.SALDO != 0) AND PRDCD = ?
      `,
      finalize: [
        `UPDATE const SET docno=docno+2 WHERE rkey='BPB'`,
      ],
    },
  },

  // Connection retry settings
  connectionRetry: {
    maxRetries: 3,
    retryDelay: 2000, // milliseconds
  },

  // Parallel processing configuration
  parallelProcessing: {
    concurrencyLimit: 5,
    branchConcurrencyLimit: 3,
    storeTimeoutMs: 10000, 
    queryTimeoutMs: 8000, 
  },

  taskProgressName: "rmbTask",

  /**
   * cat_cod eligible untuk RMB — satu-satunya tempat ini didefinisikan.
   * Ubah di sini jika ada penambahan/pengurangan kategori produk di masa depan.
   */
  rmbEligibleCatCodes: ["034203", "034202", "033005", "034205"],

  /**
   * Query autocomplete produk dari prodmast toko.
   * Gunakan prefix search (LIKE 'q%') sesuai spesifikasi.
   * Mengambil field merk untuk membedakan game online vs virtual/pulsa di frontend.
   */
  productSearchQuery: `
    SELECT prdcd, singkatan AS \`desc\`, IFNULL(merk,'') AS merk, cat_cod
    FROM prodmast
    WHERE cat_cod IN (?)
      AND prdcd LIKE ?
    ORDER BY prdcd ASC
    LIMIT 50
  `,
};
