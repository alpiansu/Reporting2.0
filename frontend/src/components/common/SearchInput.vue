<template>
  <div class="search-input-container">
    <div class="search-input-wrapper">
      <i class="pi pi-search search-icon"></i>
      <input
        type="text"
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        :placeholder="placeholder"
        class="search-control"
        :disabled="disabled"
        @keyup.enter="$emit('search')"
      />
      <button 
        v-if="modelValue && !disabled" 
        @click="clearSearch" 
        class="search-clear-btn" 
        title="Hapus pencarian"
      >
        <i class="pi pi-times"></i>
      </button>
    </div>
    <button 
      v-if="showSearchButton" 
      @click="$emit('search')" 
      class="btn btn-primary search-button" 
      :disabled="disabled"
    >
      <i class="pi pi-search"></i>
      {{ buttonText }}
    </button>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: 'Cari...'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  showSearchButton: {
    type: Boolean,
    default: true
  },
  buttonText: {
    type: String,
    default: 'Cari'
  }
});

const emit = defineEmits(['update:modelValue', 'search', 'clear']);

const clearSearch = () => {
  emit('update:modelValue', '');
  emit('clear');
};
</script>

<style scoped src="./SearchInput.style.css"></style>