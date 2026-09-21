<template>
  <div class="store-master-page">
    <page-title title="Master Toko" :include-app-name="true" separator=" | " />

    <div class="store-master-card">
      <section class="upload-section">
        <div class="section-header">
          <h2 class="section-title">Upload Master Toko</h2>
          <p class="section-subtitle">
            Format yang didukung: <code>master-tokomain.csv</code> (INDUK + STB)
          </p>
        </div>

        <div class="upload-area" @dragover.prevent @drop.prevent="onDrop">
          <input
            ref="fileInput"
            type="file"
            accept=".csv"
            class="file-input"
            @change="onFileChange"
          />

          <div v-if="!selectedFile" class="upload-prompt">
            <div class="upload-icon">
              <i class="pi pi-upload"></i>
            </div>
            <p class="upload-text">
              Drag & drop file CSV di sini, atau
              <label class="upload-link" @click.stop>pilih file
                <input type="file" accept=".csv" class="sr-only" @change="onFileChange" />
              </label>
            </p>
            <p class="upload-hint">Hanya baris INDUK dan STB yang diproses</p>
          </div>

          <div v-else class="upload-preview">
            <div class="preview-header">
              <i class="pi pi-file-excel"></i>
              <span class="preview-name">{{ selectedFile.name }}</span>
            </div>
            <div class="preview-meta">
              <span>{{ selectedFile.size | formatSize }}</span>
              <button class="preview-remove" @click="clearFile">
                <i class="pi pi-times"></i>
                Hapus
              </button>
            </div>
          </div>
        </div>

        <div class="upload-actions">
          <button
            class="btn btn-primary"
            :disabled="isUploading || !selectedFile"
            @click="uploadCsv"
          >
            <i class="pi pi-upload"></i>
            {{ isUploading ? 'Mengupload...' : 'Upload CSV' }}
          </button>
          <span v-if="uploadMessage" class="upload-message" :class="uploadMessageType">
            {{ uploadMessage }}
          </span>
        </div>

        <div v-if="uploadSnapshot" class="snapshot-result">
          <div class="result-row">
            <span class="result-label">Terakhir diupload</span>
            <span class="result-value">{{ uploadSnapshot.updatedAt | fmtDateTime }}</span>
          </div>
          <div class="result-row">
            <span class="result-label">Oleh</span>
            <span class="result-value">{{ uploadSnapshot.uploadedByFullName || uploadSnapshot.uploadedBy }}</span>
          </div>
          <div class="result-row">
            <span class="result-label">Jumlah toko</span>
            <span class="result-value">{{ uploadSnapshot.stats?.total || 0 }} (INDUK: {{ uploadSnapshot.stats?.induk || 0 }}, STB: {{ uploadSnapshot.stats?.stb || 0 }})</span>
          </div>
        </div>
      </section>

      <section class="sync-section">
        <div class="section-header">
          <h2 class="section-title">Sinkronisasi Master Toko</h2>
          <p class="section-subtitle">
            Proses akan mengupdate nama & IP dari CSV, lalu menyamakan kode cabang dengan semua server WRC yang tersedia.
          </p>
        </div>

        <div class="sync-status">
          <div v-if="syncStatus" class="sync-meta-card">
            <div class="sync-meta-row">
              <span class="meta-label">Sumber</span>
              <span class="meta-value source-badge">{{ syncStatus.source }}</span>
            </div>
            <div class="sync-meta-row">
              <span class="meta-label">Terakhir disinkronisasi</span>
              <span class="meta-value">{{ syncStatus.lastSyncedAt | fmtDateTime }}</span>
            </div>
            <div class="sync-meta-row">
              <span class="meta-label">PIC</span>
              <span class="meta-value">{{ syncStatus.syncedByFullName || syncStatus.syncedBy }}</span>
            </div>
            <div v-if="syncStatus.summary" class="summary-grid">
              <div class="summary-item">
                <span class="summary-num">{{ syncStatus.summary.snapshotCount || 0 }}</span>
                <span class="summary-text">Toko dalam CSV</span>
              </div>
              <div class="summary-item">
                <span class="summary-num">{{ syncStatus.summary.branchUpdated || 0 }}</span>
                <span class="summary-text">Cabang diupdate</span>
              </div>
              <div class="summary-item">
                <span class="summary-num">{{ syncStatus.summary.created || 0 }}</span>
                <span class="summary-text">Toko baru</span>
              </div>
              <div class="summary-item">
                <span class="summary-num">{{ syncStatus.summary.updatedIp || 0 }}</span>
                <span class="summary-text">IP/Nama update</span>
              </div>
            </div>
          </div>

          <div v-else class="sync-empty">
            <i class="pi pi-history"></i>
            <p>Belum ada riwayat sinkronisasi master toko.</p>
          </div>
        </div>

        <div class="sync-actions">
          <button
            class="btn btn-primary"
            :disabled="isSyncing || !uploadSnapshot"
            @click="startSync"
          >
            <i class="pi pi-refresh"></i>
            {{ isSyncing ? 'Sedang memproses...' : 'Proses Sinkronisasi' }}
          </button>
          <span v-if="syncMessage" class="sync-message" :class="syncMessageType">
            {{ syncMessage }}
          </span>
        </div>
      </section>
    </div>

    <ConfirmDialog
      :show="confirmVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      :type="confirmType"
      :confirm-text="'Lanjutkan'"
      :cancel-text="'Batal'"
      @close="closeConfirm"
      @confirm="handleConfirm"
    />

    <!-- Debug informasi (sembunyikan di production) -->
    <div v-if="false" class="debug-info">
      <p>confirmVisible: {{ confirmVisible }}</p>
      <p>confirmTitle: {{ confirmTitle }}</p>
      <p>confirmMessage: {{ confirmMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import PageTitle from '../../components/PageTitle.vue'
import ConfirmDialog from '../../components/admin/ConfirmDialog.vue'
import storeService from '../../services/store.service.js'
import { useToast } from 'primevue/usetoast'

const toast = useToast()

const fileInput = ref(null)
const selectedFile = ref(null)
const isUploading = ref(false)
const uploadMessage = ref('')
const uploadMessageType = ref('')
const uploadSnapshot = ref(null)
const isSyncing = ref(false)
const syncMessage = ref('')
const syncMessageType = ref('')
const syncStatus = ref(null)
const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmType = ref('warning')
const pendingAction = ref(null)

const fmtDateTime = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
  })
}

const formatSize = (bytes) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}

const onFileChange = (event) => {
  const file = event.target.files?.[0]
  if (file) {
    selectedFile.value = file
    uploadMessage.value = ''
    uploadMessageType.value = ''
  }
}

const onDrop = (event) => {
  const file = event.dataTransfer?.files?.[0]
  if (file && file.name.toLowerCase().endsWith('.csv')) {
    selectedFile.value = file
    uploadMessage.value = ''
    uploadMessageType.value = ''
  } else {
    uploadMessage.value = 'File yang di-drop harus berformat CSV.'
    uploadMessageType.value = 'error'
  }
}

const clearFile = () => {
  selectedFile.value = null
  if (fileInput.value) fileInput.value.value = ''
  uploadMessage.value = ''
  uploadMessageType.value = ''
}

const uploadCsv = async () => {
  if (!selectedFile.value) return
  isUploading.value = true
  uploadMessage.value = ''
  uploadMessageType.value = ''

  try {
    const result = await storeService.uploadMasterCsv(selectedFile.value)
    if (result.success) {
      uploadSnapshot.value = result.snapshot
      uploadMessage.value = `Upload berhasil: ${result.snapshot.stats?.total || 0} toko (${result.snapshot.stats?.induk || 0} INDUK, ${result.snapshot.stats?.stb || 0} STB).`
      uploadMessageType.value = 'success'
      toast.add({
        severity: 'success',
        summary: 'Upload CSV',
        detail: uploadMessage.value,
        life: 4000,
      })
      await loadSyncStatus()
    } else {
      uploadMessage.value = result.message || 'Upload gagal.'
      uploadMessageType.value = 'error'
      toast.add({
        severity: 'error',
        summary: 'Upload CSV',
        detail: uploadMessage.value,
        life: 4000,
      })
    }
  } catch (err) {
    uploadMessage.value = err?.response?.data?.message || 'Terjadi kesalahan saat upload.'
    uploadMessageType.value = 'error'
    toast.add({
      severity: 'error',
      summary: 'Upload CSV',
      detail: uploadMessage.value,
      life: 4000,
    })
  } finally {
    isUploading.value = false
  }
}

const loadSyncStatus = async () => {
  try {
    const status = await storeService.getSyncStatus()
    if (status?.lastSync) {
      syncStatus.value = status.lastSync
    } else {
      syncStatus.value = null
    }
  } catch (err) {
    console.error('Gagal memuat status sinkronisasi:', err)
  }
}

const startSync = async () => {
  if (!uploadSnapshot.value) return
  isSyncing.value = true
  syncMessage.value = ''
  syncMessageType.value = ''

  try {
    const result = await storeService.syncMasterCsv(false)

    if (result.needsConfirmation) {
      showConfirm(result)
      return
    }

    if (result.needsSnapshot) {
      syncMessage.value = result.message || 'Belum ada file CSV. Upload terlebih dahulu.'
      syncMessageType.value = 'error'
      toast.add({
        severity: 'error',
        summary: 'Sinkronisasi',
        detail: syncMessage.value,
        life: 4000,
      })
      return
    }

    await finishSync(result)
  } catch (err) {
    syncMessage.value = err?.response?.data?.message || 'Terjadi kesalahan saat sinkronisasi.'
    syncMessageType.value = 'error'
    toast.add({
      severity: 'error',
      summary: 'Sinkronisasi',
      detail: syncMessage.value,
      life: 4000,
    })
  } finally {
    isSyncing.value = false
  }
}

const showConfirm = (result) => {
  console.log('[DEBUG] showConfirm dipanggil:', result)
  const lastSync = result.lastSync
  const pic = lastSync?.syncedByFullName || lastSync?.syncedBy || 'System'
  const time = lastSync?.lastSyncedAt
  const source = lastSync?.source || 'tidak diketahui'

  confirmTitle.value = 'Konfirmasi Sinkronisasi Master Toko'
  confirmMessage.value = `Data master toko baru saja di-update oleh ${pic} pada ${fmtDateTime(time)} (sumber: ${source}). Apakah Anda yakin ingin melakukan proses update master toko lagi?`
  confirmType.value = 'warning'
  pendingAction.value = { force: true }
  confirmVisible.value = true
  console.log('[DEBUG] confirmVisible setelah di-set:', confirmVisible.value)
}

const closeConfirm = () => {
  console.log('[DEBUG] closeConfirm dipanggil')
  confirmVisible.value = false
  pendingAction.value = null
}

const handleConfirm = async () => {
  if (!pendingAction.value) return
  confirmVisible.value = false

  const force = pendingAction.value.force
  pendingAction.value = null

  try {
    const result = await storeService.syncMasterCsv(force)

    if (result.needsSnapshot) {
      syncMessage.value = result.message || 'Belum ada file CSV.'
      syncMessageType.value = 'error'
      toast.add({
        severity: 'error',
        summary: 'Sinkronisasi',
        detail: syncMessage.value,
        life: 4000,
      })
      return
    }

    await finishSync(result)
  } catch (err) {
    syncMessage.value = err?.response?.data?.message || 'Terjadi kesalahan saat sinkronisasi.'
    syncMessageType.value = 'error'
    toast.add({
      severity: 'error',
      summary: 'Sinkronisasi',
      detail: syncMessage.value,
      life: 4000,
    })
  }
}

const finishSync = async (result) => {
  syncStatus.value = result
  syncMessage.value = `Sinkronisasi selesai. ${result.summary?.created || 0} toko baru, ${result.summary?.updatedIp || 0} IP/nama diupdate, ${result.summary?.branchUpdated || 0} cabang disamakan.`
  syncMessageType.value = 'success'
  toast.add({
    severity: 'success',
    summary: 'Sinkronisasi Master Toko',
    detail: syncMessage.value,
    life: 5000,
  })
  await loadSyncStatus()
}

loadSyncStatus()
</script>

<style scoped src="./index.style.css"></style>
