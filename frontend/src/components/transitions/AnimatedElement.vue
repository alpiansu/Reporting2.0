<template>
  <div
    :class="[animationClass, { 'animation-paused': paused }]"
    :style="animationStyle"
  >
    <slot></slot>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';

// Props
const props = defineProps({
  animation: {
    type: String,
    default: 'fade-in',
    validator: (value) => [
      'fade-in',
      'slide-in-left',
      'slide-in-right',
      'slide-in-top',
      'slide-in-bottom',
      'bounce',
      'pulse',
      'shake',
      'none'
    ].includes(value)
  },
  duration: {
    type: Number,
    default: 500
  },
  delay: {
    type: Number,
    default: 0
  },
  repeat: {
    type: [Number, String],
    default: 1,
    validator: (value) => Number(value) > 0 || value === 'infinite'
  },
  paused: {
    type: Boolean,
    default: false
  },
  onVisible: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['animation-start', 'animation-end']);

// State
const isVisible = ref(false);
const hasAnimated = ref(false);

// Computed
const animationClass = computed(() => {
  if (props.animation === 'none') return '';
  if (props.onVisible && !isVisible.value && !hasAnimated.value) return '';
  return props.animation;
});

const animationStyle = computed(() => {
  if (props.animation === 'none') return {};
  
  return {
    animationDuration: `${props.duration}ms`,
    animationDelay: `${props.delay}ms`,
    animationIterationCount: props.repeat === 'infinite' ? 'infinite' : props.repeat
  };
});

// Methods
const startAnimation = () => {
  emit('animation-start');
};

const endAnimation = () => {
  hasAnimated.value = true;
  emit('animation-end');
};

// Intersection Observer for onVisible prop
onMounted(() => {
  if (props.onVisible) {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        isVisible.value = true;
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    
    // Get the parent element
    const element = document.querySelector('.animated-element');
    if (element) {
      observer.observe(element);
    }
  }
});
</script>

<style scoped>
.animation-paused {
  animation-play-state: paused;
}
</style>