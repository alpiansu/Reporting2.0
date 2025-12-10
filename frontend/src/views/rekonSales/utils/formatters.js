export const formatCurrency = (value) => {
  const n = Number(value || 0);
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
};

export const formatNumber = (value) => {
  const n = Number(value || 0);
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n);
};

export const formatDateTime = (date) => {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('id-ID', { hour12: false });
};

export const formatRelativeTime = (date) => {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)} detik lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
};

export const formatPeriode = (periode) => {
  if (!periode) return '-';
  const [year, month] = String(periode).split('-');
  if (!month || !year) return String(periode);
  return `${month}/${String(year).slice(-2)}`;
};
