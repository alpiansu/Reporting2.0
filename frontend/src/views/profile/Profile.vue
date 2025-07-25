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
            <span v-if="!user.avatar">{{ getInitials(user.fullName) }}</span>
            <img v-else :src="user.avatar" alt="Profile avatar" />
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
      
      <div class="security-card">
        <h2 class="card-title">Security</h2>
        
        <div class="security-content">
          <div class="password-section">
            <h3 class="section-title">Change Password</h3>
            <p class="section-description">
              It's a good idea to use a strong password that you don't use elsewhere
            </p>
            
            <form @submit.prevent="changePassword" class="password-form">
              <div class="form-group">
                <label for="currentPassword">Current Password</label>
                <div class="password-input-wrapper">
                  <input 
                    :type="showCurrentPassword ? 'text' : 'password'"
                    id="currentPassword"
                    v-model="passwordForm.currentPassword"
                    required
                  />
                  <button 
                    type="button" 
                    class="toggle-password-button"
                    @click="showCurrentPassword = !showCurrentPassword"
                  >
                    <i :class="showCurrentPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                  </button>
                </div>
                <span v-if="errors.currentPassword" class="error-message">
                  {{ errors.currentPassword }}
                </span>
              </div>
              
              <div class="form-group">
                <label for="newPassword">New Password</label>
                <div class="password-input-wrapper">
                  <input 
                    :type="showNewPassword ? 'text' : 'password'"
                    id="newPassword"
                    v-model="passwordForm.newPassword"
                    required
                  />
                  <button 
                    type="button" 
                    class="toggle-password-button"
                    @click="showNewPassword = !showNewPassword"
                  >
                    <i :class="showNewPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                  </button>
                </div>
                <span v-if="errors.newPassword" class="error-message">
                  {{ errors.newPassword }}
                </span>
              </div>
              
              <div class="form-group">
                <label for="confirmPassword">Confirm New Password</label>
                <div class="password-input-wrapper">
                  <input 
                    :type="showConfirmPassword ? 'text' : 'password'"
                    id="confirmPassword"
                    v-model="passwordForm.confirmPassword"
                    required
                  />
                  <button 
                    type="button" 
                    class="toggle-password-button"
                    @click="showConfirmPassword = !showConfirmPassword"
                  >
                    <i :class="showConfirmPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                  </button>
                </div>
                <span v-if="errors.confirmPassword" class="error-message">
                  {{ errors.confirmPassword }}
                </span>
              </div>
              
              <div class="form-actions">
                <button type="submit" class="submit-button" :disabled="isSubmitting">
                  <span v-if="!isSubmitting">Change Password</span>
                  <i v-else class="pi pi-spin pi-spinner"></i>
                </button>
              </div>
            </form>
          </div>
          
          <div class="two-factor-section">
            <h3 class="section-title">Two-Factor Authentication</h3>
            <p class="section-description">
              Add an extra layer of security to your account by enabling two-factor authentication
            </p>
            
            <div class="two-factor-toggle">
              <span class="toggle-label">Enable Two-Factor Authentication</span>
              <label class="switch">
                <input type="checkbox" v-model="twoFactorEnabled" @change="toggleTwoFactor" />
                <span class="slider"></span>
              </label>
            </div>
            
            <div v-if="twoFactorEnabled" class="two-factor-info">
              <p>Two-factor authentication is enabled for your account.</p>
              <button class="setup-button" @click="openTwoFactorSetupDialog">
                <i class="pi pi-cog"></i>
                Manage Two-Factor Settings
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="activity-card">
        <h2 class="card-title">Recent Activity</h2>
        
        <div v-if="recentActivity.length === 0" class="empty-activity">
          <i class="pi pi-history"></i>
          <p>No recent activity to display</p>
        </div>
        
        <div v-else class="activity-list">
          <div 
            v-for="activity in recentActivity" 
            :key="activity.id"
            class="activity-item"
          >
            <div class="activity-icon" :class="getActivityIconClass(activity.type)">
              <i :class="getActivityIcon(activity.type)"></i>
            </div>
            <div class="activity-details">
              <div class="activity-description">{{ activity.description }}</div>
              <div class="activity-meta">
                <span class="activity-time">{{ formatDateTime(activity.timestamp) }}</span>
                <span v-if="activity.location" class="activity-location">
                  <i class="pi pi-map-marker"></i>
                  {{ activity.location }}
                </span>
              </div>
            </div>
          </div>
        </div>
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
                <span v-if="!profileForm.avatar && !avatarPreview">{{ getInitials(profileForm.fullName) }}</span>
                <img v-else-if="avatarPreview" :src="avatarPreview" alt="Avatar preview" />
                <img v-else :src="profileForm.avatar" alt="Current avatar" />
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
                  v-if="profileForm.avatar || avatarPreview" 
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

const recentActivity = ref([]);
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
    // In a real app, this would come from the auth store or an API call
    // For now, we'll use mock data
    user.value = {
      fullName: 'John Doe',
      username: 'johndoe',
      email: 'john.doe@example.com',
      phone: '+1 (555) 123-4567',
      department: 'Operations',
      location: 'New York',
      role: 'Store Manager',
      avatar: null,
      createdAt: '2022-06-15T10:30:00'
    };
    
    // Initialize profile form with user data
    Object.assign(profileForm, {
      fullName: user.value.fullName,
      username: user.value.username,
      email: user.value.email,
      phone: user.value.phone,
      department: user.value.department,
      location: user.value.location,
      avatar: user.value.avatar
    });
    
    // Fetch recent activity
    await fetchRecentActivity();
    
    // Generate mock backup codes
    generateBackupCodes();
  } catch (error) {
    console.error('Error fetching user data:', error);
    showError('Failed to load user profile data');
  }
});

// Methods
const fetchRecentActivity = async () => {
  try {
    // In a real app, this would be an API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock activity data
    recentActivity.value = [
      {
        id: 1,
        type: 'login',
        description: 'Logged in to the system',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        location: 'New York, USA'
      },
      {
        id: 2,
        type: 'screening',
        description: 'Completed screening for Store Alpha',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'New York, USA'
      },
      {
        id: 3,
        type: 'profile',
        description: 'Updated profile information',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'New York, USA'
      },
      {
        id: 4,
        type: 'password',
        description: 'Changed account password',
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'New York, USA'
      },
      {
        id: 5,
        type: 'login',
        description: 'Logged in from a new device',
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Boston, USA'
      }
    ];
  } catch (error) {
    console.error('Error fetching activity data:', error);
  }
};

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

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleString(undefined, options);
};

const getActivityIcon = (type) => {
  switch (type) {
    case 'login':
      return 'pi pi-sign-in';
    case 'logout':
      return 'pi pi-sign-out';
    case 'profile':
      return 'pi pi-user-edit';
    case 'password':
      return 'pi pi-lock';
    case 'screening':
      return 'pi pi-check-square';
    default:
      return 'pi pi-history';
  }
};

const getActivityIconClass = (type) => {
  switch (type) {
    case 'login':
      return 'icon-login';
    case 'logout':
      return 'icon-logout';
    case 'profile':
      return 'icon-profile';
    case 'password':
      return 'icon-password';
    case 'screening':
      return 'icon-screening';
    default:
      return '';
  }
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

const handleAvatarUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  // Check file type and size
  if (!file.type.startsWith('image/')) {
    showError('Please upload an image file');
    return;
  }
  
  if (file.size > 5 * 1024 * 1024) { // 5MB limit
    showError('Image size should be less than 5MB');
    return;
  }
  
  // Create a preview URL
  avatarPreview.value = URL.createObjectURL(file);
  
  // In a real app, you would upload the file to a server and get a URL back
  // For now, we'll just store the preview URL
  // profileForm.avatar would be set to the URL returned from the server
};

const removeAvatar = () => {
  profileForm.avatar = null;
  avatarPreview.value = null;
  
  // Clear the file input
  const fileInput = document.getElementById('avatar-upload');
  if (fileInput) fileInput.value = '';
};

const updateProfile = async () => {
  isSubmitting.value = true;
  
  try {
    // In a real app, this would be an API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update the user object with form data
    user.value = {
      ...user.value,
      fullName: profileForm.fullName,
      email: profileForm.email,
      phone: profileForm.phone,
      department: profileForm.department,
      location: profileForm.location,
      avatar: avatarPreview.value || profileForm.avatar
    };
    
    // Add an activity entry
    recentActivity.value.unshift({
      id: recentActivity.value.length + 1,
      type: 'profile',
      description: 'Updated profile information',
      timestamp: new Date().toISOString(),
      location: user.value.location
    });
    
    closeEditProfileDialog();
    showSuccess('Profile updated successfully');
  } catch (error) {
    console.error('Error updating profile:', error);
    showError('Failed to update profile');
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
.profile-page {
  padding: 16px;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-color);
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.profile-card, .security-card, .activity-card {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.profile-header {
  display: flex;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 600;
  margin-right: 20px;
  overflow: hidden;
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-info {
  flex: 1;
}

.profile-name {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--text-color);
}

.profile-role {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  margin: 0;
}

.edit-profile-button {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.edit-profile-button:hover {
  background-color: var(--primary-color-darken);
}

.profile-details {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
  padding: 24px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.detail-value {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-color);
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
  padding: 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.security-content {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--text-color);
}

.section-description {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  margin: 0 0 16px 0;
}

.password-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 400px;
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
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
}

.password-input-wrapper input {
  padding-right: 40px;
  width: 100%;
  box-sizing: border-box;
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

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.submit-button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
}

.submit-button:hover {
  background-color: var(--primary-color-darken);
}

.submit-button:disabled {
  background-color: var(--primary-color-lighten);
  cursor: not-allowed;
}

.two-factor-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

.toggle-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color);
}

.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--primary-color);
}

input:focus + .slider {
  box-shadow: 0 0 1px var(--primary-color);
}

input:checked + .slider:before {
  transform: translateX(26px);
}

.two-factor-info {
  margin-top: 16px;
  padding: 16px;
  background-color: rgba(var(--primary-color-rgb), 0.05);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.two-factor-info p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-color);
}

.setup-button {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
  align-self: flex-start;
  color: var(--text-color);
}

.setup-button:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.empty-activity {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
  text-align: center;
}

.empty-activity i {
  font-size: 2.5rem;
  color: var(--text-color-secondary);
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-activity p {
  color: var(--text-color-secondary);
  margin-bottom: 0;
}

.activity-list {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.activity-item {
  display: flex;
  gap: 16px;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

.activity-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1rem;
}

.icon-login {
  background-color: #28a745;
}

.icon-logout {
  background-color: #6c757d;
}

.icon-profile {
  background-color: #17a2b8;
}

.icon-password {
  background-color: #fd7e14;
}

.icon-screening {
  background-color: #6f42c1;
}

.activity-details {
  flex: 1;
}

.activity-description {
  font-size: 0.875rem;
  color: var(--text-color);
  margin-bottom: 8px;
}

.activity-meta {
  display: flex;
  gap: 16px;
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.activity-location {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog-content {
  background-color: white;
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.dialog-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-color-secondary);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.dialog-body {
  padding: 20px;
}

.profile-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.avatar-upload {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 16px;
}

.current-avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background-color: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 600;
  overflow: hidden;
}

.current-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upload-button, .remove-button {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
  color: var(--text-color);
}

.upload-button:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.remove-button:hover {
  border-color: var(--error-color);
  color: var(--error-color);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.cancel-button {
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s;
}

.cancel-button:hover {
  border-color: var(--text-color);
}

.two-factor-setup {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.qr-code {
  display: flex;
  justify-content: center;
  margin: 16px 0;
}

.backup-codes {
  background-color: rgba(0, 0, 0, 0.02);
  padding: 16px;
  border-radius: 8px;
}

.codes-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin: 16px 0;
}

.code-item {
  font-family: monospace;
  font-size: 0.875rem;
  padding: 8px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  text-align: center;
}

.download-codes-button {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
  color: var(--text-color);
  margin-top: 16px;
}

.download-codes-button:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.verification-section {
  margin-top: 16px;
}

.verification-form {
  max-width: 300px;
  margin: 16px auto 0;
}

.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.success-toast {
  background-color: #d4edda;
  color: #155724;
  border-left: 4px solid #28a745;
}

.error-toast {
  background-color: #f8d7da;
  color: #721c24;
  border-left: 4px solid #dc3545;
}

.close-toast {
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.close-toast:hover {
  opacity: 1;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .profile-header {
    flex-direction: column;
    text-align: center;
    gap: 16px;
  }
  
  .profile-avatar {
    margin-right: 0;
  }
  
  .profile-details {
    grid-template-columns: 1fr;
  }
  
  .avatar-upload {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .dialog-content {
    width: 90%;
  }
  
  .codes-grid {
    grid-template-columns: 1fr;
  }
  
  .toast {
    left: 16px;
    right: 16px;
    bottom: 16px;
  }
}
</style>