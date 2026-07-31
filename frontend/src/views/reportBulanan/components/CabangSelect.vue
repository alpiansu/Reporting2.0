<template>
  <div class="field">
    <label for="cabang-select" class="field-label">
      Cabang <span class="text-red-500">*</span>
    </label>
    <Dropdown
      id="cabang-select"
      :model-value="modelValue"
      :options="options"
      optionLabel="namacab"
      optionValue="kdcab"
      placeholder="Pilih Cabang"
      class="w-full"
      :disabled="disabled"
      filter
      filter-placeholder="Cari cabang..."
      @update:model-value="$emit('update:modelValue', $event)"
    />
    <small v-if="showError && !modelValue" class="p-error">Cabang wajib dipilih</small>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  showError: { type: Boolean, default: false },
});

defineEmits(['update:modelValue']);
</script>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
  min-width: 200px;
}

.field-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-color, #212529);
}

:deep(.p-dropdown) {
  width: 100%;
}
</style>
