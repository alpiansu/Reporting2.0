// tasks/printBpb.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { pool_dbedp } from "../config/database.js";
import { getConstringToko, RunQuery } from "../config/MysqlConnection.js";
import { logger } from "../config/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const Q_TOKO = `
    SELECT kodegudang,
           kodetoko,
           namatoko,
           ipaddress
    FROM tb_toko
    LEFT JOIN rekap_ip ON kodetoko = kdtk
    WHERE kodetoko = ?
      AND jenis = 'INDUK'
`;

const makeHeaderQuery = (bukti_no) => `
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
`;

const makeDetailQuery = (bukti_no) => `
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
`;

function formatDate(d) {
    if (!d) return "";
    const s = typeof d === "string" ? d.substring(0, 10) : d.toISOString().substring(0, 10);
    const [y, m, day] = s.split("-");
    return `${day}/${m}/${y}`;
}

export async function printBpbToPdf(kodetoko, bukti_no) {
    const kd = String(kodetoko).trim();
    const buktino = String(bukti_no).trim();

    // 1. ambil toko
    let tokoRow;
    try {
        const [rows] = await pool_dbedp.query(Q_TOKO, [kd]);
        if (!rows || rows.length === 0) {
            logger.warn(`[printBpb] kodetoko ${kd} tidak ditemukan di EDP`);
            return;
        }
        tokoRow = rows[0];
    } catch (err) {
        logger.error(`[printBpb] error select toko di EDP untuk ${kd}: ${err.message}`);
        return;
    }

    const { ipaddress } = tokoRow;
    const constringToko = getConstringToko(ipaddress);
    if (!constringToko) {
        logger.warn(`[printBpb] constring toko ${kd} (ip ${ipaddress}) tidak terbentuk`);
        return;
    }

    // 2. ambil header+detail
    let header;
    let details;
    try {
        const headerRes = await RunQuery(constringToko, makeHeaderQuery(buktino));
        const detailRes = await RunQuery(constringToko, makeDetailQuery(buktino));
        if (!headerRes || headerRes.length === 0) {
            logger.warn(`[printBpb] bukti_no ${buktino} tidak ada di toko ${kd}`);
            return;
        }
        header = headerRes[0];
        details = detailRes || [];
    } catch (err) {
        logger.error(
            `[printBpb] error select header/detail toko ${kd} bukti ${buktino}: ${err.message}`
        );
        return;
    }

    // 3. hitung total
    let totalBKP = 0;
    let totalNonBKP = 0;
    let totalDisc5 = 0;
    let totalDPP = 0;
    let totalPPN = 0;
    let totalDPPPPN = 0;

    for (const d of details) {
        const jumlah = Number(d.JUMLAH) || 0;
        const ppn = Number(d.PPN) || 0;
        const total = Number(d.TOTAL) || 0;
        const disc5 = Number(d.DISC_05) || 0;
        const isSubBkp = d.SUB_BKP === "Y";

        if (isSubBkp) totalBKP += jumlah;
        else totalNonBKP += jumlah;

        totalDisc5 += disc5;
        totalDPP += jumlah;
        totalPPN += ppn;
        totalDPPPPN += total;
    }

    // 4. bikin PDF baru
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // header judul
    page.drawText("BUKTI PENGIRIMAN/PENERIMAAN BARANG", {
        x: 146,
        y: height - 17,
        size: 12,
        font: fontBold,
    });

    // blok kiri (toko & supplier)
    const topY = height - 50;
    page.drawText(header.TOKO || "", {
        x: 20,
        y: topY,
        size: 9,
        font: fontBold,
    });

    page.drawText(`Kode - Nama Supplier  : ${header.SUPCO || ""}`, {
        x: 20,
        y: topY - 15,
        size: 9,
        font,
    });

    page.drawText(`NamaSupplier               : ${header.NAMA.slice(0, 30) || ""}`, {
        x: 20,
        y: topY - 30,
        size: 9,
        font,
    });

    // blok kanan (no ref, tanggal)
    const now = new Date();
    page.drawText(`No. Ref Ba SK`, {
        x: 264,
        y: topY,
        size: 9,
        font,
    });
    page.drawText(`:`, {
        x: 326,
        y: topY,
        size: 9,
        font,
    });
    page.drawText(`/`, {
        x: 387,
        y: topY,
        size: 9,
        font,
    });
    page.drawText(`No. Ref PB `, {
        x: 264,
        y: topY - 15,
        size: 9,
        font,
    });
    page.drawText(`: ${header.INVNO || ""}`, {
        x: 326,
        y: topY - 15,
        size: 9,
        font,
    });
    page.drawText(`/ ${formatDate(header.INV_DATE)}`, {
        x: 387,
        y: topY - 15,
        size: 9,
        font,
    });
    page.drawText(`No. Ref SJ `, {
        x: 264,
        y: topY - 30,
        size: 9,
        font,
    });
    page.drawText(`: ${header.PO_NO || ""}`, {
        x: 326,
        y: topY - 30,
        size: 9,
        font,
    });
    page.drawText(`${header.PO_DATE && header.PO_DATE !== "0000-00-00" ? "/ " + formatDate(header.PO_DATE) : ""}`, {
        x: 387,
        y: topY - 30,
        size: 9,
        font,
    });
    page.drawText(`No. `, {
        x: 264,
        y: topY - 45,
        size: 9,
        font,
    });
    page.drawText(`: ${bukti_no || ""}`, {
        x: 326,
        y: topY - 45,
        size: 9,
        font,
    });

    page.drawText(`Tgl Cetak : ${formatDate(now)}`, {
        x: 466,
        y: topY,
        size: 9,
        font,
    });
    page.drawText(`Pk. Cetak : ${now.toTimeString().substring(0, 8)}`, {
        x: 466,
        y: topY - 15,
        size: 9,
        font,
    });

    // garis pemisah
    page.drawLine({
        start: { x: 20, y: topY - 55 },
        end: { x: width - 30, y: topY - 55 },
        thickness: 1.2,
    });

    // header tabel detail

    page.drawText("Dengan Rincian Sbb:", { x: 25, y: topY - 70, size: 9, font });
    let currentY = topY - 85;
    page.drawText("No", { x: 25, y: currentY, size: 9, font });
    page.drawText("Prdcd - Nama Barang", { x: 50, y: currentY, size: 9, font });
    page.drawText("Kuantitas", { x: 360, y: currentY, size: 9, font });
    page.drawText("Jumlah", { x: 450, y: currentY, size: 9, font });

    currentY -= 12;

    // isi tabel detail
    let no = 1;
    for (const d of details) {
        if (currentY < 120) {
            // halaman baru kalau habis
            const newPage = pdfDoc.addPage([595.28, 841.89]);
            currentY = 800;
            page.drawText("lanjutan ...", { x: 40, y: currentY, size: 9, font });
        }

        const lineText = `${d.PLU || ""} - ${(d.DESKRIPSI || "").toUpperCase()}`;
        page.drawText(String(no), { x: 25, y: currentY, size: 9, font });
        page.drawText(lineText, { x: 50, y: currentY, size: 9, font });
        const length_qty = font.widthOfTextAtSize(String(d.TERIMA || 0), 9);
        const length_rp = font.widthOfTextAtSize((Number(d.JUMLAH) || 0).toLocaleString("id-ID"), 9);
        page.drawText(String(d.TERIMA || 0), {
            x: 400 - length_qty,
            y: currentY,
            size: 9,
            font,
        });

        page.drawText((Number(d.JUMLAH) || 0).toLocaleString("id-ID"), {
            x: 483 - length_rp,
            y: currentY,
            size: 9,
            font,
        });

        currentY -= 12;
        no++;
    }

    // total baris
    currentY -= 6;
    // kolom total kanan
    page.drawText(`Total:`, {
        x: 25,
        y: currentY,
        size: 9,
        font,
    });
    const total_terima = details.reduce((a, c) => a + (Number(c.TERIMA) || 0), 0);
    const length_terima = font.widthOfTextAtSize(String(total_terima), 9);
    page.drawText(`${total_terima}`, {
        x: 400 - length_terima,
        y: currentY,
        size: 9,
        font,
    });
    const total_rp = details.reduce((a, c) => a + (Number(c.JUMLAH) || 0), 0).toLocaleString("id-ID");
    const length_rp = font.widthOfTextAtSize(total_rp, 9);
    page.drawText(`${total_rp}`, {
        x: 483 - length_rp,
        y: currentY,
        size: 9,
        font,
    });

    currentY -= 3;
    page.drawLine({
        start: { x: 20, y: currentY },
        end: { x: width - 30, y: currentY },
        thickness: 1,
    });





    // blok ringkasan bawah kiri
    const sumY = currentY - 20;
    page.drawText(`BKP`, {
        x: 20,
        y: sumY,
        size: 9,
        font,
    });
    page.drawText(`:`, {
        x: 75,
        y: sumY,
        size: 9,
        font,
    });
    page.drawText(`${totalBKP.toLocaleString("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`, {
        x: 145 - font.widthOfTextAtSize(totalBKP.toLocaleString("id-ID", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }), 9),
        y: sumY,
        size: 9,
        font,
    });
    page.drawText(`Non BKP`, {
        x: 20,
        y: sumY - 14,
        size: 9,
        font,
    });

    page.drawText(`:`, {
        x: 75,
        y: sumY - 14,
        size: 9,
        font,
    });
    page.drawText(`${totalNonBKP.toLocaleString("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`, {
        x: 145 - font.widthOfTextAtSize(totalNonBKP.toLocaleString("id-ID", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }), 9),
        y: sumY - 14,
        size: 9,
        font,
    });
    page.drawText(`Discount`, {
        x: 20,
        y: sumY - 28,
        size: 9,
        font,
    });

    page.drawText(`:`, {
        x: 75,
        y: sumY - 28,
        size: 9,
        font,
    });
    page.drawText(`${totalDisc5.toLocaleString("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`, {
        x: 145 - font.widthOfTextAtSize(totalDisc5.toLocaleString("id-ID", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }), 9),
        y: sumY - 28,
        size: 9,
        font,
    });
    page.drawText(`DPP`, {
        x: 20,
        y: sumY - 42,
        size: 9,
        font,
    });

    page.drawText(`:`, {
        x: 75,
        y: sumY - 42,
        size: 9,
        font,
    });
    page.drawText(`${totalDPP.toLocaleString("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`, {
        x: 145 - font.widthOfTextAtSize(totalDPP.toLocaleString("id-ID", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }), 9),
        y: sumY - 42,
        size: 9,
        font,
    });
    page.drawText(`PPN`, {
        x: 20,
        y: sumY - 56,
        size: 9,
        font,
    });
    page.drawText(`:`, {
        x: 75,
        y: sumY - 56,
        size: 9,
        font,
    });
    page.drawText(`${totalPPN.toLocaleString("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`, {
        x: 145 - font.widthOfTextAtSize(totalPPN.toLocaleString("id-ID", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }), 9),
        y: sumY - 56,
        size: 9,
        font,
    });
    page.drawText(`DPP + PPN`, {
        x: 20,
        y: sumY - 70,
        size: 9,
        font,
    });

    page.drawText(`:`, {
        x: 75,
        y: sumY - 70,
        size: 9,
        font,
    });
    page.drawText(`${totalDPPPPN.toLocaleString("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`, {
        x: 145 - font.widthOfTextAtSize(totalDPPPPN.toLocaleString("id-ID", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }), 9),
        y: sumY - 70,
        size: 9,
        font,
    });

    currentY = sumY - 95
    page.drawText(`Chief of Store/SSL`, {
        x: 87,
        y: currentY,
        size: 9,
        font,
    });
    page.drawText(`Supplier/Delivery Driver`, {
        x: 381,
        y: currentY,
        size: 9,
        font,
    });
    currentY -= 70;
    page.drawLine({
        start: { x: 68, y: currentY },
        end: { x: 180, y: currentY },
        thickness: 0.5,
    });
    page.drawLine({
        start: { x: 373, y: currentY },
        end: { x: 488, y: currentY },
        thickness: 0.5,
    });
    currentY -= 3;
    // catatan bawah
    page.drawLine({
        start: { x: 20, y: currentY },
        end: { x: width - 30, y: currentY },
        thickness: 1,
    });
    page.drawText(
        "Bukti Penerimaan/Pengiriman Barang dan Berita Acara Selisih Kurang (jika ada) Wajib Dilampirkan Pada Saat Penagihan",
        {
            x: 52,
            y: currentY - 15,
            size: 9,
            font,
        }
    );

    // 5. simpan
    const pdfBytes = await pdfDoc.save();
    const outName = `BPB_${kd}_${buktino}.pdf`;
    const outPath = path.join(__dirname, "../output", outName);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, pdfBytes);

    logger.info(
        `[printBpb] sukses generate PDF baru (tanpa template) untuk toko ${kd} bukti ${buktino} -> ${outPath}`
    );
}

const args = process.argv.slice(2);




if (args.length > 0) {
    const kdtk = args[0];
    const bukti_no = args[1];


    await printBpbToPdf(kdtk, bukti_no);
    process.exit();
}