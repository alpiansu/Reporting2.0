// src/composables/useDeviceConfig.js
import { ref, computed } from "vue";
import deviceConfigService from "@/services/deviceConfig.service.js";
import storeService from "@/services/store.service.js";

const DEVICE_ID_KEY = "reporting_device_id";
const DB_NAME = "reporting-device";
const DB_STORE = "handles";
const DIR_HANDLE_KEY = "tokomain-dir-handle";

// ---------------------------------------------
// Stable per-browser/per-device ID (localStorage)
// ---------------------------------------------
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getBrowserInfo() {
  const ua = navigator.userAgent || "";
  let browser = "Unknown";
  const edge = ua.match(/Edg\/([\d.]+)/);
  const chrome = ua.match(/Chrome\/([\d.]+)/);
  const firefox = ua.match(/Firefox\/([\d.]+)/);
  const safari = ua.match(/Version\/([\d.]+)/);

  if (edge) browser = `Edge ${edge[1]}`;
  else if (chrome) browser = `Chrome ${chrome[1]}`;
  else if (firefox) browser = `Firefox ${firefox[1]}`;
  else if (safari) browser = `Safari ${safari[1]}`;

  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "Unknown";
  return { browser, platform };
}

// ---------------------------------------------
// IndexedDB helper untuk persist directory handle
// ---------------------------------------------
function openDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbPut(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const request = tx.objectStore(DB_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------
// File System Access API helpers
// ---------------------------------------------
const isFsAccessSupported = computed(() => {
  return typeof window !== "undefined" && "showOpenFilePicker" in window && "showDirectoryPicker" in window;
});

async function findTokomainFile(dirHandle) {
  for await (const entry of dirHandle.values()) {
    if (entry.kind === "file" && /^tokomain\.ini$/i.test(entry.name)) {
      return entry;
    }
  }
  return null;
}

async function getFileHandleWithPicker() {
  const persistedDir = await dbGet(DIR_HANDLE_KEY);
  let startIn = "documents";
  if (persistedDir) {
    try {
      if (await persistedDir.queryPermission({ mode: "read" }) === "granted") {
        startIn = persistedDir;
      }
    } catch (e) {
      /* ignore, fallback to documents */
    }
  }

  const [fileHandle] = await window.showOpenFilePicker({
    startIn,
    multiple: false,
    excludeAcceptAllOption: false,
    types: [
      {
        description: "TOKOMAIN.ini / INI / TXT",
        accept: { "text/plain": [".ini", ".txt"] },
      },
    ],
  });

  // Persist parent directory handle so next upload can auto-read without picker
  try {
    const parent = (await fileHandle.getParent && fileHandle.getParent()) || null;
    if (parent) await dbPut(DIR_HANDLE_KEY, parent);
  } catch (e) {
    /* persistence is best-effort */
  }

  return fileHandle;
}

async function getTokomainFileHandle() {
  // 1) Coba auto-resolve dari handle folder yang sudah diizinkan (tanpa dialog)
  try {
    const dirHandle = await dbGet(DIR_HANDLE_KEY);
    if (dirHandle) {
      if (dirHandle.queryPermission({ mode: "read" }) === "granted") {
        const fileHandle = await findTokomainFile(dirHandle);
        if (fileHandle) return fileHandle;
      }
    }
  } catch (e) {
    /* fallthrough ke picker */
  }

  // 2) Fallback: buka file picker (user pilih file sekali)
  return getFileHandleWithPicker();
}

/**
 * Composable untuk konfigurasi per-perangkat (path TOKOMAIN.ini) dan upload nya
 * @returns {object}
 */
export function useDeviceConfig() {
  const deviceId = getDeviceId();
  const config = ref(null);
  const loading = ref(false);
  const uploading = ref(false);
  const uploadError = ref(null);

  const browserInfo = computed(() => getBrowserInfo());
  const supportsFsAccess = isFsAccessSupported;

  const register = async () => {
    try {
      const { browser, platform } = getBrowserInfo();
      config.value = await deviceConfigService.register(deviceId, browser, platform);
    } catch (error) {
      console.error("Gagal register device config:", error);
      throw error;
    }
  };

  const load = async () => {
    try {
      config.value = await deviceConfigService.getCurrent(deviceId);
    } catch (error) {
      // 404 = belum terdaftar; bukan error fatal
      if (error.response?.status !== 404) throw error;
      config.value = null;
    }
  };

  const savePath = async path => {
    loading.value = true;
    try {
      config.value = await deviceConfigService.updatePath(deviceId, path || "");
      return config.value;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Upload TOKOMAIN.ini. Prioritaskan File System Access API (auto-read via
   * handle folder yang sudah diizinkan). Throw jika tidak supported.
   * @returns {Promise<Object>} Backend response
   */
  const pickAndUploadTokomain = async () => {
    if (!supportsFsAccess.value) {
      const error = new Error("File System Access API tidak didukung di browser ini. Gunakan pilihan file manual.");
      error.code = "FS_UNSUPPORTED";
      throw error;
    }

    uploading.value = true;
    uploadError.value = null;
    try {
      const fileHandle = await getTokomainFileHandle();
      const file = await fileHandle.getFile();
      const result = await storeService.uploadTokomain(file, {
        deviceId,
        sourcePath: config.value?.path || file.name,
      });
      return result;
    } catch (error) {
      if (error.name === "AbortError") {
        uploadError.value = "Pemilihan file dibatalkan";
      } else {
        uploadError.value = error.message || "Gagal upload TOKOMAIN";
      }
      throw error;
    } finally {
      uploading.value = false;
    }
  };

  /**
   * Upload file yang dipilih manual (fallback <input type=file>)
   * @param {File} file
   */
  const uploadFile = async file => {
    uploading.value = true;
    uploadError.value = null;
    try {
      const result = await storeService.uploadTokomain(file, {
        deviceId,
        sourcePath: config.value?.path || file.name,
      });
      return result;
    } catch (error) {
      uploadError.value = error.message || "Gagal upload TOKOMAIN";
      throw error;
    } finally {
      uploading.value = false;
    }
  };

  return {
    deviceId,
    config,
    loading,
    uploading,
    uploadError,
    browserInfo,
    supportsFsAccess,
    register,
    load,
    savePath,
    pickAndUploadTokomain,
    uploadFile,
  };
}

export default useDeviceConfig;