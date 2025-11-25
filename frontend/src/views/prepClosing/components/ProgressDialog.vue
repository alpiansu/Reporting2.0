<template>
    <Dialog v-model:visible="localVisible" header="Progress Screening" :modal="true" :closable="false"
        :dismissableMask="false" :style="{ width: '600px' }">
        <div class="progress-content">
            <!-- Status Section -->
            <div class="status-section">
                <div class="status-icon" :class="statusClass">
                    <i :class="statusIcon"></i>
                </div>
                <div class="status-info">
                    <h3>{{ statusTitle }}</h3>
                    <p>{{ statusMessage }}</p>
                </div>
            </div>

            <!-- Progress Bar -->
            <div class="progress-section">
                <ProgressBar :value="progressPercentage" :showValue="true" :class="progressClass" />

                <div class="progress-details">
                    <span>{{ progress?.current || 0 }} / {{ progress?.total || 0 }} toko</span>
                    <span>{{ timeElapsed }}</span>
                </div>
            </div>

            <!-- Description -->
            <div v-if="progress?.description" class="description-section">
                <Message severity="info" :closable="false">
                    {{ progress.description }}
                </Message>
            </div>

            <!-- ETA Section -->
            <div v-if="estimatedTime" class="eta-section">
                <i class="pi pi-clock"></i>
                <span>Estimasi waktu tersisa: <strong>{{ estimatedTime }}</strong></span>
            </div>

            <!-- Warning on Complete -->
            <div v-if="isCompleted" class="completion-section">
                <Message severity="success" :closable="false">
                    <i class="pi pi-check-circle"></i>
                    <span>Screening selesai! Data sedang diperbarui...</span>
                </Message>
            </div>

            <!-- Error Section -->
            <div v-if="isFailed" class="error-section">
                <Message severity="error" :closable="false">
                    <i class="pi pi-times-circle"></i>
                    <span>Screening gagal! Silakan coba lagi.</span>
                </Message>
            </div>
        </div>

        <template #footer>
            <div class="footer-actions">
                <Button v-if="!isCompleted && !isFailed" label="Minimize" icon="pi pi-window-minimize"
                    class="p-button-outlined" @click="handleMinimize" />
                <Button v-if="isCompleted" label="Selesai" icon="pi pi-check" class="p-button-success"
                    @click="handleComplete" />
                <Button v-if="isFailed" label="Tutup" icon="pi pi-times" class="p-button-danger"
                    @click="handleComplete" />
            </div>
        </template>
    </Dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import ProgressBar from 'primevue/progressbar';
import Message from 'primevue/message';

const props = defineProps({
    visible: Boolean,
    progress: Object
});

const emit = defineEmits(['update:visible', 'complete', 'minimize']);

const localVisible = ref(props.visible);
const startTime = ref(Date.now());
const elapsedSeconds = ref(0);
let intervalId = null;

watch(() => props.visible, (newVal) => {
    localVisible.value = newVal;
    if (newVal) {
        startTime.value = Date.now();
        startTimer();
    } else {
        stopTimer();
    }
});

watch(localVisible, (newVal) => {
    emit('update:visible', newVal);
});

watch(() => props.progress, (newVal) => {
    if (newVal?.percentage === 100 || newVal?.status === 'completed') {
        setTimeout(() => {
            handleComplete();
        }, 2000); // Auto close after 2 seconds
    }
});

onMounted(() => {
    if (props.visible) {
        startTimer();
    }
});

onUnmounted(() => {
    stopTimer();
});

const progressPercentage = computed(() => {
    return props.progress?.percentage || 0;
});

const isCompleted = computed(() => {
    return props.progress?.status === 'completed' || progressPercentage.value >= 100;
});

const isFailed = computed(() => {
    return props.progress?.status === 'failed';
});

const statusClass = computed(() => {
    if (isCompleted.value) return 'status-success';
    if (isFailed.value) return 'status-error';
    return 'status-processing';
});

const statusIcon = computed(() => {
    if (isCompleted.value) return 'pi pi-check-circle';
    if (isFailed.value) return 'pi pi-times-circle';
    return 'pi pi-spin pi-spinner';
});

const statusTitle = computed(() => {
    if (isCompleted.value) return 'Screening Selesai!';
    if (isFailed.value) return 'Screening Gagal';
    return 'Sedang Memproses...';
});

const statusMessage = computed(() => {
    if (isCompleted.value) return 'Semua toko telah berhasil di-screening';
    if (isFailed.value) return 'Terjadi kesalahan saat screening';
    return props.progress?.description || 'Mohon tunggu, proses screening sedang berjalan';
});

const progressClass = computed(() => {
    if (isCompleted.value) return 'progress-success';
    if (isFailed.value) return 'progress-error';
    if (progressPercentage.value >= 80) return 'progress-warning';
    return 'progress-info';
});

const timeElapsed = computed(() => {
    const minutes = Math.floor(elapsedSeconds.value / 60);
    const seconds = elapsedSeconds.value % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

const estimatedTime = computed(() => {
    if (!props.progress || props.progress.current === 0) return null;

    const avgTimePerStore = elapsedSeconds.value / props.progress.current;
    const remaining = props.progress.total - props.progress.current;
    const estimatedSeconds = Math.round(avgTimePerStore * remaining);

    if (estimatedSeconds < 60) return `${estimatedSeconds} detik`;

    const minutes = Math.floor(estimatedSeconds / 60);
    const seconds = estimatedSeconds % 60;
    return `${minutes} menit ${seconds} detik`;
});

const startTimer = () => {
    stopTimer();
    intervalId = setInterval(() => {
        elapsedSeconds.value = Math.floor((Date.now() - startTime.value) / 1000);
    }, 1000);
};

const stopTimer = () => {
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
    }
};

const handleComplete = () => {
    stopTimer();
    emit('complete');
    localVisible.value = false;
};

const handleMinimize = () => {
    emit('minimize');
    localVisible.value = false;
};
</script>

<style scoped>
.progress-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem 0;
}

.status-section {
    display: flex;
    align-items: center;
    gap: 1.5rem;
}

.status-icon {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
}

.status-icon.status-processing {
    background: #dbeafe;
    color: #3b82f6;
}

.status-icon.status-success {
    background: #dcfce7;
    color: #10b981;
}

.status-icon.status-error {
    background: #fee2e2;
    color: #ef4444;
}

.status-info {
    flex: 1;
}

.status-info h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    color: #111827;
}

.status-info p {
    margin: 0;
    color: #6b7280;
    line-height: 1.5;
}

.progress-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

:deep(.progress-info .p-progressbar-value) {
    background: #3b82f6;
}

:deep(.progress-warning .p-progressbar-value) {
    background: #f59e0b;
}

:deep(.progress-success .p-progressbar-value) {
    background: #10b981;
}

:deep(.progress-error .p-progressbar-value) {
    background: #ef4444;
}

.progress-details {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    color: #6b7280;
}

.description-section :deep(.p-message) {
    border-radius: 8px;
}

.eta-section {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 8px;
    color: #374151;
}

.eta-section i {
    color: #3b82f6;
    font-size: 1.25rem;
}

.completion-section,
.error-section {
    animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.footer-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
}

@media (max-width: 768px) {
    .status-section {
        flex-direction: column;
        text-align: center;
    }

    .footer-actions {
        flex-direction: column;
    }

    .footer-actions button {
        width: 100%;
    }
}
</style>