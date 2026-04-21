<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal confirm-dialog">
      <div class="modal-header">
        <h3>Confirm Deletion</h3>
      </div>
      <div class="modal-body">
        <p>Are you sure you want to delete the department "{{ dept?.dep_nm }}" ({{ dept?.dep_kd }})?</p>
        <p class="warning-text">This action cannot be undone.</p>
        <div class="form-actions">
          <button class="btn btn-secondary" type="button" @click="$emit('close')">Cancel</button>
          <button class="btn btn-danger" type="button" @click="$emit('confirm')" :disabled="deleting">
            <i v-if="deleting" class="pi pi-spin pi-spinner"></i>
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>

defineProps({
  show: {
    type: Boolean,
    default: false
  },
  dept: {
    type: Object,
    default: null
  },
  deleting: {
    type: Boolean,
    default: false
  }
});

defineEmits(['close', 'confirm']);
</script>

<style src="./MasterDeptConfirmDialog.css" scoped />
<style src="@/views/common-button.css" scoped />