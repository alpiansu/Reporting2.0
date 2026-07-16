const NRB_CONFIG = {
  queries: {
    wrcHeader: `
      SELECT
        (SELECT CONCAT(kode_toko, ' - ', nama_toko) FROM mstr_toko_all WHERE kode_toko = ?) AS TOKO_ASAL,
        M.BUKTI_NO,
        DATE(M.TGL1) AS BUKTI_TGL,
        M.TOKO,
        M.SUPCO,
        M.KETERANGAN,
        IFNULL(S.STATUS_RETUR, 'RT') AS STATUS_RETUR
      FROM wt_{tanggal} M
      LEFT JOIN SUPMAST_toko S ON M.SUPCO = S.SUPCO
      WHERE M.RTYPE = 'K' AND M.BUKTI_NO = ? AND M.SHOP = ?
      LIMIT 1
    `,
    wrcDetail: `
      SELECT a.*, IFNULL(b.supco,'') supco, IFNULL(b.nama,'') nama
      FROM (
        SELECT
          IF(GUDANG <> '', 1, 2) AS TIPE,
          P.SINGKATAN AS SINGKATAN,
          P.UNIT,
          M.KETERANGAN,
          M.PRDCD,
          M.QTY,
          IFNULL(S.STATUS_RETUR, 'RT') AS STATUS_RETUR,
          P.PTAG,
          M.BUKTI_NO,
          DATE(TGL1) AS TGL1,
          M.DOCNO2,
          M.ISTYPE,
          M.TOKO,
          CAST(IF(
            CONCAT('E-', IFNULL(R.MAX_RET_TOKO2DCI,''), IFNULL(R.MAX_RET_TOKO2DCI_S,'')) = 'E-', '',
            CONCAT('E-', IFNULL(R.MAX_RET_TOKO2DCI,''), IFNULL(R.MAX_RET_TOKO2DCI_S,''))
          ) AS CHAR) AS EXPIRED
        FROM wt_{tanggal} M
        LEFT JOIN supmast S ON M.SUPCO = S.SUPCO
        LEFT JOIN pr_{tanggal} P ON M.PRDCD = P.PRDCD AND M.SHOP = P.TOKO
        LEFT JOIN BATAS_RETUR R ON P.PRDCD = R.FMKODE
        WHERE M.RTYPE = 'K' AND M.BUKTI_NO = ? AND M.SHOP = ?
      ) a
      LEFT JOIN supmast b ON a.TOKO = b.SUPCO
    `,
    storeHeader: `
      SELECT
        (SELECT CONCAT(kdtk, ' - ', nama) FROM toko) AS TOKO_ASAL,
        m.BUKTI_NO,
        DATE(m.BUKTI_TGL) AS BUKTI_TGL,
        m.GUDANG AS TOKO,
        m.SUPCO,
        m.KETER as KETERANGAN,
        IFNULL(S.STATUS_RETUR, 'RT') AS STATUS_RETUR
      FROM mstran m
      LEFT JOIN supmast S ON m.SUPCO = S.SUPCO
      WHERE m.bukti_no = ? AND m.rtype = 'K'
      LIMIT 1
    `,
    storeDetail: `
      SELECT a.*, IFNULL(b.supco,'') supco, IFNULL(b.kode_supplier,'') kode_supplier, IFNULL(b.nama,'') nama, ifnull(c.nama_dc, '') nama_dc
      FROM (
        SELECT
          IF(GUDANG <> '', 1, 2) AS TIPE,
          P.SINGKATAN AS SINGKATAN,
          P.UNIT,
          M.KETER as KETERANGAN,
          M.PRDCD,
          M.QTY,
          IFNULL(S.STATUS_RETUR, 'RT') AS STATUS_RETUR,
          P.PTAG,
          M.BUKTI_NO,
          DATE(BUKTI_TGL) AS TGL1,
          M.INVNO AS DOCNO2,
          M.ISTYPE,
          IF(ISTYPE='L', M.SUPCO, M.GUDANG) AS TOKO,
          CAST(IF(
            CONCAT('E-', IFNULL(R.MAX_RET_TOKO2DCI,''), IFNULL(R.MAX_RET_TOKO2DCI_S,'')) = 'E-', '',
            CONCAT('E-', IFNULL(R.MAX_RET_TOKO2DCI,''), IFNULL(R.MAX_RET_TOKO2DCI_S,''))
          ) AS CHAR) AS EXPIRED
        FROM mstran M
        LEFT JOIN supmast S ON M.SUPCO = S.SUPCO
        LEFT JOIN prodmast P ON M.PRDCD = P.PRDCD
        LEFT JOIN BATAS_RETUR R ON P.PRDCD = R.FMKODE
        WHERE M.RTYPE = 'K' AND M.BUKTI_NO = ?
      ) a
      LEFT JOIN supmast b ON a.TOKO = b.SUPCO
      LEFT JOIN (SELECT * FROM DCMAST where type_dc != 'DCB' limit 1) c ON  a.TOKO = c.KODE_DC
    `,
  },

  helpers: {
    toTableDate(date) {
      const d = date instanceof Date ? date : new Date(date);
      const yy = String(d.getFullYear()).slice(2);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yy}${mm}${dd}`;
    },

    parseKeterangan(keterangan) {
      if (!keterangan) return { kode: "", label: "" };
      const match = keterangan.trim().match(/^(\d+)\s+(.*)$/);
      if (!match) return { kode: "", label: keterangan.trim() };
      return { kode: match[1], label: match[2] };
    },

    formatSectionCategory(keterangan) {
      const parsed = NRB_CONFIG.helpers.parseKeterangan(keterangan);
      const { kode, label } = parsed;
      if (!kode) return "";
      const prefix = kode.substring(0, 2);
      return label ? `${prefix} - ${label}` : prefix;
    },
  },

  layout: {
    PAGE_WIDTH: 595.28,
    PAGE_HEIGHT: 841.89,
    MARGIN_LEFT: 25,
    MARGIN_RIGHT: 25,
    MARGIN_TOP: 20,
    FONT_SIZE: {
      TITLE: 12,
      HEADER: 8,
      TABLE_HEADER: 7,
      TABLE_BODY: 7,
      SECTION: 7,
      FOOTER: 8,
    },
    COLUMN_WIDTHS: {
      NO: 30,
      PLU: 55,
      NAMA: 140,
      SAT: 25,
      KTS: 30,
      STATUS: 45,
      TAG: 25,
      EXPIRED: 90,
      KET: 90,
    },
    ROW_HEIGHT: 11,
    TABLE_TOP_Y: 145,
  },
};

export default NRB_CONFIG;
