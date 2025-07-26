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
            <span class="detail-label">Phone</span>
            <span class="detail-value">{{ user.phone || 'Not provided' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Department</span>
            <span class="detail-value">{{ user.department || 'Not provided' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Location</span>
            <span class="detail-value">{{ user.location || 'Not provided' }}</span>
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
    <div v-if="showEditProfileDialog" class="dialog-overlay" @click="closeEditProfileDialog">
      <div class="dialog-content" @click.stop>
        <div class="dialog-header">
          <h2>Edit Profile</h2>
          <button class="close-button" @click="closeEditProfileDialog">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="dialog-body">
          <form @submit.prevent="updateProfile" class="profile-form">
            <div class="avatar-upload">
              <div class="current-avatar">
                <span v-if="!profileForm.profileImage && !avatarPreview">{{ getInitials(profileForm.fullName) }}</span>
                <img v-else-if="avatarPreview" :src="avatarPreview" alt="Avatar preview" />
                <img v-else :src="getProfileImageUrl(profileForm.profileImage)" alt="Current avatar" />
              </div>
              <div class="avatar-actions">
                <label for="avatar-upload" class="upload-button">
                  <i class="pi pi-upload"></i>
                  Upload Photo
                </label>
                <input 
                  type="file" 
                  id="avatar-upload" 
                  accept="image/*"
                  @change="handleAvatarUpload"
                  style="display: none;"
                />
                <button 
                  v-if="profileForm.profileImage || avatarPreview" 
                  type="button" 
                  class="remove-button"
                  @click="removeAvatar"
                >
                  <i class="pi pi-trash"></i>
                  Remove
                </button>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="fullName">Full Name</label>
                <input type="text" id="fullName" v-model="profileForm.fullName" required />
              </div>
              <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" v-model="profileForm.username" required disabled />
                <span class="field-hint">Username cannot be changed</span>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" v-model="profileForm.email" required />
              </div>
              <div class="form-group">
                <label for="phone">Phone</label>
                <input type="tel" id="phone" v-model="profileForm.phone" />
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="department">Department</label>
                <input type="text" id="department" v-model="profileForm.department" />
              </div>
              <div class="form-group">
                <label for="location">Location</label>
                <input type="text" id="location" v-model="profileForm.location" />
              </div>
            </div>
            
            <div class="form-actions">
              <button type="button" class="cancel-button" @click="closeEditProfileDialog">Cancel</button>
              <button type="submit" class="submit-button" :disabled="isSubmitting">
                <span v-if="!isSubmitting">Save Changes</span>
                <i v-else class="pi pi-spin pi-spinner"></i>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    
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
import { ref, reactive, computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import UserActivityList from '@/components/user/UserActivityList.vue';
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


const twoFactorEnabled = ref(false);
const backupCodes = ref([]);

// Form state
const showEditProfileDialog = ref(false);
const showTwoFactorDialog = ref(false);
const isSubmitting = ref(false);
const avatarPreview = ref(null);

const profileForm = reactive({
  fullName: '',
  username: '',
  email: '',
  phone: '',
  department: '',
  location: '',
  avatar: null
});

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

const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);
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
    
    // Initialize profile form with user data
    Object.assign(profileForm, {
      fullName: user.value.fullName,
      username: user.value.username,
      email: user.value.email,
      phone: user.value.phone || '',
      department: user.value.department || '',
      location: user.value.location || '',
      profileImage: user.value.profileImage
    });
    
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
  // Reset the form with current user data
  Object.assign(profileForm, {
    fullName: user.value.fullName,
    username: user.value.username,
    email: user.value.email,
    phone: user.value.phone,
    department: user.value.department,
    location: user.value.location,
    avatar: user.value.avatar
  });
  
  avatarPreview.value = null;
  showEditProfileDialog.value = true;
};

const closeEditProfileDialog = () => {
  showEditProfileDialog.value = false;
};

const getProfileImageUrl = (imagePath) => {
  if (!imagePath) return null;
  // If the image path is already a full URL, return it as is
  if (imagePath.startsWith('http')) return imagePath;
  // Otherwise, construct the URL based on your API's image serving endpoint
  return `${import.meta.env.VITE_API_URL || ''}${imagePath}`;
};

const handleAvatarUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    showError('Please upload a valid image file (JPEG, PNG, or GIF)');
    return;
  }
  
  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    showError('Image size should not exceed 5MB');
    return;
  }
  
  // Create a preview URL for immediate display
  avatarPreview.value = URL.createObjectURL(file);
  
  // Store the file for later upload when the form is submitted
  uploadedAvatar.value = file;
};

const removeAvatar = () => {
  avatarPreview.value = null;
  uploadedAvatar.value = null;
  profileForm.profileImage = null;
  
  // Clear the file input
  const fileInput = document.getElementById('avatar-upload');
  if (fileInput) fileInput.value = '';
};

const updateProfile = async () => {
  isSubmitting.value = true;
  
  try {
    let profileImagePath = profileForm.profileImage;
    
    // If a new avatar was uploaded, process it first
    if (uploadedAvatar.value) {
      // Convert the file to base64
      const reader = new FileReader();
      const filePromise = new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(uploadedAvatar.value);
      });
      
      const base64Image = await filePromise;
      
      // Extract the base64 data (remove the data:image/xxx;base64, prefix)
      const base64Data = base64Image.split(',')[1];
      
      // Upload the image
      const imageData = {
        image: base64Data,
        mimetype: uploadedAvatar.value.type,
        filename: uploadedAvatar.value.name
      };
      
      const uploadResult = await authService.uploadProfileImage(imageData);
      profileImagePath = uploadResult.imagePath;
    } else if (profileForm.profileImage === null && user.value.profileImage) {
      // If the profile image was removed, delete it from the server
      await authService.deleteProfileImage();
      profileImagePath = null;
    }
    
    // Update the profile with all data including the new image path
    const updatedProfile = await authService.updateProfile({
      fullName: profileForm.fullName,
      email: profileForm.email,
      phone: profileForm.phone,
      department: profileForm.department,
      location: profileForm.location,
      profileImage: profileImagePath
    });
    
    // Update local user data
    user.value = updatedProfile;
    
    closeEditProfileDialog();
    showSuccess('Profile updated successfully');
    
    // Reset preview and uploaded avatar
    avatarPreview.value = null;
    uploadedAvatar.value = null;
  } catch (error) {
    console.error('Error updating profile:', error);
    showError(error.response?.data?.message || 'Failed to update profile');
  } finally {
    isSubmitting.value = false;
  }
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