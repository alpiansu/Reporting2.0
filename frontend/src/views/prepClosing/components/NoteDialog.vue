<template>
    <Dialog v-model:visible="localVisible" :header="dialogTitle" :modal="true" :closable="true" :dismissableMask="true"
        :style="{ width: '600px' }">
        <div class="note-dialog-content">
            <!-- Store Info -->
            <div class="store-info">
                <div class="info-item">
                    <i class="pi pi-shop"></i>
                    <div>
                        <div class="info-label">Kode Toko</div>
                        <div class="info-value">{{ store?.KDTK }}</div>
                    </div>
                </div>
                <div class="info-item">
                    <i class="pi pi-building"></i>
                    <div>
                        <div class="info-label">Nama Toko</div>
                        <div class="info-value">{{ store?.NAMA }}</div>
                    </div>
                </div>
                <div class="info-item">
                    <i class="pi pi-calendar"></i>
                    <div>
                        <div class="info-label">Periode</div>
                        <div class="info-value">{{ formatPeriode(periode) }}</div>
                    </div>
                </div>
            </div>

            <!-- Previous Note Info -->
            <div v-if="store?.note" class="previous-note">
                <div class="previous-note-header">
                    <i class="pi pi-history"></i>
                    <span>Catatan Sebelumnya</span>
                </div>
                <div class="previous-note-content">
                    <p>{{ store.note.noteText }}</p>
                    <div class="note-meta">
                        <span><i class="pi pi-user"></i> {{ store.note.fullName || store.note.pic }}</span>
                        <span><i class="pi pi-clock"></i> {{ formatDateTime(store.note.updated_at) }}</span>
                    </div>
                </div>
            </div>

            <!-- Note Editor -->
            <div class="note-editor">
                <label for="noteText">Catatan Baru</label>
                <Textarea id="noteText" v-model="noteText" rows="6" placeholder="Masukkan catatan untuk toko ini..."
                    :maxlength="maxLength" class="w-full" />
                <div class="character-counter">
                    <span :class="{ 'text-danger': isOverLimit }">
                        {{ noteText.length }} / {{ maxLength }} karakter
                    </span>
                </div>
            </div>

            <!-- Help Text -->
            <Message severity="info" :closable="false">
                <i class="pi pi-info-circle"></i>
                <span>Catatan akan membantu tim lain memahami kondisi toko ini</span>
            </Message>
        </div>

        <template #footer>
            <div class="footer-actions">
                <Button label="Batal" icon="pi pi-times" class="p-button-outlined" @click="handleCancel" />
                <Button v-if="noteText.trim()" label="Hapus" icon="pi pi-trash"
                    class="p-button-danger p-button-outlined" @click="handleClear" />
                <Button label="Simpan" icon="pi pi-save" class="p-button-primary" :disabled="!canSave"
                    @click="handleSave" />
            </div>
        </template>
    </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';
import Message from 'primevue/message';
import { formatDateTime, formatPeriode } from '../utils/formatters';

const props = defineProps({
    visible: Boolean,
    store: Object,
    periode: String
});

const emit = defineEmits(['update:visible', 'save']);

const localVisible = ref(props.visible);
const noteText = ref('');
const maxLength = 500;

watch(() => props.visible, (newVal) => {
    localVisible.value = newVal;
    if (newVal && props.store) {
        // Load existing note if available
        noteText.value = props.store.note?.noteText || '';
    }
});

watch(localVisible, (newVal) => {
    emit('update:visible', newVal);
    if (!newVal) {
        // Reset on close
        noteText.value = '';
    }
});

const dialogTitle = computed(() => {
    if (!props.store) return 'Tambah Catatan';
    return `Catatan untuk ${props.store.KDTK} - ${props.store.NAMA}`;
});

const isOverLimit = computed(() => {
    return noteText.value.length > maxLength;
});

const canSave = computed(() => {
    return noteText.value.trim().length > 0 && !isOverLimit.value;
});

const handleSave = () => {
    if (canSave.value) {
        emit('save', noteText.value.trim());
    }
};

const handleClear = () => {
    noteText.value = '';
};

const handleCancel = () => {
    localVisible.value = false;
};
</script>

<style scoped>
.note-dialog-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.store-info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 8px;
}

.info-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.info-item i {
    font-size: 1.5rem;
    color: #3b82f6;
}

.info-label {
    font-size: 0.75rem;
    color: #6b7280;
    margin-bottom: 0.25rem;
}

.info-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
}

.previous-note {
    padding: 1rem;
    background: #fffbeb;
    border-left: 4px solid #f59e0b;
    border-radius: 8px;
}

.previous-note-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: #92400e;
    margin-bottom: 0.75rem;
}

.previous-note-header i {
    color: #f59e0b;
}

.previous-note-content p {
    margin: 0 0 0.75rem 0;
    color: #78350f;
    line-height: 1.6;
}

.note-meta {
    display: flex;
    gap: 1.5rem;
    font-size: 0.75rem;
    color: #92400e;
}

.note-meta span {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.note-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.note-editor label {
    font-weight: 500;
    color: #374151;
}

.character-counter {
    text-align: right;
    font-size: 0.875rem;
    color: #6b7280;
}

.character-counter .text-danger {
    color: #ef4444;
    font-weight: 600;
}

.footer-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
}

@media (max-width: 768px) {
    .store-info {
        grid-template-columns: 1fr;
    }

    .note-meta {
        flex-direction: column;
        gap: 0.5rem;
    }

    .footer-actions {
        flex-direction: column;
    }

    .footer-actions button {
        width: 100%;
    }
}
</style>