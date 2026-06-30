<template>
  <Dialog v-model:visible="visible" header="Catatan" :modal="true" :style="{ width: '600px' }">
    <div class="note-form">
      <div class="meta">
        <div><strong>{{ store?.KDTK }}</strong> - {{ store?.NAMA }}</div>
      </div>
      <Textarea v-model="noteText" rows="6" class="w-full" placeholder="Tulis catatan..." />
      <div class="controls">
        <span class="last-update" v-if="store?.note?.pic || store?.note?.fullName">PIC: {{ store?.note?.fullName || store?.note?.pic }}</span>
        <span class="last-update" v-if="lastUpdate">Terakhir diupdate: {{ lastUpdate }}</span>
      </div>
    </div>
    <template #footer>
      <div class="footer">
        <Button icon="pi pi-trash" label="Hapus" severity="danger" outlined :disabled="saving" @click="onDelete" />
        <Button icon="pi pi-save" label="Simpan" class="p-button-primary" :disabled="saving" :loading="saving" @click="onSave" />
        <Button icon="pi pi-times" label="Batal" class="p-button-text" @click="onCancel" />
      </div>
    </template>
  </Dialog>
  </template>

<script setup>
import { ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';

const props = defineProps({
  visible: { type: Boolean, default: false },
  store: { type: Object, default: () => ({}) },
  defaultText: { type: String, default: '' },
  lastUpdate: { type: String, default: '' },
  saving: { type: Boolean, default: false }
});

const emit = defineEmits(['update:visible', 'save', 'delete']);

const visible = ref(props.visible);
const noteText = ref(props.defaultText);

watch(() => props.visible, (v) => { visible.value = v; });
watch(visible, (v) => emit('update:visible', v));
watch(() => props.defaultText, (v) => { noteText.value = v ?? ''; }, { immediate: true });

const onSave = () => emit('save', { text: noteText.value });
const onDelete = () => emit('delete');
const onCancel = () => { visible.value = false; };
</script>

<style scoped>
.note-form { display: flex; flex-direction: column; gap: .75rem; }
.meta { display: flex; justify-content: space-between; align-items: center; color: var(--text-color); }
.badge { color: #fff; padding: .25rem .5rem; border-radius: 6px; font-size: .75rem; }
.controls { display: flex; justify-content: space-between; align-items: center; }
.last-update { color: var(--text-color-secondary); font-size: .75rem; }
.footer { display: flex; justify-content: flex-end; gap: .5rem; }
</style>
