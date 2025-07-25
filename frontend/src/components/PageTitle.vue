<template>
  <!-- This is an invisible component that manages page titles -->
</template>

<script setup>
import { watch } from 'vue';
import { useRoute } from 'vue-router';
import { setDocumentTitle } from '../utils/title';

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  includeAppName: {
    type: Boolean,
    default: true
  },
  separator: {
    type: String,
    default: ' | '
  },
  reverse: {
    type: Boolean,
    default: false
  }
});

const route = useRoute();

// Update title when component props change
watch(
  () => props.title,
  (newTitle) => {
    if (newTitle) {
      setDocumentTitle(newTitle, {
        includeAppName: props.includeAppName,
        separator: props.separator,
        reverse: props.reverse
      });
    }
  },
  { immediate: true }
);

// Update title when route changes (if no explicit title is provided)
watch(
  () => route.meta.title,
  (newTitle) => {
    if (!props.title && newTitle) {
      setDocumentTitle(newTitle, {
        includeAppName: props.includeAppName,
        separator: props.separator,
        reverse: props.reverse
      });
    }
  },
  { immediate: true }
);
</script>