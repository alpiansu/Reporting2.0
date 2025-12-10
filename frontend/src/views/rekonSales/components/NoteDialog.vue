<template>
  <Dialog v-model:visible="visible" header="Catatan" :modal="true" :style="{ width: '600px' }">
    <div class="note-form">
      <div class="meta">
        <div><strong>{{ store?.KDTK }}</strong> - {{ store?.NAMA }}</div>
        <div class="badge" :style="{ background: selectedCategory?.color }">{{ selectedCategory?.name }}</div>
      </div>
      <Textarea v-model="noteText" rows="6" class="w-full" placeholder="Tulis catatan..." />
      <div class="controls">
        <Dropdown v-model="category" :options="categoryOptions" optionLabel="name" optionValue="name" placeholder="Kategori" />
        <span class="last-update" v-if="lastUpdate">Terakhir diupdate: {{ lastUpdate }}</span>
      </div>
    </div>
    <template #footer>
      <div class="footer">
        <Button icon="pi pi-save" label="Simpan" class="p-button-primary" @click="onSave" />
        <Button icon="pi pi-times" label="Batal" class="p-button-text" @click="onCancel" />
      </div>
    </template>
  </Dialog>
  </template>

<script setup>
import { computed, ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import Textarea from 'primevue/textarea';
import { NOTE_CATEGORIES } from '../utils/constants';

const props = defineProps({
  visible: { type: Boolean, default: false },
  store: { type: Object, default: () => ({}) },
  defaultText: { type: String, default: '' },
  defaultCategory: { type: String, default: 'human-input' },
  lastUpdate: { type: String, default: '' }
});

const emit = defineEmits(['update:visible', 'save']);

const visible = ref(props.visible);
const noteText = ref(props.defaultText);
const category = ref(props.defaultCategory);

const categoryOptions = Object.values(NOTE_CATEGORIES).map(c => ({ name: c.name, color: c.color }));
const selectedCategory = computed(() => categoryOptions.find(c => c.name === category.value));

watch(() => props.visible, (v) => { visible.value = v; });
watch(visible, (v) => emit('update:visible', v));
watch(() => props.defaultText, (v) => { noteText.value = v ?? ''; }, { immediate: true });
watch(() => props.defaultCategory, (v) => { category.value = v ?? 'human-input'; }, { immediate: true });

const onSave = () => emit('save', { text: noteText.value, category: category.value });
const onCancel = () => { visible.value = false; };
</script>

<style scoped>
.note-form { display: flex; flex-direction: column; gap: .75rem; }
.meta { display: flex; justify-content: space-between; align-items: center; }
.badge { color: #fff; padding: .25rem .5rem; border-radius: 6px; font-size: .75rem; }
.controls { display: flex; justify-content: space-between; align-items: center; }
.last-update { color: #6b7280; font-size: .75rem; }
.footer { display: flex; justify-content: flex-end; gap: .5rem; }
</style>
