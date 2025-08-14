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

<style scoped>
.search-input-container {
  display: flex;
  gap: 0.5rem;
  width: 100%;
}

.search-input-wrapper {
  position: relative;
  flex: 1;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #666;
}

.search-control {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-size: 0.875rem;
  transition: all 0.3s ease;
}

.search-control:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.1);
}

.search-control:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.search-clear-btn {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
}

.search-clear-btn:hover {
  background-color: #f0f0f0;
  color: #333;
}

.search-button {
  white-space: nowrap;
}

@media (max-width: 576px) {
  .search-input-container {
    flex-direction: column;
  }
  
  .search-button {
    width: 100%;
  }
}
</style>