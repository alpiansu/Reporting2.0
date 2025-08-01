<template>
  <FormDialog
    v-model="dialogVisible"
    title="Edit Profile"
    submit-text="Save Changes"
    cancel-text="Cancel"
    :loading="isSubmitting"
    @submit="handleSubmit"
  >
    <!-- Form content langsung di sini (dari ProfileEditForm) -->
    <form class="profile-form" enctype="multipart/form-data">
      <div class="avatar-upload">
        <div class="current-avatar">
          <span v-if="!formData.profileImage && !avatarPreview">{{ getInitials(formData.fullName) }}</span>
          <img v-else-if="avatarPreview" :src="avatarPreview" alt="Avatar preview" />
          <img v-else :src="getProfileImageUrl(formData.profileImage)" alt="Current avatar" />
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
            v-if="formData.profileImage || avatarPreview" 
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
          <input type="text" id="fullName" v-model="formData.fullName" required />
          <span v-if="errors.fullName" class="error-message">{{ errors.fullName }}</span>
        </div>
        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" id="username" v-model="formData.username" required disabled />
          <span class="field-hint">Username cannot be changed</span>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" v-model="formData.email" required />
          <span v-if="errors.email" class="error-message">{{ errors.email }}</span>
        </div>
      </div>
    </form>
  </FormDialog>
</template>

<script setup>
import { ref, reactive, defineProps, defineEmits, watch } from 'vue';
import FormDialog from '@/components/common/FormDialog.vue';
import authService from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  userData: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update:modelValue', 'profile-updated', 'error']);

// State
const dialogVisible = ref(props.modelValue);
const isSubmitting = ref(false);
const avatarPreview = ref(null);
const uploadedAvatar = ref(null);

// Form state
const formData = reactive({
  fullName: '',
  username: '',
  email: '',
  profileImage: null
});

const errors = reactive({});

// Initialize form data from props
const initForm = () => {
  Object.assign(formData, {
    fullName: props.userData.fullName || '',
    username: props.userData.username || '',
    email: props.userData.email || '',
    profileImage: props.userData.profileImage || null
  });
  
  // Reset avatar preview and uploaded avatar
  avatarPreview.value = null;
  uploadedAvatar.value = null;
  
  // Reset errors
  Object.keys(errors).forEach(key => errors[key] = '');
};

// Watch for changes in modelValue prop
watch(() => props.modelValue, (newValue) => {
  dialogVisible.value = newValue;
  if (newValue) {
    initForm();
  }
});

// Watch for changes in dialog visibility
watch(dialogVisible, (newValue) => {
  emit('update:modelValue', newValue);
});

// Methods
const getInitials = (name) => {
  if (!name) return 'NA';
  return name
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
};

const getProfileImageUrl = (imagePath) => {
  if (!imagePath) return null;
  // If the image path is already a full URL, return it as is
  if (imagePath.startsWith('http')) return imagePath;
  // Import baseURL from api.js
  const baseURL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
  // Otherwise, construct the URL based on your API's image serving endpoint
  return `${baseURL}${imagePath}`;
};

const handleAvatarUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    emit('error', 'Please upload a valid image file (JPEG, PNG, or GIF)');
    return;
  }
  
  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    emit('error', 'Image size should not exceed 5MB');
    return;
  }
  
  // Create a preview URL for immediate display
  avatarPreview.value = URL.createObjectURL(file);
  
  // Store the file for later upload when the form is submitted
  uploadedAvatar.value = file;
  console.log('Avatar file selected and ready for upload');
};

const removeAvatar = () => {
  avatarPreview.value = null;
  uploadedAvatar.value = null;
  formData.profileImage = null; // Explicitly set to null to indicate removal
  
  // Clear the file input
  const fileInput = document.getElementById('avatar-upload');
  if (fileInput) fileInput.value = '';
};

const validateForm = () => {
  console.log('Validating form...');
  const newErrors = {};
  
  if (!formData.fullName) {
    newErrors.fullName = 'Full name is required';
  }
  
  if (!formData.email) {
    newErrors.email = 'Email is required';
    console.error('Validation error: email is required');
  } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
    newErrors.email = 'Please enter a valid email address';
    console.error('Validation error: invalid email format');
  }
  
  // Update errors object
  Object.assign(errors, newErrors);
  
  const isValid = Object.keys(newErrors).length === 0;
  return isValid;
};

const handleSubmit = async () => {
  if (!validateForm()) {
    console.error('Form validation failed');
    return;
  }

  isSubmitting.value = true;

  try {
    // Inisialisasi profileImagePath dengan nilai yang ada
    let profileImagePath = formData.profileImage;

    // If a new avatar was uploaded, process it first
    if (uploadedAvatar.value) {
      const fd = new FormData();
      fd.append('image', uploadedAvatar.value);
      const uploadResult = await authService.uploadProfileImage(fd);
      profileImagePath = uploadResult.imagePath;
    } else if (
      formData.profileImage === null &&
      props.userData.profileImage
    ) {
      console.log('Deleting profile image from server...');
      // If the profile image was removed, delete it from the server
      await authService.deleteProfileImage();
      profileImagePath = null;
      console.log('Profile image deleted, profileImagePath set to null');
    }

    // Pastikan profileImagePath tidak undefined atau null jika tidak ada perubahan
    if (profileImagePath === undefined && formData.profileImage !== null) {
      profileImagePath = props.userData.profileImage;
      console.log('Using existing profile image path:', profileImagePath);
    }
    
    // Jika avatar dihapus, pastikan profileImagePath adalah null
    if (avatarPreview.value === null) {
      profileImagePath = null;
      console.log('Avatar removed, ensuring profileImagePath is null');
    }
    
    // Prepare profile data
    const profileData = {
      fullName: formData.fullName,
      email: formData.email,
      profileImage: profileImagePath
    };
    
    // Use auth store
    const authStore = useAuthStore();
    
    // Update the profile with all data including the new image path
    const updatedProfile = await authService.updateProfile(profileData);
    
    // Update auth store to refresh header
    await authStore.updateProfile(updatedProfile);

    // Close dialog and emit updated profile
    dialogVisible.value = false;
    emit('profile-updated', updatedProfile);
  } catch (error) {
    console.error('Error updating profile:', error);
    emit('error', error.response?.data?.message || 'Failed to update profile');

    // Set form errors if they come from the backend
    if (error.response?.data?.errors) {
      Object.assign(errors, error.response.data.errors);
    }
  } finally {
    isSubmitting.value = false;
  }
};

// Initialize form on component creation
initForm();
</script>

<style src="./EditProfileDialog.style.css"></style>