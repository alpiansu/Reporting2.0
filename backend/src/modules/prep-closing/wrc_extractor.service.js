import fs from 'fs/promises';
import path from 'path';
import logger from '../../config/logger.js';
import wrcUtils from '../../utils/wrc.utils.js';
import wrcBulananService from '../../services/wrc.service.js';

const RULES_PATH = path.join(process.cwd(), 'data/wrc_extract_rules.json');
const CACHE_PATH = path.join(process.cwd(), 'data/wrc_cache.json');

class WrcExtractorService {
  constructor() {
    this.extractRules = [];
    this.cacheData = {
      last_extracted_at: null,
      data_by_cabang: {}
    };
  }

  async loadRules() {
    try {
      const data = await fs.readFile(RULES_PATH, 'utf8');
      this.extractRules = JSON.parse(data);
    } catch (e) {
      if (e.code === 'ENOENT') {
        this.extractRules = [];
        await fs.writeFile(RULES_PATH, JSON.stringify([], null, 2));
      } else {
        logger.error(`[wrc_extractor] Failed to load WRC Extract Rules: ${e.message}`);
      }
    }
    return this.extractRules;
  }

  async updateRules(newRules) {
    this.extractRules = newRules;
    await fs.writeFile(RULES_PATH, JSON.stringify(newRules, null, 2));
    logger.info(`[wrc_extractor] Updated ${newRules.length} WRC Extract Rules`);
    return this.extractRules;
  }

  async loadCache() {
    try {
      const data = await fs.readFile(CACHE_PATH, 'utf8');
      this.cacheData = JSON.parse(data);
      // Migrate old cache format
      if (!this.cacheData.data_by_cabang) {
        this.cacheData.data_by_cabang = {};
        if (this.cacheData.data_by_kdtk) {
           delete this.cacheData.data_by_kdtk;
        }
      }
    } catch (e) {
      if (e.code === 'ENOENT') {
        this.cacheData = { last_extracted_at: null, data_by_cabang: {} };
        await fs.writeFile(CACHE_PATH, JSON.stringify(this.cacheData, null, 2));
      } else {
        logger.error(`[wrc_extractor] Failed to load WRC Cache: ${e.message}`);
      }
    }
    return this.cacheData;
  }

  async getCachedValue(kdtk, fieldKey, cab) {
    if (!this.cacheData.data_by_cabang) await this.loadCache();
    
    const branchFolder = this.cacheData.data_by_cabang[cab];
    if (!branchFolder) return null;

    // Check branch_level_data FIRST
    if (branchFolder.branch_level_data && branchFolder.branch_level_data[fieldKey] !== undefined) {
      return branchFolder.branch_level_data[fieldKey];
    }

    // Check store level data NEXT
    if (branchFolder.stores && branchFolder.stores[kdtk] && branchFolder.stores[kdtk][fieldKey] !== undefined) {
      return branchFolder.stores[kdtk][fieldKey];
    }

    return null;
  }

  /**
   * Internal recursive handler to extract for a single branch
   */
  async _extractSingleCabang(cab, period, shops) {
    const year = '20' + period.substring(0, 2);
    const month = period.substring(2, 4);
    
    // Calculate previous period (YYMM)
    let yearNum = parseInt(period.substring(0, 2), 10);
    let monthNum = parseInt(month, 10);
    monthNum -= 1;
    if (monthNum === 0) {
        monthNum = 12;
        yearNum -= 1;
    }
    const prevPeriod = `${yearNum.toString().padStart(2, '0')}${monthNum.toString().padStart(2, '0')}`;

    let extractedCount = 0;

    // Initialize branch folder in memory
    if (!this.cacheData.data_by_cabang[cab]) {
      this.cacheData.data_by_cabang[cab] = {
        branch_level_data: {},
        stores: {}
      };
    }
    const targetFolder = this.cacheData.data_by_cabang[cab];

    for (const rule of this.extractRules) {
       try {
         // Sub-interpolate {month}, {year}, {period}, and {prev_period} directly just in case before sending to smartReplace
         let processedQuery = rule.query
           .replace(/{year}/g, year)
           .replace(/{month}/g, month)
           .replace(/{period}/g, period)
           .replace(/{prev_period}/g, prevPeriod)
           .replace(/{period_prev}/g, prevPeriod);

         const tempFile = await wrcUtils.getWrcData(cab, period, rule.table_type || 'generic', processedQuery, shops);
         if (!tempFile) continue;

         // Load temp file to read array
         const rawDataBytes = await fs.readFile(tempFile, 'utf8');
         const returnedRows = JSON.parse(rawDataBytes);

         // Merge logic
         for (const row of returnedRows) {
           const code = row.KODE_TOKO || row.kode_toko || row.KDTK;
           
           // Temukan nama property yang cocok tak peduli kecil / kapital
           const ignoreCaseKey = Object.keys(row).find(k => k.toLowerCase() === rule.valueField.toLowerCase());
           const val = ignoreCaseKey ? row[ignoreCaseKey] : undefined;

           if (val !== undefined) {
             // 1. Prioritas Utama: Jika rule secara tegas menyatakan level branch
             if (rule.level === 'branch') {
               targetFolder.branch_level_data[rule.key] = val;
             } 
             // 2. Prioritas Kedua: Jika rule secara tegas menyatakan level store
             else if (rule.level === 'store' && code) {
               if (!targetFolder.stores[code]) targetFolder.stores[code] = {};
               targetFolder.stores[code][rule.key] = val;
             }
             // 3. Fallback: Logika lama berbasis KODE_TOKO 'GLOBAL'
             else if (code && code.toString().toUpperCase() !== 'GLOBAL') {
               if (!targetFolder.stores[code]) targetFolder.stores[code] = {};
               targetFolder.stores[code][rule.key] = val;
             } else {
               targetFolder.branch_level_data[rule.key] = val;
             }
           }
         }

         // Cleanup temp file since we have extracted what we need
         await fs.unlink(tempFile).catch(() => {});
         extractedCount++;
         logger.info(`[wrc_extractor] Successfully extracted logic for Rule: ${rule.key} at CAB ${cab}`);

       } catch (err) {
         logger.error(`[wrc_extractor] Failed extraction for Rule ${rule.key} at CAB ${cab}: ${err.message}`);
       }
    }
    return extractedCount;
  }

  /**
   * Evaluates all extractor rules sequentially and merges them into wrc_cache.json
   */
  async triggerExtraction(cab, period, shops) {
    await this.loadRules();
    await this.loadCache();

    logger.info(`[wrc_extractor] Starting extraction for CAB: ${cab}, Period: ${period}`);

    let totalExtracted = 0;

    if (cab === 'All') {
       // Query all available WRC branches
       const wrcService = new wrcBulananService();
       const allActiveCabs = await wrcService.getAllCabangWrc();
       for (const branch of allActiveCabs) {
          totalExtracted += await this._extractSingleCabang(branch, period, null);
       }
    } else {
       totalExtracted = await this._extractSingleCabang(cab, period, shops);
    }

    this.cacheData.last_extracted_at = new Date().toISOString();
    
    // Save to Cache JSON
    await fs.writeFile(CACHE_PATH, JSON.stringify(this.cacheData, null, 2));
    logger.info(`[wrc_extractor] WRC Cache successfully refreshed! Total successful logic evaluations: ${totalExtracted}.`);
    
    return this.cacheData;
  }
}

export const wrcExtractorService = new WrcExtractorService();
