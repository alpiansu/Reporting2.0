<template>
  <form class="password-form" @submit.prevent="handleSubmit">
    <div class="form-group">
      <label for="currentPassword">Current Password</label>
      <div class="password-input-wrapper">
        <input
          :type="showCurrentPassword ? 'text' : 'password'"
          id="currentPassword"
          v-model="formData.currentPassword"
          :class="{ 'p-invalid': errors.currentPassword }"
          @input="validateForm"
          required
        />
        <button type="button" class="toggle-password-button" @click="showCurrentPassword = !showCurrentPassword">
          <i :class="`pi ${showCurrentPassword ? 'pi-eye-slash' : 'pi-eye'}`"></i>
        </button>
      </div>
      <small class="error-message" v-if="errors.currentPassword">{{ errors.currentPassword }}</small>
    </div>
    <div class="form-group">
      <label for="newPassword">New Password</label>
      <div class="password-input-wrapper">
        <input
          :type="showNewPassword ? 'text' : 'password'"
          id="newPassword"
          v-model="formData.newPassword"
          :class="{ 'p-invalid': errors.newPassword }"
          @input="validateForm"
          required
        />
        <button type="button" class="toggle-password-button" @click="showNewPassword = !showNewPassword">
          <i :class="`pi ${showNewPassword ? 'pi-eye-slash' : 'pi-eye'}`"></i>
        </button>
      </div>
      <small class="error-message" v-if="errors.newPassword">{{ errors.newPassword }}</small>
      <small class="field-hint">Password must be at least 6 characters</small>
    </div>
    <div class="form-group">
      <label for="confirmPassword">Confirm New Password</label>
      <div class="password-input-wrapper">
        <input
          :type="showConfirmPassword ? 'text' : 'password'"
          id="confirmPassword"
          v-model="formData.confirmPassword"
          :class="{ 'p-invalid': errors.confirmPassword }"
          @input="validatePasswordMatch"
          required
        />
        <button type="button" class="toggle-password-button" @click="showConfirmPassword = !showConfirmPassword">
          <i :class="`pi ${showConfirmPassword ? 'pi-eye-slash' : 'pi-eye'}`"></i>
        </button>
      </div>
      <small class="error-message" v-if="errors.confirmPassword">{{ errors.confirmPassword }}</small>
    </div>
  </form>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { useToastService } from '../../utils/toast';

const authStore = useAuthStore();
const toast = useToastService();

const formData = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

const errors = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);

const loading = ref(false);

// Expose methods to parent component
const hasErrors = () => {
  validateForm();
  return Object.values(errors).some(error => error !== '');
};

// Method to set errors from outside (e.g. from backend validation)
const setErrors = (errorData) => {
  // Update error messages with backend validation errors
  if (errorData.currentPassword) {
    errors.currentPassword = errorData.currentPassword;
  }
  
  if (errorData.newPassword) {
    errors.newPassword = errorData.newPassword;
  }
  
  if (errorData.confirmPassword) {
    errors.confirmPassword = errorData.confirmPassword;
  }
  
  // Emit validation errors to parent component
  emit('validation-error', errors);
};

// Define emits
const emit = defineEmits(['submit', 'validation-error']);

const validatePasswordMatch = () => {
  if (formData.newPassword && formData.confirmPassword && formData.newPassword !== formData.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
    emit('validation-error', errors);
    return false;
  } else if (formData.confirmPassword) {
    errors.confirmPassword = '';
    emit('validation-error', errors);
  }
  return true;
};

const validateForm = () => {
  errors.currentPassword = '';
  errors.newPassword = '';
  errors.confirmPassword = '';
  let valid = true;
  if (!formData.currentPassword) {
    errors.currentPassword = 'Current password is required';
    valid = false;
  }
  if (!formData.newPassword) {
    errors.newPassword = 'New password is required';
    valid = false;
  } else if (formData.newPassword.length < 6) {
    errors.newPassword = 'Password must be at least 6 characters';
    valid = false;
  }
  if (!formData.confirmPassword) {
    errors.confirmPassword = 'Please confirm your new password';
    valid = false;
  } else if (formData.newPassword !== formData.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
    valid = false;
  }
  
  // Emit validation errors to parent component
  emit('validation-error', errors);
  
  return valid;
};

const resetForm = () => {
  formData.currentPassword = '';
  formData.newPassword = '';
  formData.confirmPassword = '';
  errors.currentPassword = '';
  errors.newPassword = '';
  errors.confirmPassword = '';
};

const handleSubmit = () => {
  if (!validateForm()) {
    emit('validation-error', errors);
    return;
  }
  
  emit('submit', {
    currentPassword: formData.currentPassword,
    newPassword: formData.newPassword
  });
};

// Expose methods to parent component
defineExpose({
  hasErrors,
  resetForm,
  setErrors
});
</script>

<style scoped>
@import './ChangePasswordForm.style.css';
</style>