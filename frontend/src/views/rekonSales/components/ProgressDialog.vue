<template>
  <Dialog v-model:visible="localVisible" header="Progress Screening" :modal="true" :style="{ width: '700px' }">
    <div class="status" :class="statusClass">
      <i :class="statusIcon"></i>
      <div class="status-text">
        <div class="title">{{ statusTitle }}</div>
        <div class="message">{{ statusMessage }}</div>
      </div>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" :class="progressClass" :style="{ width: progressPercentage + '%' }"></div>
    </div>
    <div class="info-row">
      <div>Processed: {{ progress?.current || 0 }} / {{ progress?.total || 0 }}</div>
      <div v-if="elapsed">Elapsed: {{ elapsed }}</div>
    </div>
    <template #footer>
      <div class="footer">
        <Button v-if="isCompleted" icon="pi pi-check" label="Tutup" class="p-button-success" @click="$emit('complete')" />
        <Button v-else icon="pi pi-minus" label="Minimize" class="p-button-text" @click="$emit('minimize')" />
      </div>
    </template>
  </Dialog>
  </template>

<script setup>
import { computed, ref, watch, onUnmounted } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';

const props = defineProps({
  visible: { type: Boolean, default: false },
  progress: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['complete', 'minimize', 'update:visible']);

const localVisible = ref(props.visible);
watch(() => props.visible, (v) => { localVisible.value = v; });
watch(localVisible, (v) => emit('update:visible', v));

const isCompleted = computed(() => props.progress?.status === 'completed');
const isFailed = computed(() => props.progress?.status === 'failed');
const progressPercentage = computed(() => Math.min(100, Math.max(0, props.progress?.percentage ?? 0)));

const statusClass = computed(() => (isCompleted.value ? 'status-success' : isFailed.value ? 'status-error' : 'status-processing'));
const statusIcon = computed(() => (isCompleted.value ? 'pi pi-check-circle' : isFailed.value ? 'pi pi-times-circle' : 'pi pi-spin pi-spinner'));
const statusTitle = computed(() => (isCompleted.value ? 'Screening Selesai!' : isFailed.value ? 'Screening Gagal' : 'Sedang Memproses...'));
const statusMessage = computed(() => props.progress?.info || (isFailed.value ? 'Terjadi kesalahan' : 'Mohon tunggu, proses berlangsung'));
const progressClass = computed(() => (isCompleted.value ? 'progress-success' : isFailed.value ? 'progress-error' : progressPercentage.value >= 80 ? 'progress-warning' : 'progress-info'));

const startTime = ref(null);
const elapsed = ref('');
let intervalId = null;

const startTimer = () => {
  stopTimer();
  startTime.value = Date.now();
  intervalId = setInterval(() => {
    const seconds = Math.floor((Date.now() - startTime.value) / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    elapsed.value = `${m}:${String(s).padStart(2, '0')}`;
  }, 1000);
};

const stopTimer = () => { if (intervalId) { clearInterval(intervalId); intervalId = null; } };

watch(localVisible, (v) => { if (v) startTimer(); else stopTimer(); });
onUnmounted(() => { stopTimer(); });
</script>

<style scoped>
.status { display: flex; align-items: center; gap: .75rem; padding: .75rem; border-radius: 8px; margin-bottom: .75rem; }
.status-processing { background: #f9fafb; border-left: 3px solid #3b82f6; }
.status-success { background: #f0fdf4; border-left: 3px solid #10b981; }
.status-error { background: #fef2f2; border-left: 3px solid #ef4444; }
.status-text .title { font-weight: 600; }
.progress-bar { width: 100%; height: 10px; background: #e5e7eb; border-radius: 6px; overflow: hidden; }
.progress-fill { height: 100%; transition: width .3s ease; }
.progress-info { background: #3b82f6; }
.progress-warning { background: #f59e0b; }
.progress-success { background: #10b981; }
.progress-error { background: #ef4444; }
.info-row { display: flex; justify-content: space-between; margin-top: .5rem; color: #6b7280; font-size: .85rem; }
.footer { display: flex; justify-content: flex-end; gap: .5rem; }
</style>
