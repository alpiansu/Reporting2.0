<template>
  <div class="login-container">
    <!-- Custom page title with reverse order (App Name first) -->
    <page-title title="Sign In" :reverse="true" />
    
    <div class="login-card">
      <div class="login-header">
        <img src="@/assets/report-logo.svg" alt="Logo" class="login-logo" />
        <h1 class="login-title">Reporting 2.0</h1>
      </div>
      
      <h2 class="login-subtitle">Sign in to your account</h2>
      
      <form @submit.prevent="handleSubmit" class="login-form">
        <div class="form-group" :class="{ 'error': errors.username }">
          <label for="username">Username</label>
          <div class="input-with-icon">
            <i class="pi pi-user"></i>
            <input 
              id="username" 
              v-model="username" 
              type="text" 
              placeholder="Enter your username"
              :class="{ 'p-invalid': errors.username }"
            />
          </div>
          <small v-if="errors.username" class="error-text">{{ errors.username }}</small>
        </div>
        
        <div class="form-group" :class="{ 'error': errors.password }">
          <label for="password">Password</label>
          <div class="input-with-icon">
            <i class="pi pi-lock"></i>
            <input 
              id="password" 
              v-model="password" 
              :type="showPassword ? 'text' : 'password'" 
              placeholder="Enter your password"
              :class="{ 'p-invalid': errors.password }"
            />
            <i 
              :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" 
              class="password-toggle-icon"
              @click="showPassword = !showPassword"
            ></i>
          </div>
          <small v-if="errors.password" class="error-text">{{ errors.password }}</small>
        </div>
        
        <div class="form-options">
          <div class="remember-me">
            <input id="remember" v-model="rememberMe" type="checkbox" />
            <label for="remember">Remember me</label>
          </div>
          <router-link to="/forgot-password" class="forgot-password">Forgot password?</router-link>
        </div>
        
        <button type="submit" class="login-button" :disabled="loading">
          <span v-if="!loading">Sign In</span>
          <i v-else class="pi pi-spin pi-spinner"></i>
        </button>
      </form>
      
      <div class="login-footer">
        <p>© {{ new Date().getFullYear() }} Reporting 2.0. All rights reserved.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores';

const router = useRouter();
const authStore = useAuthStore();

// Form state
const username = ref('');
const password = ref('');
const rememberMe = ref(false);
const showPassword = ref(false);
const errors = reactive({});
const loading = ref(false);

// Form validation
const validateForm = () => {
  errors.username = '';
  errors.password = '';
  
  let isValid = true;
  
  if (!username.value) {
    errors.username = 'Username is required';
    isValid = false;
  }
  
  if (!password.value) {
    errors.password = 'Password is required';
    isValid = false;
  } else if (password.value.length < 6) {
    errors.password = 'Password must be at least 6 characters';
    isValid = false;
  }
  
  return isValid;
};

// Form submission
const handleSubmit = async () => {
  if (!validateForm()) return;
  
  loading.value = true;
  
  try {
    await authStore.login({
      username: username.value,
      password: password.value,
      rememberMe: rememberMe.value
    });
    
    router.push('/dashboard');
  } catch (error) {
    if (error.response?.status === 401) {
      const errorData = error.response.data;
      if (errorData.field === 'username') {
        errors.username = errorData.message || 'Username not found';
      } else if (errorData.field === 'password') {
        errors.password = errorData.message || 'Invalid password';
      } else {
        errors.password = errorData.message || 'Invalid login credentials';
      }
    } else {
      errors.password = error.message || 'An error occurred during login';
    }
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 400px;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  padding: 32px;
  animation: fadeIn 0.5s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

.login-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.login-logo {
  height: 48px;
  width: 48px;
  margin-right: 12px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.login-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.login-subtitle {
  font-size: 1.25rem;
  font-weight: 600;
  text-align: center;
  margin-bottom: 24px;
  color: var(--text-color);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.form-group label {
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-color);
}

.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-icon i:not(.password-toggle-icon) {
  position: absolute;
  left: 12px;
  color: var(--text-color-secondary);
}

.input-with-icon input {
  width: 100%;
  padding: 12px 12px 12px 40px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input-with-icon input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
}

.input-with-icon input.p-invalid {
  border-color: var(--error-color);
}

.password-toggle-icon {
  position: absolute;
  right: 12px;
  cursor: pointer;
  color: var(--text-color-secondary);
  transition: color 0.2s;
}

.password-toggle-icon:hover {
  color: var(--primary-color);
}

.error-text {
  color: var(--error-color);
  font-size: 0.875rem;
  margin-top: 4px;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.remember-me {
  display: flex;
  align-items: center;
  gap: 8px;
}

.forgot-password {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.forgot-password:hover {
  text-decoration: underline;
  color: var(--primary-color-darken);
}

.login-button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 48px;
  margin-top: 8px;
}

.login-button:hover {
  background-color: var(--primary-color-darken);
  transform: translateY(-1px);
}

.login-button:active {
  transform: translateY(0);
}

.login-button:disabled {
  background-color: var(--primary-color-lighten);
  cursor: not-allowed;
  transform: none;
}

.login-footer {
  text-align: center;
  margin-top: 24px;
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

@media (max-width: 480px) {
  .login-card {
    padding: 24px;
  }
  
  .form-options {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}
</style>