import SourceRegistry from './services/sources/registry.js';
import config from './sales_custab.config.js';
import logger from '../../config/logger.js';

export default class SalesCustabService {
  constructor() {
    this.registry = new SourceRegistry();
    this.defaultSource = config.wrc.sourceName;
  }

  async generateReport(params) {
    const { csvFile, cab, prdLap, prdLap2, kdtkIn } = params;

    if (!csvFile || !csvFile.buffer) {
      throw new Error('File CSV PLU wajib diupload');
    }

    const pluList = this.parseCsvBuffer(csvFile.buffer);
    logger.info(`[sales_custab] Parsed ${pluList.length} PLU from CSV`);

    const shopFilter = kdtkIn
      ? kdtkIn.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const source = this.registry.getSource(this.defaultSource);

    const rows = await source.fetchData({
      cab,
      prdLap,
      prdLap2,
      pluList,
      shopFilter,
    });

    return rows;
  }

  parseCsvBuffer(buffer) {
    const text = buffer.toString('utf-8').trim();
    const lines = text.split(/\r?\n/).filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('File CSV kosong');
    }

    const pluSet = new Set();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(',');

      // Skip header jika ada kata "PRDCD" atau "plu" di kolom pertama
      if (i === 0 && /PRDCD|plu|kode/i.test(cols[0])) {
        continue;
      }

      const raw = (cols[0] || '').trim();
      if (!raw) continue;

      // Hanya terima numerik
      if (!/^\d+$/.test(raw)) continue;

      if (pluSet.size >= config.maxPluCount) {
        logger.warn(`[sales_custab] Max PLU limit reached (${config.maxPluCount}), ignoring rest`);
        break;
      }

      pluSet.add(raw);
    }

    if (pluSet.size === 0) {
      throw new Error('Tidak ada PLU valid ditemukan di file CSV');
    }

    return Array.from(pluSet);
  }
}
