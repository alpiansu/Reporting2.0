<template>
  <transition
    :name="transitionName"
    :mode="transitionMode"
    :appear="appear"
    @before-enter="beforeEnter"
    @enter="enter"
    @after-enter="afterEnter"
    @before-leave="beforeLeave"
    @leave="leave"
    @after-leave="afterLeave"
  >
    <slot></slot>
  </transition>
</template>

<script setup>
import { computed } from 'vue';
import { getTransition } from '../../utils/transitions';

// Props
const props = defineProps({
  name: {
    type: String,
    default: 'page'
  },
  mode: {
    type: String,
    default: 'out-in'
  },
  appear: {
    type: Boolean,
    default: false
  },
  duration: {
    type: Number,
    default: 300
  }
});

// Computed
const transition = computed(() => getTransition(props.name));
const transitionName = computed(() => transition.value.name || props.name);
const transitionMode = computed(() => transition.value.mode || props.mode);

// Hooks
const beforeEnter = (el) => {
  // Custom logic before element enters
};

const enter = (el, done) => {
  // Custom logic when element enters
  setTimeout(done, props.duration);
};

const afterEnter = (el) => {
  // Custom logic after element enters
};

const beforeLeave = (el) => {
  // Custom logic before element leaves
};

const leave = (el, done) => {
  // Custom logic when element leaves
  setTimeout(done, props.duration);
};

const afterLeave = (el) => {
  // Custom logic after element leaves
};
</script>