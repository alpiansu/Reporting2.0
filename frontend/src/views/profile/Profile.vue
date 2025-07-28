<template>
  <div class="profile-page">
    <!-- Custom page title with no app name -->
    <page-title title="My Profile" :include-app-name="false" />
    
    <div class="page-header">
      <h1 class="page-title">My Profile</h1>
    </div>
    
    <div class="profile-content">
      <div class="profile-card">
        <div class="profile-header">
          <div class="profile-avatar">
            <span v-if="!user.profileImage">{{ getInitials(user.fullName) }}</span>
            <img v-else :src="getProfileImageUrl(user.profileImage)" alt="Profile avatar" />
          </div>
          <div class="profile-info">
            <h2 class="profile-name">{{ user.fullName }}</h2>
            <p class="profile-role">{{ user.role }}</p>
            <p class="profile-email">{{ user.email }}</p>
          </div>
          <button class="edit-profile-button" @click="openEditProfileDialog">
            <i class="pi pi-pencil"></i>
            Edit Profile
          </button>
        </div>
        
        <div class="profile-details">
          <div class="detail-item">
            <span class="detail-label">Username</span>
            <span class="detail-value">{{ user.username }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Email</span>
            <span class="detail-value">{{ user.email }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Member Since</span>
            <span class="detail-value">{{ formatDate(user.createdAt) }}</span>
          </div>
        </div>
      </div>
      
      <div class="activity-card">
        <h2 class="card-title">Activity Log</h2>
        <user-activity-list />
      </div>
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
              <p>Save these backup codes in a secure place. You can use them to sign in if you lose access to your authenticator app.</p>
              
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
                  <input 
                    type="text" 
                    id="verificationCode" 
                    v-model="verificationCode" 
                    maxlength="6"
                    placeholder="000000"
                    required
                  />
                </div>
                
                <div class="form-actions">
                  <button type="button" class="cancel-button" @click="closeTwoFactorDialog">Cancel</button>
                  <button 
                    type="button" 
                    class="submit-button" 
                    @click="verifyTwoFactorSetup"
                    :disabled="verificationCode.length !== 6 || isSubmitting"
                  >
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
import { ref, reactive, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import UserActivityList from '@/components/user/UserActivityList.vue';
import EditProfileDialog from '@/components/user/EditProfileDialog.vue';
import authService from '@/services/auth.service';

const authStore = useAuthStore();

// State
const user = ref({
  fullName: '',
  username: '',
  email: '',
  phone: '',
  department: '',
  location: '',
  role: '',
  avatar: null,
  createdAt: ''
});

// Activity state for local demo purposes
const recentActivity = ref([]);

const twoFactorEnabled = ref(false);
const backupCodes = ref([]);

// Dialog state
const showEditProfileDialog = ref(false);
const showTwoFactorDialog = ref(false);
const isSubmitting = ref(false);

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

const errors = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

const verificationCode = ref('');

// Toast state
const showSuccessToast = ref(false);
const showErrorToast = ref(false);
const successMessage = ref('');
const errorMessage = ref('');

// Fetch user data
onMounted(async () => {
  try {
    // Get user profile from API
    const userData = await authService.getProfile();
    user.value = userData;
    
    // User data is now handled by EditProfileDialog component
    
    // Generate mock backup codes
    generateBackupCodes();
  } catch (error) {
    console.error('Error fetching user data:', error);
    showError('Failed to load user profile data');
  }
});

// Methods

const generateBackupCodes = () => {
  // Generate 10 random backup codes
  backupCodes.value = Array.from({ length: 10 }, () => {
    return Math.random().toString(36).substring(2, 6).toUpperCase() + 
           '-' + 
           Math.random().toString(36).substring(2, 6).toUpperCase();
  });
};

const getInitials = (name) => {
  if (!name) return 'NA';
  return name
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};





const openEditProfileDialog = () => {
  showEditProfileDialog.value = true;
};

// Handle profile updated event from EditProfileDialog component
const handleProfileUpdated = (updatedUser) => {
  // Update user in store
  user.value = updatedUser;
  showSuccess('Profile updated successfully');
  
  // Refresh activities using the UserActivityList component
  // We don't need to call fetchUserActivities() directly as it doesn't exist
  // The UserActivityList component will handle fetching activities
};

const getProfileImageUrl = (imagePath) => {
  if (!imagePath) return null;
  // If the image path is already a full URL, return it as is
  if (imagePath.startsWith('http')) return imagePath;
  // Otherwise, construct the URL based on your API's image serving endpoint
  return `${import.meta.env.VITE_API_URL || ''}${imagePath}`;
};

const validatePasswordForm = () => {
  let isValid = true;
  
  // Reset errors
  errors.currentPassword = '';
  errors.newPassword = '';
  errors.confirmPassword = '';
  
  // Validate current password
  if (!passwordForm.currentPassword) {
    errors.currentPassword = 'Current password is required';
    isValid = false;
  }
  
  // Validate new password
  if (!passwordForm.newPassword) {
    errors.newPassword = 'New password is required';
    isValid = false;
  } else if (passwordForm.newPassword.length < 8) {
    errors.newPassword = 'Password must be at least 8 characters long';
    isValid = false;
  }
  
  // Validate confirm password
  if (!passwordForm.confirmPassword) {
    errors.confirmPassword = 'Please confirm your new password';
    isValid = false;
  } else if (passwordForm.confirmPassword !== passwordForm.newPassword) {
    errors.confirmPassword = 'Passwords do not match';
    isValid = false;
  }
  
  return isValid;
};

const changePassword = async () => {
  if (!validatePasswordForm()) return;
  
  isSubmitting.value = true;
  
  try {
    // In a real app, this would be an API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Add an activity entry
    recentActivity.value.unshift({
      id: recentActivity.value.length + 1,
      type: 'password',
      description: 'Changed account password',
      timestamp: new Date().toISOString(),
      location: user.value.location
    });
    
    // Reset the form
    passwordForm.currentPassword = '';
    passwordForm.newPassword = '';
    passwordForm.confirmPassword = '';
    
    showSuccess('Password changed successfully');
  } catch (error) {
    console.error('Error changing password:', error);
    showError('Failed to change password');
  } finally {
    isSubmitting.value = false;
  }
};

const toggleTwoFactor = () => {
  if (twoFactorEnabled.value) {
    // If turning on, show the setup dialog
    openTwoFactorSetupDialog();
  } else {
    // If turning off, confirm and disable
    if (confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
      disableTwoFactor();
    } else {
      // If user cancels, revert the toggle
      twoFactorEnabled.value = true;
    }
  }
};

const openTwoFactorSetupDialog = () => {
  showTwoFactorDialog.value = true;
  verificationCode.value = '';
};

const closeTwoFactorDialog = () => {
  showTwoFactorDialog.value = false;
  
  // If two-factor was not previously enabled and user cancels setup,
  // revert the toggle
  if (!twoFactorEnabled.value) {
    twoFactorEnabled.value = false;
  }
};

const verifyTwoFactorSetup = async () => {
  isSubmitting.value = true;
  
  try {
    // In a real app, this would be an API call to verify the code
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For demo purposes, any 6-digit code is accepted
    if (verificationCode.value.length === 6) {
      twoFactorEnabled.value = true;
      showTwoFactorDialog.value = false;
      showSuccess('Two-factor authentication enabled successfully');
      
      // Add an activity entry
      recentActivity.value.unshift({
        id: recentActivity.value.length + 1,
        type: 'security',
        description: 'Enabled two-factor authentication',
        timestamp: new Date().toISOString(),
        location: user.value.location
      });
    } else {
      showError('Invalid verification code');
    }
  } catch (error) {
    console.error('Error verifying two-factor setup:', error);
    showError('Failed to verify two-factor setup');
  } finally {
    isSubmitting.value = false;
  }
};

const disableTwoFactor = async () => {
  try {
    // In a real app, this would be an API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    twoFactorEnabled.value = false;
    showSuccess('Two-factor authentication disabled');
    
    // Add an activity entry
    recentActivity.value.unshift({
      id: recentActivity.value.length + 1,
      type: 'security',
      description: 'Disabled two-factor authentication',
      timestamp: new Date().toISOString(),
      location: user.value.location
    });
  } catch (error) {
    console.error('Error disabling two-factor:', error);
    showError('Failed to disable two-factor authentication');
  }
};

const showSuccess = (message) => {
  successMessage.value = message;
  showSuccessToast.value = true;
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    showSuccessToast.value = false;
  }, 5000);
};

const showError = (message) => {
  errorMessage.value = message;
  showErrorToast.value = true;
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    showErrorToast.value = false;
  }, 5000);
};
</script>

<style scoped>
@import './Profile.style.css';
</style>