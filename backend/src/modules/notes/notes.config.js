/**
 * Configuration for Notes module
 */
import path from "path";

export default {
  jsonPath: path.join(process.cwd(), "data/notes.json"),
  cacheTTL: 60 * 1000, // 1 minute cache
  autoNotes: {
    checkQtyRmb: `SELECT 
                        PRDCD, BUKTI_TGL, ISTYPE, QTY, PRICE, GROSS, 
                        '8| ERROR - Terdapat transaksi dengan ISTYPE RMB yang memiliki QTY tidak sama dengan 1' as ERROR_MSG,
                        COUNT(*) as COUNT
                    FROM MSTRAN 
                    WHERE PRDCD = ? 
                    AND DATE(BUKTI_TGL) = ? 
                    AND ISTYPE='RMB' 
                    AND QTY != 1;`,
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
      CAST(CASE
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
      HAVING keterangan IS NOT NULL )XX GROUP BY SHIFT, STATION, DOCNO, TANGGAL,PLU ORDER BY TANGGAL ASC;
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

            WHEN (C.STATUS != 1 AND C.KTART IS NOT NULL) 
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
    rekonVirtualMrgEnhanced: `
      SELECT 
          COALESCE(A.TANGGAL, DATE(C.TransaksiDate), DATE(B.BUKTI_TGL)) AS TANGGAL,
          COALESCE(A.SHIFT, C.Shift, '-') AS SHIFT,
          COALESCE(A.STATION, C.Station, '-') AS STATION,
          COALESCE(A.DOCNO, C.NoStruk, MID(B.KETER, 1, 9), '-') AS DOCNO,
          COALESCE(A.PLU, B.PRDCD, C.VoucherID, D.PLU) AS PRDCD,
          COALESCE(E.NAMA, C.VoucherNama, '-') AS NAMA_PRODUK,
          COALESCE(E.FLAVOUR, '-') AS FLAVOUR,
          A.TTYPE AS TTYPE_MTRAN,
          GROUP_CONCAT(DISTINCT A.RTYPE ORDER BY A.RTYPE DESC) AS RTYPE_MTRAN,
          B.ISTYPE AS ISTYPE_MSTRAN,
          IFNULL(A.QTY, 0) AS QTY_MTRAN,
          IFNULL(B.QTY, 0) AS QTY_MSTRAN,
          C.TransaksiID AS IPULSA_TRXID,
          C.Status AS IPULSA_STATUS,
          C.KetStatus AS IPULSA_KET,
          C.KTart AS IPULSA_KTART,
          D.LastRespKode AS VIRTUAL_RESPKODE,
          D.LastRespDetil AS VIRTUAL_RESPDETIL,
          CAST(CASE
              -- Pola 1A: Qty MTRAN > 1 (Akumulasi kasir sebelum struk terbit)
              WHEN A.QTY > 1 AND (B.QTY IS NULL OR A.QTY > B.QTY) 
                  THEN CONCAT('1| Terload kembali ke POS kasir (Akumulasi QTY=', A.QTY, ', RMB=', IFNULL(B.QTY, 0), '). Kasir scan ulang sebelum struk tercetak.')
              
              -- Pola 1B: Qty MTRAN > Qty MSTRAN dan Sukses
              WHEN (A.QTY > IFNULL(B.QTY, 0)) AND (C.Status = '1' OR C.KTart = 'Y' OR D.LastRespDetil LIKE '%suk%')
                  THEN CONCAT('1| Terload kembali ke POS kasir (Multi-DOCNO/Double Struk). Qty MTRAN=', A.QTY, ' > RMB=', IFNULL(B.QTY, 0), '. DOCNO:', A.DOCNO)
                  
              -- Pola 1C: MTRAN ada tapi tidak ada di IPULSA & MSTRAN (Struk orphan karena NoStruk ter-overwrite transaksi baru)
              WHEN A.QTY >= 1 AND B.QTY IS NULL AND C.TransaksiID IS NULL AND D.IDTran IS NULL
                  THEN CONCAT('1| MTRAN terbentuk (Qty=', A.QTY, ') tapi data IPULSA & RMB nihil. Indikasi NoStruk ter-overwrite transaksi baru / data struk tidak terlink.')
                  
              -- Pola 2A: IPULSA Status != 1 (Gagal Vendor / Timeout)
              WHEN C.Status IS NOT NULL AND C.Status != '1' AND (B.QTY IS NULL OR B.QTY = 0)
                  THEN CONCAT('2| Transaksi GAGAL IPULSA (Status:', C.Status, ' - ', IFNULL(C.KetStatus, 'Timeout/Gagal Vendor'), '), BATV & RMB tidak terbentuk.')
                  
              -- Pola 2B: MTRAN ada, tapi tidak terbentuk RMB dan tidak terbentuk BATV
              WHEN A.QTY > 0 AND (B.QTY IS NULL OR B.QTY = 0) AND (C.Status != '1' OR C.KTart IS NULL) AND A.TTYPE <> 'BATV'
                  THEN CONCAT('2| Transaksi GAGAL / Menggantung (Qty MTRAN=', A.QTY, ', RMB nihil, TTYPE<>BATV). Status IPULSA:', IFNULL(C.Status, 'N/A'))
                  
              -- Pola 3: Gagal IPULSA tapi terbentuk RMB di MSTRAN
              WHEN (C.Status IS NOT NULL AND C.Status != '1') AND B.ISTYPE = 'RMB'
                  THEN CONCAT('3| Transaksi GAGAL di IPULSA (Status:', C.Status, ') tapi RMB terbentuk di MSTRAN.')
                  
              -- Pola 4: Salah Flag SUPCO di MSTRAN / PRODMAST
              WHEN (B.SUPCO = 'V' OR E.SUPCO = 'V')
                  THEN CONCAT('4| Indikasi salah flag SUPCO vendor (SUPCO: ', IFNULL(B.SUPCO, E.SUPCO), ').')
                  
              -- Pola 5: Sukses di IPULSA tapi tidak ada di MTRAN (Gagal cetak struk POS kasir)
              WHEN A.PLU IS NULL AND (C.Status = '1' OR C.KTart = 'Y')
                  THEN CONCAT('5| Transaksi SUKSES di IPULSA (Status:', C.Status, ', TrxID:', C.TransaksiID, ') tapi struk MTRAN TIDAK terbentuk di POS kasir.')
                  
              -- Pola 6: Sukses tapi terbentuk BATV
              WHEN (C.Status = '1' OR C.KTart = 'Y') AND (A.TTYPE = 'BATV' OR GROUP_CONCAT(DISTINCT A.RTYPE) LIKE '%D%')
                  THEN CONCAT('6| Transaksi SUKSES tapi terbentuk retur/BATV di MTRAN. Docno:', A.DOCNO)
                  
              -- Pola 8: QTY RMB <> 1
              WHEN B.ISTYPE = 'RMB' AND B.QTY != 1
                  THEN CONCAT('8| QTY RMB di MSTRAN tidak sama dengan 1 (Qty:', B.QTY, ').')
                  
              -- Default jika ada selisih
              WHEN IFNULL(A.QTY, 0) != IFNULL(B.QTY, 0)
                  THEN CONCAT('Penyebab selisih: QTY MTRAN (', IFNULL(A.QTY, 0), ') != QTY MSTRAN RMB (', IFNULL(B.QTY, 0), '). Status IPULSA:', IFNULL(C.Status, '-'))
              ELSE 'Transaksi Normal / Match'
          END AS CHAR) AS DIAGNOSA
      FROM MTRAN A
      LEFT JOIN MSTRAN B 
          ON A.PLU = B.PRDCD 
          AND A.TANGGAL = DATE(B.BUKTI_TGL) 
          AND (A.DOCNO = COALESCE(MID(B.KETER,1,9),'') OR B.KETER LIKE CONCAT('%', A.DOCNO, '%'))
          AND B.ISTYPE = 'RMB'
      LEFT JOIN ipulsa_transaksi C 
          ON A.PLU = C.VOUCHERID 
          AND A.DOCNO = C.NoStruk 
          AND A.TANGGAL = DATE(C.TransaksiDate)
      LEFT JOIN virtual_trx D 
          ON A.PLU = D.PLU 
          AND A.DOCNO = D.NoStruk 
          AND A.TANGGAL = DATE(D.TanggalTran)
      LEFT JOIN PRODMAST E 
          ON A.PLU = E.PRDCD
      WHERE A.TANGGAL = ? AND A.PLU = ?
      GROUP BY A.SHIFT, A.STATION, A.DOCNO, A.TANGGAL, A.PLU

      UNION ALL

      SELECT 
          DATE(C.TransaksiDate) AS TANGGAL,
          C.Shift AS SHIFT,
          C.Station AS STATION,
          C.NoStruk AS DOCNO,
          C.VoucherID AS PRDCD,
          C.VoucherNama AS NAMA_PRODUK,
          COALESCE(E.FLAVOUR, '-') AS FLAVOUR,
          NULL AS TTYPE_MTRAN,
          NULL AS RTYPE_MTRAN,
          B.ISTYPE AS ISTYPE_MSTRAN,
          0 AS QTY_MTRAN,
          IFNULL(B.QTY, 0) AS QTY_MSTRAN,
          C.TransaksiID AS IPULSA_TRXID,
          C.Status AS IPULSA_STATUS,
          C.KetStatus AS IPULSA_KET,
          C.KTart AS IPULSA_KTART,
          NULL AS VIRTUAL_RESPKODE,
          NULL AS VIRTUAL_RESPDETIL,
          CONCAT('5| Transaksi SUKSES di IPULSA (Status:', C.Status, ', TrxID:', C.TransaksiID, ') tapi struk MTRAN TIDAK terbentuk di POS kasir.') AS DIAGNOSA
      FROM ipulsa_transaksi C
      LEFT JOIN MTRAN A 
          ON C.VOUCHERID = A.PLU 
          AND C.NoStruk = A.DOCNO 
          AND DATE(C.TransaksiDate) = A.TANGGAL
      LEFT JOIN MSTRAN B 
          ON C.VOUCHERID = B.PRDCD 
          AND DATE(C.TransaksiDate) = DATE(B.BUKTI_TGL) 
          AND (C.NoStruk = COALESCE(MID(B.KETER,1,9),'') OR B.KETER LIKE CONCAT('%', C.NoStruk, '%'))
          AND B.ISTYPE = 'RMB'
      LEFT JOIN PRODMAST E 
          ON C.VOUCHERID = E.PRDCD
      WHERE DATE(C.TransaksiDate) = ? 
          AND C.VOUCHERID = ? 
          AND A.DOCNO IS NULL
          AND (C.Status = '1' OR C.KTart = 'Y')
      ORDER BY TANGGAL ASC, DOCNO ASC;
    `,
    rawMtran: `
      SELECT 
          STATION, SHIFT, DOCNO, NO_BON, JAM, RTYPE, TTYPE, PLU, QTY, PRICE, GROSS, ADDTIME, KET 
      FROM MTRAN 
      WHERE TANGGAL = ? AND PLU = ? 
      ORDER BY JAM ASC, DOCNO ASC;
    `,
    rawMstran: `
      SELECT 
          BUKTI_NO, BUKTI_TGL, JAM, RTYPE, ISTYPE, PRDCD, QTY, PRICE, GROSS, KETER, SUPCO, addid, ADDTIME 
      FROM MSTRAN 
      WHERE DATE(BUKTI_TGL) = ? AND PRDCD = ? 
      ORDER BY JAM ASC, BUKTI_NO ASC;
    `,
    rawIpulsa: `
      SELECT 
          TransaksiID, TransaksiDate, VoucherID, VoucherNama, NoHP, NoStruk, Station, Shift, Status, KetStatus, KTart, NoSerial, Denum, provider, hpp 
      FROM ipulsa_transaksi 
      WHERE DATE(TransaksiDate) = ? AND VoucherID = ? 
      ORDER BY TransaksiDate ASC;
    `,
    rawVirtualTrx: `
      SELECT 
          jenisTran, IDTran, TanggalTran, PLU, NoStruk, Station, Shift, Harga, LastRespKode, LastRespDetil, SendPos, NoBPB, TanggalBPB 
      FROM virtual_trx 
      WHERE DATE(TanggalTran) = ? AND PLU = ? 
      ORDER BY TanggalTran ASC;
    `,
  },
};
