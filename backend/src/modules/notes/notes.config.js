/**
 * Configuration for Notes module
 */
import path from "path";

export default {
  jsonPath: path.join(process.cwd(), "data/notes.json"),
  cacheTTL: 60 * 1000, // 1 minute cache
  autoNotes: {
    rekonVirtualMrg: `
      SELECT * FROM(SELECT 
      (SELECT KDTK FROM TOKO LIMIT 1) as KDTK,
      A.PLU,
      B.PRDCD,
      A.DOCNO,
      A.SHIFT,
      A.STATION,
      A.TANGGAL,
      B.BUKTI_NO,
      A.TTYPE,
      B.ISTYPE,
      GROUP_CONCAT(DISTINCT A.RTYPE ORDER BY A.RTYPE DESC) AS RTYPE_MTR,
      B.RTYPE AS RTYPE_MSTR,
      E.NAMA,
      E.FLAVOUR,
      C.TRANSAKSIID,
      C.STATUS,
      C.KTART,
      TRXTOKO,
      LASTRESPDETIL,
      SENDPOS,
      A.QTY AS QTY_MTR,
      B.QTY AS QTY_MSTR,
      B.SUPCO,
      COALESCE(MID(B.KETER,1,9),'') AS DOCNO_MSTR,
      CAST (CASE
          WHEN (A.QTY>B.QTY) AND (LASTRESPDETIL LIKE'%sukses%' OR STATUS=1) 
              THEN CONCAT('1| Transaksi ',FLAVOUR,' ',E.nama,' Qty MTRAN lebih besar dari qty MSTRAN. Indikasi transaksi kembali terPush ke POS kasir. shift:',A.shift,' , station:',A.station,' , tanggal:',A.tanggal,' , docno:',A.docno,' , QtyMtran:',A.QTY,' , QtyMstran:',IFNULL(B.qty,0))
          WHEN STATUS != 1 AND KTART IS NOT NULL AND GROUP_CONCAT(DISTINCT A.RTYPE) NOT LIKE'%D%' AND TTYPE<>'BATV' AND (B.QTY IS NULL OR B.QTY='') 
              THEN CONCAT('2| Transaksi ',FLAVOUR,' ',E.nama,' GAGAL, TIDAK TERBENTUK RTYPE D MTRAN ISTYPE BATV. shift:',A.shift,' , station:',A.station,' , tanggal:',A.tanggal,' , docno:',A.docno,' , QtyMtran:',A.QTY,' , QtyMstran:',IFNULL(B.qty,0),' (ipulsa_transaksi ktart=',C.KTART,' status=',C.status,')')
          WHEN STATUS = 1 AND KTART IS NOT NULL AND GROUP_CONCAT(DISTINCT A.RTYPE) LIKE'%D%' AND TTYPE='BATV' AND (B.QTY IS NOT NULL OR B.QTY<>'') 
              THEN CONCAT('6| Transaksi ',FLAVOUR,' ',E.nama,' BERHASIL & RMB SUKSES TERBENTUK, NAMUN TERBENTUK BATV. shift:',A.shift,' , station:',A.station,' , tanggal:',A.tanggal,' , docno:',A.docno,' , QtyMtran:',A.QTY,' , QtyMstran:',IFNULL(B.qty,0),' (ipulsa_transaksi ktart=',C.KTART,' status=',C.status,')')
          WHEN STATUS != 1 AND KTART IS NOT NULL AND GROUP_CONCAT(DISTINCT A.RTYPE) LIKE'%D%' AND TTYPE='BATV' AND (B.QTY IS NOT NULL OR B.QTY<>'') 
              THEN CONCAT('3| Transaksi ',FLAVOUR,' ',E.nama,' GAGAL dan TERBENTUK BATV & RMB di MSTRAN. shift:',A.shift,' , station:',A.station,' , tanggal:',A.tanggal,' , docno:',A.docno,' , QtyMtran:',A.QTY,' , QtyMstran:',IFNULL(B.qty,0),' (ipulsa_transaksi ktart=',C.KTART,' status=',C.status,')')
          WHEN A.QTY<>'0' AND B.qty IS NULL AND GROUP_CONCAT(DISTINCT A.RTYPE) NOT LIKE'%D%' AND TRANSAKSIID IS NULL AND TRXTOKO IS NULL  AND FLAVOUR LIKE'%PULSA%'
              THEN CONCAT('2| Transaksi ',FLAVOUR,' ',E.nama,' GAGAL, TIDAK TERBENTUK BATV dan tidak ada di table IPULSA_TRANSAKSI. Indikasi ada data rusak atau transaksi kembali terload di POS KASIR, shift:',A.shift,' , station:',A.station,' , tanggal:',A.tanggal,' , docno:',A.docno,' , QtyMtran:',A.QTY,' , QtyMstran:',IFNULL(B.qty,0))
          WHEN STATUS != 1 AND KTART IS NOT NULL AND GROUP_CONCAT(DISTINCT A.RTYPE) NOT LIKE'%D%' AND ISTYPE='RMB' AND FLAVOUR LIKE'%PULSA%'
                  THEN CONCAT('3| Transaksi ',FLAVOUR,' ',E.nama,' GAGAL, TAPI TERBENTUK RMB. shift:',A.shift,' , station:',A.station,' , tanggal:',A.tanggal,' , docno:',A.docno,' , QtyMtran:',A.QTY,' , QtyMstran:',IFNULL(B.qty,0),' (ipulsa_transaksi ktart=',C.KTART,' status=',C.status,')')

      END as CHAR) as keterangan
      FROM MTRAN A
      LEFT JOIN MSTRAN B 
      ON A.PLU = B.PRDCD 
      AND A.TANGGAL = DATE(B.BUKTI_TGL) 
      AND A.DOCNO = COALESCE(MID(B.KETER,1,9),'')
      LEFT JOIN ipulsa_transaksi C 
      ON A.PLU = C.VOUCHERID 
      AND A.DOCNO = C.NOSTRUK 
      AND A.TANGGAL = DATE(C.transaksidate)
      LEFT JOIN VIRTUAL_TRX D 
      ON A.PLU = D.PLU 
      AND A.TANGGAL = DATE(D.TanggalTran) 
      AND A.DOCNO = D.NOSTRUK
      LEFT JOIN PRODMAST E 
      ON A.PLU = E.PRDCD
      WHERE A.TANGGAL = ?
      AND A.PLU = ?
      GROUP BY A.SHIFT, A.STATION, A.DOCNO, A.TANGGAL
      HAVING keterangan IS NOT NULL 

      UNION ALL

      SELECT 
      (SELECT KDTK FROM TOKO LIMIT 1) as KDTK,
      A.PLU,
      B.PRDCD,
      A.DOCNO,
      A.SHIFT,
      A.STATION,
      A.TANGGAL,
      B.BUKTI_NO,
      A.TTYPE,
      B.ISTYPE,
      GROUP_CONCAT(DISTINCT A.RTYPE ORDER BY A.RTYPE DESC) AS RTYPE_MTR,
      B.RTYPE AS RTYPE_MSTR,
      E.NAMA,
      E.FLAVOUR,
      C.TRANSAKSIID,
      C.STATUS,
      C.KTART,
      TRXTOKO,
      LASTRESPDETIL,
      SENDPOS,
      A.QTY AS QTY_MTR,
      B.QTY AS QTY_MSTR,
      B.SUPCO,
      '' AS DOCNO_MSTR,
      CAST(CASE
          WHEN (A.QTY>B.QTY) AND (LASTRESPDETIL LIKE'%suk%' OR KTART='Y') 
              THEN CONCAT('1| Transaksi double struk , qty mtran lebih besar dari qty mstran. Indikasi transaksi kembali terPush ke POS kasir. shift:',A.shift,' , station:',A.station,' , tanggal:',A.tanggal,' , docno:',A.docno,' , QtyMtran:',A.QTY,' , QtyMstran:',IFNULL(B.qty,0))
          WHEN STATUS != 1 AND KTART IS NOT NULL AND GROUP_CONCAT(DISTINCT A.RTYPE) NOT LIKE'%D%' AND TTYPE<>'BATV' AND (B.QTY IS NULL OR B.QTY='') 
              THEN CONCAT('2| Transaksi ',E.nama,' gagal, tidak terbentuk rtype D istype BATV di table mtran. shift:',A.shift,' , station:',A.station,' , tanggal:',A.tanggal,' , docno:',A.docno,' , QtyMtran:',A.QTY,' , QtyMstran:',IFNULL(B.qty,0),' (ipulsa_transaksi ktart=',C.KTART,' status=',C.status,')')
          WHEN STATUS = 1 AND KTART IS NOT NULL AND GROUP_CONCAT(DISTINCT A.RTYPE) LIKE'%D%' AND TTYPE='BATV' AND (B.QTY IS NOT NULL OR B.QTY<>'') 
              THEN CONCAT('3| Transaksi ',E.nama,' gagal dan terbentuk BATV dan terbentuk RMB di mstran. shift:',A.shift,' , station:',A.station,' , tanggal:',A.tanggal,' , docno:',A.docno,' , QtyMtran:',A.QTY,' , QtyMstran:',IFNULL(B.qty,0),' (ipulsa_transaksi ktart=',C.KTART,' status=',C.status,')')
          WHEN A.QTY<>'0' AND B.qty IS NULL AND GROUP_CONCAT(DISTINCT A.RTYPE) NOT LIKE'%D%' AND TRANSAKSIID IS NULL AND TRXTOKO IS NULL 
              THEN CONCAT('2| Transaksi ',E.nama,' gagal, tidak terbentuk rtype D istype BATV di mstran. shift:',A.shift,' , station:',A.station,' , tanggal:',A.tanggal,' , docno:',A.docno,' , QtyMtran:',A.QTY,' , QtyMstran:',IFNULL(B.qty,0))

      END AS CHAR) AS keterangan
      FROM MTRAN A
      LEFT JOIN MSTRAN B 
      ON A.PLU = B.PRDCD 
      AND A.TANGGAL = DATE(B.BUKTI_TGL)
      LEFT JOIN ipulsa_transaksi C 
      ON A.PLU = C.VOUCHERID 
      AND A.DOCNO = C.NOSTRUK 
      AND A.TANGGAL = DATE(C.transaksidate)
      LEFT JOIN VIRTUAL_TRX D 
      ON A.PLU = D.PLU 
      AND A.TANGGAL = DATE(D.TanggalTran) 
      AND A.DOCNO = D.NOSTRUK
      LEFT JOIN PRODMAST E 
      ON A.PLU = E.PRDCD
      WHERE A.TANGGAL = ?
      AND A.PLU = ?
      GROUP BY A.SHIFT, A.STATION, A.DOCNO, A.TANGGAL
      HAVING keterangan IS NOT NULL )XX GROUP BY SHIFT, STATION, DOCNO, TANGGAL,PLU ORDER BY TANGGAL ASC
    `,
  },
};
