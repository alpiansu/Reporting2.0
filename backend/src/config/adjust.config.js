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
      init: [`DROP TABLE IF EXISTS mstadj`, `CREATE TABLE mstadj LIKE mstran`, `DROP TABLE IF EXISTS adjcek`],
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
      safetyCek: `create table adjcek 
          select a.prdcd, a.qty, b.qty_ms, b.qty_mt, b.begbal, b.saldo, b.saldo + a.qty as sisa from mstadj a inner join (
          select pr.prdcd, IFNULL(qty_ms,0) AS qty_ms, ifnull(qty_mt,0) as qty_mt, begbal, (begbal + ifnull(qty_ms,0) + ifnull(qty_mt,0)) as saldo from prodmast pr left join 
            (select prdcd, sum(IF(RTYPE IN ('O','K'), QTY*-1, QTY)) as qty_ms from mstran where MONTH(bukti_tgl) = MONTH(CURRENT_DATE()) group by prdcd ) ms using(prdcd) left join
            (select plu as prdcd, sum(if(rtype='J', qty*-1, qty)) as qty_mt from mtran where MONTH(tanggal) = MONTH(CURRENT_DATE()) group by prdcd) mt using(prdcd) left join
            (select prdcd, saldo_akh as begbal from ?? ) flt using(prdcd) where prdcd in (select prdcd from mstadj)
          ) b using(prdcd)`,
      finalize: [
        `UPDATE const SET docno=docno+2 WHERE rkey='nkl'`,
        `INSERT IGNORE INTO mstran SELECT * FROM mstadj where prdcd in (SELECT prdcd from adjcek a inner join mstadj b using(prdcd) WHERE a.sisa >= 0 )`,
        `DROP TABLE IF EXISTS adjcek`,
        `DROP TABLE IF EXISTS mstadj`,
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
    // Maximum number of stores to process concurrently
    concurrencyLimit: 5,
    // Maximum number of branches to process concurrently (for reconcileAllBranches)
    branchConcurrencyLimit: 3,
    // Timeout for individual store processing (milliseconds)
    storeTimeoutMs: 10000, // 10 seconds - reduced for better timeout testing
    // Timeout for individual query execution (milliseconds)
    queryTimeoutMs: 8000, // 8 seconds - reduced for better timeout testing
  },

  // Testing configuration
  testing: {
    // Stores that will be artificially timed out for wave system testing
    // Add store codes here to simulate timeouts in first 2 waves
    simulateTimeoutStores: [],
    // Example: simulateTimeoutStores: ['0001', '0002'],
    // These stores will timeout in wave 1 & 2, then succeed in wave 3
  },
};
