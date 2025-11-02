/**
 * Configuration for rekon_virtual module
 */
export default {
  // Query templates
  queries: {
    // WRC query template
    wrc: ``,

    // Store query template
    // store: `SELECT (SELECT KIRIM FROM toko) AS CABANG, (SELECT KDTK FROM toko) AS SHOP, TANGGAL, PRDCD, SINGKATAN, ACOST, PRICE, QTY_MSTRAN, QTY_MTRAN, QTY_MSTRAN - QTY_MTRAN AS SEL, NOW() AS LASTCATCH FROM (
    // 		SELECT i.tanggal, p.prdcd, p.singkatan, p.acost, p.price, IFNULL(ms.qty_mstran,0) AS qty_mstran, IFNULL(m.qty_mtran,0) AS qty_mtran FROM
    // 			(SELECT DISTINCT tanggal FROM initial) i
    // 			INNER JOIN prodmast p
    // 				ON p.kons = 'K' AND p.cat_cod IN ('034203','034202') AND p.SUPCO IS NOT NULL
    // 			LEFT JOIN (SELECT tanggal, plu, SUM(IF(RTYPE='J', QTY, QTY*-1)) AS QTY_MTRAN FROM MTRAN GROUP BY tanggal, plu ) m
    // 				ON i.tanggal = m.tanggal AND m.plu = p.prdcd
    // 			LEFT JOIN (SELECT DATE(bukti_tgl) AS tgl_ms, prdcd, SUM(qty) AS qty_mstran FROM mstran WHERE rtype='BPB' GROUP BY DATE(bukti_tgl), prdcd) ms
    // 				ON i.tanggal = DATE(ms.tgl_ms) AND ms.prdcd = p.prdcd
    // 		WHERE MONTH(i.tanggal)=? AND YEAR(i.tanggal)=? AND (m.tanggal IS NOT NULL OR ms.tgl_ms IS NOT NULL )
    // 	) AS SEL_ERELOAD WHERE TANGGAL < CURDATE() AND (QTY_MSTRAN - QTY_MTRAN) != 0`,

    store: `SELECT KIRIM as CABANG, SHOP, TANGGAL, PRDCD, SINGKATAN, ACOST, PRICE, MS_QTY AS QTY_MSTRAN, MT_QTY AS QTY_MTRAN, SEL, NOW() AS LASTCATCH FROM (
          SELECT KIRIM, KDTK AS SHOP, TANGGAL, PRDCD, MS_QTY, MT_QTY, MS_QTY - MT_QTY AS SEL FROM (
            SELECT M.TANGGAL, M.PRDCD, MT.STATION, MT.SHIFT, MT.DOCNO, MT.ADDTIME, SUM(IFNULL(IF(MT.RTYPE='J',MT.QTY,MT.QTY*-1),0)) AS MT_QTY FROM
            (
            SELECT TANGGAL, PRDCD FROM (
            SELECT DISTINCT DATE(TANGGAL) AS TANGGAL, PLU AS PRDCD FROM mtran WHERE plu IN (SELECT prdcd FROM prodmast p WHERE p.kons = 'K' AND p.cat_cod IN ('034203','034202') AND p.SUPCO IS NOT NULL) AND tanggal RLIKE ? AND TANGGAL < CURDATE() UNION ALL
            SELECT DISTINCT DATE(BUKTI_TGL) AS TANGGAL, PRDCD FROM mstran WHERE prdcd IN (SELECT prdcd FROM prodmast p WHERE p.kons = 'K' AND p.cat_cod IN ('034203','034202') AND p.SUPCO IS NOT NULL) AND bukti_tgl RLIKE ? AND DATE(BUKTI_TGL) < CURDATE()
            ) AS CEK GROUP BY TANGGAL, PRDCD
            ) AS M LEFT JOIN MTRAN MT ON M.PRDCD = MT.PLU AND M.TANGGAL = MT.TANGGAL 
            GROUP BY M.TANGGAL, M.PRDCD ORDER BY MT.TANGGAL, MT.ADDTIME
          ) AS MTRAN LEFT JOIN (
            SELECT M.TANGGAL, M.PRDCD, MS.RTYPE, MS.BUKTI_TGL, MS.INVNO, MS.ADDTIME, SUM(IFNULL(QTY,0)) AS MS_QTY FROM
            (
            SELECT TANGGAL, PRDCD FROM (
            SELECT DISTINCT DATE(TANGGAL) AS TANGGAL, PLU AS PRDCD FROM mtran WHERE plu IN (SELECT prdcd FROM prodmast p WHERE p.kons = 'K' AND p.cat_cod IN ('034203','034202') AND p.SUPCO IS NOT NULL) AND tanggal RLIKE ? AND TANGGAL < CURDATE() UNION ALL
            SELECT DISTINCT DATE(BUKTI_TGL) AS TANGGAL, PRDCD FROM mstran WHERE prdcd IN (SELECT prdcd FROM prodmast p WHERE p.kons = 'K' AND p.cat_cod IN ('034203','034202') AND p.SUPCO IS NOT NULL) AND bukti_tgl RLIKE ? AND DATE(BUKTI_TGL) < CURDATE()
            ) AS CEK GROUP BY TANGGAL, PRDCD
            ) AS M LEFT JOIN MSTRAN MS ON M.PRDCD = MS.PRDCD AND M.TANGGAL = LEFT(MS.BUKTI_TGL,10) AND MS.RTYPE = 'BPB'
            GROUP BY M.TANGGAL, M.PRDCD ORDER BY MS.BUKTI_TGL, MS.ADDTIME
          ) AS MSTRAN USING(PRDCD,TANGGAL) LEFT JOIN 
          TOKO T ON 1=1 HAVING SEL != 0
        ) AS DT LEFT JOIN PRODMAST P USING(PRDCD);`,
  },

  // Connection retry settings
  connectionRetry: {
    maxRetries: 2,
    retryDelay: 3000, // milliseconds
  },

  // Parallel processing configuration
  parallelProcessing: {
    // Maximum number of stores to process concurrently
    concurrencyLimit: 10,
    // Maximum number of branches to process concurrently (for reconcileAllBranches)
    branchConcurrencyLimit: 3,
    // Timeout for individual store processing (milliseconds)
    storeTimeoutMs: 10000, // 10 seconds - reduced for better timeout testing
    // Timeout for individual query execution (milliseconds)
    queryTimeoutMs: 8000, // 8 seconds - reduced for better timeout testing
  },

  taskProgressName: "rekonVirtualMarginTask",
};
