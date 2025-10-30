/**
 * Configuration for adjust module
 */

export default {
  // Query templates
  queries: {
    // WRC query template
    wrc: ``,

    // Store query template
    store: {
      init: [
        `DROP TABLE IF EXISTS mstadj`,
        `CREATE TABLE IF NOT EXISTS mstadj LIKE mstran`,
        `DROP TABLE IF EXISTS simul_mst`,
        // `CREATE TABLE IF NOT EXISTS simul_mst LIKE mstran`,
        `DROP TABLE IF EXISTS adjcek`,
        // `delete from pos.mstran where date(bukti_tgl) = curdate() and rtype = 'X' and istype = 'so' and addid like '%133.10%';`,
      ],
      insertPlu: `
        INSERT INTO mstadj(lokasi,rtype,bukti_no,bukti_tgl,supco,inv_date,prdcd,plu_nas,istype,bkp,sub_bkp,price,gross,qty,jam,keter,price_jual,gross_jual)
        SELECT 
          '01', 'X', 
          (SELECT docno FROM const WHERE rkey = 'NKL')+1,
          CURRENT_DATE(),
          IFNULL(pm.supco,''),
          CURRENT_DATE(),
          ?,  -- prdcd from file
          ?,  -- plu_nas from file (same as prdcd)
          'SO',
          pm.bkp,
          pm.sub_bkp,
          pm.acost,
          pm.acost*(?),  -- qty from file
          ?,             -- qty from file
          CURTIME(),
          ?,              -- Keterangan from file
          pm.price,
          pm.price*(?)   -- qty from file
        FROM prodmast pm
        WHERE pm.prdcd = ?  -- prdcd from file
      `,
      safetyCek: `CREATE TABLE adjcek 
        SELECT 
            a.prdcd, 
            a.qty, 
            b.qty_ms, 
            b.qty_mt, 
            b.begbal, 
            b.saldo, 
            b.saldo + a.qty AS sisa
        FROM mstadj a 
        INNER JOIN (
            SELECT 
                pr.prdcd, 
                IFNULL(qty_ms, 0) AS qty_ms, 
                IFNULL(qty_mt, 0) AS qty_mt, 
                IFNULL(begbal,0) as begbal, 
                (IFNULL(begbal,0) + IFNULL(qty_ms, 0) + IFNULL(qty_mt, 0)) AS saldo
            FROM prodmast pr 
            LEFT JOIN (
                SELECT 
                    prdcd, 
                    ifnull(SUM(IF(RTYPE IN ('O','K'), QTY * -1, QTY)),0) AS qty_ms 
                FROM mstran 
                WHERE (
                    (MONTH(bukti_tgl) = MONTH(CURRENT_DATE()) AND DATE(bukti_tgl) < CURRENT_DATE)
                    OR (DAY(CURRENT_DATE()) = 1 AND MONTH(bukti_tgl) = MONTH(CURRENT_DATE() - INTERVAL 1 MONTH))
                )
                GROUP BY prdcd
            ) ms USING (prdcd)
            LEFT JOIN (
                SELECT 
                    plu AS prdcd, 
                    ifnull(SUM(IF(rtype = 'J', qty * -1, qty)),0) AS qty_mt 
                FROM mtran 
                WHERE (
                    (MONTH(tanggal) = MONTH(CURRENT_DATE()) AND DATE(tanggal) < CURRENT_DATE)
                    OR (DAY(CURRENT_DATE()) = 1 AND MONTH(tanggal) = MONTH(CURRENT_DATE() - INTERVAL 1 MONTH))
                )
                GROUP BY prdcd
            ) mt USING (prdcd)
            LEFT JOIN (
                SELECT prdcd, ifnull(saldo_akh,0) AS begbal FROM ?? 
            ) flt USING (prdcd)
            WHERE pr.prdcd IN (SELECT prdcd FROM mstadj)
        ) b USING (prdcd);
      `,
      finalize: [
        `UPDATE const SET docno=docno+2 WHERE rkey='nkl'`,
        // `UPDATE mstadj m JOIN adjcek a USING(prdcd) SET m.qty = m.qty - a.sisa WHERE a.sisa < 0 AND a.saldo * m.qty < 0;`,
        // `UPDATE mstadj a
        //   JOIN adjcek b ON a.prdcd = b.prdcd
        //   SET a.qty = CASE WHEN b.sisa < 0 THEN a.qty - b.sisa ELSE a.qty END,
        //       a.gross = (CASE WHEN b.sisa < 0 THEN a.qty - b.sisa ELSE a.qty END) * a.price,
        //       a.gross_jual = (CASE WHEN b.sisa < 0 THEN a.qty - b.sisa ELSE a.qty END) * a.price_jual,
        //       b.sisa = b.saldo + (CASE WHEN b.sisa < 0 THEN a.qty - b.sisa ELSE a.qty END)
        //     WHERE a.qty * b.saldo < 0`,
      ],
      insertTran: `INSERT IGNORE INTO mstran SELECT * FROM mstadj where prdcd in (SELECT prdcd from adjcek a inner join mstadj b using(prdcd) WHERE a.saldo != 0) AND PRDCD = ?`,
      // insertTran: `INSERT IGNORE INTO mstran SELECT * FROM mstadj where PRDCD = ?`,
      // insertTran: `INSERT IGNORE INTO simul_mst SELECT * FROM mstadj where prdcd in (SELECT prdcd from adjcek a inner join mstadj b using(prdcd) WHERE abs(a.saldo) >= abs(a.sisa) ) AND PRDCD = ?`,
    },
  },

  // Connection retry settings
  connectionRetry: {
    maxRetries: 3,
    retryDelay: 2000, // milliseconds
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

  taskProgressName: "adjustmentTask",
};
