<template>
    <Dialog v-model:visible="localVisible" :modal="true" :closable="true" :dismissableMask="true"
        :style="{ width: '560px' }" :breakpoints="{ '640px': '95vw' }" class="note-dialog" :draggable="false">

        <template #header>
            <div class="note-header">
                <div class="note-header-icon">
                    <i class="pi pi-comment"></i>
                </div>
                <div class="note-header-text">
                    <h3 class="note-title">{{ store?.note ? 'Edit Catatan' : 'Tambah Catatan' }}</h3>
                    <span class="note-subtitle">{{ store?.KDTK }} - {{ store?.NAMA }}</span>
                </div>
            </div>
        </template>

        <div class="note-dialog-content">
            <!-- Store Info Chips -->
            <div class="store-chips">
                <div class="chip">
                    <i class="pi pi-shop"></i>
                    <span>{{ store?.KDTK }}</span>
                </div>
                <div class="chip">
                    <i class="pi pi-building"></i>
                    <span>{{ store?.NAMA }}</span>
                </div>
                <div class="chip">
                    <i class="pi pi-calendar"></i>
                    <span>{{ formatPeriode(periode) }}</span>
                </div>
            </div>

            <!-- Previous Note -->
            <div v-if="store?.note" class="prev-note-card">
                <div class="prev-note-header">
                    <i class="pi pi-history"></i>
                    <span>Catatan Sebelumnya</span>
                </div>
                <div class="prev-note-body">
                    <p class="prev-note-text">{{ store.note.noteText }}</p>
                    <div class="prev-note-meta">
                        <span><i class="pi pi-user"></i> {{ store.note.fullName || store.note.pic }}</span>
                        <span><i class="pi pi-clock"></i> {{ formatDateTime(store.note.updated_at) }}</span>
                    </div>
                </div>
            </div>

            <!-- Note Editor -->
            <div class="note-editor-section">
                <label for="noteText" class="editor-label">
                    {{ store?.note ? 'Perbarui Catatan' : 'Catatan Baru' }}
                </label>
                <Textarea id="noteText" v-model="noteText" rows="5" placeholder="Tulis catatan untuk toko ini..."
                    :maxlength="maxLength" class="w-full note-textarea" autoResize />
                <div class="char-counter">
                    <span :class="{ 'counter-danger': isOverLimit, 'counter-warn': isNearLimit && !isOverLimit }">
                        {{ noteText.length }}
                    </span>
                    <span class="counter-sep">/ {{ maxLength }}</span>
                </div>
            </div>

            <!-- Help -->
            <div class="help-tip">
                <i class="pi pi-info-circle"></i>
                <span>Catatan membantu tim memahami kondisi toko ini sebelum closing.</span>
            </div>
        </div>

        <template #footer>
            <div class="footer-actions">
                <Button v-if="store?.note" label="Hapus" icon="pi pi-trash"
                    class="p-button-danger p-button-outlined p-button-sm" @click="handleClear" />
                <div class="footer-right">
                    <Button label="Batal" icon="pi pi-times" class="p-button-text p-button-secondary" @click="handleCancel" />
                    <Button label="Simpan" icon="pi pi-save" class="p-button-primary" :disabled="!canSave"
                        @click="handleSave" />
                </div>
            </div>
        </template>
    </Dialog>

    <!-- Confirmation Dialog -->
    <ConfirmDialog v-model="showConfirm" title="Hapus Catatan" message="Apakah Anda yakin ingin menghapus catatan ini?"
        confirm-text="Hapus" @confirm="handleConfirmDelete" />
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
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
const showConfirm = ref(false);

watch(() => props.visible, (newVal) => {
    localVisible.value = newVal;
    if (newVal && props.store) {
        noteText.value = props.store.note?.noteText || '';
    }
});

watch(localVisible, (newVal) => {
    emit('update:visible', newVal);
    if (!newVal) {
        noteText.value = '';
    }
});

const isOverLimit = computed(() => noteText.value.length > maxLength);
const isNearLimit = computed(() => noteText.value.length > maxLength * 0.85);

const canSave = computed(() => {
    return noteText.value.trim().length > 0 && !isOverLimit.value;
});

const handleSave = () => {
    if (canSave.value) {
        emit('save', noteText.value.trim());
    }
};

const handleClear = () => {
    showConfirm.value = true;
};

const handleConfirmDelete = () => {
    emit('save', '');
    showConfirm.value = false;
};

const handleCancel = () => {
    localVisible.value = false;
};
</script>

<style scoped>
/* === Header === */
.note-header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
}

.note-header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 0.625rem;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: #fff;
    flex-shrink: 0;
}

.note-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #1e293b;
}

.note-subtitle {
    font-size: 0.8rem;
    color: #64748b;
}

/* === Content === */
.note-dialog-content {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

/* === Store Info Chips === */
.store-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 2rem;
    font-size: 0.78rem;
    font-weight: 500;
    color: #475569;
}

.chip i {
    font-size: 0.75rem;
    color: #3b82f6;
}

/* === Previous Note Card === */
.prev-note-card {
    border: 1px solid #fde68a;
    border-radius: 0.625rem;
    overflow: hidden;
}

.prev-note-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    background: #fffbeb;
    font-weight: 600;
    font-size: 0.82rem;
    color: #92400e;
    border-bottom: 1px solid #fde68a;
}

.prev-note-header i {
    color: #f59e0b;
    font-size: 0.9rem;
}

.prev-note-body {
    padding: 0.75rem 0.875rem;
    background: #fffdf7;
}

.prev-note-text {
    margin: 0 0 0.5rem 0;
    color: #78350f;
    line-height: 1.55;
    font-size: 0.85rem;
}

.prev-note-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.72rem;
    color: #92400e;
}

.prev-note-meta span {
    display: flex;
    align-items: center;
    gap: 0.375rem;
}

/* === Note Editor Section === */
.note-editor-section {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.editor-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: #475569;
}

.note-textarea {
    border-radius: 0.5rem !important;
    font-size: 0.88rem !important;
    line-height: 1.6 !important;
}

.char-counter {
    text-align: right;
    font-size: 0.78rem;
    color: #94a3b8;
    margin-top: 0.125rem;
}

.counter-danger {
    color: #ef4444;
    font-weight: 700;
}

.counter-warn {
    color: #f59e0b;
    font-weight: 600;
}

.counter-sep {
    color: #cbd5e1;
}

/* === Help Tip === */
.help-tip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 0.5rem;
    font-size: 0.78rem;
    color: #0369a1;
}

.help-tip i {
    flex-shrink: 0;
    font-size: 0.85rem;
}

/* === Footer === */
.footer-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}

.footer-right {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
}

@media (max-width: 768px) {
    .store-chips {
        flex-direction: column;
    }

    .footer-actions {
        flex-direction: column;
        gap: 0.5rem;
    }

    .footer-right {
        width: 100%;
        justify-content: flex-end;
    }

    .footer-actions button {
        width: auto;
    }
}
</style>
