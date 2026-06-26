import mysql from "mysql2/promise";
import moment from "moment";
import logger from "../../config/logger.js";
import {
  connReporting,
  getConWRC,
  conDataDC,
  branchApp,
} from "./exportLapDev.config.js";

const getTableName = (data) => {
  const dateMoment = moment(data.rangeDate);
  const strPeriod = dateMoment.format("YYMM");
  const reportName = data.ktgrLap.toString().toLowerCase();
  const kdcab = data.kode_cab.toString().toLowerCase();
  return `report_${reportName}_${kdcab}_${strPeriod}`;
};

export const openActiveShop = async (data) => {
  const kode_cab = data.kode_cab;
  const strQuery = `SELECT kode_toko as kdtk, nama_toko, kode_gudang, tgl_buka, tok_tgl_tutup, NOW() AS periode FROM mstr_toko_all WHERE
    (tok_tgl_tutup = '0000-00-00' OR (MONTH(tok_tgl_tutup)= MONTH( CURRENT_DATE() ) AND YEAR(tok_tgl_tutup)= YEAR( CURRENT_DATE() ) ) ) AND tgl_buka <= CURDATE() and tgl_buka != '0000-00-00' ORDER BY tgl_buka DESC;`;
  let conWRC;
  try {
    conWRC = await mysql.createConnection(await getConWRC(kode_cab));
    const [rows] = await conWRC.execute(strQuery);
    logger.info("[exportLapDev.service.openActiveShop] sukses, total toko: " + (rows ? rows.length : 0));
    return rows;
  } catch (err) {
    logger.error("[exportLapDev.service.openActiveShop] " + err.message);
    return [];
  } finally {
    if (conWRC) {
      try { await conWRC.close(); } catch (e) { /* safe close */ }
    }
  }
};

export const openPluKategori = async (data) => {
  const ktgrLap = data.ktgrLap;
  const strQuery = "SELECT prdcd, modul, kategori FROM master_plu_kat WHERE kategori=?";
  let conWebReport;
  try {
    conWebReport = await mysql.createConnection(connReporting);
    const [rows] = await conWebReport.execute(strQuery, [ktgrLap]);
    logger.info("[exportLapDev.service.openPluKategori] sukses, total plu: " + (rows ? rows.length : 0));
    return rows;
  } catch (err) {
    logger.error("[exportLapDev.service.openPluKategori] " + err.message);
    return [];
  } finally {
    if (conWebReport) {
      try { await conWebReport.close(); } catch (e) { /* safe close */ }
    }
  }
};

export const createTblPeriode = async (data) => {
  const TblName = getTableName(data);
  const query = "CREATE TABLE IF NOT EXISTS `" + TblName + "` (`kdtk` char(4) NOT NULL DEFAULT '', `tanggal` datetime NOT NULL DEFAULT '0000-00-00 00:00:00', `prdcd` varchar(8) NOT NULL DEFAULT '', `stock_qty` decimal(10,0) DEFAULT '0', `stock_rp` decimal(10,0) DEFAULT '0', `bpb_qty` decimal(10,0) DEFAULT '0', `bpb_rp` decimal(10,0) DEFAULT '0', `sales_qty` decimal(10,0) NOT NULL DEFAULT '0', `sales_rp` decimal(10,0) unsigned NOT NULL DEFAULT '0', `sales_hpp` decimal(10,0) NOT NULL DEFAULT '0', `sales_ppn` decimal(10,0) DEFAULT '0', `ba_qty` decimal(10,0) NOT NULL DEFAULT '0', `ba_rp` decimal(10,0) NOT NULL DEFAULT '0', `so_qty` decimal(10,0) DEFAULT '0', `so_rp` decimal(10,0) DEFAULT '0', `ret_qty` decimal(10,0) DEFAULT '0', `ret_rp` decimal(10,0) DEFAULT '0', `rsk_qty` decimal(10,0) DEFAULT '0', `rsk_rp` decimal(10,0) DEFAULT '0', `promo` decimal(10,0) NOT NULL DEFAULT '0', PRIMARY KEY (`kdtk`,`tanggal`,`prdcd`) ) ENGINE=InnoDB DEFAULT CHARSET=latin1;";
  let conWebReport;
  try {
    conWebReport = await mysql.createConnection(connReporting);
    await conWebReport.execute(query);
    logger.info("[exportLapDev.service.createTblPeriode] tabel " + TblName + " siap");
    return true;
  } catch (err) {
    logger.error("[exportLapDev.service.createTblPeriode] " + err.message);
    return false;
  } finally {
    if (conWebReport) {
      try { await conWebReport.close(); } catch (e) { /* safe close */ }
    }
  }
};

const buildInClause = (arr) => {
  return arr.join(",");
};

const buildShopInClause = (arr) => {
  return arr.map((s) => "'" + s + "'").join(",");
};

const prosesInsert = async (data) => {
  const sourceData = data.valParam;
  const tblName = getTableName(data);
  const sqlValues = data.valData.map((obj) => Object.values(obj));

  if (sqlValues.length === 0) return;

  let conWebReport;
  try {
    conWebReport = await mysql.createConnection(connReporting);

    if (sourceData == "dt") {
      let strInsert = `INSERT IGNORE INTO ${tblName} (kdtk, tanggal, prdcd, sales_qty, sales_rp, sales_hpp, sales_ppn) VALUES ?`;
      strInsert += ` ON DUPLICATE KEY UPDATE sales_qty=values(sales_qty), sales_rp=values(sales_rp), sales_hpp=values(sales_hpp), sales_ppn=values(sales_ppn)`;
      await conWebReport.query(strInsert, [sqlValues]);
      logger.info("[exportLapDev.service.prosesInsert] dt sukses, " + sqlValues.length + " baris");
      return;
    }

    if (sourceData == "wt") {
      const strInsertB = `INSERT IGNORE INTO ${tblName} (kdtk, tanggal, prdcd, bpb_qty, bpb_rp) VALUES ? ON DUPLICATE KEY UPDATE bpb_qty=values(bpb_qty), bpb_rp=values(bpb_rp)`;
      const strInsertSO = `INSERT IGNORE INTO ${tblName} (kdtk, tanggal, prdcd, so_qty, so_rp) VALUES ? ON DUPLICATE KEY UPDATE so_qty=values(so_qty), so_rp=values(so_rp)`;
      const strInsertBA = `INSERT IGNORE INTO ${tblName} (kdtk, tanggal, prdcd, ba_qty, ba_rp) VALUES ? ON DUPLICATE KEY UPDATE ba_qty=values(ba_qty), ba_rp=values(ba_rp)`;
      const strInsertK = `INSERT IGNORE INTO ${tblName} (kdtk, tanggal, prdcd, ret_qty, ret_rp) VALUES ? ON DUPLICATE KEY UPDATE ret_qty=values(ret_qty), ret_rp=values(ret_rp)`;

      const allInsWtB = [];
      const allInsWtSO = [];
      const allInsWtBA = [];
      const allInsWtK = [];

      for (const dataWT of sqlValues) {
        if (dataWT[3] == "B") {
          allInsWtB.push([dataWT[0], dataWT[1], dataWT[2], dataWT[7], dataWT[8]]);
        } else if (dataWT[3] == "X" && dataWT[4] == "SO") {
          allInsWtSO.push([dataWT[0], dataWT[1], dataWT[2], dataWT[7], dataWT[8]]);
        } else if (dataWT[3] == "X" && String(dataWT[4]).includes("BA")) {
          allInsWtBA.push([dataWT[0], dataWT[1], dataWT[2], parseInt(dataWT[7]) * -1, parseInt(dataWT[8]) * -1]);
        } else if (dataWT[3] == "K") {
          allInsWtK.push([dataWT[0], dataWT[1], dataWT[2], dataWT[7], dataWT[8]]);
        }
      }

      if (allInsWtB.length > 0) {
        await conWebReport.query(strInsertB, [allInsWtB]);
      }
      if (allInsWtSO.length > 0) {
        await conWebReport.query(strInsertSO, [allInsWtSO]);
      }
      if (allInsWtBA.length > 0) {
        await conWebReport.query(strInsertBA, [allInsWtBA]);
      }
      if (allInsWtK.length > 0) {
        await conWebReport.query(strInsertK, [allInsWtK]);
      }

      logger.info("[exportLapDev.service.prosesInsert] wt sukses, " + sqlValues.length + " baris");
      return;
    }

    if (sourceData == "st") {
      let strInsert = `INSERT IGNORE INTO ${tblName} (kdtk, tanggal, prdcd, stock_qty, stock_rp) VALUES ?`;
      strInsert += ` ON DUPLICATE KEY UPDATE stock_qty=values(stock_qty), stock_rp=values(stock_rp)`;
      await conWebReport.query(strInsert, [sqlValues]);
      logger.info("[exportLapDev.service.prosesInsert] st sukses, " + sqlValues.length + " baris");
      return;
    }

    if (sourceData == "rsk") {
      let strInsert = `INSERT IGNORE INTO ${tblName} (kdtk, tanggal, prdcd, rsk_qty, rsk_rp) VALUES ?`;
      strInsert += ` ON DUPLICATE KEY UPDATE rsk_qty=values(rsk_qty), rsk_rp=values(rsk_rp)`;
      await conWebReport.query(strInsert, [sqlValues]);
      logger.info("[exportLapDev.service.prosesInsert] rsk sukses, " + sqlValues.length + " baris");
      return;
    }

    if (sourceData == "ntb") {
      let strInsert = `INSERT IGNORE INTO ${tblName} (kdtk, tanggal, prdcd, promo) VALUES ?`;
      strInsert += ` ON DUPLICATE KEY UPDATE promo=values(promo)`;
      await conWebReport.query(strInsert, [sqlValues]);
      logger.info("[exportLapDev.service.prosesInsert] ntb sukses, " + sqlValues.length + " baris");
      return;
    }
  } catch (err) {
    logger.error("[exportLapDev.service.prosesInsert] " + sourceData + " error: " + err.message);
  } finally {
    if (conWebReport) {
      try { await conWebReport.close(); } catch (e) { /* safe close */ }
    }
  }
};

export const openSalesDt = async (data) => {
  const rangeDate = data.rangeDate;
  const kode_cab = data.kode_cab;
  const pluOpen = data.pluOpen;
  const shopOpen = data.shopOpen;

  if (pluOpen.length === 0 || shopOpen.length === 0) {
    logger.warn("[exportLapDev.service.openSalesDt] plu atau toko kosong, skip");
    return [];
  }

  const prdcdIn = buildInClause(pluOpen);
  const shopIn = buildShopInClause(shopOpen);

  const dateMoment = moment(rangeDate);
  const TglDt = "DT_" + dateMoment.format("YYMMDD");
  const strQuery = `SELECT
    SHOP, STR_TO_DATE(TANGGAL,'%d-%m-%Y') as TANGGAL, PRDCD, SUM(IF(RTYPE='J', QTY, QTY*-1)) AS QTY, SUM(IF(RTYPE='J', GROSS, GROSS*-1)) AS GROSS, SUM(IF(RTYPE='J', HPP*QTY, (HPP*QTY)*-1)) AS HPP, SUM(IF(RTYPE='J', PPN, PPN*-1)) AS PPN
    FROM ${TglDt} WHERE PRDCD IN (${prdcdIn}) AND SHOP IN (${shopIn}) GROUP BY SHOP, TANGGAL, PRDCD`;

  let conWRC;
  try {
    conWRC = await mysql.createConnection(await getConWRC(kode_cab));
    const [rows] = await conWRC.execute(strQuery);
    logger.info("[exportLapDev.service.openSalesDt] sukses, " + (rows ? rows.length : 0) + " baris");
    return rows;
  } catch (err) {
    logger.error("[exportLapDev.service.openSalesDt] " + err.message);
    return [];
  } finally {
    if (conWRC) {
      try { await conWRC.close(); } catch (e) { /* safe close */ }
    }
  }
};

export const openDataWt = async (data) => {
  const rangeDate = data.rangeDate;
  const kode_cab = data.kode_cab;
  const pluOpen = data.pluOpen;
  const shopOpen = data.shopOpen;

  if (pluOpen.length === 0 || shopOpen.length === 0) {
    logger.warn("[exportLapDev.service.openDataWt] plu atau toko kosong, skip");
    return [];
  }

  const prdcdIn = buildInClause(pluOpen);
  const shopIn = buildShopInClause(shopOpen);

  const dateMoment = moment(rangeDate);
  const TglDt = "WT_" + dateMoment.format("YYMMDD");
  const strQuery = `SELECT
    SHOP, STR_TO_DATE(TGL1,'%Y-%m-%d') as TGL1, PRDCD, RTYPE, ISTYPE, KETERANGAN, TOKO, SUM(QTY) AS QTY,
    SUM(GROSS) AS GROSS FROM ${TglDt} WHERE RTYPE IN ('X','K','B') AND ISTYPE NOT IN ('KO','BM')
    AND PRDCD IN (${prdcdIn}) AND SHOP IN (${shopIn}) GROUP BY SHOP, TGL1, PRDCD, RTYPE, ISTYPE, TOKO`;

  let conWRC;
  try {
    conWRC = await mysql.createConnection(await getConWRC(kode_cab));
    const [rows] = await conWRC.execute(strQuery);
    logger.info("[exportLapDev.service.openDataWt] sukses, " + (rows ? rows.length : 0) + " baris");
    return rows;
  } catch (err) {
    logger.error("[exportLapDev.service.openDataWt] " + err.message);
    return [];
  } finally {
    if (conWRC) {
      try { await conWRC.close(); } catch (e) { /* safe close */ }
    }
  }
};

export const openDataSt = async (data) => {
  const rangeDate = data.rangeDate;
  const kode_cab = data.kode_cab;
  const pluOpen = data.pluOpen;
  const shopOpen = data.shopOpen;

  if (pluOpen.length === 0 || shopOpen.length === 0) {
    logger.warn("[exportLapDev.service.openDataSt] plu atau toko kosong, skip");
    return [];
  }

  const prdcdIn = buildInClause(pluOpen);
  const shopIn = buildShopInClause(shopOpen);

  const dateMoment = moment(rangeDate);
  const TblTgl = "ST_" + dateMoment.format("YYMMDD");
  const strQuery = `SELECT
    KODE_TOKO, '${dateMoment.format("YYYY-MM-DD")}' AS TANGGAL, PRDCD, QTY, (PRICE*QTY) AS RP
    FROM ${TblTgl} WHERE KODE_TOKO IN (${shopIn}) AND PRDCD IN (${prdcdIn}) AND QTY != 0`;

  let conWRC;
  try {
    conWRC = await mysql.createConnection(await getConWRC(kode_cab));
    const [rows] = await conWRC.execute(strQuery);
    logger.info("[exportLapDev.service.openDataSt] sukses, " + (rows ? rows.length : 0) + " baris");
    return rows;
  } catch (err) {
    logger.error("[exportLapDev.service.openDataSt] " + err.message);
    return [];
  } finally {
    if (conWRC) {
      try { await conWRC.close(); } catch (e) { /* safe close */ }
    }
  }
};

export const getMstxhg = async (data) => {
  const rangeDate = data.rangeDate;
  const kode_cab = data.kode_cab;
  const pluOpen = data.pluOpen;
  const shopOpen = data.shopOpen;

  if (pluOpen.length === 0 || shopOpen.length === 0) {
    logger.warn("[exportLapDev.service.getMstxhg] plu atau toko kosong, skip");
    return [];
  }

  const prdcdIn = buildInClause(pluOpen);
  const shopIn = buildShopInClause(shopOpen);

  const dateMoment = moment(rangeDate);
  const tableOpen = "mstxhg_" + dateMoment.format("YYMM");
  const strQuery = `SELECT
    TOKO AS KDTK, TANGGAL1 as TANGGAL, PRDCD, SUM(QTY) AS QTY, SUM(GROSS) AS GROSS
    FROM ${tableOpen} WHERE PRDCD IN (${prdcdIn}) AND date(TANGGAL1)='${rangeDate}' AND TOKO IN (${shopIn}) GROUP BY TOKO, TANGGAL, PRDCD`;

  let conDC;
  try {
    const dcConfig = await conDataDC(kode_cab);
    if (!dcConfig) {
      logger.warn("[exportLapDev.service.getMstxhg] koneksi DC tidak tersedia untuk " + kode_cab);
      return [];
    }
    conDC = await mysql.createConnection(dcConfig);
    const [rows] = await conDC.execute(strQuery);
    logger.info("[exportLapDev.service.getMstxhg] sukses, " + (rows ? rows.length : 0) + " baris");
    return rows;
  } catch (err) {
    logger.error("[exportLapDev.service.getMstxhg] " + err.message);
    return [];
  } finally {
    if (conDC) {
      try { await conDC.close(); } catch (e) { /* safe close */ }
    }
  }
};

export const getNTB = async (data) => {
  const rangeDate = data.rangeDate;
  const kode_cab = data.kode_cab;
  const pluOpen = data.pluOpen;
  const shopOpen = data.shopOpen;

  if (pluOpen.length === 0 || shopOpen.length === 0) {
    logger.warn("[exportLapDev.service.getNTB] plu atau toko kosong, skip");
    return [];
  }

  const prdcdIn = buildInClause(pluOpen);
  const shopIn = buildShopInClause(shopOpen);

  const dateMoment = moment(rangeDate);
  const tableOpen = "NTB" + dateMoment.format("YYMM");
  const tglCustom = dateMoment.format("DD-MM-YYYY");
  const strQuery = `SELECT
    TOKO AS KDTK, STR_TO_DATE(TANGGAL,'%d-%m-%Y') as TANGGAL, PLU_NTAMBAH, SUM(RP_NTAMBAH) AS GROSS
    FROM ${tableOpen} WHERE PLU_NTAMBAH IN (${prdcdIn}) AND TANGGAL='${tglCustom}' AND TOKO IN (${shopIn}) GROUP BY TOKO, TANGGAL, PLU_NTAMBAH`;

  let conBranch;
  try {
    const branchConfig = await branchApp(kode_cab);
    if (!branchConfig) {
      logger.warn("[exportLapDev.service.getNTB] koneksi branch app tidak tersedia untuk " + kode_cab);
      return [];
    }
    conBranch = await mysql.createConnection(branchConfig);
    const [rows] = await conBranch.execute(strQuery);
    logger.info("[exportLapDev.service.getNTB] sukses, " + (rows ? rows.length : 0) + " baris");
    return rows;
  } catch (err) {
    logger.error("[exportLapDev.service.getNTB] " + err.message);
    return [];
  } finally {
    if (conBranch) {
      try { await conBranch.close(); } catch (e) { /* safe close */ }
    }
  }
};

export const openReportProdsus = async (data) => {
  const rangeDate = data.rangeDate;
  const kode_cab = data.kode_cab;
  const pluOpen = data.pluOpen;
  const shopOpen = data.shopOpen;

  const tblName = getTableName(data);
  const prdcdIn = buildInClause(pluOpen);
  const shopIn = buildShopInClause(shopOpen);

  const strQuery = `SELECT
    * FROM ${tblName} WHERE PRDCD IN (${prdcdIn}) AND KDTK IN (${shopIn})
    AND TANGGAL='${rangeDate}' GROUP BY KDTK, TANGGAL, PRDCD`;

  let conWebReport;
  try {
    conWebReport = await mysql.createConnection(connReporting);
    const [rows] = await conWebReport.execute(strQuery);
    logger.info("[exportLapDev.service.openReportProdsus] sukses, " + (rows ? rows.length : 0) + " baris");
    return rows;
  } catch (err) {
    logger.error("[exportLapDev.service.openReportProdsus] " + err.message);
    return [];
  } finally {
    if (conWebReport) {
      try { await conWebReport.close(); } catch (e) { /* safe close */ }
    }
  }
};

export const prosesOpenData = async (data) => {
  const sources = [
    { fn: openSalesDt, name: "dt" },
    { fn: openDataWt, name: "wt" },
    { fn: openDataSt, name: "st" },
    { fn: getMstxhg, name: "rsk" },
    { fn: getNTB, name: "ntb" },
  ];

  for (const source of sources) {
    try {
      const results = await source.fn(data);
      const strValue = {
        valParam: source.name,
        ktgrLap: data.ktgrLap,
        rangeDate: data.rangeDate,
        kode_cab: data.kode_cab,
        valData: results || [],
      };
      await prosesInsert(strValue);
    } catch (err) {
      logger.error("[exportLapDev.service.prosesOpenData] " + source.name + " gagal: " + err.message);
    }
  }

  logger.info("[exportLapDev.service.prosesOpenData] selesai memproses semua sumber data");
  return "sukses!";
};
