/**
 * Screening Request Guard
 * 
 * Mencegah pengiriman request screening banyak toko ke backend jika sedang
 * ada proses screening / task progress lain yang berjalan di sistem.
 */
import { useProgressStore } from "../stores/progress";

/**
 * Daftar aturan pemetaan endpoint yang meregistrasikan SSE Progress task di backend.
 * Setiap rule menentukan apakah request merupakan proses screening massal (multi-store).
 */
export const SCREENING_RULES = [
  {
    name: "Rekon Virtual Margin",
    match: (config) => {
      if (!config.url?.includes("/rekon-virtual-mrg/screening")) return false;
      const shops = config.params?.shops;
      if (shops) {
        const count = Array.isArray(shops)
          ? shops.length
          : String(shops).split(",").map((s) => s.trim()).filter(Boolean).length;
        if (count === 1) return false; // Single-store screening dilepas
      }
      return true; // Multi-store screening
    },
  },
  {
    name: "Rekon Sales",
    match: (config) => {
      if (!config.url?.includes("/rekon-sales/screening")) return false;
      return !config.params?.kdtk; // Single store kdtk dilepas
    },
  },
  {
    name: "Rekon Persediaan",
    match: (config) => {
      return Boolean(config.url?.includes("/rekon-persediaan/screening"));
    },
  },
  {
    name: "Prep Closing",
    match: (config) => {
      if (!config.url?.includes("/prep-closing/screening")) return false;
      return !config.params?.kdtk; // Single store kdtk dilepas
    },
  },
  {
    name: "Penyesuaian",
    match: (config) => {
      if (!config.url?.includes("/penyesuaian/screening")) return false;
      return !config.params?.kdtk; // Single store kdtk dilepas
    },
  },
  {
    name: "Rekon WT Harian",
    match: (config) => {
      const isPost = config.method?.toLowerCase() === "post";
      return isPost && /\/rekon-wt-harian\/?$/.test(config.url || "");
    },
  },
  {
    name: "Combined Screening",
    match: (config) => {
      return Boolean(config.url?.includes("/combined-screening/trigger"));
    },
  },
  {
    name: "Adjust Process",
    match: (config) => {
      return Boolean(config.url?.includes("/adjust/upload"));
    },
  },
  {
    name: "Buat RMB Process",
    match: (config) => {
      return Boolean(
        config.url?.includes("/buat-rmb/upload") ||
        config.url?.includes("/buat-rmb/manual")
      );
    },
  },
];

/**
 * Cek apakah request cocok dengan salah satu rule screening massal.
 * @param {object} config - Axios request config
 * @returns {object|null} Matched rule or null
 */
export function matchScreeningRule(config) {
  if (config.skipScreeningGuard) return null;
  return SCREENING_RULES.find((rule) => rule.match(config)) || null;
}

/**
 * Dapatkan active task saat ini dari progress store.
 * @returns {object|null}
 */
export function getActiveScreeningTask() {
  try {
    const progressStore = useProgressStore();
    if (!progressStore.hasActiveTasks) return null;
    return progressStore.mainTask || progressStore.activeTasks[0] || null;
  } catch (err) {
    return null;
  }
}

/**
 * Pasang Screening Request Guard Interceptor ke Axios instance.
 * @param {import("axios").AxiosInstance} api - Axios instance
 */
export function setupScreeningGuard(api) {
  api.interceptors.request.use(async (config) => {
    // 1. Cek apakah request termasuk kategori screening massal
    const matchedRule = matchScreeningRule(config);
    if (!matchedRule) {
      return config;
    }

    try {
      const progressStore = useProgressStore();

      // 2. Pastikan store sudah sync jika pertama kali dibuka
      if (!progressStore.isInitialized) {
        await progressStore.syncActiveTasks();
      }

      // 3. Cek apakah ada task yang sedang berjalan
      if (progressStore.hasActiveTasks) {
        const activeTask = progressStore.mainTask || progressStore.activeTasks[0];
        const taskTitle = activeTask?.title || activeTask?.taskId || "Screening lain";
        const userText = activeTask?.startedBy ? ` oleh ${activeTask.startedBy}` : "";
        const percentText =
          activeTask?.percentage !== undefined ? ` (${activeTask.percentage}%)` : "";

        const errorMessage = `Screening tidak dapat dimulai: Saat ini proses "${taskTitle}" sedang berlangsung${userText}${percentText}. Harap tunggu hingga proses selesai.`;

        const blockedError = new Error(errorMessage);
        blockedError.isScreeningBlocked = true;
        blockedError.activeTask = activeTask;
        blockedError.targetModule = matchedRule.name;

        // Cegat request sebelum dikirim ke jaringan backend
        return Promise.reject(blockedError);
      }
    } catch (err) {
      // Jika error adalah pencegatan dari guard kita, re-throw agar di-catch oleh caller
      if (err.isScreeningBlocked) {
        return Promise.reject(err);
      }
      // Jika terjadi kegagalan saat mengecek store, biarkan request tetap lanjut ke backend
      console.warn("[ScreeningGuard] Gagal memeriksa progress store:", err);
    }

    return config;
  });
}
