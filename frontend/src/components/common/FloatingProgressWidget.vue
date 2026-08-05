<template>
  <transition name="slide-fade-right">
    <div v-if="isVisible" class="floating-progress-widget" :class="{ minimal: isMinimal }">

      <!-- Header -->
      <div class="widget-header">
        <div class="header-main" @click="toggleMode">
          <div class="process-icon" :class="{ error: hasError, cancelling: isCancelling }">
            <i class="pi" :class="isCancelling ? 'pi-spin pi-spinner' : hasError ? 'pi-exclamation-triangle' : 'pi-spin pi-spinner'"></i>
          </div>
          <div class="title-container" v-if="!isMinimal">
            <span class="widget-title">{{ mainTask?.title || 'Processing...' }}</span>
            <span class="widget-count" v-if="taskCount > 1">
              +{{ taskCount - 1 }} more
            </span>
          </div>
        </div>

        <div class="widget-actions" v-if="!isMinimal">
          <!-- Cancel button — only shown to the initiator or admin -->
          <button
            v-if="canCancel"
            class="cancel-btn"
            :disabled="isCancelling"
            :title="isCancelling ? 'Membatalkan...' : 'Batalkan proses'"
            @click.stop="confirmCancel"
          >
            <i class="pi" :class="isCancelling ? 'pi-spin pi-spinner' : 'pi-times'"></i>
          </button>

          <button class="mode-toggle" @click.stop="toggleMode" :title="isMinimal ? 'Show details' : 'Minimize'">
            <i class="pi" :class="isMinimal ? 'pi-chevron-left' : 'pi-chevron-right'"></i>
          </button>
        </div>

        <!-- Minimal: only toggle button -->
        <div class="widget-actions" v-else>
          <button class="mode-toggle" @click.stop="toggleMode" title="Show details">
            <i class="pi pi-chevron-left"></i>
          </button>
        </div>
      </div>

      <!-- Expanded content -->
      <div class="widget-content" v-if="!isMinimal">
        <!-- Status info row -->
        <div class="progress-info">
          <span class="info-text" :title="mainTask?.info">
            {{ isCancelling ? 'Membatalkan proses...' : (mainTask?.info || 'Syncing data...') }}
          </span>
          <span class="percentage-text">{{ totalPercentage }}%</span>
        </div>

        <!-- Progress bar -->
        <div class="progress-bar-container">
          <div class="progress-bar-track">
            <div
              class="progress-bar-fill"
              :class="{ 'fill-cancelling': isCancelling }"
              :style="{ width: totalPercentage + '%' }"
            >
              <div class="fill-shine" v-if="!isCancelling"></div>
            </div>
          </div>
        </div>

        <!-- Initiator badge -->
        <div class="initiator-row" v-if="mainTask?.startedBy">
          <i class="pi pi-user"></i>
          <span>{{ mainTask.startedBy }}</span>
        </div>

        <!-- Processing stores (real-time) -->
        <div class="processing-stores" v-if="currentProcessingStores.length > 0">
          <div class="stores-header">
            <i class="pi pi-database"></i>
            <span>Memproses {{ currentProcessingStores.length }} store</span>
          </div>
          <div class="stores-list">
            <span
              class="store-chip"
              v-for="(store, idx) in visibleStores"
              :key="idx"
              :title="store"
            >{{ store }}</span>
            <span class="store-more" v-if="currentProcessingStores.length > maxVisibleStores">
              +{{ currentProcessingStores.length - maxVisibleStores }} more
            </span>
          </div>
        </div>
      </div>

      <!-- Minimal progress indicator -->
      <div
        class="minimal-progress"
        v-if="isMinimal"
        :title="`${totalPercentage}% complete`"
        @click="toggleMode"
      >
        <div class="minimal-fill" :style="{ width: totalPercentage + '%' }"></div>
      </div>

    </div>
  </transition>

  <!-- Confirm Dialog -->
  <div v-if="showConfirmDialog" class="cancel-overlay" @click.self="showConfirmDialog = false">
    <div class="cancel-dialog">
      <div class="dialog-icon">
        <i class="pi pi-exclamation-triangle"></i>
      </div>
      <div class="dialog-body">
        <h4 class="dialog-title">Batalkan Proses?</h4>
        <p class="dialog-msg">
          Proses <strong>{{ mainTask?.title }}</strong> akan dihentikan.
          Store yang sedang berjalan akan selesai, namun store berikutnya tidak akan diproses.
        </p>
      </div>
      <div class="dialog-actions">
        <button class="btn-secondary" @click="showConfirmDialog = false">Tidak</button>
        <button class="btn-danger" @click="executeCancel">Ya, Batalkan</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useProgressStore, useExportsStore } from '../../stores';
import { useAuthStore } from '../../stores';
import { useToastService } from '../../utils/toast';

const progressStore = useProgressStore();
const exportStore = useExportsStore();
const authStore = useAuthStore();
const toast = useToastService();

const isMinimal = ref(true);
const isCancelling = ref(false);
const showConfirmDialog = ref(false);

// Processing stores display
const maxVisibleStores = 8;

// ── Computed ──────────────────────────────────────────────────────────────────

// Satu widget, dua sumber: task screening (progressStore) + job export (exportStore).
// Prioritas tampil: screening dulu, kalau tidak ada baru export.
const mainTask = computed(() => {
  if (progressStore.hasActiveTasks && progressStore.mainTask) {
    return { ...progressStore.mainTask, source: 'progress' };
  }
  const job = exportStore.mainJob;
  if (job) {
    const isQueued = job.status === 'queued';
    return {
      taskId: job.taskId,
      title: job.reportName || 'Export Laporan',
      info: isQueued
        ? `Antrian #${job.queuePosition || '...'} — ${job.message || 'Menunggu giliran'}`
        : (job.message || 'Memproses export...'),
      percentage: job.percentage || 0,
      startedBy: job.startedBy,
      status: job.status,
      source: 'export',
    };
  }
  return null;
});

const isVisible = computed(() => progressStore.hasActiveTasks || exportStore.hasActiveJobs);
const hasError = computed(() => mainTask.value?.status?.toLowerCase() === 'failed');
const taskCount = computed(() => progressStore.activeTasks.length + exportStore.activeJobs.length);

const totalPercentage = computed(() => {
  if (mainTask.value?.source === 'export') return exportStore.totalPercentage;
  return progressStore.totalPercentage;
});

// Stores currently being processed for the main task (hanya untuk task screening)
const currentProcessingStores = computed(() => {
  if (mainTask.value?.source !== 'progress') return [];
  const taskId = mainTask.value?.taskId;
  if (!taskId) return [];
  return progressStore.processingStores[taskId] || [];
});

const visibleStores = computed(() => {
  return currentProcessingStores.value.slice(0, maxVisibleStores);
});

// Use login username for cancel permission check (fallback via taskId always works)
// startedBy now contains the user's display name (fullName) for UI display
const currentUsername = computed(() => authStore.user?.username ?? null);

const isAdmin = computed(() =>
  ['admin', 'superadmin'].includes(authStore.user?.role)
);

const canCancel = computed(() => {
  if (!mainTask.value || isCancelling.value) return false;
  if (isAdmin.value) return true;

  const task = mainTask.value;
  const username = currentUsername.value;
  if (!username) return false;

  // Primary: compare stored startedBy (case-insensitive)
  if (task.startedBy) {
    return task.startedBy.toLowerCase() === username.toLowerCase();
  }

  // Fallback: extract owner from taskId — format is "<module>Task_<username>"
  // taskId is guaranteed to embed the initiator's username
  const tid = task.taskId || '';
  if (tid.includes('_')) {
    const taskOwner = tid.substring(tid.lastIndexOf('_') + 1);
    return taskOwner.toLowerCase() === username.toLowerCase();
  }

  return false;
});

// ── Methods ───────────────────────────────────────────────────────────────────

const toggleMode = () => {
  isMinimal.value = !isMinimal.value;
};

const confirmCancel = () => {
  showConfirmDialog.value = true;
};

const executeCancel = async () => {
  showConfirmDialog.value = false;
  const task = mainTask.value;
  if (!task?.taskId) return;

  isCancelling.value = true;
  try {
    // Routing otomatis: job export → store exports, task screening → store progress
    if (task.source === 'export') {
      await exportStore.cancelTask(task.taskId);
    } else {
      await progressStore.cancelTask(task.taskId);
    }
  } catch (err) {
    console.error('Cancel failed:', err);
    const status = err.response?.status;
    let msg = 'Gagal membatalkan proses';
    if (status === 403) msg = err.response.data?.message || 'Tidak memiliki izin untuk membatalkan';
    if (status === 404) msg = 'Task tidak ditemukan atau sudah selesai';
    toast.showError('Gagal', msg);
    isCancelling.value = false;
  }
};

/** Notifikasi global dari exportStore (auto-download sukses/gagal, job selesai). */
const onExportNotify = (event) => {
  const { type, title, message } = event.detail || {};
  if (!title && !message) return;
  if (type === 'success') toast.showSuccess(title, message);
  else if (type === 'error') toast.showError(title, message);
  else toast.showInfo(title, message);
};

const handleExpand = () => {
  isMinimal.value = false;
};

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(() => {
  progressStore.initProgressMonitoring();
  exportStore.initMonitoring();
  window.addEventListener('progress-widget-expand', handleExpand);
  window.addEventListener('export-notify', onExportNotify);
});

onBeforeUnmount(() => {
  exportStore.stopMonitoring();
  window.removeEventListener('progress-widget-expand', handleExpand);
  window.removeEventListener('export-notify', onExportNotify);
});

// Reset cancelling state when task is gone (SSE confirmed)
watch(
  () => mainTask.value,
  (newTask) => {
    if (!newTask) isCancelling.value = false;
  }
);

// Auto-minimize when all tasks finish
watch(isVisible, (newVal) => {
  if (!newVal) {
    isCancelling.value = false;
    setTimeout(() => {
      isMinimal.value = true;
    }, 500);
  }
});
</script>

<style scoped src="./FloatingProgressWidget.style.css"></style>
