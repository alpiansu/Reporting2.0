import BaseDataSource from './base.source.js';
import wrcService from '../../../../services/wrc.service.js';
import mysql from 'mysql2/promise';
import logger from '../../../../config/logger.js';
import config from '../../sales_custab.config.js';

export default class WrcDtSource extends BaseDataSource {
  getSourceName() {
    return 'wrc_dt';
  }

  validateConfig(config) {
    const errors = [];

    if (!config.cab) {
      errors.push('Cabang wajib diisi');
    }
    if (!config.prdLap) {
      errors.push('Periode awal wajib diisi');
    }
    if (!config.pluList || config.pluList.length === 0) {
      errors.push('Daftar PLU tidak boleh kosong');
    }
    if (config.pluList && config.pluList.length > 5000) {
      errors.push('Maksimal 5000 PLU');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async fetchData(config) {
    const { cab, prdLap, prdLap2, pluList, shopFilter } = config;

    const validation = this.validateConfig({ cab, prdLap, prdLap2, pluList, shopFilter });
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const dates = this.getDatesBetween(prdLap, prdLap2);
    if (dates.length === 0) {
      throw new Error('Range tanggal tidak valid');
    }

    const query = this.buildUnionQuery(dates, pluList, shopFilter);

    const wrcInstance = new wrcService();
    const wrcConfig = await wrcInstance.getConnWRC(cab);
    const connection = await mysql.createConnection(wrcConfig);

    try {
      logger.info(`[sales_custab][wrc_dt] executing query for cab=${cab}, dates=${dates.length}, plu=${pluList.length}`);
      const queryStart = Date.now();
      const [rows] = await connection.query({ sql: query, timeout: config.queryTimeoutMs });
      logger.info(`[sales_custab][wrc_dt] query done, rows=${rows.length}, duration=${Date.now() - queryStart}ms`);
      return rows;
    } finally {
      await connection.end();
    }
  }

  getDatesBetween(startDate, endDate) {
    const parseLocal = (str) => {
      const parts = str.split('-').map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2]);
    };

    const current = parseLocal(startDate);
    const end = parseLocal(endDate);
    const dates = [];

    while (current <= end) {
      const yy = String(current.getFullYear()).slice(-2);
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      dates.push(`${yy}${mm}${dd}`);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  buildUnionQuery(dates, pluList, shopFilter) {
    const pluIn = pluList.map(p => `'${p}'`).join(',');
    const customShop = shopFilter && shopFilter.length > 0
      ? `AND SHOP IN ('${shopFilter.join("','")}')`
      : '';

    const unionParts = dates.map(date => {
      return `SELECT 
        SHOP,
        STR_TO_DATE(tanggal, '%d-%m-%Y') AS TANGGAL,
        PRDCD,
        ${this.buildHourlyColumns()}
      FROM DT_${date}
      WHERE prdcd IN(${pluIn}) ${customShop}
      GROUP BY shop, prdcd`;
    });

    return unionParts.join(' UNION ALL ');
  }

  buildHourlyColumns() {
    const columns = [];
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0');
      columns.push(`
        SUM(CASE WHEN HOUR(jam)='${hh}' THEN IF(rtype='j',qty,qty*-1) ELSE 0 END) AS qty_${hh},
        SUM(CASE 
          WHEN HOUR(jam)='${hh}' AND Bkp='Y' AND sub_bkp='Y' THEN IF(rtype='J',Gross-ppn,(Gross-ppn)*-1)
          WHEN HOUR(jam)='${hh}' AND Bkp='Y' AND sub_bkp!='Y' THEN IF(rtype='J',Gross,Gross*-1)
          WHEN HOUR(jam)='${hh}' AND Bkp!='Y' THEN IF(rtype='J',Gross,Gross*-1)
          ELSE 0
        END) AS net_${hh},
        SUM(CASE WHEN HOUR(jam)='${hh}' THEN IF(rtype='J',Qty*ROUND(Hpp),(Qty*ROUND(Hpp))*-1) ELSE 0 END) AS hpp_${hh},
        SUM(CASE 
          WHEN HOUR(jam)='${hh}' AND Bkp='Y' AND sub_bkp='Y' THEN IF(rtype='J',ppn,ppn*-1)
          ELSE 0 
        END) AS ppn_${hh}`);
    }
    return columns.join(',\n');
  }
}
