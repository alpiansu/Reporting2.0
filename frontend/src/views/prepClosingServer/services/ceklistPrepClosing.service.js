/**
 * API Service for Ceklist Prepare Closing
 * All requests use JWT token from localStorage/sessionStorage
 */

const API_BASE = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'}/ceklist-prep-closing`;

function getToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
}

async function request(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(opts.headers || {}),
    },
  });
  const json = await res.json();
  if (!res.ok || json.status === 'error') throw new Error(json.message || 'Request gagal');
  return json.data ?? json;
}

async function upload(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  const json = await res.json();
  if (!res.ok || json.status === 'error') throw new Error(json.message || 'Upload gagal');
  return json.data ?? json;
}

// ─── Space HDD Bulanan ────────────────────────────────────────────────────────
export const getSpaceHdd      = (p)   => request(`/space-hdd?${p}`);
export const upsertSpaceHdd   = (body) => request('/space-hdd', { method: 'POST', body: JSON.stringify(body) });
export const deleteSpaceHdd   = (kdcab, periode) => request(`/space-hdd?kdcab=${kdcab}&periode=${periode}`, { method: 'DELETE' });
export const initSpaceHdd     = (periode) => request(`/space-hdd/init?periode=${periode}`, { method: 'POST' });
export const uploadCaptureHdd = (fd, kdcab, periode) => upload(`/space-hdd/upload?kdcab=${kdcab}&periode=${periode}`, fd);

// ─── Space HDD Tampung ────────────────────────────────────────────────────────
export const getSpaceTampung      = (p)   => request(`/space-tampung?${p}`);
export const upsertSpaceTampung   = (body) => request('/space-tampung', { method: 'POST', body: JSON.stringify(body) });
export const deleteSpaceTampung   = (cab, periode) => request(`/space-tampung?cab=${cab}&periode=${periode}`, { method: 'DELETE' });
export const initSpaceTampung     = (periode) => request(`/space-tampung/init?periode=${periode}`, { method: 'POST' });
export const uploadCaptureTampung = (fd, kdcab, periode) => upload(`/space-tampung/upload?kdcab=${kdcab}&periode=${periode}`, fd);

// ─── Import IDT ───────────────────────────────────────────────────────────────
export const getImportIdt    = (p)    => request(`/import-idt?${p}`);
export const upsertImportIdt = (body) => request('/import-idt', { method: 'POST', body: JSON.stringify(body) });
export const deleteImportIdt = (kdcab, periode) => request(`/import-idt?kdcab=${kdcab}&periode=${periode}`, { method: 'DELETE' });
export const initImportIdt   = (periode) => request(`/import-idt/init?periode=${periode}`, { method: 'POST' });
export const uploadCapture   = (fd, kdcab, periode) => upload(`/import-idt/upload?kdcab=${kdcab}&periode=${periode}`, fd);

// ─── Rekap Screening ──────────────────────────────────────────────────────────
export const getRekapScreening = (p) => request(`/rekap-screening?${p}`);

// ─── Summary ──────────────────────────────────────────────────────────────────
export const getSummary = (p) => request(`/summary?${p}`);

// ─── Export Excel ─────────────────────────────────────────────────────────────
export async function exportExcel(paramsStr, filename = 'Ceklist_Prepare_Closing.xlsx') {
  const res = await fetch(`${API_BASE}/export-excel?${paramsStr}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Export gagal');
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
