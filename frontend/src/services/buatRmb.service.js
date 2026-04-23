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
  }
};

export default buatRmbService;
