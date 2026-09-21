<template>
  <div class="tokomain-card">
    <div class="tokomain-header">
      <div class="tokomain-title-wrap">
        <i class="pi pi-file-import tokomain-icon"></i>
        <div class="tokomain-title-wrap">
          <h2 class="tokomain-title">Konfigurasi Path TOKOMAIN</h2>
          <p class="tokomain-subtitle">Konfigurasi bersifat per-perangkat — berlaku untuk semua user yang login di perangkat ini</p>
        </div>
      </div>
      <span class="device-chip">
        <i class="pi pi-desktop"></i>
        <span>{{ deviceIdShort }}</span>
      </span>
    </div>

    <!-- Device Info -->
    <div class="device-info-grid">
      <div class="device-info-item">
        <span class="device-info-label">Browser</span>
        <span class="device-info-value">{{ browserInfo.browser }}</span>
      </div>
      <div class="device-info-item">
        <span class="device-info-label">Platform</span>
        <span class="device-info-value">{{ browserInfo.platform }}</span>
      </div>
      <div class="device-info-item">
        <span class="device-info-label">Client IP</span>
        <span class="device-info-value">{{ config?.clientIp || 'Belum terdeteksi' }}</span>
      </div>
    </div>

    <!-- Path Config -->
    <div class="path-section">
      <label class="form-label" for="tokomainPath">Path Folder / File TOKOMAIN.ini</label>
      <div class="path-row">
        <input
          id="tokomainPath"
          v-model="pathInput"
          type="text"
          class="path-input"
          placeholder="C:\MIS\TOKOMAIN.ini"
          @keyup.enter="handleSavePath"
        />
        <button class="btn-save" :disabled="loading" @click="handleSavePath">
          <i class="pi" :class="loading ? 'pi-spin pi-spinner' : 'pi-save'"></i>
          <span>{{ loading ? 'Menyimpan...' : 'Simpan' }}</span>
        </button>
      </div>
      <p class="path-hint">Path ini disimpan di server dan dihubungkan dengan perangkat Anda.</p>
    </div>

    <!-- Upload -->
    <div class="upload-section">
      <label class="form-label">Upload Snapshot TOKOMAIN ke Server</label>
      <p class="upload-hint">Mengirim kode toko + IP (INDUK/STB) dari file TOKOMAIN.ini di komputer ini.</p>

      <div class="upload-row">
        <button class="btn-upload" :disabled="uploading" @click="handleUpload">
          <i class="pi" :class="uploading ? 'pi-spin pi-spinner' : 'pi-upload'"></i>
          <span>{{ uploading ? 'Mengupload...' : 'Upload TOKOMAIN.ini' }}</span>
        </button>

        <div v-if="!supportsFsAccess" class="file-fallback">
          <span class="file-fallback-label">atau pilih file manual:</span>
          <input type="file" accept=".ini,.txt" @change="handleFileInput" />
        </div>
      </div>

      <div v-if="!supportsFsAccess && !fileErrorShown" class="fs-fallback-notice">
        <i class="pi pi-info-circle"></i>
        Browser ini tidak mendukung pemilihan folder otomatis. Gunakan pilihan file manual di atas.
      </div>
    </div>

    <!-- Messages -->
    <div v-if="successMessage" class="msg success-msg">
      <i class="pi pi-check-circle"></i>
      <span>{{ successMessage }}</span>
    </div>
    <div v-if="errorMessage" class="msg error-msg">
      <i class="pi pi-exclamation-circle"></i>
      <span>{{ errorMessage }}</span>
    </div>

    <!-- Last snapshot -->
    <div v-if="snapshot" class="snapshot-info">
      <i class="pi pi-clock"></i>
      <span>
        Snapshot terakhir: {{ formatDate(snapshot.updatedAt) }} · {{ snapshot.count }} records
        ({{ snapshot.stats?.induk }} induk, {{ snapshot.stats?.stb }} stb)
        <template v-if="snapshot.uploadedBy"> · oleh {{ snapshot.uploadedBy }}</template>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import useDeviceConfig from '@/composables/useDeviceConfig.js';
import storeService from '@/services/store.service.js';

const { deviceId, config, loading, uploading, browserInfo, supportsFsAccess, register, load, savePath, pickAndUploadTokomain, uploadFile } = useDeviceConfig();

const pathInput = ref('');
const successMessage = ref('');
const errorMessage = ref('');
const snapshot = ref(null);
const fileErrorShown = ref(false);

const deviceIdShort = computed(() => (deviceId ? deviceId.slice(0, 8) + '…' : '—'));

const init = async () => {
  try {
    await register();
    pathInput.value = config.value?.path || '';
  } catch {
    try {
      await load();
      pathInput.value = config.value?.path || '';
    } catch {
      /* lempar ke UI */
    }
  }
  try {
    const status = await storeService.getSyncStatus();
    snapshot.value = status.snapshot || null;
  } catch {
    /* skip, bukan fatal */
  }
};

const showSuccess = msg => {
  successMessage.value = msg;
  errorMessage.value = '';
  setTimeout(() => (successMessage.value = ''), 6000);
};
const showError = msg => {
  errorMessage.value = msg;
  successMessage.value = '';
};

const handleSavePath = async () => {
  try {
    await savePath(pathInput.value.trim());
    showSuccess('Path TOKOMAIN berhasil disimpan untuk perangkat ini');
  } catch (e) {
    showError(e.response?.data?.message || 'Gagal menyimpan path');
  }
};

const handleUpload = async () => {
  fileErrorShown.value = false;
  try {
    const result = await pickAndUploadTokomain();
    showSuccess(result.message || 'Snapshot TOKOMAIN berhasil diupload');
    snapshot.value = result.snapshot || snapshot.value;
  } catch (e) {
    if (e.code === 'FS_UNSUPPORTED') {
      fileErrorShown.value = true;
    } else if (e.name !== 'AbortError') {
      showError(e.message || 'Gagal upload TOKOMAIN');
    }
  }
};

const handleFileInput = async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const result = await uploadFile(file);
    showSuccess(result.message || 'Snapshot TOKOMAIN berhasil diupload');
    snapshot.value = result.snapshot || snapshot.value;
  } catch (e) {
    showError(e.message || 'Gagal upload TOKOMAIN');
  } finally {
    event.target.value = '';
  }
};

const formatDate = str => {
  if (!str) return '-';
  return new Date(str).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

onMounted(init);
</script>

<style scoped>
.tokomain-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.tokomain-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.tokomain-title-wrap {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.tokomain-title-wrap .tokomain-title-wrap {
  flex-direction: column;
  gap: 2px;
}

.tokomain-icon {
  font-size: 1.5rem;
  color: #3b82f6;
  margin-top: 2px;
}

.tokomain-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.tokomain-subtitle {
  font-size: 0.8rem;
  color: #6b7280;
  margin: 0;
}

.device-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.device-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  background: #f9fafb;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 18px;
}

.device-info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.device-info-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #9ca3af;
}

.device-info-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: #374151;
}

.path-section,
.upload-section {
  margin-bottom: 18px;
}

.form-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
}

.path-row {
  display: flex;
  gap: 8px;
}

.path-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.85rem;
  font-family: 'Consolas', 'Menlo', monospace;
  outline: none;
}
.path-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.btn-save,
.btn-upload {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-save {
  background: #eef2ff;
  color: #4338ca;
}
.btn-save:hover {
  background: #e0e7ff;
}
.btn-upload {
  background: #2563eb;
  color: #fff;
}
.btn-upload:hover {
  background: #1d4ed8;
}
.btn-save:disabled,
.btn-upload:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.path-hint,
.upload-hint {
  font-size: 0.75rem;
  color: #9ca3af;
  margin: 6px 0 0;
}

.upload-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.file-fallback {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: #6b7280;
}
.file-fallback input {
  font-size: 0.8rem;
}

.fs-fallback-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 0.78rem;
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 8px 12px;
}

.msg {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  font-size: 0.82rem;
}
.success-msg {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}
.error-msg {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.snapshot-info {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.78rem;
  color: #475569;
}
.snapshot-info .pi {
  margin-top: 2px;
  color: #6366f1;
}
</style>