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
        description: "Mendeteksi apakah terdapat data restore stock (ISTYPE = RMB) dengan QTY != 1.",
        sql: replaceParams(config.autoNotes.checkQtyRmb, [formattedPrdcd, formattedTanggal]),
      },
      {
        title: "Query 2: Rekon Virtual Margin (Utama);",
        description: "Query pengecekan standar rekon virtual margin berbasis data MTRAN & MSTRAN.",
        sql: replaceParams(config.autoNotes.rekonVirtualMrg, [
          formattedTanggal,
          formattedPrdcd,
          formattedTanggal,
          formattedPrdcd,
        ]),
      },
      {
        title: "Query 3: Rekon Virtual Margin (Delon Fallback);",
        description: "Query fallback rekon virtual margin berbasis IPULSA_TRANSAKSI.",
        sql: replaceParams(config.autoNotes.rekonVirtualMrgDelon, [formattedTanggal, formattedPrdcd]),
      },
      {
        title: "Query 4: Diagnosa Pola Selisih Virtual Margin (Komprehensif);",
        description: "Diagnosa otomatis 4 pola selisih (Terload 2x / Overwrite NoStruk, Gagal Vendor IPULSA, Salah SUPCO, Data Orphan/Rusak).",
        sql: replaceParams(config.autoNotes.rekonVirtualMrgEnhanced, [
          formattedTanggal,
          formattedPrdcd,
          formattedTanggal,
          formattedPrdcd,
        ]),
      },
      {
        title: "Query 5: Raw Data MTRAN (Detail Kasir & Struk);",
        description: "Menampilkan seluruh baris transaksi penjualan di POS kasir untuk produk & tanggal terkait.",
        sql: replaceParams(config.autoNotes.rawMtran, [formattedTanggal, formattedPrdcd]),
      },
      {
        title: "Query 6: Raw Data MSTRAN (Detail Restore Stock / RMB);",
        description: "Menampilkan seluruh pergerakan inventory/RMB pada table mutasi toko.",
        sql: replaceParams(config.autoNotes.rawMstran, [formattedTanggal, formattedPrdcd]),
      },
      {
        title: "Query 7: Raw Data IPULSA_TRANSAKSI (Detail Status Vendor);",
        description: "Menampilkan log transaksi pulsa/voucher toko dan respon vendor/server IPULSA.",
        sql: replaceParams(config.autoNotes.rawIpulsa, [formattedTanggal, formattedPrdcd]),
      },
      {
        title: "Query 8: Raw Data VIRTUAL_TRX (Detail Respon API Toko);",
        description: "Menampilkan log transaksi virtual dan kode respon kirim ke POS.",
        sql: replaceParams(config.autoNotes.rawVirtualTrx, [formattedTanggal, formattedPrdcd]),
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
