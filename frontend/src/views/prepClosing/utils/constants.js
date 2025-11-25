// src/pages/PrepClosing/utils/constants.js

export const CATEGORIES = {
  wrc_data: {
    label: "Data WRC",
    icon: "pi pi-server",
    color: "#3b82f6",
  },
  system_config: {
    label: "Konfigurasi Sistem",
    icon: "pi pi-cog",
    color: "#8b5cf6",
  },
  inventory: {
    label: "Inventory",
    icon: "pi pi-box",
    color: "#10b981",
  },
  database: {
    label: "Database",
    icon: "pi pi-database",
    color: "#f59e0b",
  },
  saldo: {
    label: "Saldo",
    icon: "pi pi-chart-line",
    color: "#ef4444",
  },
  data_integrity: {
    label: "Integritas Data",
    icon: "pi pi-shield",
    color: "#06b6d4",
  },
  tax: {
    label: "Perpajakan",
    icon: "pi pi-receipt",
    color: "#ec4899",
  },
};

export const SEVERITY_CONFIG = {
  critical: {
    label: "Kritis",
    color: "#dc2626",
    bgColor: "#fee2e2",
    icon: "pi pi-exclamation-circle",
    iconBg: "#fecaca",
    blocking: true,
  },
  high: {
    label: "Tinggi",
    color: "#f59e0b",
    bgColor: "#fef3c7",
    icon: "pi pi-exclamation-triangle",
    iconBg: "#fde68a",
    blocking: false,
  },
  medium: {
    label: "Sedang",
    color: "#3b82f6",
    bgColor: "#dbeafe",
    icon: "pi pi-info-circle",
    iconBg: "#bfdbfe",
    blocking: false,
  },
  low: {
    label: "Rendah",
    color: "#6b7280",
    bgColor: "#f3f4f6",
    icon: "pi pi-info",
    iconBg: "#e5e7eb",
    blocking: false,
  },
};

export const SCREENING_LEVELS = {
  STORE: "store",
  CABANG: "cabang",
  ALL: "all",
};

export const AUTO_REFRESH_INTERVALS = {
  SUMMARY: 60000, // 60 seconds
  TABLE: 30000, // 30 seconds
  PROGRESS: 2000, // 2 seconds
};
