<template>
  <Dialog
    v-model:visible="model"
    :header="title || 'Preview Gambar'"
    modal
    dismissableMask
    :style="{ width: '75vw', maxHeight: '75vh' }"
    :contentStyle="{ padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', overflow: 'hidden' }"
    class="image-preview-dialog"
  >
    <div class="img-wrapper">
      <img v-if="src" :src="src" alt="Preview" class="preview-img" />
      <div v-else class="no-image">
        <i class="pi pi-image" style="font-size:3rem; color:#666" />
        <span>Gambar tidak tersedia</span>
      </div>
    </div>
    <template #footer>
      <Button label="Tutup" icon="pi pi-times" class="p-button-text" @click="model = false" />
      <a v-if="src" :href="src" target="_blank" rel="noopener">
        <Button label="Buka di Tab Baru" icon="pi pi-external-link" class="p-button-outlined p-button-sm" />
      </a>
    </template>
  </Dialog>
</template>

<script setup>
import { computed } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';

const props = defineProps({
  visible: { type: Boolean, default: false },
  src:     { type: String,  default: '' },
  title:   { type: String,  default: '' },
});

const emit = defineEmits(['update:visible']);

const model = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
});
</script>

<style scoped>
.img-wrapper {
  width: 100%;
  height: calc(75vh - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111;
}

.preview-img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
}

.no-image {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: #888;
}
</style>
