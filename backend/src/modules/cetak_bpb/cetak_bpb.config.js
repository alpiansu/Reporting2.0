/**
 * Configuration for Cetak BPB module
 */

export default {
  taskProgressName: "CetakBPB",
  parallelProcessing: {
    concurrencyLimit: 5,
  },
  queries: {
    header: (bukti_no) => `
      SELECT 
          (SELECT CONCAT(kdtk,' - ',nama ) FROM toko) AS TOKO, 
          m.BUKTI_NO,
          m.SUPCO,
          (SELECT nama FROM supmast WHERE supco = m.supco) AS NAMA,
          m.INVNO,
          m.INV_DATE,
          m.PO_NO,
          CAST(IFNULL(m.PO_DATE,'0000-00-00') AS CHAR) AS PO_DATE
      FROM mstran m
      WHERE m.bukti_no = '${bukti_no}'
        AND m.rtype = 'BPB'
      LIMIT 1;
    `,
    detail: (bukti_no) => `
      SELECT 
          m.PRDCD AS PLU,
          (SELECT singkatan FROM prodmast WHERE prdcd=m.prdcd) AS DESKRIPSI,
          (SELECT kemasan FROM prodmast WHERE prdcd=m.prdcd) AS KEMASAN,
          m.QTY AS TERIMA,
          m.PRICE,
          IF(m.BKP='Y' AND m.SUB_BKP<>'Y',0,m.PPN) AS PPN,
          m.GROSS AS JUMLAH,
          (m.PRICE*m.QTY) + IF(m.BKP='Y' AND m.SUB_BKP<>'Y',0,m.PPN) AS TOTAL,
          m.DISC_05,
          m.BKP,
          m.SUB_BKP,
          m.BUKTI_NO
      FROM mstran m
      WHERE m.bukti_no='${bukti_no}'
        AND m.rtype='BPB';
    `,
  },
};
