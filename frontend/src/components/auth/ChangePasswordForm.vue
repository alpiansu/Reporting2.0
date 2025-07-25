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
          required
        />
        <button 
          type="button" 
          class="toggle-password-button" 
          @click="showCurrentPassword = !showCurrentPassword"
        >
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
          required
        />
        <button 
          type="button" 
          class="toggle-password-button" 
          @click="showNewPassword = !showNewPassword"
        >
          <i :class="`pi ${showNewPassword ? 'pi-eye-slash' : 'pi-eye'}`"></i>
        </button>
      </div>
      <small class="error-message" v-if="errors.newPassword">{{ errors.newPassword }}</small>
      <small class="field-hint">Password must be at least 6 characters long</small>
    </div>
    
    <div class="form-group">
      <label for="confirmPassword">Confirm New Password</label>
      <div class="password-input-wrapper">
        <input 
          :type="showConfirmPassword ? 'text' : 'password'" 
          id="confirmPassword" 
          v-model="formData.confirmPassword"
          :class="{ 'p-invalid': errors.confirmPassword }"
          required
        />
        <button 
          type="button" 
          class="toggle-password-button" 
          @click="showConfirmPassword = !showConfirmPassword"
        >
          <i :class="`pi ${showConfirmPassword ? 'pi-eye-slash' : 'pi-eye'}`"></i>
        </button>
      </div>
      <small class="error-message" v-if="errors.confirmPassword">{{ errors.confirmPassword }}</small>
    </div>
  </form>
</template>

<script setup>
import { ref, reactive, defineEmits } from 'vue';

const emit = defineEmits(['submit', 'validation-error']);

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

const validateForm = () => {
  let isValid = true;
  
  // Reset errors
  errors.currentPassword = '';
  errors.newPassword = '';
  errors.confirmPassword = '';
  
  // Validate current password
  if (!formData.currentPassword) {
    errors.currentPassword = 'Current password is required';
    isValid = false;
  }
  
  // Validate new password
  if (!formData.newPassword) {
    errors.newPassword = 'New password is required';
    isValid = false;
  } else if (formData.newPassword.length < 6) {
    errors.newPassword = 'Password must be at least 6 characters long';
    isValid = false;
  }
  
  // Validate confirm password
  if (!formData.confirmPassword) {
    errors.confirmPassword = 'Please confirm your new password';
    isValid = false;
  } else if (formData.newPassword !== formData.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
    isValid = false;
  }
  
  return isValid;
};

const handleSubmit = () => {
  if (validateForm()) {
    emit('submit', {
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword
    });
  } else {
    emit('validation-error', errors);
  }
};

// Method to reset the form
const resetForm = () => {
  formData.currentPassword = '';
  formData.newPassword = '';
  formData.confirmPassword = '';
  
  errors.currentPassword = '';
  errors.newPassword = '';
  errors.confirmPassword = '';
  
  showCurrentPassword.value = false;
  showNewPassword.value = false;
  showConfirmPassword.value = false;
};

// Expose resetForm method to parent components
defineExpose({ resetForm });
</script>

<style scoped>
.password-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color);
}

.password-input-wrapper {
  position: relative;
}

.form-group input {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 0.875rem;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
}

.form-group input.p-invalid {
  border-color: var(--error-color);
}

.password-input-wrapper input {
  padding-right: 40px;
}

.toggle-password-button {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-color-secondary);
  cursor: pointer;
  padding: 4px;
}

.toggle-password-button:hover {
  color: var(--text-color);
}

.error-message {
  font-size: 0.75rem;
  color: var(--error-color);
}

.field-hint {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}
</style>