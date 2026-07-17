<template>
  <Dialog
    :visible="visible"
    :header="isEditing ? 'Edit Pengguna' : 'Tambah Pengguna Baru'"
    :modal="true"
    :closable="true"
    :draggable="false"
    :style="{ width: '520px' }"
    class="user-form-dialog"
    @hide="onHide"
  >
    <div class="form-body">
      <!-- Username -->
      <div class="field">
        <label for="username" class="field-label">
          Username <span class="required">*</span>
        </label>
        <InputText
          id="username"
          v-model="form.username"
          class="field-input"
          :class="{ 'p-invalid': submitted && !form.username }"
          :disabled="isEditing"
          placeholder="Masukkan username"
          autocomplete="off"
        />
        <small v-if="submitted && !form.username" class="field-error">
          Username harus diisi
        </small>
      </div>

      <!-- Email -->
      <div class="field">
        <label for="email" class="field-label">
          Email <span class="required">*</span>
        </label>
        <InputText
          id="email"
          v-model="form.email"
          class="field-input"
          :class="{ 'p-invalid': submitted && (!form.email || !isEmailValid) }"
          placeholder="contoh@email.com"
          autocomplete="off"
        />
        <small v-if="submitted && !form.email" class="field-error">
          Email harus diisi
        </small>
        <small v-else-if="submitted && !isEmailValid" class="field-error">
          Format email tidak valid
        </small>
      </div>

      <!-- Full Name -->
      <div class="field">
        <label for="fullName" class="field-label">
          Nama Lengkap <span class="required">*</span>
        </label>
        <InputText
          id="fullName"
          v-model="form.fullName"
          class="field-input"
          :class="{ 'p-invalid': submitted && !form.fullName }"
          placeholder="Masukkan nama lengkap"
          autocomplete="off"
        />
        <small v-if="submitted && !form.fullName" class="field-error">
          Nama lengkap harus diisi
        </small>
      </div>

      <!-- Password -->
      <div class="field">
        <label for="password" class="field-label">
          Password
          <span v-if="!isEditing" class="required">*</span>
          <span v-else class="optional-mark">(kosongkan jika tidak diubah)</span>
        </label>
        <InputText
          id="password"
          v-model="form.password"
          type="password"
          class="field-input"
          :class="{ 'p-invalid': submitted && !isEditing && !form.password }"
          :placeholder="isEditing ? 'Biarkan kosong jika tidak diubah' : 'Masukkan password'"
          autocomplete="new-password"
        />
        <small
          v-if="submitted && !isEditing && !form.password"
          class="field-error"
        >
          Password harus diisi
        </small>
      </div>

      <!-- Role -->
      <div class="field">
        <label for="role" class="field-label">
          Role <span class="required">*</span>
        </label>
        <Dropdown
          id="role"
          v-model="form.role"
          :options="roleOptions"
          optionLabel="label"
          optionValue="value"
          class="field-input"
          placeholder="Pilih role"
        />
      </div>

      <!-- Active Status -->
      <div class="field-checkbox">
        <label class="checkbox-wrapper">
          <input
            type="checkbox"
            v-model="form.isActive"
            class="checkbox-input"
          />
          <span class="checkbox-custom">
            <i class="pi pi-check checkbox-icon"></i>
          </span>
          <span class="checkbox-label">Aktif</span>
        </label>
      </div>
    </div>

    <template #footer>
      <div class="form-footer">
        <Button
          label="Batal"
          icon="pi pi-times"
          class="p-button-text"
          :disabled="saving"
          @click="closeDialog"
        />
        <Button
          :label="isEditing ? 'Simpan Perubahan' : 'Tambah Pengguna'"
          :icon="isEditing ? 'pi pi-check' : 'pi pi-user-plus'"
          :loading="saving"
          @click="submitForm"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

// ── Props ────────────────────────────────────────────────────────────────
const props = defineProps({
  visible: { type: Boolean, default: false },
  user: { type: Object, default: null },
  isEditing: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
});

// ── Emits ────────────────────────────────────────────────────────────────
const emit = defineEmits(['close', 'save']);

// ── Constants ────────────────────────────────────────────────────────────
const roleOptions = [
  { label: 'Superadmin', value: 'superadmin' },
  { label: 'Admin', value: 'admin' },
  { label: 'User', value: 'user' },
];

// ── Form State ───────────────────────────────────────────────────────────
const form = ref(getDefaultForm());
const submitted = ref(false);

function getDefaultForm() {
  return {
    id: null,
    username: '',
    email: '',
    fullName: '',
    password: '',
    role: 'user',
    isActive: true,
  };
}

function resetForm() {
  form.value = getDefaultForm();
  submitted.value = false;
}

function populateForm(userData) {
  form.value = {
    id: userData.id || null,
    username: userData.username || '',
    email: userData.email || '',
    fullName: userData.fullName || '',
    password: '',
    role: userData.role || 'user',
    isActive: userData.isActive !== undefined ? userData.isActive : true,
  };
  submitted.value = false;
}

// Watch for visible/user changes to populate/reset form
watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      if (props.isEditing && props.user) {
        populateForm(props.user);
      } else {
        resetForm();
      }
    }
  }
);

// ── Validation ───────────────────────────────────────────────────────────
const isEmailValid = computed(() => {
  if (!form.value.email?.trim()) return true; // empty is handled separately
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(form.value.email.trim());
});

function isFormValid() {
  submitted.value = true;

  // Username: required
  if (!form.value.username?.trim()) return false;

  // Email: required + valid format
  if (!form.value.email?.trim()) return false;
  if (!isEmailValid.value) return false;

  // Full Name: required
  if (!form.value.fullName?.trim()) return false;

  // Password: required only on create
  if (!props.isEditing && !form.value.password) return false;

  return true;
}

// ── Actions ──────────────────────────────────────────────────────────────
function submitForm() {
  if (!isFormValid()) return;
  emit('save', { ...form.value });
}

function closeDialog() {
  emit('close');
}

function onHide() {
  // Dialog closed via backdrop click / escape — notify parent
  emit('close');
}
</script>

<style scoped>
/* ── Form Body ──────────────────────────────────────────────────────── */
.form-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0.25rem 0;
}

/* ── Field ──────────────────────────────────────────────────────────── */
.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field-label {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--p-text-color, #374151);
}

.required {
  color: var(--p-red-500, #ef4444);
}

.optional-mark {
  font-weight: 400;
  font-size: 0.8rem;
  color: var(--p-text-muted-color, #6b7280);
}

.field-input {
  width: 100%;
}

.field-error {
  color: var(--p-red-500, #ef4444);
  font-size: 0.8rem;
}

/* ── Checkbox (Active) ──────────────────────────────────────────────── */
.field-checkbox {
  padding-top: 0.25rem;
}

.checkbox-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.checkbox-custom {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 2px solid var(--p-surface-400, #94a3b8);
  border-radius: 4px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.checkbox-input:checked + .checkbox-custom {
  background: var(--p-primary-color, #3b82f6);
  border-color: var(--p-primary-color, #3b82f6);
}

.checkbox-icon {
  font-size: 12px;
  color: white;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.checkbox-input:checked + .checkbox-custom .checkbox-icon {
  opacity: 1;
}

.checkbox-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--p-text-color, #374151);
}

/* ── Footer ─────────────────────────────────────────────────────────── */
.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
