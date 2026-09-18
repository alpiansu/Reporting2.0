<template>
  <div class="profile-page">
    <page-title title="My Profile" :include-app-name="true" separator=" | " />

    <!-- Hero Section -->
    <div class="profile-hero">
      <div class="hero-bg"></div>
      <div class="hero-content">
        <div class="avatar-wrapper">
          <div class="profile-avatar">
            <span v-if="!user.profileImage">{{ getInitials(user.fullName) }}</span>
            <img v-else :src="getProfileImageUrl(user.profileImage)" alt="Profile avatar" />
          </div>
          <div class="avatar-ring"></div>
        </div>

        <div class="hero-info">
          <h1 class="user-name">{{ user.fullName || user.username }}</h1>
          <p class="user-email">{{ user.email }}</p>
          <div class="role-badge-wrapper">
            <span class="role-badge" :class="roleBadgeClass">
              <i :class="roleIcon"></i>
              {{ roleDisplay }}
            </span>
          </div>
        </div>

        <button class="edit-btn" @click="openEditProfileDialog">
          <i class="pi pi-pencil"></i>
          <span>Edit Profil</span>
        </button>
      </div>
    </div>

    <!-- Info Cards -->
    <div class="info-grid">
      <div class="info-card">
        <div class="info-card-icon" style="--accent: #3b82f6">
          <i class="pi pi-user"></i>
        </div>
        <div class="info-card-body">
          <span class="info-label">Username</span>
          <span class="info-value">{{ user.username || '-' }}</span>
        </div>
      </div>

      <div class="info-card">
        <div class="info-card-icon" style="--accent: #8b5cf6">
          <i class="pi pi-envelope"></i>
        </div>
        <div class="info-card-body">
          <span class="info-label">Email</span>
          <span class="info-value">{{ user.email || '-' }}</span>
        </div>
      </div>

      <div class="info-card">
        <div class="info-card-icon" style="--accent: #06b6d4">
          <i class="pi pi-calendar"></i>
        </div>
        <div class="info-card-body">
          <span class="info-label">Member Sejak</span>
          <span class="info-value">{{ formatDate(user.createdAt) }}</span>
        </div>
      </div>

      <div class="info-card">
        <div class="info-card-icon" :style="{ '--accent': roleAccentColor }">
          <i class="pi pi-shield"></i>
        </div>
        <div class="info-card-body">
          <span class="info-label">Level Akun</span>
          <span class="info-value role-value" :style="{ color: roleAccentColor }">{{ roleDisplay }}</span>
        </div>
      </div>
    </div>

    <!-- Activity Log -->
    <div class="activity-card">
      <div class="card-header">
        <h2 class="card-title">
          <i class="pi pi-history"></i>
          Aktivitas Terkini
        </h2>
      </div>
      <user-activity-list />
    </div>

    <!-- Edit Profile Dialog -->
    <EditProfileDialog
      v-model="showEditProfileDialog"
      :user-data="user"
      @profile-updated="handleProfileUpdated"
      @error="showError"
    />

    <!-- Two-Factor Setup Dialog -->
    <div v-if="showTwoFactorDialog" class="dialog-overlay" @click="closeTwoFactorDialog">
      <div class="dialog-content" @click.stop>
        <div class="dialog-header">
          <h2>Two-Factor Authentication</h2>
          <button class="close-button" @click="closeTwoFactorDialog">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="dialog-body">
          <div class="two-factor-setup">
            <h3>Scan QR Code</h3>
            <p>Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>

            <div class="qr-code">
              <img src="https://placehold.co/200x200/e9ecef/adb5bd?text=QR+Code" alt="Two-factor QR code" />
            </div>

            <div class="backup-codes">
              <h3>Backup Codes</h3>
              <p>Save these backup codes in a secure place. You can use them to sign in if you lose access to your
                authenticator app.</p>

              <div class="codes-grid">
                <div v-for="(code, index) in backupCodes" :key="index" class="code-item">
                  {{ code }}
                </div>
              </div>

              <button class="download-codes-button">
                <i class="pi pi-download"></i>
                Download Codes
              </button>
            </div>

            <div class="verification-section">
              <h3>Verify Setup</h3>
              <p>Enter the 6-digit code from your authenticator app to verify the setup</p>

              <div class="verification-form">
                <div class="form-group">
                  <label for="verificationCode">Verification Code</label>
                  <input type="text" id="verificationCode" v-model="verificationCode" maxlength="6" placeholder="000000"
                    required />
                </div>

                <div class="form-actions">
                  <button type="button" class="cancel-button" @click="closeTwoFactorDialog">Cancel</button>
                  <button type="button" class="submit-button" @click="verifyTwoFactorSetup"
                    :disabled="verificationCode.length !== 6 || isSubmitting">
                    <span v-if="!isSubmitting">Verify & Enable</span>
                    <i v-else class="pi pi-spin pi-spinner"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Success Toast -->
    <div v-if="showSuccessToast" class="toast success-toast">
      <i class="pi pi-check-circle"></i>
      <span>{{ successMessage }}</span>
      <button class="close-toast" @click="showSuccessToast = false">
        <i class="pi pi-times"></i>
      </button>
    </div>

    <!-- Error Toast -->
    <div v-if="showErrorToast" class="toast error-toast">
      <i class="pi pi-exclamation-circle"></i>
      <span>{{ errorMessage }}</span>
      <button class="close-toast" @click="showErrorToast = false">
        <i class="pi pi-times"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import UserActivityList from '@/components/user/UserActivityList.vue';
import EditProfileDialog from '@/components/user/EditProfileDialog.vue';
import authService from '@/services/auth.service';
import api from '@/services/api.js';

const authStore = useAuthStore();

const user = ref({
  fullName: '', username: '', email: '', phone: '',
  department: '', location: '', role: '', profileImage: null, createdAt: ''
});

const showEditProfileDialog = ref(false);
const showSuccessToast = ref(false);
const showErrorToast = ref(false);
const successMessage = ref('');
const errorMessage = ref('');

const roleBadgeClass = computed(() => {
  const r = (user.value.role || '').toLowerCase();
  if (r === 'superadmin') return 'role-superadmin';
  if (r === 'admin') return 'role-admin';
  return 'role-user';
});

const roleDisplay = computed(() => {
  const r = (user.value.role || '').toLowerCase();
  if (r === 'superadmin') return 'Superadmin';
  if (r === 'admin') return 'Admin';
  return 'User';
});

const roleIcon = computed(() => {
  const r = (user.value.role || '').toLowerCase();
  if (r === 'superadmin') return 'pi pi-star-fill';
  if (r === 'admin') return 'pi pi-shield';
  return 'pi pi-user';
});

const roleAccentColor = computed(() => {
  const r = (user.value.role || '').toLowerCase();
  if (r === 'superadmin') return '#f59e0b';
  if (r === 'admin') return '#3b82f6';
  return '#10b981';
});

const init = async () => {
  try {
    const userData = await authService.getProfile();
    user.value = userData;
  } catch (error) {
    console.error('Error fetching user data:', error);
    showError('Gagal memuat data profil');
  }
};
init();

const getInitials = (name) => {
  if (!name) return 'NA';
  return name.split(' ').map(p => p.charAt(0).toUpperCase()).slice(0, 2).join('');
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('id-ID', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
};

const openEditProfileDialog = () => {
  showEditProfileDialog.value = true;
};

const handleProfileUpdated = (updatedUser) => {
  user.value = updatedUser;
  showSuccess('Profil berhasil diperbarui');
};

const getProfileImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http')) return imagePath;
  const baseURL = api.defaults.baseURL.replace('/api', '');
  return `${baseURL}${imagePath}`;
};

const showSuccess = (msg) => {
  successMessage.value = msg;
  showSuccessToast.value = true;
  setTimeout(() => { showSuccessToast.value = false; }, 5000);
};

const showError = (msg) => {
  errorMessage.value = msg;
  showErrorToast.value = true;
  setTimeout(() => { showErrorToast.value = false; }, 5000);
};
</script>

<style scoped>
@import './Profile.style.css';
</style>