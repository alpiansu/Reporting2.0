<template>
  <FormDialog
    v-model="dialogVisible"
    title="Edit Profile"
    submit-text="Save Changes"
    cancel-text="Cancel"
    :loading="isSubmitting"
    @submit="handleSubmit"
  >
    <ProfileEditForm
      ref="profileFormRef"
      :user-data="userData"
      @submit="handleFormSubmit"
      @validation-error="handleValidationError"
    />
  </FormDialog>
</template>

<script setup>
import { ref, defineProps, defineEmits, watch } from 'vue';
import FormDialog from '@/components/common/FormDialog.vue';
import ProfileEditForm from './ProfileEditForm.vue';
import authService from '@/services/auth.service';

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
const profileFormRef = ref(null);

// Watch for changes in modelValue prop
watch(() => props.modelValue, (newValue) => {
  dialogVisible.value = newValue;
});

// Watch for changes in dialog visibility
watch(dialogVisible, (newValue) => {
  emit('update:modelValue', newValue);
  
  // Reset form when dialog is opened
  if (newValue && profileFormRef.value) {
    profileFormRef.value.resetForm();
  }
});

// Methods
const handleValidationError = (errors) => {
  // You can handle validation errors here if needed
  console.log('Validation errors:', errors);
};

const handleFormSubmit = (formData) => {
  console.log('Form submitted with data:', formData);
  // Don't call handleSubmit() here to prevent duplicate submissions
  // The submit event from FormDialog will trigger handleSubmit
};

const handleSubmit = async () => {
  console.log('EditProfileDialog: handleSubmit called');
  if (!profileFormRef.value) {
    console.error('profileFormRef is null or undefined');
    return;
  }
  
  // Explicitly call submitForm to ensure we have the latest form data
  const formData = profileFormRef.value.submitForm();
  if (!formData) {
    console.error('Form data is null or undefined after submitForm call');
    return;
  }

  console.log('Form data after submitForm call:', formData);
  console.log('handleSubmit processing with data:', {
    fullName: formData.fullName,
    email: formData.email,
    profileImage: formData.profileImage,
    hasUploadedAvatar: !!profileFormRef.value?.uploadedAvatar
  });

  isSubmitting.value = true;

  try {
    // Inisialisasi profileImagePath dengan nilai yang ada
    // Jika tidak ada perubahan, gunakan nilai yang ada
    let profileImagePath = formData.profileImage;
    console.log('Initial profileImagePath:', profileImagePath);

    // If a new avatar was uploaded, process it first
    if (profileFormRef.value.uploadedAvatar) {
      console.log('Processing uploaded avatar:', profileFormRef.value.uploadedAvatar);
      // Convert the file to base64
      const reader = new FileReader();
      const filePromise = new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(profileFormRef.value.uploadedAvatar);
      });

      const base64Image = await filePromise;

      // Gunakan base64Image langsung tanpa memisahkan prefix
      // Ini memastikan format data:image/xxx;base64 tetap ada
      const base64Data = base64Image;

      // Upload the image
      const imageData = {
        image: base64Data,
        mimetype: profileFormRef.value.uploadedAvatar.type,
        filename: profileFormRef.value.uploadedAvatar.name
      };

      console.log('Uploading image to server...');
      const uploadResult = await authService.uploadProfileImage(imageData);
      profileImagePath = uploadResult.imagePath;
      console.log('Image uploaded, new path:', profileImagePath);
    } else if (
      formData.profileImage === null &&
      props.userData.profileImage
    ) {
      console.log('Deleting profile image from server...');
      console.log('formData.profileImage is null, and props.userData.profileImage exists:', props.userData.profileImage);
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
    if (formData.profileImage === null) {
      profileImagePath = null;
      console.log('Avatar removed, ensuring profileImagePath is null');
    }
    
    // Debug: Tampilkan nilai profileImagePath sebelum dikirim
    console.log('Final profileImagePath value:', profileImagePath);

    // Prepare profile data
    const profileData = {
      fullName: formData.fullName,
      email: formData.email,
      profileImage: profileImagePath
    };
    
    // Debugging: Log detail tentang profileImage
    console.log('formData.profileImage:', formData.profileImage);
    console.log('props.userData.profileImage:', props.userData.profileImage);
    console.log('profileImagePath:', profileImagePath);
    console.log('Updating profile with data:', JSON.stringify(profileData));
    
    // Update the profile with all data including the new image path
    const updatedProfile = await authService.updateProfile(profileData);
    console.log('Profile updated successfully:', updatedProfile);

    // Close dialog and emit updated profile
    dialogVisible.value = false;
    emit('profile-updated', updatedProfile);
  } catch (error) {
    console.error('Error updating profile:', error);
    emit('error', error.response?.data?.message || 'Failed to update profile');

    // Set form errors if they come from the backend
    if (error.response?.data?.errors) {
      profileFormRef.value.setErrors(error.response.data.errors);
    }
  } finally {
    isSubmitting.value = false;
  }
};
</script>