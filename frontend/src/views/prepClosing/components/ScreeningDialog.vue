<template>
    <Dialog v-model:visible="localVisible" header="Mulai Proses Screening" :modal="true" :closable="true"
        :dismissableMask="false" :style="{ width: '600px' }">
        <div class="screening-dialog-content">
            <!-- Level Selection -->
            <div class="level-selection">
                <h4>Pilih Level Screening</h4>
                <div class="level-options">
                    <div v-for="option in screeningOptions" :key="option.value" class="level-option"
                        :class="{ active: selectedLevel === option.value }" @click="selectedLevel = option.value">
                        <div class="option-icon" :style="{ backgroundColor: option.color }">
                            <i :class="option.icon"></i>
                        </div>
                        <div class="option-info">
                            <div class="option-title">{{ option.title }}</div>
                            <div class="option-description">{{ option.description }}</div>
                        </div>
                        <i class="pi pi-check-circle check-icon"></i>
                    </div>
                </div>
            </div>

            <!-- Info Section -->
            <div class="info-section">
                <Message severity="info" :closable="false">
                    <template #default>
                        <div class="info-content">
                            <i class="pi pi-info-circle"></i>
                            <div>
                                <strong>Informasi Screening</strong>
                                <ul>
                                    <li v-for="info in currentLevelInfo" :key="info">{{ info }}</li>
                                </ul>
                            </div>
                        </div>
                    </template>
                </Message>
            </div>

            <!-- Confirmation Checklist -->
            <div class="checklist-section">
                <h4>Konfirmasi</h4>
                <div class="checklist-items">
                    <div class="checklist-item">
                        <Checkbox v-model="confirmations.dataReady" :binary="true" inputId="confirm1" />
                        <label for="confirm1">Data toko sudah ready untuk di-screening</label>
                    </div>
                    <div class="checklist-item">
                        <Checkbox v-model="confirmations.understood" :binary="true" inputId="confirm2" />
                        <label for="confirm2">Saya memahami proses screening akan memakan waktu</label>
                    </div>
                    <div class="checklist-item">
                        <Checkbox v-model="confirmations.noInterrupt" :binary="true" inputId="confirm3" />
                        <label for="confirm3">Tidak akan menutup browser selama proses screening</label>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="footer-actions">
                <Button label="Batal" icon="pi pi-times" class="p-button-outlined" @click="handleCancel" />
                <Button label="Mulai Screening" icon="pi pi-play" class="p-button-primary" :disabled="!canStart"
                    @click="handleStart" />
            </div>
        </template>
    </Dialog>
</template>

<script setup>
import { ref, computed, watch, reactive } from 'vue';
import Dialog from 'primevue/dialog';
import Checkbox from 'primevue/checkbox';
import Message from 'primevue/message';

const props = defineProps({
    visible: Boolean,
    periode: String,
    cabang: String,
    level: {
        type: String,
        default: 'all'
    }
});

const emit = defineEmits(['update:visible', 'start']);

const localVisible = ref(props.visible);
const selectedLevel = ref(props.level || 'all');
const selectedStore = ref('');

const confirmations = reactive({
    dataReady: false,
    understood: false,
    noInterrupt: false
});

watch(() => props.visible, (newVal) => {
    localVisible.value = newVal;
    if (newVal) {
        // Reset on open
        confirmations.dataReady = false;
        confirmations.understood = false;
        confirmations.noInterrupt = false;
        selectedStore.value = '';
    }
});

watch(localVisible, (newVal) => {
    emit('update:visible', newVal);
});

const screeningOptions = [
    {
        value: 'all',
        title: 'Semua Cabang',
        description: 'Screening seluruh toko di semua cabang',
        icon: 'pi pi-globe',
        color: '#3b82f6',
        info: [
            'Memproses semua toko aktif',
            'Estimasi waktu: 60-120 menit',
            'Progress dapat dipantau secara real-time'
        ]
    },
    {
        value: 'cabang',
        title: 'Per Cabang',
        description: 'Screening toko di cabang yang dipilih',
        icon: 'pi pi-building',
        color: '#10b981',
        info: [
            `Memproses toko di cabang ${props.cabang}`,
            'Estimasi waktu: 10-30 menit',
            'Lebih cepat dari screening semua cabang'
        ]
    },
];

const currentLevelInfo = computed(() => {
    const option = screeningOptions.find(o => o.value === selectedLevel.value);
    return option?.info || [];
});

const canStart = computed(() => {
    const allConfirmed = confirmations.dataReady &&
        confirmations.understood &&
        confirmations.noInterrupt;

    if (selectedLevel.value === 'store') {
        return allConfirmed && selectedStore.value.trim().length > 0;
    }

    return allConfirmed;
});

const handleCancel = () => {
    localVisible.value = false;
};

const handleStart = () => {
    const data = { level: selectedLevel.value };

    emit('start', data);
    localVisible.value = false;
};
</script>

<style scoped>
.screening-dialog-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.level-selection h4,
.checklist-section h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
}

.level-options {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.level-option {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.level-option:hover {
    border-color: #3b82f6;
    background: #f9fafb;
}

.level-option.active {
    border-color: #3b82f6;
    background: #eff6ff;
}

.option-icon {
    width: 50px;
    height: 50px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.5rem;
}

.option-info {
    flex: 1;
}

.option-title {
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.25rem;
}

.option-description {
    font-size: 0.875rem;
    color: #6b7280;
}

.check-icon {
    font-size: 1.5rem;
    color: #3b82f6;
    opacity: 0;
    transition: opacity 0.2s ease;
}

.level-option.active .check-icon {
    opacity: 1;
}

.store-selection {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.store-selection label {
    font-weight: 500;
    color: #374151;
}

.info-section :deep(.p-message) {
    border-radius: 8px;
}

.info-content {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
}

.info-content i {
    font-size: 1.5rem;
    margin-top: 0.25rem;
}

.info-content ul {
    margin: 0.5rem 0 0 0;
    padding-left: 1.25rem;
}

.info-content li {
    margin-bottom: 0.25rem;
    color: #1e40af;
}

.checklist-items {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.checklist-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #f9fafb;
    border-radius: 6px;
}

.checklist-item label {
    flex: 1;
    color: #374151;
    cursor: pointer;
}

.footer-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
}

@media (max-width: 768px) {
    .footer-actions {
        flex-direction: column;
    }

    .footer-actions button {
        width: 100%;
    }
}
</style>