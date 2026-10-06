<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal dept-form-modal">
      <!-- Modern Dialog Header -->
      <div class="dialog-header-modern" :class="{ 'edit-mode': isEditing }">
        <div class="dialog-header-left">
          <div class="dialog-icon-badge" :class="isEditing ? 'edit' : 'add'">
            <i :class="isEditing ? 'pi pi-pencil' : 'pi pi-plus'"></i>
          </div>
          <div>
            <h3 class="dialog-title">
              {{ isEditing ? 'Edit Department' : 'Create New Department' }}
            </h3>
            <span class="dialog-subtitle" v-if="!isEditing">
              Tambahkan data departemen baru ke dalam master data
            </span>
            <span class="dialog-subtitle-badge" v-else>
              Kode: #{{ localForm.dep_kd }} &bull; {{ localForm.dep_nm }}
            </span>
          </div>
        </div>
        <button type="button" class="dialog-close-btn" @click="$emit('close')" title="Tutup modal">
          <i class="pi pi-times"></i>
        </button>
      </div>

      <!-- Modern Dialog Body -->
      <div class="dialog-body-modern">
        <form @submit.prevent="submit" class="dept-form-redesign">
          <!-- Section 1: Identitas Departemen -->
          <div class="form-section-card">
            <div class="section-card-title">
              <i class="pi pi-id-card"></i>
              <span>Identitas Departemen</span>
            </div>

            <div class="form-grid-inner">
              <!-- Dept Code -->
              <div class="form-group-redesign">
                <label for="dep_kd" class="form-label-redesign">
                  Department Code <span class="required-star">*</span>
                </label>
                <div class="input-with-icon">
                  <i class="pi pi-key input-icon"></i>
                  <input 
                    type="text" 
                    id="dep_kd" 
                    v-model="localForm.dep_kd" 
                    placeholder="Contoh: 01, DP01..."
                    class="form-input-redesign"
                    :class="{ 'invalid': errors.dep_kd, 'is-disabled': isEditing }"
                    :disabled="isEditing"
                    required
                  />
                </div>
                <span class="field-hint" v-if="isEditing">Kode departemen tidak dapat diubah</span>
                <div v-if="errors.dep_kd" class="error-text">{{ errors.dep_kd }}</div>
              </div>

              <!-- Dept Name -->
              <div class="form-group-redesign">
                <label for="dep_nm" class="form-label-redesign">
                  Department Name <span class="required-star">*</span>
                </label>
                <div class="input-with-icon">
                  <i class="pi pi-building input-icon"></i>
                  <input 
                    type="text" 
                    id="dep_nm" 
                    v-model="localForm.dep_nm" 
                    placeholder="Contoh: MERCHANDISING..."
                    class="form-input-redesign"
                    :class="{ 'invalid': errors.dep_nm }"
                    required
                  />
                </div>
                <div v-if="errors.dep_nm" class="error-text">{{ errors.dep_nm }}</div>
              </div>
            </div>
          </div>

          <!-- Section 2: Struktur Organisasi -->
          <div class="form-section-card">
            <div class="section-card-title">
              <i class="pi pi-sitemap"></i>
              <span>Struktur Organisasi</span>
            </div>

            <div class="form-grid-inner">
              <!-- Div Code -->
              <div class="form-group-redesign">
                <label for="div_kd" class="form-label-redesign">
                  Division Code
                </label>
                <div class="input-with-icon">
                  <i class="pi pi-folder input-icon"></i>
                  <input 
                    type="text" 
                    id="div_kd" 
                    v-model="localForm.div_kd" 
                    placeholder="Contoh: DIV01, DRY..."
                    class="form-input-redesign"
                    :class="{ 'invalid': errors.div_kd }"
                  />
                </div>
              </div>

              <!-- Manager -->
              <div class="form-group-redesign">
                <label for="dep_mgr" class="form-label-redesign">
                  Manager
                </label>
                <div class="input-with-icon">
                  <i class="pi pi-user input-icon"></i>
                  <input 
                    type="text" 
                    id="dep_mgr" 
                    v-model="localForm.dep_mgr" 
                    placeholder="Nama kepala departemen..."
                    class="form-input-redesign"
                    :class="{ 'invalid': errors.dep_mgr }"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Form Actions -->
          <div class="form-actions-redesign">
            <button 
              type="button" 
              class="btn-form-cancel" 
              @click="$emit('close')" 
              :disabled="saving"
            >
              <i class="pi pi-times"></i>
              <span>Batal</span>
            </button>
            <button 
              type="submit" 
              class="btn-form-submit" 
              :disabled="saving"
            >
              <i v-if="saving" class="pi pi-spin pi-spinner"></i>
              <i v-else :class="isEditing ? 'pi pi-check' : 'pi pi-plus'"></i>
              <span>{{ isEditing ? 'Update Department' : 'Create Department' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  initialData: {
    type: Object,
    default: null
  },
  saving: {
    type: Boolean,
    default: false
  },
  errors: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['close', 'save']);

const localForm = ref({
  dep_kd: '',
  dep_nm: '',
  div_kd: '',
  dep_mgr: ''
});

const isEditing = computed(() => !!props.initialData);

watch(() => props.show, (newVal) => {
  if (newVal) {
    if (props.initialData) {
      localForm.value = {
        dep_kd: props.initialData.dep_kd || '',
        dep_nm: props.initialData.dep_nm || '',
        div_kd: props.initialData.div_kd || '',
        dep_mgr: props.initialData.dep_mgr || ''
      };
    } else {
      localForm.value = {
        dep_kd: '',
        dep_nm: '',
        div_kd: '',
        dep_mgr: ''
      };
    }
  }
});

const submit = () => {
  emit('save', { ...localForm.value });
};
</script>

<style src="./MasterDeptDialog.css" scoped />
