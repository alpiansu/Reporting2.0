<template>
  <div class="login-container">
    <!-- Custom page title with reverse order (App Name first) -->
    <page-title title="Sign In" :reverse="true" />

    <div class="login-card">
      <!-- Brand -->
      <header class="login-brand">
        <div class="brand-mark">
          <img src="@/assets/report-logo.svg" alt="Logo" class="brand-logo" />
        </div>
        <div class="brand-meta">
          <span class="brand-name">Reporting 2.0</span>
          <span class="brand-sub">Retail Reporting Platform</span>
        </div>
      </header>

      <!-- Panel heading — mengikuti bahasa visual panel Dashboard -->
      <div class="panel-heading">
        <span class="panel-kicker"><i class="pi pi-shield"></i> Secure Login</span>
        <h1 class="panel-title">Sign in to your account</h1>
      </div>

      <form class="login-form" novalidate @submit.prevent="handleSubmit">
        <div class="form-group" :class="{ 'has-error': errors.username }">
          <label for="username">Username</label>
          <div class="input-wrap">
            <i class="pi pi-user input-icon" aria-hidden="true"></i>
            <input
              id="username"
              v-model="username"
              type="text"
              name="username"
              autocomplete="username"
              placeholder="Enter your username"
              :aria-invalid="errors.username ? 'true' : undefined"
              :aria-describedby="errors.username ? 'username-error' : undefined"
            />
          </div>
          <small v-if="errors.username" id="username-error" class="error-text">
            <i class="pi pi-exclamation-circle" aria-hidden="true"></i>
            {{ errors.username }}
          </small>
        </div>

        <div class="form-group" :class="{ 'has-error': errors.password }">
          <label for="password">Password</label>
          <div class="input-wrap">
            <i class="pi pi-lock input-icon" aria-hidden="true"></i>
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              name="password"
              autocomplete="current-password"
              placeholder="Enter your password"
              :aria-invalid="errors.password ? 'true' : undefined"
              :aria-describedby="errors.password ? 'password-error' : undefined"
            />
            <button
              type="button"
              class="password-toggle"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <i :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true"></i>
            </button>
          </div>
          <small v-if="errors.password" id="password-error" class="error-text">
            <i class="pi pi-exclamation-circle" aria-hidden="true"></i>
            {{ errors.password }}
          </small>
        </div>

        <button type="submit" class="login-button" :disabled="loading">
          <template v-if="loading">
            <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
            <span>Signing in…</span>
          </template>
          <template v-else>
            <span>Sign In</span>
            <i class="pi pi-arrow-right" aria-hidden="true"></i>
          </template>
        </button>
      </form>

      <footer class="login-footer">
        <p>© {{ copyrightYear }} Reporting 2.0 — v{{ frontendVersion }}. All rights reserved.</p>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../../stores';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

// Versi frontend di-inject saat build oleh vite.config.ts (dari package.json)
const frontendVersion = import.meta.env.VITE_APP_VERSION || 'dev';

// Dihitung sekali di module scope — daripada `new Date()` di template (re-evaluated tiap render)
const copyrightYear = new Date().getFullYear();

// Form state
const username = ref('');
const password = ref('');
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

/**
 * Target tujuan setelah login, diambil dari ?redirect= (dari router guard).
 * Hanya path internal yang valid yang diizinkan — tolak protocol-relative (//evil.com)
 * untuk mencegah open redirect, dan tolak halaman non-navigasi (/login, /loading).
 */
const resolvePostLoginTarget = () => {
  const target = route.query.redirect;
  const isSafeInternalPath =
    typeof target === 'string' &&
    target.startsWith('/') &&
    !target.startsWith('//') &&
    !['/login', '/loading'].includes(target);

  return isSafeInternalPath ? target : '/dashboard';
};

// Form submission
const handleSubmit = async () => {
  if (!validateForm()) return;

  loading.value = true;

  try {
    await authStore.login({
      username: username.value,
      password: password.value
    });

    router.push(resolvePostLoginTarget());
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
