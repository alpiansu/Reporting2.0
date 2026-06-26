import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import excelJS from "exceljs";
import logger from "../../config/logger.js";
import {
  openActiveShop,
  openPluKategori,
  createTblPeriode,
  prosesOpenData,
  openReportProdsus,
} from "./exportLapDev.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPORT_DIR = path.join(__dirname, "../../../exportedLap");

const deleteFile = async (filePath) => {
  try {
    await fs.promises.unlink(filePath);
    logger.info("[exportLapDev.controller.deleteFile] " + filePath + " berhasil dihapus");
  } catch (err) {
    logger.error("[exportLapDev.controller.deleteFile] " + filePath + " gagal dihapus: " + err.message);
  }
};

const ensureExportDir = () => {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
    logger.info("[exportLapDev.controller.ensureExportDir] direktori " + EXPORT_DIR + " dibuat");
  }
};

export const exportLaporanDev = async (req, res) => {
  const workbook = new excelJS.Workbook();
  const data = {
    kode_cab: req.params.cab,
    rangeDate: req.params.tgl,
    ktgrLap: req.params.lap,
    pluOpen: [],
    shopOpen: [],
    pluModul: {},
  };

  logger.info("[exportLapDev.controller.exportLaporanDev] mulai: lap=" + data.ktgrLap + " cab=" + data.kode_cab + " tgl=" + data.rangeDate);

  try {
    const shops = await openActiveShop(data);
    if (shops && shops.length > 0) {
      shops.forEach((row) => {
        data.shopOpen.push(row.kdtk);
      });
      logger.info("[exportLapDev.controller.exportLaporanDev] toko aktif: " + data.shopOpen.length + " toko");
    } else {
      logger.warn("[exportLapDev.controller.exportLaporanDev] tidak ada toko aktif, lanjut dengan data kosong");
    }

    const pluList = await openPluKategori(data);
    if (pluList && pluList.length > 0) {
      pluList.forEach((row) => {
        data.pluOpen.push(row.prdcd);
        data.pluModul[row.prdcd] = row.modul;
      });
      logger.info("[exportLapDev.controller.exportLaporanDev] PLU: " + data.pluOpen.length + " item");
    } else {
      logger.warn("[exportLapDev.controller.exportLaporanDev] tidak ada PLU, lanjut dengan data kosong");
    }

    const tblCreated = await createTblPeriode(data);
    if (!tblCreated) {
      logger.warn("[exportLapDev.controller.exportLaporanDev] tabel tidak dibuat, proses insert akan dilewati");
    }

    await prosesOpenData(data);
    logger.info("[exportLapDev.controller.exportLaporanDev] selesai ekstraksi & insert data");

    const worksheet = workbook.addWorksheet("PER ITEM");

    const reportRows = await openReportProdsus(data);
    if (reportRows && reportRows.length > 0) {
      logger.info("[exportLapDev.controller.exportLaporanDev] data report: " + reportRows.length + " baris");
    } else {
      logger.warn("[exportLapDev.controller.exportLaporanDev] tidak ada data report, Excel akan kosong");
    }

    worksheet.columns = [
      { header: "KDTK", key: "kdtk", width: 7 },
      { header: "TANGGAL", key: "tanggal", width: 10 },
      { header: "PRDCD", key: "prdcd", width: 10 },
      { header: "MODUL", key: "modul", width: 25 },
      { header: "STOCK_QTY", key: "stock_qty", width: 12, style: { numFmt: "#,##0" } },
      { header: "STOCK_RP", key: "stock_rp", width: 12, style: { numFmt: "#,##0" } },
      { header: "BPB_QTY", key: "bpb_qty", width: 12, style: { numFmt: "#,##0" } },
      { header: "BPB_RP", key: "bpb_rp", width: 12, style: { numFmt: "#,##0" } },
      { header: "SALES_QTY", key: "sales_qty", width: 12, style: { numFmt: "#,##0" } },
      { header: "SALES_RP", key: "sales_rp", width: 12, style: { numFmt: "#,##0" } },
      { header: "SALES_HPP", key: "sales_hpp", width: 12, style: { numFmt: "#,##0" } },
      { header: "SALES_PPN", key: "sales_ppn", width: 12, style: { numFmt: "#,##0" } },
      { header: "BA_QTY", key: "ba_qty", width: 12, style: { numFmt: "#,##0" } },
      { header: "BA_RP", key: "ba_rp", width: 12, style: { numFmt: "#,##0" } },
      { header: "SO_QTY", key: "so_qty", width: 12, style: { numFmt: "#,##0" } },
      { header: "SO_RP", key: "so_rp", width: 12, style: { numFmt: "#,##0" } },
      { header: "RET_QTY", key: "ret_qty", width: 12, style: { numFmt: "#,##0" } },
      { header: "RET_RP", key: "ret_rp", width: 12, style: { numFmt: "#,##0" } },
      { header: "RSK_QTY", key: "rsk_qty", width: 12, style: { numFmt: "#,##0" } },
      { header: "RSK_RP", key: "rsk_rp", width: 12, style: { numFmt: "#,##0" } },
      { header: "PROMO", key: "promo", width: 12, style: { numFmt: "#,##0" } },
    ];

    if (reportRows && reportRows.length > 0) {
      for (const row of reportRows) {
        row.modul = data.pluModul[row.prdcd] || "";
        Object.keys(row).forEach((key) => {
          if (key != "kdtk" && key != "tanggal" && key != "prdcd" && key != "modul") {
            row[key] = parseInt(row[key]) || 0;
          }
        });
        worksheet.addRow(row);
      }
    }

    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
    });

    ensureExportDir();

    const fileNameXlsx = `${data.ktgrLap}-${data.kode_cab}(${data.rangeDate}).xlsx`;
    const filePath = path.join(EXPORT_DIR, fileNameXlsx);

    await workbook.xlsx.writeFile(filePath);
    logger.info("[exportLapDev.controller.exportLaporanDev] file Excel berhasil ditulis: " + fileNameXlsx);

    res.download(filePath, (errDownload) => {
      if (!errDownload) {
        deleteFile(filePath);
      }
    });
  } catch (err) {
    logger.error("[exportLapDev.controller.exportLaporanDev] error: " + err.message);
    if (!res.headersSent) {
      res.json({
        message: "Something went wrong :" + err.message,
      });
    }
  }
};
