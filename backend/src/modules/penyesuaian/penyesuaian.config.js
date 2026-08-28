/**
 * Configuration for penyesuaian module
 */
export default {
  // Query templates
  queries: {
    filterWrc: (cab, prd, kdtk, lastday) => {
      // ============================================================
      // lastday format: YYMMDD
      // Contoh:
      //   260827 -> 27 Agustus 2026
      //   260731 -> 31 Juli 2026
      // ============================================================

      const yyMM = lastday.substring(0, 4);
      const lastDayNumber = Number(lastday.substring(4, 6));

      // ============================================================
      // Ambil bulan H-1 dari lastday untuk tabel kodetoko
      //
      // Contoh:
      //   lastday 260827 -> kodetoko_2607
      //   lastday 260731 -> kodetoko_2606
      //   lastday 260101 -> kodetoko_2512
      // ============================================================

      const yy = Number(lastday.substring(0, 2));
      const mm = Number(lastday.substring(2, 4));

      const previousMonth = new Date(2000 + yy, mm - 2, 1);

      const kodetokoYYMM =
        String(previousMonth.getFullYear()).substring(2) + String(previousMonth.getMonth() + 1).padStart(2, "0");

      // ============================================================
      // Generate UNION ALL WT
      //
      // Contoh lastday = 260827:
      //
      // SELECT * FROM wt_260801 WHERE shop = 'T001'
      // UNION ALL
      // SELECT * FROM wt_260802 WHERE shop = 'T001'
      // ...
      // SELECT * FROM wt_260827 WHERE shop = 'T001'
      // ============================================================

      const wtUnion = Array.from({ length: lastDayNumber }, (_, index) => {
        const day = String(index + 1).padStart(2, "0");
        const tableDate = `${yyMM}${day}`;

        return `SELECT * FROM wt_${tableDate} WHERE shop = '${kdtk}'`;
      }).join(" UNION ALL\n\t\t");

      // ============================================================
      // Generate UNION ALL DT
      //
      // Contoh lastday = 260827:
      //
      // SELECT * FROM DT_260801 WHERE SHOP = 'T001'
      // UNION ALL
      // SELECT * FROM DT_260802 WHERE SHOP = 'T001'
      // ...
      // SELECT * FROM DT_260827 WHERE SHOP = 'T001'
      // ============================================================

      const dtUnion = Array.from({ length: lastDayNumber }, (_, index) => {
        const day = String(index + 1).padStart(2, "0");
        const tableDate = `${yyMM}${day}`;

        return `SELECT * FROM DT_${tableDate} WHERE SHOP = '${kdtk}'`;
      }).join(" UNION ALL\n\t\t");

      // ============================================================
      // Main Query
      // ============================================================

      return `
    SELECT '${cab}' AS CABANG,
           '${prd}' AS PERIODE,
           '${kdtk}' AS KDTK,
           SUM(sesuai) AS SESUAI,
           NOW() AS UPDTIME,
           '*' AS RECID
    FROM (
      SELECT
        prdcd,
        prod.SINGKATAN AS desc2,
        prod.recid,
        prod.ptag,
        (stock) AS stock,
        saldo_akh,
        qty_trfin,
        qty_trfout,
        qty_sales,
        qty_retur_sales,
        qty_adj,
        qty_ba,
        qty_bs,
        acost,
        rp_sld_akh,
        trfin,
        trfout,
        sales,
        retur_sales,
        adj,
        ba,
        bs,

        (
          stock * IF(
            (
              IFNULL(qty_trfin,0) +
              IFNULL(qty_trfout,0) +
              IFNULL(qty_sales,0) +
              IFNULL(qty_retur_sales,0) +
              IFNULL(qty_adj,0) +
              IFNULL(qty_ba,0) +
              IFNULL(qty_bs,0)
            ) = 0,
            rcost_flt,
            acost
          )
        ) -
        (
          rp_sld_akh +
          trfin -
          trfout -
          sales +
          retur_sales +
          adj +
          ba +
          bs
        ) AS sesuai

      FROM (
        SELECT
          prdcd,
          saldo_awal,
          rp_sld_awl,
          flt.rcost AS rcost_flt,
          saldo_akh,
          rp_sld_akh,

          COALESCE(mst.trfin, 0) AS trfin,
          COALESCE(mst.trfout, 0) AS trfout,
          COALESCE(mst.adj, 0) AS adj,
          COALESCE(mtr.sales, 0) AS sales,
          COALESCE(mtr.retur_sales, 0) AS retur_sales,
          COALESCE(mst.ba, 0) AS ba,
          COALESCE(mst.bs, 0) AS bs,

          (
            SELECT IF(acost=0, lcost, acost)
            FROM pr_${lastday}
            WHERE prdcd = flt.prdcd
              AND toko = '${kdtk}'
          ) AS acost,

          (
            saldo_akh +
            IFNULL(mst.qty_trfin, 0) -
            IFNULL(mst.qty_trfout, 0) -
            IFNULL(mtr.qty_sales, 0) +
            IFNULL(mtr.qty_retur_sales, 0) +
            IFNULL(mst.qty_adj, 0) +
            IFNULL(mst.qty_ba, 0) +
            IFNULL(mst.qty_bs, 0)
          ) AS stock,

          mst.qty_trfin,
          mst.qty_trfout,
          mtr.qty_sales,
          mtr.qty_retur_sales,
          mst.qty_adj,
          mst.qty_ba,
          mst.qty_bs

        FROM (
          SELECT
            a.prdcd,
            IFNULL(b.saldo_akh,0) AS saldo_akh,
            IFNULL(b.rp_sld_akh,0) AS rp_sld_akh,
            IFNULL(b.rcost,0) AS rcost,
            IFNULL(b.saldo_awal,0) AS saldo_awal,
            IFNULL(rp_sld_awl,0) AS rp_sld_awl

          FROM (
            SELECT *
            FROM st_${lastday}
            WHERE kode_toko = '${kdtk}'
          ) a

          LEFT JOIN (
            SELECT *
            FROM kodetoko_${kodetokoYYMM}
            WHERE KODE_TOKO = '${kdtk}'
          ) b
            ON a.prdcd = b.prdcd
           AND a.kode_toko = b.kode_toko

          WHERE a.CAT_COD NOT RLIKE '^55|^055'
            AND a.CAT_COD NOT IN(
              '54901',
              '54902',
              '54005',
              '054901',
              '054902',
              '054005'
            )
        ) flt

        LEFT JOIN (
          SELECT
            prdcd,
            rtype,

            SUM(
              IF(rtype='B' OR rtype='I', QTY, 0)
            ) AS qty_trfin,

            SUM(
              IF(rtype='X' AND ISTYPE='BA', QTY, 0)
            ) AS qty_ba,

            SUM(
              IF(rtype='X' AND ISTYPE='BS', QTY, 0)
            ) AS qty_bs,

            SUM(
              IF(
                rtype='X'
                AND ISTYPE NOT IN ('BS','BA'),
                QTY,
                0
              )
            ) AS qty_adj,

            SUM(
              IF(rtype='K' OR rtype='O', QTY, 0)
            ) AS qty_trfout,

            SUM(
              IF(rtype='B' OR rtype='I', gross, 0)
            ) AS trfin,

            SUM(
              IF(rtype='X' AND ISTYPE='BA', gross, 0)
            ) AS ba,

            SUM(
              IF(rtype='X' AND ISTYPE='BS', gross, 0)
            ) AS bs,

            SUM(
              IF(
                rtype='X'
                AND ISTYPE NOT IN ('BS','BA'),
                gross,
                0
              )
            ) AS adj,

            SUM(
              IF(rtype='K' OR rtype='O', gross, 0)
            ) AS trfout

          FROM (
            ${wtUnion}
          ) AS mstran

          GROUP BY PRDCD

        ) AS mst USING(PRDCD)

        LEFT JOIN (
          SELECT
            PRDCD AS PLU,
            rtype,

            SUM(
              IF(rtype='J', qty, 0)
            ) AS qty_sales,

            SUM(
              IF(rtype='D', qty, 0)
            ) AS qty_retur_sales,

            SUM(
              IF(rtype='J', hpp*qty, 0)
            ) AS sales,

            SUM(
              IF(rtype='D', hpp*qty, 0)
            ) AS retur_sales

          FROM (
            ${dtUnion}
          ) AS mtran

          GROUP BY PLU

        ) AS mtr
          ON flt.PRDCD = mtr.PLU

        LEFT JOIN (
          SELECT *
          FROM PR_${lastday}
          WHERE flag_prod NOT LIKE '%VIR=Y%'
            AND TOKO = '${kdtk}'
        ) prod USING(PRDCD)

      ) AS cek_sesuai

      LEFT JOIN (
        SELECT
          PRDCD,
          DESC2,
          SINGKATAN,
          RECID,
          PTAG
        FROM PR_${lastday}
        WHERE TOKO = '${kdtk}'
      ) prod USING(PRDCD)

      WHERE PRDCD NOT IN (
        20000459,
        20063701,
        20067408
      )

    ) AS rp_sesuai_toko

    HAVING SESUAI > 500000
        OR SESUAI < -500000;
  `;
    },
    // Filter query - check if store has data exceeding threshold
    filter: (filetToko, strPeriode) => `
      SELECT (SELECT KIRIM FROM toko) AS CABANG, '${strPeriode}' as PERIODE, (SELECT KDTK FROM TOKO) as KDTK, sum(sesuai) as SESUAI, NOW() as UPDTIME, '*' as RECID FROM (
        SELECT prdcd, prod.DESC2 as desc2, prod.recid, prod.ptag, (stock) as stock, saldo_akh, qty_trfin, qty_trfout, qty_sales, qty_retur_sales, qty_adj, qty_ba, qty_bs, acost,
        rp_sld_akh,trfin,trfout,sales,retur_sales,adj,ba,bs,
        (stock*if((IFNULL(qty_trfin,0)+IFNULL(qty_trfout,0)+IFNULL(qty_sales,0)+IFNULL(qty_retur_sales,0)+IFNULL(qty_adj,0)+IFNULL(qty_ba,0)+IFNULL(qty_bs,0) )= 0, rcost_flt, acost))-(rp_sld_akh+trfin-trfout-sales+retur_sales+adj+ba+bs) AS sesuai FROM (
        SELECT 
          prdcd, saldo_awal, rp_sld_awl, flt.rcost as rcost_flt, saldo_akh, rp_sld_akh, 
          COALESCE(mst.trfin, 0) AS trfin, COALESCE(mst.trfout, 0) AS trfout, 
          COALESCE(mst.adj, 0) AS adj, COALESCE(mtr.sales, 0) AS sales, 
          COALESCE(mtr.retur_sales, 0) AS retur_sales, COALESCE(mst.ba, 0) AS ba, COALESCE(mst.bs, 0) AS bs,
          (SELECT IF(acost=0, lcost, acost) as acost FROM prodmast WHERE prdcd = flt.prdcd) AS acost, (saldo_akh+(
                                                                                                        IFNULL(mst.qty_trfin, 0) -
                                                                                                        IFNULL(mst.qty_trfout, 0) -
                                                                                                        IFNULL(mtr.qty_sales, 0) +
                                                                                                        IFNULL(mtr.qty_retur_sales, 0) +
                                                                                                        IFNULL(mst.qty_adj, 0) +
                                                                                                        IFNULL(mst.qty_ba, 0) +
                                                                                                        IFNULL(mst.qty_bs, 0)
                                                                                                      )) as stock,
          mst.qty_trfin, mst.qty_trfout, mtr.qty_sales, mtr.qty_retur_sales, mst.qty_adj, mst.qty_ba, mst.qty_bs
          FROM ( SELECT a.prdcd, IFNULL(b.saldo_akh,0) AS saldo_akh, IFNULL(b.rp_sld_akh,0) AS rp_sld_akh, IFNULL(b.rcost,0) AS rcost, IFNULL(b.saldo_awal,0) AS saldo_awal, IFNULL(rp_sld_awl,0) AS rp_sld_awl FROM stmast a LEFT JOIN ${filetToko} b ON a.prdcd = b.prdcd WHERE a.CAT_COD NOT RLIKE '^55|^055' AND a.CAT_COD NOT IN('54901','54902','54005','054901','054902','054005') ) flt LEFT JOIN
        (
          SELECT 
          prdcd, rtype, 
              
              SUM(IF(rtype='BPB' OR rtype='I', QTY, 0)) AS qty_trfin, 
              SUM(IF(rtype='X' AND ISTYPE='BA', QTY, 0)) AS qty_ba, 
              SUM(IF(rtype='X' AND ISTYPE='BS', QTY, 0)) AS qty_bs, 
              SUM(IF(rtype='X' AND ISTYPE NOT IN ('BS','BA'), QTY, 0)) AS qty_adj, 
              SUM(IF(rtype='K' OR rtype='O', QTY, 0)) AS qty_trfout, 
              
              SUM(IF(rtype='BPB' OR rtype='I', gross, 0)) AS trfin, 
              SUM(IF(rtype='X' AND ISTYPE='BA', gross, 0)) AS ba, 
              SUM(IF(rtype='X' AND ISTYPE='BS', gross, 0)) AS bs, 
              SUM(IF(rtype='X' AND ISTYPE NOT IN ('BS','BA'), gross, 0)) AS adj, 
              SUM(IF(rtype='K' OR rtype='O', gross, 0)) AS trfout 
          FROM mstran 
          WHERE MONTH(bukti_tgl)=? AND YEAR(bukti_tgl)=? GROUP BY PRDCD
        ) AS mst USING(PRDCD) LEFT JOIN (
          SELECT 
          PLU, rtype, 
              SUM(IF(rtype='J', qty, 0)) AS qty_sales, 
              SUM(IF(rtype='D', qty, 0)) AS qty_retur_sales,
              SUM(IF(rtype='J', hpp*qty, 0)) AS sales, 
              SUM(IF(rtype='D', hpp*qty, 0)) AS retur_sales
          FROM mtran 
          WHERE MONTH(TANGGAL)=? AND YEAR(TANGGAL)=? GROUP BY PLU
        )AS mtr ON flt.PRDCD = mtr.PLU left join
        
        PRODMAST prod USING(PRDCD) WHERE flagprod not like '%VIR=Y%'
        
        ) AS cek_sesuai LEFT JOIN (SELECT PRDCD, DESC2, RECID, PTAG FROM PRODMAST) prod USING (PRDCD) WHERE PRDCD NOT IN (20000459,20063701,20067408)
      ) as rp_sesuai_toko HAVING SESUAI > 500000 OR SESUAI < -500000
    `,

    // Detail query - get full record details for insertion
    detail: (filetToko, strPeriode, month, year) => `
      SELECT (SELECT KIRIM FROM toko) AS CAB, '${strPeriode}' as PERIODE, (SELECT KDTK FROM TOKO) as KDTK, PRDCD, prod.SINGKATAN, prod.RECID as RECID_PRODMAST, prod.PTAG, rp_sld_akh / saldo_akh as BEGBAL, trfin / qty_trfin as TRFIN, trfout / qty_trfout as TRFOUT, sales / qty_sales as RP_SALES, retur_sales / qty_retur_sales as RP_RETUR_SALES, adj / qty_adj as ADJ, ba / qty_ba as BA, bs / qty_bs as BS, ACOST, lcost, stock, (stock*acost) as rp_stock,
        (stock*if((IFNULL(qty_trfin,0)+IFNULL(qty_trfout,0)+IFNULL(qty_sales,0)+IFNULL(qty_retur_sales,0)+IFNULL(qty_adj,0)+IFNULL(qty_ba,0)+IFNULL(qty_bs,0) )= 0, rcost_flt, acost))-(rp_sld_akh+trfin-trfout-sales+retur_sales+adj+ba+bs) AS sesuai, now() as updtime FROM (
        
        SELECT 
          prdcd, saldo_awal, rp_sld_awl, flt.rcost as rcost_flt, saldo_akh, rp_sld_akh, 
          COALESCE(mst.trfin, 0) AS trfin, COALESCE(mst.trfout, 0) AS trfout, 
          COALESCE(mst.adj, 0) AS adj, COALESCE(mtr.sales, 0) AS sales, 
          COALESCE(mtr.retur_sales, 0) AS retur_sales, COALESCE(mst.ba, 0) AS ba, COALESCE(mst.bs, 0) AS bs,
          (SELECT acost FROM prodmast WHERE prdcd = flt.prdcd) AS acost, (SELECT lcost FROM prodmast WHERE prdcd = flt.prdcd) AS lcost, (saldo_akh+(
                                                                                                      IFNULL(mst.qty_trfin, 0) -
                                                                                                      IFNULL(mst.qty_trfout, 0) -
                                                                                                      IFNULL(mtr.qty_sales, 0) +
                                                                                                      IFNULL(mtr.qty_retur_sales, 0) +
                                                                                                      IFNULL(mst.qty_adj, 0) +
                                                                                                      IFNULL(mst.qty_ba, 0) +
                                                                                                      IFNULL(mst.qty_bs, 0)
                                                                                                    )) as stock,
          mst.qty_trfin, mst.qty_trfout, mtr.qty_sales, mtr.qty_retur_sales, mst.qty_adj, mst.qty_ba, mst.qty_bs
          FROM ( SELECT a.prdcd, IFNULL(b.saldo_akh,0) AS saldo_akh, IFNULL(b.rp_sld_akh,0) AS rp_sld_akh, IFNULL(b.rcost,0) AS rcost, IFNULL(b.saldo_awal,0) AS saldo_awal, IFNULL(rp_sld_awl,0) AS rp_sld_awl FROM stmast a LEFT JOIN ${filetToko} b ON a.prdcd = b.prdcd WHERE a.CAT_COD NOT RLIKE '^55|^055' AND a.CAT_COD NOT IN('54901','54902','54005','054901','054902','054005') ) flt LEFT JOIN
        (
          SELECT 
          prdcd, rtype, 
              
              SUM(IF(rtype='BPB' OR rtype='I', QTY, 0)) AS qty_trfin, 
              SUM(IF(rtype='X' AND ISTYPE='BA', QTY, 0)) AS qty_ba, 
              SUM(IF(rtype='X' AND ISTYPE='BS', QTY, 0)) AS qty_bs, 
              SUM(IF(rtype='X' AND ISTYPE NOT IN ('BS','BA'), QTY, 0)) AS qty_adj, 
              SUM(IF(rtype='K' OR rtype='O', QTY, 0)) AS qty_trfout, 
              
              SUM(IF(rtype='BPB' OR rtype='I', gross, 0)) AS trfin, 
              SUM(IF(rtype='X' AND ISTYPE='BA', gross, 0)) AS ba, 
              SUM(IF(rtype='X' AND ISTYPE='BS', gross, 0)) AS bs, 
              SUM(IF(rtype='X' AND ISTYPE NOT IN ('BS','BA'), gross, 0)) AS adj, 
              SUM(IF(rtype='K' OR rtype='O', gross, 0)) AS trfout 
          FROM mstran 
          WHERE MONTH(bukti_tgl)=? AND YEAR(bukti_tgl)=? GROUP BY PRDCD
        ) AS mst USING(PRDCD) LEFT JOIN (
          SELECT 
          PLU, rtype, 
              SUM(IF(rtype='J', qty, 0)) AS qty_sales, 
              SUM(IF(rtype='D', qty, 0)) AS qty_retur_sales,
              SUM(IF(rtype='J', hpp*qty, 0)) AS sales, 
              SUM(IF(rtype='D', hpp*qty, 0)) AS retur_sales
          FROM mtran 
          WHERE MONTH(TANGGAL)=? AND YEAR(TANGGAL)=? GROUP BY PLU
        )AS mtr ON flt.PRDCD = mtr.PLU left join
        
        PRODMAST prod USING(PRDCD) WHERE flagprod not like '%VIR=Y%'
        
        ) AS cek_sesuai LEFT JOIN (SELECT PRDCD, SINGKATAN, RECID, PTAG FROM PRODMAST) prod USING (PRDCD) WHERE PRDCD NOT IN (20000459,20063701,20067408) HAVING abs(SESUAI) >= 30000
    `,

    // Detail query - get full record details for check detail
    fullDetail: (filetToko, strPeriode) => `
      SELECT (SELECT KIRIM FROM toko) AS CAB, '${strPeriode}' as PERIODE, (SELECT KDTK FROM TOKO) as KDTK, PRDCD, prod.SINGKATAN, prod.RECID as RECID_PRODMAST, prod.PTAG, rp_sld_akh / saldo_akh as BEGBAL, trfin / qty_trfin as TRFIN, trfout / qty_trfout as TRFOUT, sales / qty_sales as RP_SALES, retur_sales / qty_retur_sales as RP_RETUR_SALES, adj / qty_adj as ADJ, ba / qty_ba as BA, bs / qty_bs as BS, ACOST, lcost, stock, (stock*acost) as rp_stock,
        (stock*if((IFNULL(qty_trfin,0)+IFNULL(qty_trfout,0)+IFNULL(qty_sales,0)+IFNULL(qty_retur_sales,0)+IFNULL(qty_adj,0)+IFNULL(qty_ba,0)+IFNULL(qty_bs,0) )= 0, rcost_flt, acost))-(rp_sld_akh+trfin-trfout-sales+retur_sales+adj+ba+bs) AS sesuai, now() as updtime FROM (
        
        SELECT 
          prdcd, saldo_awal, rp_sld_awl, flt.rcost as rcost_flt, saldo_akh, rp_sld_akh, 
          COALESCE(mst.trfin, 0) AS trfin, COALESCE(mst.trfout, 0) AS trfout, 
          COALESCE(mst.adj, 0) AS adj, COALESCE(mtr.sales, 0) AS sales, 
          COALESCE(mtr.retur_sales, 0) AS retur_sales, COALESCE(mst.ba, 0) AS ba, COALESCE(mst.bs, 0) AS bs,
          (SELECT acost FROM prodmast WHERE prdcd = flt.prdcd) AS acost, (SELECT lcost FROM prodmast WHERE prdcd = flt.prdcd) AS lcost, (saldo_akh+(
                                                                                                      IFNULL(mst.qty_trfin, 0) -
                                                                                                      IFNULL(mst.qty_trfout, 0) -
                                                                                                      IFNULL(mtr.qty_sales, 0) +
                                                                                                      IFNULL(mtr.qty_retur_sales, 0) +
                                                                                                      IFNULL(mst.qty_adj, 0) +
                                                                                                      IFNULL(mst.qty_ba, 0) +
                                                                                                      IFNULL(mst.qty_bs, 0)
                                                                                                    )) as stock,
          mst.qty_trfin, mst.qty_trfout, mtr.qty_sales, mtr.qty_retur_sales, mst.qty_adj, mst.qty_ba, mst.qty_bs
          FROM ( SELECT a.prdcd, IFNULL(b.saldo_akh,0) AS saldo_akh, IFNULL(b.rp_sld_akh,0) AS rp_sld_akh, IFNULL(b.rcost,0) AS rcost, IFNULL(b.saldo_awal,0) AS saldo_awal, IFNULL(rp_sld_awl,0) AS rp_sld_awl FROM stmast a LEFT JOIN ${filetToko} b ON a.prdcd = b.prdcd WHERE a.CAT_COD NOT RLIKE '^55|^055' AND a.CAT_COD NOT IN('54901','54902','54005','054901','054902','054005') ) flt LEFT JOIN
        (
          SELECT 
          prdcd, rtype, 
              
              SUM(IF(rtype='BPB' OR rtype='I', QTY, 0)) AS qty_trfin, 
              SUM(IF(rtype='X' AND ISTYPE='BA', QTY, 0)) AS qty_ba, 
              SUM(IF(rtype='X' AND ISTYPE='BS', QTY, 0)) AS qty_bs, 
              SUM(IF(rtype='X' AND ISTYPE NOT IN ('BS','BA'), QTY, 0)) AS qty_adj, 
              SUM(IF(rtype='K' OR rtype='O', QTY, 0)) AS qty_trfout, 
              
              SUM(IF(rtype='BPB' OR rtype='I', gross, 0)) AS trfin, 
              SUM(IF(rtype='X' AND ISTYPE='BA', gross, 0)) AS ba, 
              SUM(IF(rtype='X' AND ISTYPE='BS', gross, 0)) AS bs, 
              SUM(IF(rtype='X' AND ISTYPE NOT IN ('BS','BA'), gross, 0)) AS adj, 
              SUM(IF(rtype='K' OR rtype='O', gross, 0)) AS trfout 
          FROM mstran 
          WHERE MONTH(bukti_tgl)=? AND YEAR(bukti_tgl)=? GROUP BY PRDCD
        ) AS mst USING(PRDCD) LEFT JOIN (
          SELECT 
          PLU, rtype, 
              SUM(IF(rtype='J', qty, 0)) AS qty_sales, 
              SUM(IF(rtype='D', qty, 0)) AS qty_retur_sales,
              SUM(IF(rtype='J', hpp*qty, 0)) AS sales, 
              SUM(IF(rtype='D', hpp*qty, 0)) AS retur_sales
          FROM mtran 
          WHERE MONTH(TANGGAL)=? AND YEAR(TANGGAL)=? GROUP BY PLU
        )AS mtr ON flt.PRDCD = mtr.PLU left join
        
        PRODMAST prod USING(PRDCD) WHERE flagprod not like '%VIR=Y%'
        
        ) AS cek_sesuai LEFT JOIN (SELECT PRDCD, SINGKATAN, RECID, PTAG FROM PRODMAST) prod USING (PRDCD) WHERE PRDCD NOT IN (20000459,20063701,20067408) HAVING abs(SESUAI) >= 15000
    `,
  },

  // Connection retry settings
  connectionRetry: {
    maxRetries: 2,
    retryDelay: 3000, // milliseconds
  },

  // Parallel processing configuration
  parallelProcessing: {
    // Maximum number of stores to process concurrently
    concurrencyLimit: 8,
    // Maximum number of branches to process concurrently
    branchConcurrencyLimit: 3,
    // Timeout for individual store processing (milliseconds)
    storeTimeoutMs: 90000, // 90 seconds
    // Timeout for individual query execution (milliseconds)
    queryTimeoutMs: 8000, // 8 seconds
  },

  // Threshold for filtering data (absolute value)
  sesuaiThreshold: 500000,

  taskProgressName: "penyesuaianTask",
};
