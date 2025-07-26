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
@import './Login.style.css';
</style>