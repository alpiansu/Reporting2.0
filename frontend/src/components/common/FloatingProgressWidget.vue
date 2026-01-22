<template>
  <transition name="slide-fade-right">
    <div v-if="isVisible" class="floating-progress-widget" :class="{ 'minimal': isMinimal }">
      <div class="widget-header">
        <div class="header-main" @click="toggleMode">
          <div class="process-icon" :class="{ 'error': hasError }">
            <i class="pi" :class="hasError ? 'pi-exclamation-triangle' : 'pi-spin pi-spinner'"></i>
          </div>
          <div class="title-container" v-if="!isMinimal">
            <span class="widget-title">{{ mainTask?.title || 'Processing...' }}</span>
            <span class="widget-count" v-if="progressStore.activeTasks.length > 1">
              +{{ progressStore.activeTasks.length - 1 }} more
            </span>
          </div>
        </div>
        <div class="widget-actions">
          <button class="mode-toggle" @click="toggleMode" :title="isMinimal ? 'Show details' : 'Minimize'">
            <i class="pi" :class="isMinimal ? 'pi-chevron-left' : 'pi-chevron-right'"></i>
          </button>
        </div>
      </div>

      <div class="widget-content" v-if="!isMinimal">
        <div class="progress-info">
          <span class="info-text" :title="mainTask?.info">{{ mainTask?.info || 'Syncing data...' }}</span>
          <span class="percentage-text">{{ progressStore.totalPercentage }}%</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" :style="{ width: progressStore.totalPercentage + '%' }">
              <div class="fill-shine"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Minimal Mode Progress indicator -->
      <div class="minimal-progress" v-if="isMinimal" :title="`${progressStore.totalPercentage}% complete`" @click="toggleMode">
        <div class="minimal-fill" :style="{ width: progressStore.totalPercentage + '%' }"></div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useProgressStore } from '../../stores';

const progressStore = useProgressStore();
const isMinimal = ref(true);

const mainTask = computed(() => progressStore.mainTask);
const isVisible = computed(() => progressStore.hasActiveTasks);
const hasError = computed(() => mainTask.value?.status?.toLowerCase() === 'failed');

const toggleMode = () => {
  isMinimal.value = !isMinimal.value;
};

const handleExpand = () => {
  isMinimal.value = false;
};

onMounted(() => {
  // Initialize progress monitoring
  progressStore.initProgressMonitoring();
  
  // Listen for auto-expand events
  window.addEventListener('progress-widget-expand', handleExpand);
});

onBeforeUnmount(() => {
  window.removeEventListener('progress-widget-expand', handleExpand);
});

// Auto-minimize when tasks finish
watch(isVisible, (newVal) => {
  if (!newVal) {
    setTimeout(() => {
      isMinimal.value = true;
    }, 500);
  }
});
</script>

<style scoped>
.floating-progress-widget {
  position: fixed;
  top: 74px; /* Perfectly below 64px header + 10px spacing */
  right: 20px;
  z-index: 9999; /* Ensure high visibility */
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  padding: 12px;
  width: 280px;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  overflow: hidden;
  user-select: none;
}

.floating-progress-widget.minimal {
  width: 48px;
  padding: 8px;
  border-radius: 24px;
  right: 15px;
  cursor: pointer;
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  flex: 1;
}

.process-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #4f46e5, #818cf8);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
}

.process-icon.error {
  background: linear-gradient(135deg, #ef4444, #f87171);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.title-container {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.widget-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.widget-count {
  font-size: 0.7rem;
  color: #6b7280;
  font-weight: 500;
}

.widget-actions {
  display: flex;
}

.mode-toggle {
  background: transparent;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-toggle:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #4f46e5;
}

.widget-content {
  margin-top: 12px;
  animation: fadeIn 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.info-text {
  font-size: 0.75rem;
  color: #6b7280;
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.percentage-text {
  font-size: 0.85rem;
  font-weight: 800;
  color: #4f46e5;
}

.progress-bar-container {
  height: 6px;
  width: 100%;
}

.progress-bar-track {
  height: 100%;
  width: 100%;
  background: #f3f4f6;
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #4f46e5, #818cf8);
  border-radius: 3px;
  transition: width 0.3s ease;
  position: relative;
  overflow: hidden;
}

.fill-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  animation: shine 1.5s infinite;
}

/* Minimal Mode Progress indicator - more visible now as a border glow or bottom fill */
.minimal-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: #f3f4f6;
}

.minimal-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 100%;
  background: #4f46e5;
  transition: width 0.3s ease;
}

@keyframes shine {
  0% { left: -100%; }
  100% { left: 100%; }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Transitions */
.slide-fade-right-enter-active,
.slide-fade-right-leave-active {
  transition: all 0.4s ease-in-out;
}

.slide-fade-right-enter-from,
.slide-fade-right-leave-to {
  transform: translateX(50px);
  opacity: 0;
}

@media (max-width: 768px) {
  .floating-progress-widget {
    top: auto;
    bottom: 80px; /* Above bottom tabs if any */
  }
}
</style>
