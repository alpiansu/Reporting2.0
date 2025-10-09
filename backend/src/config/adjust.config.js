/**
 * Configuration for adjust module
 */

export default {
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
          pm.acost*(?*-1),  -- qty from file
          ?*-1,             -- qty from file
          CURTIME(),
          ?,              -- Keterangan from file
          pm.price,
          pm.price*(?*-1)   -- qty from file
        FROM prodmast pm
        WHERE pm.prdcd = ?  -- prdcd from file
      `,
      safetyCek: `create table adjcek 
          select a.prdcd, a.qty, b.qty_ms, b.qty_mt, b.begbal, b.saldo, b.saldo + a.qty as sisa from mstadj a inner join (
          select pr.prdcd, qty_ms, qty_mt, begbal, (begbal + qty_ms + qty_mt) as saldo from prodmast pr left join 
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
