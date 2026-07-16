import api from "./api";

const fixedPattern = "cetak-nrb";

const cetakNrbService = {
  processCetakNrb: async (data) => {
    const response = await api.post(`${fixedPattern}/process`, data, {
      responseType: "blob",
    });
    return response;
  },
};

export default cetakNrbService;
