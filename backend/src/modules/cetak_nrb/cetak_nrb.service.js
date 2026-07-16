import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import { PDFDocument, StandardFonts } from "pdf-lib";
import logger from "../../config/logger.js";
import config from "./cetak_nrb.config.js";
import dbStore from "../../config/db_store.js";
import wrcBulananService from "../../services/wrc.service.js";
import storeService from "../store/storeService.js";
import jenisReturService from "../jenis-retur/jenis-retur.service.js";
import MCabangService from "../m_cabang/m_cabang.service.js";
const mCabangService = new MCabangService();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, "../../output/nrb");
const TABLE_DATE_REGEX = /^\d{6}$/;

class CetakNrbService {
  cleanupOutputDirectory() {
    try {
      if (fs.existsSync(OUTPUT_DIR)) {
        const files = fs.readdirSync(OUTPUT_DIR);
        for (const file of files) {
          const filePath = path.join(OUTPUT_DIR, file);
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
          }
        }
        logger.info(`[cetak_nrb] Cleaned output directory: ${OUTPUT_DIR}`);
      }
    } catch (error) {
      logger.error(`[cetak_nrb] Failed to cleanup output: ${error.message}`);
    }
  }

  async getStorePool(storeCode) {
    const storeInfo = await storeService.getStoreIPHost(storeCode);
    if (!storeInfo || !storeInfo.dbHost) {
      throw new Error(`Store IP not found for ${storeCode}`);
    }
    return dbStore.createDbStore(storeInfo.dbHost);
  }

  async getWrcPool(cabang) {
    const wrcService = new wrcBulananService();
    const wrcConfig = await wrcService.getConnWRC(cabang);
    return mysql.createPool({ ...wrcConfig, connectionLimit: 3 });
  }

  async fetchWrcHeader(pool, bukti_no, shop, tableDate) {
    const query = config.queries.wrcHeader.split("{tanggal}").join(tableDate);
    const [rows] = await pool.query(query, [shop, bukti_no, shop]);
    return rows[0] || null;
  }

  async fetchStoreHeader(pool, bukti_no) {
    const [rows] = await pool.query(config.queries.storeHeader, [bukti_no]);
    return rows[0] || null;
  }

  async fetchWrcDetails(pool, bukti_no, shop, tableDate) {
    const query = config.queries.wrcDetail.split("{tanggal}").join(tableDate);
    logger.info(`[cetak_nrb] fetchWrcDetails: shop=${shop}, bukti_no=${bukti_no}, tableDate=${tableDate}`);
    logger.info(`[cetak_nrb] fetchWrcDetails resolved query:\n${query}`);
    const [rows] = await pool.query(query, [bukti_no, shop]);
    logger.info(`[cetak_nrb] fetchWrcDetails result: ${rows.length} rows`);
    if (rows.length > 0) {
      logger.info(`[cetak_nrb] fetchWrcDetails first row keys: ${JSON.stringify(Object.keys(rows[0]))}`);
    }
    return rows || [];
  }

  async fetchStoreDetails(pool, bukti_no) {
    const [rows] = await pool.query(config.queries.storeDetail, [bukti_no]);
    return rows || [];
  }

  resolveHeaderArgs(source, bukti_no, shop, tableDate) {
    if (source === "wrc") return [shop, bukti_no, shop];
    return [bukti_no];
  }

  resolveDetailArgs(source, bukti_no, shop, tableDate) {
    if (source === "wrc") return [shop, bukti_no, shop];
    return [bukti_no];
  }

  async processCetakNrb({ cabang, store, bukti_no, source, tanggal, username }) {
    this.cleanupOutputDirectory();

    if (!store) throw new Error("Store code must be specified");
    if (!cabang) throw new Error("Cabang must be specified");
    if (!bukti_no) throw new Error("Bukti No must be specified");
    if (!source || !["wrc", "store"].includes(source)) {
      throw new Error("Source must be 'wrc' or 'store'");
    }

    const selectedStore = await storeService.getStoreByCode(store);
    if (!selectedStore) throw new Error(`Store ${store} not found`);

    logger.info(`[cetak_nrb] Processing NRB: store=${store}, source=${source}, user=${username}`);

    let storePool = null;
    let wrcPool = null;

    try {
      if (source === "wrc") {
        if (!tanggal) throw new Error("Tanggal is required for WRC source");
        const tableDate = config.helpers.toTableDate(new Date(tanggal));
        if (!TABLE_DATE_REGEX.test(tableDate)) {
          throw new Error(`Invalid table date: ${tableDate}`);
        }

        wrcPool = await this.getWrcPool(cabang);
        const header = await this.fetchWrcHeader(wrcPool, bukti_no, store, tableDate);
        if (!header) {
          throw new Error(`Bukti No ${bukti_no} tidak ditemukan di WRC toko ${store}`);
        }
        const details = await this.fetchWrcDetails(wrcPool, bukti_no, store, tableDate);

        const firstDetail = details[0] || {};
        const istype = String(firstDetail.ISTYPE || "").trim();
        const isL = istype === "L";

        let tujuanRetur;
        if (isL) {
          tujuanRetur = `${firstDetail.TOKO || ""} - ${firstDetail.nama || ""}`;
        } else {
          const cabangData = await mCabangService.getCabangByCode(firstDetail.TOKO);
          const namaDc = cabangData ? cabangData.namacab : "";
          for (const d of details) d.nama_dc = namaDc;
          tujuanRetur = `${firstDetail.TOKO || ""} - ${namaDc || ""}`;
        }

        const outName = `NRB_${store}_${bukti_no}.pdf`;
        const outPath = path.join(OUTPUT_DIR, outName);
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        await this.generatePdfFile(store, bukti_no, header, details, outPath, { tujuanRetur });
        return { success: true, filePath: outPath, fileName: outName };
      } else {
        storePool = await this.getStorePool(store);
        const header = await this.fetchStoreHeader(storePool, bukti_no);
        if (!header) {
          throw new Error(`Bukti No ${bukti_no} tidak ditemukan di toko ${store}`);
        }
        const details = await this.fetchStoreDetails(storePool, bukti_no);

        const firstDetail = details[0] || {};
        const istype = String(firstDetail.ISTYPE || "").trim();
        const isL = istype === "L";

        const tujuanRetur = isL
          ? `${firstDetail.supco || ""} - ${firstDetail.nama || ""}`
          : `${firstDetail.TOKO || ""} - ${firstDetail.nama_dc || ""}`;

        const outName = `NRB_${store}_${bukti_no}.pdf`;
        const outPath = path.join(OUTPUT_DIR, outName);
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        await this.generatePdfFile(store, bukti_no, header, details, outPath, { tujuanRetur });
        return { success: true, filePath: outPath, fileName: outName };
      }
    } catch (error) {
      logger.error(`[cetak_nrb] Processing failed: ${error.message}`);
      throw error;
    } finally {
      if (wrcPool) await wrcPool.end().catch(() => {});
      if (storePool) await storePool.end().catch(() => {});
    }
  }

  async generatePdfFile(kdtk, bukti_no, header, details, outputPath, { tujuanRetur }) {
    const pdfDoc = await PDFDocument.create();
    const L = config.layout;
    const FS = L.FONT_SIZE;
    const CW = L.COLUMN_WIDTHS;

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const formatDate = d => {
      if (!d) return "";
      const s = typeof d === "string" ? d.substring(0, 10) : d.toISOString().substring(0, 10);
      const [y, m, day] = s.split("-");
      return `${m}/${day}/${y}`;
    };

    const formatShortDate = d => {
      if (!d) return "";
      const s = typeof d === "string" ? d.substring(0, 10) : d.toISOString().substring(0, 10);
      const [y, m, day] = s.split("-");
      return `${day}/${m}/${y}`;
    };

    const tokoAsal = header.TOKO_ASAL || "";
    const buktiTgl = header.BUKTI_TGL;
    const keterangan = header.KETERANGAN || "";
    const tipeRetur = config.helpers.parseKeterangan(keterangan);
    const firstDetail = details[0] || {};

    const istype = String(firstDetail.ISTYPE || "").trim();
    const jenisRetur = await jenisReturService.getByKode(istype);
    const sectionCategory = jenisRetur ? `${istype} - ${jenisRetur.label}` : "";

    let page;
    let currentY;
    let pageNo = 0;

    const drawPageHeader = () => {
      page = pdfDoc.addPage([L.PAGE_WIDTH, L.PAGE_HEIGHT]);
      pageNo++;
      const { width, height } = page.getSize();
      currentY = height - L.MARGIN_TOP;

      page.drawText(tokoAsal, {
        x: L.MARGIN_LEFT,
        y: currentY,
        size: FS.HEADER,
        font: fontBold,
      });

      const printDate = `Tgl. Print :${formatShortDate(new Date())}`;
      page.drawText(printDate, {
        x: width - L.MARGIN_RIGHT - font.widthOfTextAtSize(printDate, FS.HEADER),
        y: currentY,
        size: FS.HEADER,
        font,
      });

      currentY -= 25;
      const titleX = (width - fontBold.widthOfTextAtSize("NOTA RETUR BARANG", FS.TITLE)) / 2;
      page.drawText("NOTA RETUR BARANG", {
        x: titleX,
        y: currentY,
        size: FS.TITLE,
        font: fontBold,
      });

      currentY -= 20;
      const infoX = width - L.MARGIN_RIGHT - 200;
      const drawInfoLine = (label, value, yOff) => {
        page.drawText(label, { x: infoX, y: currentY - yOff, size: FS.HEADER, font });
        page.drawText(`: ${value}`, { x: infoX + 60, y: currentY - yOff, size: FS.HEADER, font });
      };

      drawInfoLine("No", bukti_no, 0);
      drawInfoLine("Tgl.", formatDate(buktiTgl), 13);
      drawInfoLine("Ke", tujuanRetur, 26);
      drawInfoLine("Tipe Retur", `${tipeRetur.kode} ${tipeRetur.label}`.trim(), 39);

      currentY -= 55;
      page.drawLine({
        start: { x: L.MARGIN_LEFT, y: currentY },
        end: { x: width - L.MARGIN_RIGHT, y: currentY },
        thickness: 1,
      });

      currentY -= 14;
      const tableStartX = L.MARGIN_LEFT;
      let colX = tableStartX;

      const drawCol = (text, w, headerFont) => {
        page.drawText(text, { x: colX + 2, y: currentY, size: FS.TABLE_HEADER, font: headerFont || font });
        colX += w;
      };

      drawCol("No.", CW.NO, fontBold);
      drawCol("PLU", CW.PLU, fontBold);
      drawCol("Nama Barang dan", CW.NAMA, fontBold);
      drawCol("Sat", CW.SAT, fontBold);
      drawCol("Kts.", CW.KTS, fontBold);
      drawCol("Status", CW.STATUS, fontBold);
      drawCol("Tag", CW.TAG, fontBold);
      drawCol("Saat Turun Pajang", CW.EXPIRED, fontBold);
      drawCol("Ket./Nomor Referensi", CW.KET, fontBold);

      currentY -= 10;
      page.drawText("Spesifikasan", {
        x: tableStartX + CW.NO + CW.PLU + 2,
        y: currentY,
        size: FS.TABLE_HEADER,
        font: fontBold,
      });
      page.drawText("dan Retur Ke DCI", {
        x: tableStartX + CW.NO + CW.PLU + CW.NAMA + CW.SAT + CW.KTS + CW.STATUS + CW.TAG + 2,
        y: currentY,
        size: FS.TABLE_HEADER,
        font: fontBold,
      });
      page.drawText("Dokumen", {
        x: tableStartX + CW.NO + CW.PLU + CW.NAMA + CW.SAT + CW.KTS + CW.STATUS + CW.TAG + CW.EXPIRED + 2,
        y: currentY,
        size: FS.TABLE_HEADER,
        font: fontBold,
      });

      currentY -= 6;
      page.drawLine({
        start: { x: L.MARGIN_LEFT, y: currentY },
        end: { x: width - L.MARGIN_RIGHT, y: currentY },
        thickness: 1,
      });
      currentY -= 10;
    };

    const drawSectionCategory = () => {
      if (!sectionCategory) return;
      const text = ` ${sectionCategory}`;
      const width = L.PAGE_WIDTH - L.MARGIN_LEFT - L.MARGIN_RIGHT;
      page.drawRectangle({
        x: L.MARGIN_LEFT,
        y: currentY - 2,
        width,
        height: 12,
        borderColor: undefined,
        borderWidth: 0,
      });
      page.drawText(text, {
        x: L.MARGIN_LEFT + 4,
        y: currentY,
        size: FS.SECTION,
        font: fontBold,
      });
      currentY -= 13;
    };

    drawPageHeader();
    drawSectionCategory();

    const tableWidth = CW.NO + CW.PLU + CW.NAMA + CW.SAT + CW.KTS + CW.STATUS + CW.TAG + CW.EXPIRED + CW.KET;
    const bottomThreshold = 120;

    let no = 1;
    for (const d of details) {
      if (currentY < bottomThreshold) {
        const tableBottomY = currentY + 4;
        page.drawLine({
          start: { x: L.MARGIN_LEFT, y: tableBottomY },
          end: { x: L.MARGIN_LEFT + tableWidth, y: tableBottomY },
          thickness: 0.5,
        });

        drawPageHeader();
        drawSectionCategory();
      }

      let colX = L.MARGIN_LEFT;
      const drawCell = (text, w) => {
        page.drawText(String(text || ""), {
          x: colX + 2,
          y: currentY,
          size: FS.TABLE_BODY,
          font,
        });
        colX += w;
      };

      drawCell(`${no}.`, CW.NO);
      drawCell(d.PRDCD, CW.PLU);
      drawCell((d.SINGKATAN || "").substring(0, 35), CW.NAMA);
      drawCell(d.UNIT, CW.SAT);
      drawCell(d.QTY, CW.KTS);
      drawCell(d.STATUS_RETUR, CW.STATUS);
      drawCell(d.PTAG, CW.TAG);
      drawCell(d.EXPIRED, CW.EXPIRED);
      drawCell(d.DOCNO2, CW.KET);

      currentY -= L.ROW_HEIGHT;
      no++;
    }

    const tableBottomY = currentY + 4;
    page.drawLine({
      start: { x: L.MARGIN_LEFT, y: tableBottomY },
      end: { x: L.MARGIN_LEFT + tableWidth, y: tableBottomY },
      thickness: 1,
    });

    currentY -= 30;

    if (currentY < 140) {
      drawPageHeader();
    }

    currentY -= 10;
    const sigBlockWidth = (L.PAGE_WIDTH - L.MARGIN_LEFT - L.MARGIN_RIGHT) / 3;

    const drawSignatureBlock = (label, sublabel, xCenter) => {
      page.drawText(label, {
        x: xCenter - font.widthOfTextAtSize(label, FS.FOOTER) / 2,
        y: currentY,
        size: FS.FOOTER,
        font,
      });
      if (sublabel) {
        page.drawText(sublabel, {
          x: xCenter - font.widthOfTextAtSize(sublabel, FS.FOOTER - 1) / 2,
          y: currentY - 12,
          size: FS.FOOTER - 1,
          font,
        });
      }
      const lineY = currentY - 55;
      const lineHalf = 45;
      page.drawLine({
        start: { x: xCenter - lineHalf, y: lineY },
        end: { x: xCenter + lineHalf, y: lineY },
        thickness: 0.5,
      });
    };

    const block1X = L.MARGIN_LEFT + sigBlockWidth * 0.5;
    const block2X = L.MARGIN_LEFT + sigBlockWidth * 1.5;
    const block3X = L.MARGIN_LEFT + sigBlockWidth * 2.5;

    drawSignatureBlock("Barang Diterima", "", block1X);
    drawSignatureBlock("Barang Diserahkan", "Merchandiser", block2X);
    drawSignatureBlock("Disetujui", "Chief Of Store/Asst.", block3X);

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
  }
}

export default new CetakNrbService();
