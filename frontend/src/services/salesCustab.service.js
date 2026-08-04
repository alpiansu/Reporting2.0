import api from './api';

const salesCustabService = {
  downloadReport(params) {
    const { csvFile, ...formData } = params;

    const fd = new FormData();
    fd.append('csvFile', csvFile);
    fd.append('cab', formData.cab);
    fd.append('prdLap', formData.prdLap);
    fd.append('prdLap2', formData.prdLap2);
    if (formData.kdtkIn && formData.kdtkIn.trim()) {
      fd.append('kdtkIn', formData.kdtkIn.trim());
    }

    return api.post('/sales-custab/download', fd, {
      responseType: 'blob',
      timeout: 600000, // 10 menit — query harian (UNION hingga 31 tabel) bisa lama
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export default salesCustabService;
