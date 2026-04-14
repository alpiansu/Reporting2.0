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
    rekonVirtualMrgDelon: `
        SELECT 
        COALESCE(A.TANGGAL, DATE(C.transaksidate)) AS TANGGAL,
        COALESCE(A.SHIFT, '-') AS SHIFT,
        COALESCE(A.STATION, '-') AS STATION,
        COALESCE(A.DOCNO, C.NOSTRUK) AS DOCNO,
        COALESCE(A.PLU, C.VOUCHERID) AS PLU,
        E.NAMA,
        E.FLAVOUR,
        A.TTYPE,
        B.ISTYPE,
        GROUP_CONCAT(DISTINCT A.RTYPE ORDER BY A.RTYPE DESC) AS RTYPE_MTR,
        B.RTYPE AS RTYPE_MSTR,
        A.QTY AS QTY_MTR,
        B.QTY AS QTY_MSTR,
        COALESCE(B.SUPCO, E.SUPCO) AS SUPCO,
        C.KTART,
        C.STATUS,
        CAST(CASE
            WHEN (A.QTY > B.QTY) AND (D.LASTRESPDETIL LIKE '%suk%' OR (C.STATUS = 1)) 
                THEN CONCAT(
                    '1| Transaksi ', E.FLAVOUR, ' ', E.NAMA,
                    ' Qty MTRAN lebih besar dari qty MSTRAN. Indikasi transaksi kembali terPush ke POS kasir. ',
                    'shift:', COALESCE(A.SHIFT, '-'), ', station:', COALESCE(A.STATION, '-'), ', tanggal:', COALESCE(A.TANGGAL, DATE(C.transaksidate)),
                    ', docno:', COALESCE(A.DOCNO, C.NOSTRUK), ', QtyMtran:', IFNULL(A.QTY, 0), ', QtyMstran:', IFNULL(B.QTY, 0)
                )

            WHEN ((C.STATUS != 1 AND C.KTART IS NOT NULL) OR ( C.STATUS = 1 AND A.QTY > IFNULL(B.QTY,0) AND KTART != 'Y' ) ) 
                AND GROUP_CONCAT(DISTINCT A.RTYPE) NOT LIKE '%D%' 
                AND A.TTYPE <> 'BATV' 
                AND (B.QTY IS NULL OR B.QTY = '') 
                THEN CONCAT(
                    '2| Transaksi ', E.FLAVOUR, ' ', E.NAMA,
                    ' gagal, tidak terbentuk RTYPE D MTRAN ISTYPE BATV. ',
                    'shift:', COALESCE(A.SHIFT, '-'), ', station:', COALESCE(A.STATION, '-'), ', tanggal:', COALESCE(A.TANGGAL, DATE(C.transaksidate)),
                    ', docno:', COALESCE(A.DOCNO, C.NOSTRUK), ', QtyMtran:', IFNULL(A.QTY, 0), ', QtyMstran:', IFNULL(B.QTY, 0),
                    ' (ipulsa_transaksi ktart=', C.KTART, ' status=', C.STATUS, ')'
                )
                
            WHEN STATUS = 1 AND KTART IS NOT NULL 
            AND GROUP_CONCAT(DISTINCT A.RTYPE) LIKE'%D%' AND TTYPE='BATV' 
            AND (B.QTY IS NOT NULL OR B.QTY<>'') 
                THEN CONCAT('6| Transaksi ',FLAVOUR,' ',E.nama,
                ' BERHASIL & RMB SUKSES TERBENTUK, NAMUN TERBENTUK BATV. shift:',A.shift,' , station:',A.station,' , tanggal:',
                A.tanggal,' , docno:',A.docno,' , QtyMtran:',A.QTY,' , QtyMstran:',IFNULL(B.qty,0),' 
                (ipulsa_transaksi ktart=',C.KTART,' status=',C.status,')')

            WHEN C.STATUS != 1 AND C.KTART IS NOT NULL 
                AND GROUP_CONCAT(DISTINCT A.RTYPE) LIKE '%D%' 
                AND A.TTYPE = 'BATV' 
                AND (B.QTY IS NOT NULL OR B.QTY <> '') 
                THEN CONCAT(
                    '3| Transaksi ', E.FLAVOUR, ' ', E.NAMA,
                    ' gagal dan terbentuk BATV & RMB di MSTRAN. ',
                    'shift:', COALESCE(A.SHIFT, '-'), ', station:', COALESCE(A.STATION, '-'), ', tanggal:', COALESCE(A.TANGGAL, DATE(C.transaksidate)),
                    ', docno:', COALESCE(A.DOCNO, C.NOSTRUK), ', QtyMtran:', IFNULL(A.QTY, 0), ', QtyMstran:', IFNULL(B.QTY, 0),
                    ' (ipulsa_transaksi ktart=', C.KTART, ' status=', C.STATUS, ')'
                )

            WHEN A.QTY <> 0 AND B.QTY IS NULL 
                AND GROUP_CONCAT(DISTINCT A.RTYPE) NOT LIKE '%D%' 
                AND C.TRANSAKSIID IS NULL 
                AND D.TRXTOKO IS NULL 
                AND E.FLAVOUR LIKE '%PULSA%' 
                THEN CONCAT(
                    '2| Transaksi ', E.FLAVOUR, ' ', E.NAMA,
                    ' gagal, tidak terbentuk BATV dan tidak ada di IPULSA_TRANSAKSI. ',
                    'shift:', COALESCE(A.SHIFT, '-'), ', station:', COALESCE(A.STATION, '-'), ', tanggal:', COALESCE(A.TANGGAL, DATE(C.transaksidate)),
                    ', docno:', COALESCE(A.DOCNO, C.NOSTRUK), ', QtyMtran:', IFNULL(A.QTY, 0), ', QtyMstran:', IFNULL(B.QTY, 0)
                )

            WHEN C.KTART <> 'Y' AND C.KTART IS NOT NULL 
                AND GROUP_CONCAT(DISTINCT A.RTYPE) NOT LIKE '%D%' 
                AND B.ISTYPE = 'RMB' 
                AND E.FLAVOUR LIKE '%PULSA%' 
                THEN CONCAT(
                    '3| Transaksi ', E.FLAVOUR, ' ', E.NAMA,
                    ' gagal, tapi terbentuk RMB. ',
                    'shift:', COALESCE(A.SHIFT, '-'), ', station:', COALESCE(A.STATION, '-'), ', tanggal:', COALESCE(A.TANGGAL, DATE(C.transaksidate)),
                    ', docno:', COALESCE(A.DOCNO, C.NOSTRUK), ', QtyMtran:', IFNULL(A.QTY, 0), ', QtyMstran:', IFNULL(B.QTY, 0),
                    ' (ipulsa_transaksi ktart=', C.KTART, ' status=', C.STATUS, ')'
                )

            WHEN A.PLU IS NULL 
                AND C.KTART = 'Y' 
                AND C.VOUCHERID IS NOT NULL
                THEN CONCAT(
                    '5| Transaksi ',
                    E.FLAVOUR, ' ', E.NAMA,
                    ' sukses di IPULSA_TRANSAKSI (KTART=Y) namun tidak ditemukan di MTRAN. ',
                    'Kemungkinan gagal tercatat di POS. ',
                    'tanggal:', C.transaksidate,
                    ', nostruk:', C.NOSTRUK,
                    ' (status=', C.STATUS, ')'
                )
        END as CHAR) AS keterangan
    FROM MTRAN A
    RIGHT JOIN ipulsa_transaksi C 
        ON A.PLU = C.VOUCHERID 
        AND A.DOCNO = C.NOSTRUK 
        AND A.TANGGAL = DATE(C.transaksidate)
    LEFT JOIN MSTRAN B 
        ON A.PLU = B.PRDCD 
        AND DATE(B.BUKTI_TGL) = COALESCE(A.TANGGAL, DATE(C.transaksidate))
        AND COALESCE(A.DOCNO, C.NOSTRUK) = COALESCE(MID(B.KETER, 1, 9), '')
    LEFT JOIN VIRTUAL_TRX D 
        ON COALESCE(A.PLU, C.VOUCHERID) = D.PLU 
        AND COALESCE(A.DOCNO, C.NOSTRUK) = D.NOSTRUK
    LEFT JOIN PRODMAST E 
        ON COALESCE(A.PLU, C.VOUCHERID) = E.PRDCD
    WHERE 
        DATE(C.transaksidate) = ?
        AND E.PRDCD = ?
    GROUP BY 
        COALESCE(A.SHIFT, '-'), 
        COALESCE(A.STATION, '-'), 
        COALESCE(A.DOCNO, C.NOSTRUK), 
        COALESCE(A.TANGGAL, DATE(C.transaksidate)), 
        COALESCE(A.PLU, C.VOUCHERID)
    HAVING KETERANGAN IS NOT NULL
    ORDER BY COALESCE(A.TANGGAL, DATE(C.transaksidate)) ASC;
    `,
  },
};
