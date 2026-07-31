import salesCustabService from "./sales_custab.service.js";
import logger from "../../config/logger.js";
import { apiResponse } from "../../utils/index.js";

const buildHourlyHeaders = () => {
  const headers = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    headers.push(`qty_${hh}`, `net_${hh}`, `hpp_${hh}`, `ppn_${hh}`);
  }
  return headers;
};

const parseLocalDate = (dateStr) => {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
};

const validatePeriode = (prdLap, prdLap2) => {
  const date1 = parseLocalDate(prdLap);
  const date2 = parseLocalDate(prdLap2);

  if (!date1 || !date2) {
    throw new Error('Format tanggal tidak valid');
  }

  if (date2 < date1) {
    throw new Error('Periode akhir tidak boleh sebelum periode awal');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isCurrentMonth = date1.getFullYear() === today.getFullYear() &&
                         date1.getMonth() === today.getMonth();

  if (isCurrentMonth && date2 > yesterday) {
    throw new Error(`Periode akhir maksimal adalah ${yesterday.toISOString().split('T')[0]} (H-1)`);
  }

  if (date1 > yesterday) {
    throw new Error('Periode awal tidak boleh di masa depan');
  }

  if (date1.getFullYear() !== date2.getFullYear() || date1.getMonth() !== date2.getMonth()) {
    throw new Error('Periode awal dan periode akhir harus di bulan yang sama');
  }

  const diffTime = Math.abs(date2 - date1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  if (diffDays > 31) {
    throw new Error('Maksimal range tanggal adalah 31 hari');
  }
};

export const downloadCustab = async (req, res) => {
  try {
    if (!req.file) {
      return apiResponse.badRequest(res, "File CSV PLU wajib diupload");
    }

    const cab = req.body.cab?.trim();
    const prdLap = req.body.prdLap?.trim();
    const prdLap2 = req.body.prdLap2?.trim() || prdLap;
    const kdtkIn = req.body.kdtkIn?.trim() || '';

    if (!cab) return apiResponse.badRequest(res, "Cabang wajib diisi");
    if (!prdLap) return apiResponse.badRequest(res, "Periode awal wajib diisi");

    validatePeriode(prdLap, prdLap2);

    const rows = await salesCustabService.generateReport({
      csvFile: req.file,
      cab,
      prdLap,
      prdLap2,
      kdtkIn,
    });

    const fileName = `Custab Custom ${cab} ${prdLap} s.d ${prdLap2}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.write('\uFEFF');

    const headers = ['SHOP', 'TANGGAL', 'PRDCD', ...buildHourlyHeaders()];
    res.write(headers.join(',') + '\n');

    for (const row of rows) {
      const values = [
        row.SHOP || '',
        row.TANGGAL || '',
        row.PRDCD || '',
      ];

      for (let h = 0; h < 24; h++) {
        const hh = String(h).padStart(2, '0');
        values.push(
          row[`qty_${hh}`] ?? 0,
          row[`net_${hh}`] ?? 0,
          row[`hpp_${hh}`] ?? 0,
          row[`ppn_${hh}`] ?? 0
        );
      }

      const line = values.map(v => {
        const str = String(v ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',');

      res.write(line + '\n');
    }

    res.end();
    logger.info(`[sales_custab] CSV streamed successfully: ${fileName}`);
  } catch (error) {
    logger.error(`[sales_custab] download error: ${error.message}`);
    if (!res.headersSent) {
      return apiResponse.error(res, error.message);
    }
  }
};
