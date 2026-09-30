/**
 * API service untuk Panduan Ceklist (guide "Before Closing Bulanan").
 */
import api from './api';

const BASE_URL = '/ceklist-panduan';

function unwrap(response) {
  const payload = response.data;
  if (payload?.status === 'error' || payload?.success === false) {
    throw new Error(payload.message || 'Request gagal');
  }
  return payload?.data ?? payload;
}

export const getPanduan = () =>
  api.get(BASE_URL).then(unwrap);

export const getPanduanByKdcab = kdcab =>
  api.get(`${BASE_URL}/${kdcab}`).then(unwrap);

export const createPanduan = body =>
  api.post(BASE_URL, body).then(unwrap);

export const updatePanduan = (kdcab, body) =>
  api.put(`${BASE_URL}/${kdcab}`, body).then(unwrap);

export const deletePanduan = kdcab =>
  api.delete(`${BASE_URL}/${kdcab}`).then(unwrap);