<template>
  <div class="csv-info-card">
    <div class="info-header">
      <i class="pi pi-info-circle info-icon"></i>
      <h3 class="info-title">{{ title }}</h3>
    </div>
    
    <div class="info-content">
      <p class="info-description">{{ description }}</p>
      
      <div v-if="showFormat" class="format-details">
        <h4 class="format-title">
          <i class="pi pi-list"></i>
          Format CSV yang diperlukan:
        </h4>
        <div class="format-grid">
          <div 
            v-for="(field, index) in fields" 
            :key="index"
            class="format-item"
          >
            <div class="field-header">
              <span class="field-name">{{ field.name }}</span>
              <span v-if="field.required" class="field-required">*</span>
            </div>
            <div class="field-description">{{ field.description }}</div>
            <div v-if="field.example" class="field-example">
              <small>Contoh: {{ field.example }}</small>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="showNotes && notes.length > 0" class="format-notes">
        <h4 class="notes-title">
          <i class="pi pi-exclamation-triangle"></i>
          Catatan Penting:
        </h4>
        <ul class="notes-list">
          <li v-for="(note, index) in notes" :key="index" class="note-item">
            {{ note }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
// Props
const props = defineProps({
  title: {
    type: String,
    default: 'Informasi Format CSV'
  },
  description: {
    type: String,
    default: 'Pastikan file CSV Anda mengikuti format yang benar untuk memastikan proses import berjalan lancar.'
  },
  fields: {
    type: Array,
    default: () => []
  },
  notes: {
    type: Array,
    default: () => []
  },
  showFormat: {
    type: Boolean,
    default: true
  },
  showNotes: {
    type: Boolean,
    default: true
  }
});
</script>

<style scoped src="./CsvInfoCard.style.css"></style>