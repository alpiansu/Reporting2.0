<template>
    <div v-if="visible" class="modern-progress-container">
        <!-- Header Section -->
        <div class="progress-header">
            <div class="header-icon">
                <slot name="icon">
                    <div class="default-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M12 2V6M12 18V22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12H6M18 12H22M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93"
                                stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                        </svg>
                    </div>
                </slot>
            </div>
            <div class="header-content">
                <h4 class="progress-title">
                    <slot name="title">
                        {{ title }}
                    </slot>
                </h4>
                <p class="progress-subtitle">
                    <slot name="subtitle">
                        {{ subtitle }}
                    </slot>
                </p>
            </div>
            
            <div class="percentage-display" v-if="percentage !== null">
                {{ percentage }}%
                <div class="percentage-to-go" v-if="showPercentageToGo">
                    {{ percentageToGo }}% to go
                </div>
            </div>
        </div>

        <!-- Progress Visualization -->
        <div class="progress-visualization" v-if="percentage !== null">
            <!-- Main Progress Bar -->
            <div class="modern-progress-bar">
                <div class="progress-track">
                    <div class="progress-fill" :style="{ width: percentage + '%' }">
                        <div class="fill-glow"></div>
                    </div>
                    <!-- Progress to go track (background) -->
                    <div class="progress-to-go-track" :style="{ width: percentageToGo + '%' }"></div>
                </div>

                <!-- Milestone Indicators -->
                <div class="milestones">
                    <div class="milestone" :class="{ active: percentage >= 25 }">
                        <span class="milestone-label">25%</span>
                    </div>
                    <div class="milestone" :class="{ active: percentage >= 50 }">
                        <span class="milestone-label">50%</span>
                    </div>
                    <div class="milestone" :class="{ active: percentage >= 75 }">
                        <span class="milestone-label">75%</span>
                    </div>
                </div>
            </div>

            <!-- Additional Info -->
            <div class="progress-meta">
                <div class="meta-info">
                    <slot name="details" :percentageToGo="percentageToGo">
                        <span class="info-text" v-if="info">{{ info }}</span>
                        <span class="to-go-text" v-if="showPercentageToGoInInfo">
                            • {{ percentageToGo }}% remaining
                        </span>
                    </slot>
                </div>
                <!-- <div class="progress-stats">
                    <span class="stats-text">{{ percentage }}% Complete</span>
                    <span class="to-go-stats" v-if="showPercentageToGo">
                        ({{ percentageToGo }}% left)
                    </span>
                </div> -->
            </div>

            <!-- Progress Steps (Optional) -->
            <div class="progress-steps" v-if="$slots.steps">
                <slot name="steps" :percentageToGo="percentageToGo"></slot>
            </div>
        </div>

        <!-- Loading Animation -->
        <div class="loading-indicator" v-if="percentage === null">
            <div class="loading-dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
            <p class="loading-text">Initializing...</p>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    visible: { type: Boolean, default: true },
    percentage: { type: Number, default: null },
    info: { type: String, default: "" },
    title: { type: String, default: "Processing..." },
    subtitle: {
        type: String,
        default: "Please wait while we process your request.",
    },
    showPercentageToGo: { type: Boolean, default: true },
    showPercentageToGoInInfo: { type: Boolean, default: true },
});

// Computed property untuk percentageToGo
const percentageToGo = computed(() => {
    if (props.percentage === null) return null
    return Math.max(0, 100 - props.percentage)
})
</script>

<style scoped src="./ProgressBar.style.css"></style>