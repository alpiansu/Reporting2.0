/**
 * Configuration for rekon_persediaan module
 */
export default {
  // Query templates
  queries: {
    // Store query template
    store: `SELECT SHOP, a.TANGGAL, 
        SUM(IF(RTYPE='J',HPP*QTY,HPP*QTY*-1)) AS HPP_DRY,
        (SELECT 
        SUM(IF(a.RType='J',a.Qty*a.Hpp,a.Qty*a.Hpp*-1)) AS 'Hpp ECOM' FROM MTran a LEFT JOIN Prodmast b ON a.plu=b.prdcd  WHERE a.Tanggal=?  AND a.Ttype<>'' and shift<>9 AND a.Customer<>'' 
        AND b.flagprod NOT LIKE '%PJR%' AND ((NOT(LEFT(a.CatCode,3)='539' OR a.CatCode='54901' OR a.CatCode='54902' OR a.CatCode='54005' OR LEFT(a.catcode,3)='554' OR LEFT(a.catcode,3)='555' OR LEFT(a.catcode,3)='556' OR LEFT(a.catcode,3)='557' OR LEFT(a.catcode,3)='558' OR LEFT(a.CatCode,4)='0539' OR a.CatCode='054901' OR a.CatCode='054902' OR a.CatCode='054005' OR LEFT(a.catcode,4)='0554' OR LEFT(a.catcode,4)='0555' OR LEFT(a.catcode,4)='0556' OR LEFT(a.catcode,4)='0557' OR LEFT(a.catcode,4)='0558' ) AND a.Fee=0) OR (b.desc2 LIKE '%YUMMY FRESH%' OR (b.desc2 LIKE '%HOT DEAL%' AND a.CatCode NOT IN(14601,44601,44602,44603,44604,44605,44606,44607,44608,014601,044601,044602,044603,044604,044605,044606,044607,044608))))) as 'HPP_ISTORE',
        (SELECT  sum(hpp*qty) FROM MTran a LEFT JOIN Prodmast b ON a.plu=b.PRDCD WHERE Tanggal=? AND prdcd NOT IN('20000065','20033066') AND (a.Recid=' ' OR a.Recid IS NULL) AND b.flagprod LIKE '%PJR=Y%' AND a.Ttype NOT IN ('ISTORE','SPCPROD') AND ((NOT(LEFT(a.CatCode,3)='539' OR a.CatCode='54901' OR a.CatCode='54902' OR a.CatCode='54005' OR LEFT(a.catcode,3)='554' OR LEFT(a.catcode,3)='555' OR LEFT(a.catcode,3)='556' OR LEFT(a.catcode,3)='557' OR LEFT(a.catcode,3)='558' OR LEFT(a.CatCode,4)='0539' OR a.CatCode='054901' OR a.CatCode='054902' OR a.CatCode='054005' OR LEFT(a.catcode,4)='0554' OR LEFT(a.catcode,4)='0555' OR LEFT(a.catcode,4)='0556' OR LEFT(a.catcode,4)='0557' OR LEFT(a.catcode,4)='0558' ) AND a.Fee=0) OR (b.desc2 LIKE '%YUMMY FRESH%' OR (b.desc2 LIKE '%HOT DEAL%' AND a.CatCode<>'64602' AND a.CatCode<>'64608' AND a.CatCode<>'064602' AND a.CatCode<>'064608' )))GROUP BY a.RType,a.Sub_Bkp,a.Bkp 
        ) as 'HPP_RESTO',
        (SELECT SUM(CASE WHEN rtype='J'  THEN hpp*qty ELSE 0 END)-SUM(CASE WHEN rtype='D' THEN hpp*qty ELSE 0 END) AS 'HPP RMB' FROM mtran WHERE tanggal=? AND catcode!='054005' AND LEFT(catcode,3)!='055' AND plu NOT IN (SELECT PLU FROM plastik WHERE jadwal='NNNNNNN') AND plu  IN(SELECT PRDCD FROM PRODMAST WHERE SUPCO IN(SELECT supco FROM supmast where flagsupp='VIR=Y')) 
        ) as 'HPP_VIRTUAL',
        (SELECT sum(hpp*qty) FROM MTran a LEFT JOIN Prodmast b ON a.plu=b.PRDCD WHERE  a.ttype rlike 'SPCPROD' and Tanggal=? AND prdcd NOT IN('20000065','20033066') AND (a.Recid=' ' OR a.Recid IS NULL) AND b.flagprod LIKE '%PJR=Y%' AND  ((NOT(LEFT(a.CatCode,3)='539' OR a.CatCode='54901' OR a.CatCode='54902' OR a.CatCode='54005' OR LEFT(a.catcode,3)='554' OR LEFT(a.catcode,3)='555' OR LEFT(a.catcode,3)='556' OR LEFT(a.catcode,3)='557' OR LEFT(a.catcode,3)='558' OR LEFT(a.CatCode,4)='0539' OR a.CatCode='054901' OR a.CatCode='054902' OR a.CatCode='054005' OR LEFT(a.catcode,4)='0554' OR LEFT(a.catcode,4)='0555' OR LEFT(a.catcode,4)='0556' OR LEFT(a.catcode,4)='0557' OR LEFT(a.catcode,4)='0558' ) AND a.Fee=0) OR (b.desc2 LIKE '%YUMMY FRESH%' OR (b.desc2 LIKE '%HOT DEAL%' AND a.CatCode<>'64602' AND a.CatCode<>'64608' AND a.CatCode<>'064602' AND a.CatCode<>'064608' )))GROUP BY a.RType,a.Sub_Bkp,a.Bkp 
        ) as 'HPP_SPC_STORE'
         FROM (SELECT * FROM MTRAN WHERE TANGGAL=? AND CATCODE NOT IN(054003,054005,055401,055402,055403,055404,055405,055406,055407,055408,055409,055501,055502,055503,055504,055601,055701,055702,055703,055801,055802,055803,055804,055410,54003,54005,55401,55402,55403,55404,55405,55406,55407,55408,55409,55501,55502,55503,55504,55601,55701,55702,55703,55801,55802,55803,55804,55410,055805,55805)
        AND plu NOT IN(SELECT PLU FROM plastik WHERE jadwal='NNNNNNN')) AS A LEFT JOIN (SELECT * FROM PRODMAST) AS B ON A.plu=B.prdcd
        WHERE (B.SUPCO NOT IN(SELECT supco FROM supmast where flagsupp='VIR=Y') OR B.SUPCO IS NULL) AND B.FLAGPROD NOT LIKE '%PJR=Y%' AND A.TTYPE not in('SPCPROD','ISTORE','SHOPEEMART');`,

    // WRC query template (table name dynamic)
    wrc: `SELECT KODE_TOKO, 
           ? AS TANGGAL, 
           SUM(CASE WHEN SUBKODE = '01' THEN AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN ELSE 0 END) AS HPP_DRY,
           SUM(CASE WHEN SUBKODE = '02' THEN AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN ELSE 0 END) AS HPP_ISTORE,
           SUM(CASE WHEN SUBKODE = '03' THEN AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN ELSE 0 END) AS HPP_RESTO,
           SUM(CASE WHEN SUBKODE = '06' THEN AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN ELSE 0 END) AS HPP_VIRTUAL,
           SUM(CASE WHEN SUBKODE = '07' THEN AMOUNT_DR+FEE_DPP_DR+FEE_DR_PPN ELSE 0 END) AS HPP_SPC_STORE
    FROM {tableName} 
    WHERE KODE = 25
    GROUP BY KODE_TOKO;`,
  },

  // Connection retry settings
  connectionRetry: {
    maxRetries: 2,
    retryDelay: 3000, // milliseconds
  },

  // Parallel processing configuration
  parallelProcessing: {
    // Maximum number of stores to process concurrently
    concurrencyLimit: 5,
    // Maximum number of branches to process concurrently
    branchConcurrencyLimit: 3,
    // Timeout for individual store processing (milliseconds)
    storeTimeoutMs: 30000, 
  },

  taskProgressName: "rekonPersediaanTask",
};
