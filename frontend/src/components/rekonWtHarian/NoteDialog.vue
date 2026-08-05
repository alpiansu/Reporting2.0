<template>
  <Dialog v-model:visible="visible" :header="dialogHeader" :modal="true" :style="{ width: '600px' }">
    <div class="note-form">
      <div class="meta">
        <div><strong>{{ store?.shop || store?.toko }}</strong> - {{ store?.store_name || store?.namaToko || 'Tidak dikenal' }}</div>
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
import { ref, computed, watch } from 'vue';
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
const noteText = ref('');

const dialogHeader = computed(() => {
  if (!props.visible) return 'Catatan';
  const kode = props.store?.shop || props.store?.toko || '';
  const nama = props.store?.store_name || props.store?.namaToko || '';
  return kode ? `Catatan - ${kode}${nama ? ` (${nama})` : ''}` : 'Catatan';
});

watch(() => props.visible, (v) => { 
  visible.value = v; 
  if (v) {
    noteText.value = props.defaultText ?? '';
  }
});
watch(visible, (v) => emit('update:visible', v));
watch(() => props.defaultText, (v) => { noteText.value = v ?? ''; });

const onSave = () => emit('save', { text: noteText.value });
const onDelete = () => emit('delete');
const onCancel = () => { visible.value = false; };
</script>

<style scoped src="./NoteDialog.style.css"></style>
