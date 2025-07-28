<template>
  <form @submit.prevent="submitForm" class="profile-form">
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
      </div>
    </div>
  </form>
</template>

<script setup>
import { ref, reactive, defineEmits, defineProps, defineExpose } from 'vue';

const props = defineProps({
  userData: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['submit', 'validation-error']);

// Form state
const formData = reactive({
  fullName: '',
  username: '',
  email: '',
  profileImage: null
});

const avatarPreview = ref(null);
const uploadedAvatar = ref(null);
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
};

// Initialize form on component creation
initForm();

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
  // Otherwise, construct the URL based on your API's image serving endpoint
  return `${import.meta.env.VITE_API_URL || ''}${imagePath}`;
};

const handleAvatarUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    emit('validation-error', { avatar: 'Please upload a valid image file (JPEG, PNG, or GIF)' });
    return;
  }
  
  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    emit('validation-error', { avatar: 'Image size should not exceed 5MB' });
    return;
  }
  
  // Create a preview URL for immediate display
  avatarPreview.value = URL.createObjectURL(file);
  
  // Store the file for later upload when the form is submitted
  uploadedAvatar.value = file;
  
  // Penting: Jangan set formData.profileImage di sini
  // formData.profileImage akan diatur oleh EditProfileDialog setelah upload berhasil
  console.log('Avatar file selected and ready for upload');
};

const removeAvatar = () => {
  avatarPreview.value = null;
  uploadedAvatar.value = null;
  formData.profileImage = null; // Explicitly set to null to indicate removal
  
  console.log('Avatar removed, formData.profileImage set to:', formData.profileImage);
  
  // Clear the file input
  const fileInput = document.getElementById('avatar-upload');
  if (fileInput) fileInput.value = '';
};

const validateForm = () => {
  console.log('ProfileEditForm: validateForm called');
  const newErrors = {};
  
  if (!formData.fullName) {
    newErrors.fullName = 'Full name is required';
    console.log('Validation error: fullName is required');
  }
  
  if (!formData.email) {
    newErrors.email = 'Email is required';
    console.log('Validation error: email is required');
  } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
    newErrors.email = 'Please enter a valid email address';
    console.log('Validation error: invalid email format');
  }
  
  // Update errors and emit validation event
  Object.assign(errors, newErrors);
  emit('validation-error', errors);
  
  const isValid = Object.keys(newErrors).length === 0;
  console.log('Form validation result:', isValid ? 'valid' : 'invalid', newErrors);
  return isValid;
};

const submitForm = () => {
  console.log('ProfileEditForm: submitForm called');
  if (!validateForm()) {
    console.error('Form validation failed');
    return;
  }
  
  // Create form data to submit
  const submitData = {
    ...formData,
    uploadedAvatar: uploadedAvatar.value
  };
  
  // Debug: Log status profileImage dan uploadedAvatar
  console.log('ProfileEditForm submitData:', {
    profileImage: submitData.profileImage,
    hasUploadedAvatar: !!uploadedAvatar.value,
    uploadedAvatarType: uploadedAvatar.value ? uploadedAvatar.value.type : null
  });
  
  console.log('Emitting submit event with data:', submitData);
  emit('submit', submitData);
  return submitData; // Return the data for direct access
};

// Reset form to initial values
const resetForm = () => {
  initForm();
  Object.keys(errors).forEach(key => errors[key] = '');
};

// Check if form has errors
const hasErrors = () => {
  console.log('ProfileEditForm: hasErrors called');
  const isValid = validateForm();
  const hasErrors = Object.values(errors).some(error => error !== '');
  console.log('hasErrors result:', hasErrors, 'errors:', errors);
  return hasErrors;
};

// Set errors from outside (e.g. from backend validation)
const setErrors = (errorData) => {
  Object.assign(errors, errorData);
  emit('validation-error', errors);
};

// Expose methods to parent component
defineExpose({
  resetForm,
  hasErrors,
  setErrors,
  submitForm
});
</script>

<style src="./ProfileEditForm.style.css"></style>