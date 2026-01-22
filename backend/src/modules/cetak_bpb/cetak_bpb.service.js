import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts } from "pdf-lib";
import moment from "moment-timezone";
import pLimit from "p-limit";
import logger from "../../config/logger.js";
import config from "./cetak_bpb.config.js";
import dbStore from "../../config/db_store.js";
import storeService from "../store/storeService.js";
import progressService from "../progress/progress.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CetakBpbService {
  /**
   * Process BPB printing for multiple stores
   * @param {Object} params - { cabang, stores, bukti_no, tanggal, username }
   */
  async processCetakBpb({ cabang, stores, bukti_no, username }) {
    const taskId = `${config.taskProgressName}_${username}`;
    
    try {
      // 1. Identify target stores
      let selectedStores = [];
      if (stores && stores.length > 0) {
        selectedStores = await storeService.getStoresByCodes(stores);
      } else if (cabang) {
        selectedStores = await storeService.getStoresByCabang(cabang);
      } else {
        throw new Error("Target stores or cabang must be specified");
      }

      if (selectedStores.length === 0) {
        throw new Error("No valid stores found for processing");
      }

      // 2. Start Progress
      const timeStart = moment().format("YYYY-MM-DD HH:mm:ss");
      await progressService.startProgress(taskId, selectedStores.length, {
        description: `Starting BPB print process for ${selectedStores.length} stores`,
        startedBy: username,
        status: "preparing",
        createdAt: timeStart,
      });

      const results = {
        total: selectedStores.length,
        success: 0,
        failed: [],
        outputFiles: [],
      };

      // 3. Process in parallel
      const limit = pLimit(config.parallelProcessing.concurrencyLimit);
      let processedCount = 0;

      const processPromises = selectedStores.map(store => 
        limit(async () => {
          const currentCount = ++processedCount;
          await progressService.updateProgress(taskId, currentCount, {
            description: `Processing store ${store.storeCode} (${currentCount}/${selectedStores.length})`,
            status: "Screening",
          });

          try {
            const result = await this.processStoreBpb(store, bukti_no);
            if (result.success) {
              results.success++;
              results.outputFiles.push(result.filePath);
            } else {
              results.failed.push({ storeCode: store.storeCode, error: result.error });
            }
          } catch (error) {
            logger.error(`Error processing BPB for store ${store.storeCode}: ${error.message}`);
            results.failed.push({ storeCode: store.storeCode, error: error.message });
          }
        })
      );

      await Promise.all(processPromises);

      // 4. Complete Progress
      await progressService.completeProgress(taskId, {
        description: `Finished processing ${selectedStores.length} stores. Success: ${results.success}, Failed: ${results.failed.length}`,
        status: "completed",
        completedAt: moment().format("YYYY-MM-DD HH:mm:ss"),
      });

      return results;
    } catch (error) {
      logger.error(`Failed to process Cetak BPB: ${error.message}`);
      await progressService.failProgress(taskId, {
        description: `Task failed: ${error.message}`,
        status: "failed",
      });
      throw error;
    }
  }

  /**
   * Process BPB for a single store
   */
  async processStoreBpb(store, bukti_no) {
    let pool;
    try {
      const storeInfo = await storeService.getStoreIPHost(store.storeCode);
      if (!storeInfo || !storeInfo.dbHost) {
        return { success: false, error: "Store IP not found" };
      }

      pool = await dbStore.createDbStore(storeInfo.dbHost);
      
      // Fetch Header
      const [headerRows] = await pool.query(config.queries.header(bukti_no));
      if (!headerRows || headerRows.length === 0) {
        return { success: false, error: `Bukti No ${bukti_no} not found` };
      }
      const header = headerRows[0];

      // Fetch Details
      const [details] = await pool.query(config.queries.detail(bukti_no));

      // Generate PDF
      const filePath = await this.generatePdf(store.storeCode, bukti_no, header, details || []);

      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      // In this project structure, pools from createDbStore might be shared or need cleanup
      // Based on db_store.js, createDbStore returns a pool. Usually we don't end it here if it's cached.
    }
  }

  /**
   * Refactored PDF Generation logic from original cetakBPB.js
   */
  async generatePdf(kdtk, bukti_no, header, details) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const formatDate = (d) => {
      if (!d) return "";
      const s = typeof d === "string" ? d.substring(0, 10) : d.toISOString().substring(0, 10);
      const [y, m, day] = s.split("-");
      return `${day}/${m}/${y}`;
    };

    // Calculate totals
    let totalBKP = 0, totalNonBKP = 0, totalDisc5 = 0, totalDPP = 0, totalPPN = 0, totalDPPPPN = 0;
    for (const d of details) {
      const jumlah = Number(d.JUMLAH) || 0;
      const ppn = Number(d.PPN) || 0;
      const total = Number(d.TOTAL) || 0;
      const disc5 = Number(d.DISC_05) || 0;
      if (d.SUB_BKP === "Y") totalBKP += jumlah;
      else totalNonBKP += jumlah;
      totalDisc5 += disc5;
      totalDPP += jumlah;
      totalPPN += ppn;
      totalDPPPPN += total;
    }

    // Header Title
    page.drawText("BUKTI PENGIRIMAN/PENERIMAAN BARANG", {
      x: 146, y: height - 17, size: 12, font: fontBold,
    });

    // Top Section Left
    const topY = height - 50;
    page.drawText(header.TOKO || "", { x: 20, y: topY, size: 9, font: fontBold });
    page.drawText(`Kode - Nama Supplier  : ${header.SUPCO || ""}`, { x: 20, y: topY - 15, size: 9, font });
    page.drawText(`NamaSupplier               : ${(header.NAMA || "").slice(0, 30)}`, { x: 20, y: topY - 30, size: 9, font });

    // Top Section Right
    const now = new Date();
    const drawRightLabel = (label, value, yOffset, valueX = 326) => {
      page.drawText(label, { x: 264, y: topY - yOffset, size: 9, font });
      page.drawText(`: ${value}`, { x: valueX, y: topY - yOffset, size: 9, font });
    };

    page.drawText("No. Ref Ba SK", { x: 264, y: topY, size: 9, font });
    page.drawText(":", { x: 326, y: topY, size: 9, font });
    page.drawText("/", { x: 387, y: topY, size: 9, font });
    
    drawRightLabel("No. Ref PB", `${header.INVNO || ""} / ${formatDate(header.INV_DATE)}`, 15);
    drawRightLabel("No. Ref SJ", `${header.PO_NO || ""} ${header.PO_DATE && header.PO_DATE !== "0000-00-00" ? "/ " + formatDate(header.PO_DATE) : ""}`, 30);
    drawRightLabel("No.", bukti_no || "", 45);

    page.drawText(`Tgl Cetak : ${formatDate(now)}`, { x: 466, y: topY, size: 9, font });
    page.drawText(`Pk. Cetak : ${now.toTimeString().substring(0, 8)}`, { x: 466, y: topY - 15, size: 9, font });

    // Separator Line
    page.drawLine({ start: { x: 20, y: topY - 55 }, end: { x: width - 30, y: topY - 55 }, thickness: 1.2 });

    // Table Header
    page.drawText("Dengan Rincian Sbb:", { x: 25, y: topY - 70, size: 9, font });
    let currentY = topY - 85;
    page.drawText("No", { x: 25, y: currentY, size: 9, font });
    page.drawText("Prdcd - Nama Barang", { x: 50, y: currentY, size: 9, font });
    page.drawText("Kuantitas", { x: 360, y: currentY, size: 9, font });
    page.drawText("Jumlah", { x: 450, y: currentY, size: 9, font });

    currentY -= 12;

    // Table Content
    let no = 1;
    for (const d of details) {
      if (currentY < 120) {
        const newPage = pdfDoc.addPage([595.28, 841.89]);
        currentY = 800; // Reset Y for new page (simplified, usually needs more checks)
        // Note: original script didn't fully handle multi-page headers, just drawing "lanjutan"
      }

      page.drawText(String(no), { x: 25, y: currentY, size: 9, font });
      page.drawText(`${d.PLU || ""} - ${(d.DESKRIPSI || "").toUpperCase()}`, { x: 50, y: currentY, size: 9, font });
      
      const qtyStr = String(d.TERIMA || 0);
      const jmlStr = (Number(d.JUMLAH) || 0).toLocaleString("id-ID");
      
      page.drawText(qtyStr, { x: 400 - font.widthOfTextAtSize(qtyStr, 9), y: currentY, size: 9, font });
      page.drawText(jmlStr, { x: 483 - font.widthOfTextAtSize(jmlStr, 9), y: currentY, size: 9, font });

      currentY -= 12;
      no++;
    }

    // Footer Totals
    currentY -= 6;
    page.drawText("Total:", { x: 25, y: currentY, size: 9, font });
    const totalTerima = details.reduce((a, c) => a + (Number(c.TERIMA) || 0), 0);
    const totalJmlStr = details.reduce((a, c) => a + (Number(c.JUMLAH) || 0), 0).toLocaleString("id-ID");
    
    page.drawText(String(totalTerima), { x: 400 - font.widthOfTextAtSize(String(totalTerima), 9), y: currentY, size: 9, font });
    page.drawText(totalJmlStr, { x: 483 - font.widthOfTextAtSize(totalJmlStr, 9), y: currentY, size: 9, font });

    currentY -= 3;
    page.drawLine({ start: { x: 20, y: currentY }, end: { x: width - 30, y: currentY }, thickness: 1 });

    // Summary Section
    const sumY = currentY - 20;
    const drawSumLine = (label, value, offset) => {
      const valStr = value.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      page.drawText(label, { x: 20, y: sumY - offset, size: 9, font });
      page.drawText(":", { x: 75, y: sumY - offset, size: 9, font });
      page.drawText(valStr, { x: 145 - font.widthOfTextAtSize(valStr, 9), y: sumY - offset, size: 9, font });
    };

    drawSumLine("BKP", totalBKP, 0);
    drawSumLine("Non BKP", totalNonBKP, 14);
    drawSumLine("Discount", totalDisc5, 28);
    drawSumLine("DPP", totalDPP, 42);
    drawSumLine("PPN", totalPPN, 56);
    drawSumLine("DPP + PPN", totalDPPPPN, 70);

    // Signature
    currentY = sumY - 95;
    page.drawText("Chief of Store/SSL", { x: 87, y: currentY, size: 9, font });
    page.drawText("Supplier/Delivery Driver", { x: 381, y: currentY, size: 9, font });
    
    currentY -= 70;
    page.drawLine({ start: { x: 68, y: currentY }, end: { x: 180, y: currentY }, thickness: 0.5 });
    page.drawLine({ start: { x: 373, y: currentY }, end: { x: 488, y: currentY }, thickness: 0.5 });

    // Footer Footnote
    currentY -= 15;
    page.drawLine({ start: { x: 20, y: currentY }, end: { x: width - 30, y: currentY }, thickness: 1 });
    page.drawText("Bukti Penerimaan/Pengiriman Barang dan Berita Acara Selisih Kurang (jika ada) Wajib Dilampirkan Pada Saat Penagihan", {
      x: 52, y: currentY - 15, size: 9, font,
    });

    // Save
    const pdfBytes = await pdfDoc.save();
    const outName = `BPB_${kdtk}_${bukti_no}.pdf`;
    const outPath = path.join(__dirname, "../../output/bpb", outName);
    
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, pdfBytes);
    
    return outPath;
  }
}

export default new CetakBpbService();
