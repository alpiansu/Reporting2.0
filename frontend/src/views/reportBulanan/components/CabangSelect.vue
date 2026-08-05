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

<style scoped src="./CabangSelect.style.css"></style>
