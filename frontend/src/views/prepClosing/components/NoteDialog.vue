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
                    class="p-button-danger p-button-outlined p-button-sm" :disabled="saving" @click="handleClear" />
                <div class="footer-right">
                    <Button label="Batal" icon="pi pi-times" class="p-button-text p-button-secondary" @click="handleCancel" />
                    <Button label="Simpan" icon="pi pi-save" class="p-button-primary"
                        :disabled="!canSave || saving" :loading="saving" @click="handleSave" />
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
    periode: String,
    saving: { type: Boolean, default: false }
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

<style scoped src="./NoteDialog.style.css"></style>
