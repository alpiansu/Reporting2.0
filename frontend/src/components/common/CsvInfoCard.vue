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

<style scoped>
.csv-info-card {
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  border: 1px solid #cbd5e0;
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.info-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.info-icon {
  color: var(--primary-color, #0ea5e9);
  font-size: 1.5rem;
}

.info-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.info-description {
  color: #475569;
  line-height: 1.6;
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
}

.format-details {
  background-color: #fff;
  border-radius: 0.5rem;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  border-left: 4px solid var(--primary-color, #0ea5e9);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.format-title {
  font-size: 1rem;
  font-weight: 600;
  color: #334155;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.format-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.format-item {
  background-color: #f8fafc;
  border-radius: 0.375rem;
  padding: 0.875rem;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
}

.format-item:hover {
  border-color: var(--primary-color, #0ea5e9);
  box-shadow: 0 2px 4px rgba(14, 165, 233, 0.1);
}

.field-header {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.field-name {
  font-weight: 600;
  color: #1e293b;
  font-family: 'Courier New', monospace;
  background-color: #e2e8f0;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.field-required {
  color: #ef4444;
  font-weight: 700;
  font-size: 1rem;
}

.field-description {
  color: #64748b;
  font-size: 0.875rem;
  line-height: 1.4;
  margin-bottom: 0.375rem;
}

.field-example {
  color: #059669;
  font-style: italic;
}

.format-notes {
  background-color: #fefce8;
  border: 1px solid #fbbf24;
  border-radius: 0.5rem;
  padding: 1rem;
}

.notes-title {
  font-size: 1rem;
  font-weight: 600;
  color: #92400e;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.notes-list {
  margin: 0;
  padding-left: 1.25rem;
  color: #a16207;
}

.note-item {
  margin-bottom: 0.5rem;
  line-height: 1.5;
  font-size: 0.875rem;
}

.note-item:last-child {
  margin-bottom: 0;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .format-grid {
    grid-template-columns: 1fr;
  }
  
  .csv-info-card {
    padding: 1rem;
  }
  
  .format-details {
    padding: 1rem;
  }
}
</style>