/**
 * Notes Controller
 */
import service from "./notes.service.js";
import { apiResponse } from "../../utils/index.js";
import logger from "../../config/logger.js";
import config from "./notes.config.js";

export const getAll = async (req, res) => {
  try {
    const data = await service.getAll();
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const remove = async (req, res) => {
  try {
    const { unixKey } = req.params;
    await service.remove(unixKey);
    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const autoNoteVirtMrg = async (req, res) => {
  try {
    const { cabang, kdtk, prdcd, tanggal } = req.body;

    if (!kdtk || !prdcd || !tanggal) {
      return apiResponse.badRequest(res, "kdtk, prdcd, dan tanggal wajib diisi");
    }

    const formattedPrdcd = String(prdcd).replace(/'/g, "''");
    const formattedTanggal = String(tanggal).replace(/'/g, "''");

    const replaceParams = (sql, params) => {
      let result = sql;
      for (const p of params) {
        result = result.replace(/\?/, `'${p}'`);
      }
      return result;
    };

    const queries = [
      {
        title: "Query 1: Cek QTY RMB;",
        sql: replaceParams(config.autoNotes.checkQtyRmb, [formattedPrdcd, formattedTanggal]),
      },
      {
        title: "Query 2: Rekon Virtual Margin (Utama);",
        sql: replaceParams(config.autoNotes.rekonVirtualMrg, [
          formattedTanggal,
          formattedPrdcd,
          formattedTanggal,
          formattedPrdcd,
        ]),
      },
      {
        title: "Query 3: Rekon Virtual Margin (Delon Fallback);",
        sql: replaceParams(config.autoNotes.rekonVirtualMrgDelon, [formattedTanggal, formattedPrdcd]),
      },
    ];

    return apiResponse.success(res, {
      message: "Query berhasil di-generate dan siap di-copy",
      data: { queries },
    });
  } catch (error) {
    logger.error(`[autoNoteVirtMrg] error: ${error.message}`);
    return apiResponse.error(res, error.message, 500);
  }
};
