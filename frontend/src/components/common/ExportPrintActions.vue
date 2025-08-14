<template>
  <div class="export-print-actions">
    <button 
      v-if="showExport" 
      class="btn btn-secondary btn-sm" 
      @click="$emit('export')" 
      title="Ekspor ke Excel"
      :disabled="disabled"
    >
      <i class="pi pi-file-excel"></i> {{ exportLabel }}
    </button>
    <button 
      v-if="showPrint" 
      class="btn btn-secondary btn-sm" 
      @click="$emit('print')" 
      title="Cetak hasil"
      :disabled="disabled"
    >
      <i class="pi pi-print"></i> {{ printLabel }}
    </button>
    <slot></slot>
  </div>
</template>

<script setup>
const props = defineProps({
  showExport: {
    type: Boolean,
    default: true
  },
  showPrint: {
    type: Boolean,
    default: true
  },
  exportLabel: {
    type: String,
    default: 'Ekspor Data'
  },
  printLabel: {
    type: String,
    default: 'Cetak'
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['export', 'print']);
</script>

<style scoped>
.export-print-actions {
  display: flex;
  gap: 0.5rem;
}

@media (max-width: 576px) {
  .export-print-actions {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}
</style>