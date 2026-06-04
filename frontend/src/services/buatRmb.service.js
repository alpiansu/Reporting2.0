import api from "./api.js";

const buatRmbService = {
  uploadCsv(file) {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/buat-rmb/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  getFilters() {
    return api.get("/buat-rmb/filters");
  },

  exportHistoryCsv(params) {
    return api.get("/buat-rmb/history/export", { params, responseType: 'blob' })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        const filename = `buat_rmb_history_${Date.now()}.csv`;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
  },

  downloadTemplate() {
    return api.get("/buat-rmb/template/download", { responseType: 'blob' })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "template_buat_rmb.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
  },

  /**
   * Cek koneksi ke database toko berdasarkan kode toko.
   * @param {string} kdtk - Kode toko
   */
  checkStoreConnection(kdtk) {
    return api.get("/buat-rmb/check-connection", { params: { kdtk } });
  },

  /**
   * Autocomplete produk dari prodmast toko.
   * Trigger setelah 3 karakter. Prefix search.
   * @param {string} kdtk - Kode toko
   * @param {string} q - Query pencarian (minimal 3 karakter)
   */
  searchStoreProducts(kdtk, q) {
    return api.get("/buat-rmb/store-products", { params: { kdtk, q } });
  },

  /**
   * Insert RMB secara manual (dari form dialog).
   * @param {object} payload - { kdtk, tanggal, items: [{prdcd, nohp, trxid}] }
   */
  insertManual(payload) {
    return api.post("/buat-rmb/manual", payload);
  },
};

export default buatRmbService;

