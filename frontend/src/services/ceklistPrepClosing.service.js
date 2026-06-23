/**
 * API service for Ceklist Prepare Closing.
 * Reuses the shared axios instance so base URL, auth token, and interceptors
 * stay consistent with the rest of the frontend services.
 */
import api from './api';

const BASE_URL = '/ceklist-prep-closing';

function normalizeParams(params) {
  if (!params) return undefined;
  if (typeof params === 'string') return new URLSearchParams(params);
  return params;
}

function unwrap(response) {
  const payload = response.data;
  if (payload?.status === 'error') {
    throw new Error(payload.message || 'Request gagal');
  }
  return payload?.data ?? payload;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function getAssetUrl(path) {
  if (!path) return '';
  const apiBaseUrl = api.defaults.baseURL || '';
  const backendBaseUrl = apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
  return `${backendBaseUrl}${path}`;
}

// Space HDD Bulanan
export const getSpaceHdd = params =>
  api.get(`${BASE_URL}/space-hdd`, { params: normalizeParams(params) }).then(unwrap);

export const upsertSpaceHdd = body =>
  api.post(`${BASE_URL}/space-hdd`, body).then(unwrap);

export const deleteSpaceHdd = (kdcab, periode) =>
  api.delete(`${BASE_URL}/space-hdd`, { params: { kdcab, periode } }).then(unwrap);

export const initSpaceHdd = periode =>
  api.post(`${BASE_URL}/space-hdd/init`, null, { params: { periode } }).then(unwrap);

export const uploadCaptureHdd = (formData, kdcab, periode) =>
  api.post(`${BASE_URL}/space-hdd/upload`, formData, {
    params: { kdcab, periode },
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(unwrap);

// Space HDD Tampung
export const getSpaceTampung = params =>
  api.get(`${BASE_URL}/space-tampung`, { params: normalizeParams(params) }).then(unwrap);

export const upsertSpaceTampung = body =>
  api.post(`${BASE_URL}/space-tampung`, body).then(unwrap);

export const deleteSpaceTampung = (cab, periode) =>
  api.delete(`${BASE_URL}/space-tampung`, { params: { cab, periode } }).then(unwrap);

export const initSpaceTampung = periode =>
  api.post(`${BASE_URL}/space-tampung/init`, null, { params: { periode } }).then(unwrap);

export const uploadCaptureTampung = (formData, kdcab, periode) =>
  api.post(`${BASE_URL}/space-tampung/upload`, formData, {
    params: { kdcab, periode },
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(unwrap);

// Import IDT
export const getImportIdt = params =>
  api.get(`${BASE_URL}/import-idt`, { params: normalizeParams(params) }).then(unwrap);

export const upsertImportIdt = body =>
  api.post(`${BASE_URL}/import-idt`, body).then(unwrap);

export const deleteImportIdt = (kdcab, periode) =>
  api.delete(`${BASE_URL}/import-idt`, { params: { kdcab, periode } }).then(unwrap);

export const initImportIdt = periode =>
  api.post(`${BASE_URL}/import-idt/init`, null, { params: { periode } }).then(unwrap);

export const uploadCapture = formData =>
  api.post(`${BASE_URL}/import-idt/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(unwrap);

// Rekap Screening
export const getRekapScreening = params =>
  api.get(`${BASE_URL}/rekap-screening`, { params: normalizeParams(params) }).then(unwrap);

// Summary
export const getSummary = params =>
  api.get(`${BASE_URL}/summary`, { params: normalizeParams(params) }).then(unwrap);

// Export Excel
export async function exportExcel(params, filename = 'Ceklist_Prepare_Closing.xlsx') {
  const response = await api.get(`${BASE_URL}/export-excel`, {
    params: normalizeParams(params),
    responseType: 'blob',
  });
  downloadBlob(response.data, filename);
}