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
            <span class="widget-count" v-if="progressStore.activeTasks.length > 1">
              +{{ progressStore.activeTasks.length - 1 }} more
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
          <span class="percentage-text">{{ progressStore.totalPercentage }}%</span>
        </div>

        <!-- Progress bar -->
        <div class="progress-bar-container">
          <div class="progress-bar-track">
            <div
              class="progress-bar-fill"
              :class="{ 'fill-cancelling': isCancelling }"
              :style="{ width: progressStore.totalPercentage + '%' }"
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
        :title="`${progressStore.totalPercentage}% complete`"
        @click="toggleMode"
      >
        <div class="minimal-fill" :style="{ width: progressStore.totalPercentage + '%' }"></div>
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
import { useProgressStore } from '../../stores';
import { useAuthStore } from '../../stores';

const progressStore = useProgressStore();
const authStore = useAuthStore();

const isMinimal = ref(true);
const isCancelling = ref(false);
const showConfirmDialog = ref(false);

// Processing stores display
const maxVisibleStores = 8;

// ── Computed ──────────────────────────────────────────────────────────────────

const mainTask = computed(() => progressStore.mainTask);
const isVisible = computed(() => progressStore.hasActiveTasks);
const hasError = computed(() => mainTask.value?.status?.toLowerCase() === 'failed');

// Stores currently being processed for the main task
const currentProcessingStores = computed(() => {
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
  if (!mainTask.value?.taskId) return;

  isCancelling.value = true;
  try {
    await progressStore.cancelTask(mainTask.value.taskId);
    // Widget will auto-hide once SSE sends the 'fail' event for this task
  } catch (err) {
    console.error('Cancel failed:', err);
    const status = err.response?.status;
    let msg = 'Gagal membatalkan proses';
    if (status === 403) msg = err.response.data?.message || 'Tidak memiliki izin untuk membatalkan';
    if (status === 404) msg = 'Task tidak ditemukan atau sudah selesai';
    alert(msg);
    isCancelling.value = false;
  }
};

const handleExpand = () => {
  isMinimal.value = false;
};

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(() => {
  progressStore.initProgressMonitoring();
  window.addEventListener('progress-widget-expand', handleExpand);
});

onBeforeUnmount(() => {
  window.removeEventListener('progress-widget-expand', handleExpand);
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

<style scoped>
/* ── Widget container ──────────────────────────────────────────────────────── */
.floating-progress-widget {
  position: fixed;
  top: 74px;
  right: 20px;
  z-index: 9999;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  padding: 12px;
  width: 290px;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  overflow: hidden;
  user-select: none;
}

.floating-progress-widget.minimal {
  width: 48px;
  padding: 8px;
  border-radius: 24px;
  right: 15px;
  cursor: pointer;
}

/* ── Header ────────────────────────────────────────────────────────────────── */
.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  flex: 1;
  min-width: 0;
}

.process-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #4f46e5, #818cf8);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
}

.process-icon.error {
  background: linear-gradient(135deg, #ef4444, #f87171);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.process-icon.cancelling {
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}

.title-container {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.widget-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.widget-count {
  font-size: 0.7rem;
  color: #6b7280;
  font-weight: 500;
}

/* ── Action buttons ────────────────────────────────────────────────────────── */
.widget-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.mode-toggle {
  background: transparent;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.mode-toggle:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #4f46e5;
}

.cancel-btn {
  background: transparent;
  border: 1px solid transparent;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ef4444;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
  font-size: 0.7rem;
}

.cancel-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
}

.cancel-btn:disabled {
  color: #f59e0b;
  cursor: not-allowed;
  opacity: 0.8;
}

/* ── Content ───────────────────────────────────────────────────────────────── */
.widget-content {
  margin-top: 10px;
  animation: fadeIn 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 7px;
}

.info-text {
  font-size: 0.72rem;
  color: #6b7280;
  max-width: 185px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.percentage-text {
  font-size: 0.85rem;
  font-weight: 800;
  color: #4f46e5;
}

/* ── Progress bar ──────────────────────────────────────────────────────────── */
.progress-bar-container {
  height: 6px;
  width: 100%;
}

.progress-bar-track {
  height: 100%;
  width: 100%;
  background: #f3f4f6;
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #4f46e5, #818cf8);
  border-radius: 3px;
  transition: width 0.3s ease;
  position: relative;
  overflow: hidden;
}

.progress-bar-fill.fill-cancelling {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.fill-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  animation: shine 1.5s infinite;
}

/* ── Initiator badge ───────────────────────────────────────────────────────── */
.initiator-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 0.68rem;
  color: #9ca3af;
}

.initiator-row .pi {
  font-size: 0.65rem;
}

/* ── Processing stores ─────────────────────────────────────────────────────── */
.processing-stores {
  margin-top: 8px;
  padding: 6px 8px;
  background: #f8f9ff;
  border-radius: 6px;
  border: 1px solid #eef0ff;
}

.stores-header {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.68rem;
  color: #6b7280;
  margin-bottom: 4px;
}

.stores-header .pi {
  font-size: 0.6rem;
  color: #818cf8;
}

.stores-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.store-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  font-size: 0.65rem;
  font-weight: 600;
  color: #4f46e5;
  background: #eef2ff;
  border-radius: 4px;
  line-height: 1.4;
  white-space: nowrap;
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.store-more {
  font-size: 0.62rem;
  color: #9ca3af;
  display: inline-flex;
  align-items: center;
  padding: 2px 4px;
}

/* ── Minimal ───────────────────────────────────────────────────────────────── */
.minimal-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: #f3f4f6;
}

.minimal-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 100%;
  background: #4f46e5;
  transition: width 0.3s ease;
}

/* ── Confirm dialog overlay ────────────────────────────────────────────────── */
.cancel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.cancel-dialog {
  background: white;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  padding: 1.5rem;
  max-width: 380px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.dialog-icon {
  width: 3rem;
  height: 3rem;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ef4444;
  font-size: 1.3rem;
  margin: 0 auto;
}

.dialog-body {
  text-align: center;
}

.dialog-title {
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.5rem;
}

.dialog-msg {
  font-size: 0.82rem;
  color: #6b7280;
  line-height: 1.5;
  margin: 0;
}

.dialog-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.btn-secondary {
  flex: 1;
  padding: 0.6rem 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  color: #374151;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

.btn-danger {
  flex: 1;
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 8px;
  background: #ef4444;
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-danger:hover {
  background: #dc2626;
}

/* ── Animations ────────────────────────────────────────────────────────────── */
@keyframes shine {
  0% { left: -100%; }
  100% { left: 100%; }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}

/* ── Slide transition ──────────────────────────────────────────────────────── */
.slide-fade-right-enter-active,
.slide-fade-right-leave-active {
  transition: all 0.4s ease-in-out;
}

.slide-fade-right-enter-from,
.slide-fade-right-leave-to {
  transform: translateX(50px);
  opacity: 0;
}

@media (max-width: 768px) {
  .floating-progress-widget {
    top: auto;
    bottom: 80px;
  }
}
</style>
