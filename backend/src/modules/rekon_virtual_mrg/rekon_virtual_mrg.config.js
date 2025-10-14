/**
 * Configuration for rekon_virtual module
 */
export default {
  // Query templates
  queries: {
    // WRC query template
    wrc: ``,

    // Store query template
    store: `SELECT (SELECT KIRIM FROM toko) AS CABANG, (SELECT KDTK FROM toko) AS SHOP, TANGGAL, PRDCD, SINGKATAN, QTY_MSTRAN, QTY_MTRAN, QTY_MSTRAN - QTY_MTRAN AS SEL, NOW() AS LAST_CATCH FROM (
				SELECT i.tanggal, p.prdcd, p.singkatan, IFNULL(ms.qty_mstran,0) AS qty_mstran, IFNULL(m.qty_mtran,0) AS qty_mtran FROM 
					(SELECT DISTINCT tanggal FROM initial) i 
					INNER JOIN prodmast p
						ON p.kons = 'K' AND p.cat_cod IN ('034203','034202') AND p.SUPCO IS NOT NULL
					LEFT JOIN (SELECT tanggal, plu, SUM(IF(RTYPE='J', QTY, QTY*-1)) AS QTY_MTRAN FROM MTRAN GROUP BY tanggal, plu ) m 
						ON i.tanggal = m.tanggal AND m.plu = p.prdcd
					LEFT JOIN (SELECT DATE(bukti_tgl) AS tgl_ms, prdcd, SUM(qty) AS qty_mstran FROM mstran WHERE rtype='BPB' GROUP BY DATE(bukti_tgl), prdcd) ms
						ON i.tanggal = DATE(ms.tgl_ms) AND ms.prdcd = p.prdcd
				WHERE MONTH(i.tanggal)=? AND YEAR(i.tanggal)=? AND (m.tanggal IS NOT NULL OR ms.tgl_ms IS NOT NULL )
			) AS SEL_ERELOAD WHERE TANGGAL < CURDATE() AND (QTY_MSTRAN - QTY_MTRAN) != 0`,
  },

  // Connection retry settings
  connectionRetry: {
    maxRetries: 3,
    retryDelay: 5000, // milliseconds
  },

  // Parallel processing configuration
  parallelProcessing: {
    // Maximum number of stores to process concurrently
    concurrencyLimit: 5,
    // Maximum number of branches to process concurrently (for reconcileAllBranches)
    branchConcurrencyLimit: 3,
    // Timeout for individual store processing (milliseconds)
    storeTimeoutMs: 10000, // 10 seconds - reduced for better timeout testing
    // Timeout for individual query execution (milliseconds)
    queryTimeoutMs: 8000, // 8 seconds - reduced for better timeout testing
  },
};
