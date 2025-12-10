<template>
  <Dialog v-model:visible="localVisible" header="Konfirmasi Screening" :modal="true" :style="{ width: '500px' }">
    <p>Mulai screening untuk cabang <strong>{{ cabang }}</strong> periode <strong>{{ periode }}</strong>?</p>
    <template #footer>
      <div class="footer">
        <Button icon="pi pi-check" label="Mulai" class="p-button-primary" @click="$emit('confirm')" />
        <Button icon="pi pi-times" label="Batal" class="p-button-text" @click="$emit('cancel')" />
      </div>
    </template>
  </Dialog>
  </template>

<script setup>
import { ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';

const props = defineProps({
  visible: { type: Boolean, default: false },
  cabang: { type: String, default: 'All' },
  periode: { type: String, default: '' }
});
const emit = defineEmits(['confirm', 'cancel', 'update:visible']);

const localVisible = ref(props.visible);
watch(() => props.visible, (v) => { localVisible.value = v; });
watch(localVisible, (v) => emit('update:visible', v));
</script>

<style scoped>
.footer { display: flex; justify-content: flex-end; gap: .5rem; }
</style>
