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

<style scoped>
.modern-progress-container {
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border-radius: 16px;
    padding: 2rem;
    box-shadow:
        0 4px 6px -1px rgba(0, 0, 0, 0.05),
        0 10px 15px -3px rgba(0, 0, 0, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    position: relative;
    overflow: hidden;
}

.modern-progress-container::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #0ea5e9, #38bdf8, #0ea5e9);
    background-size: 200% 100%;
    animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {

    0%,
    100% {
        background-position: -200% 0;
    }

    50% {
        background-position: 200% 0;
    }
}

/* Header Styles */
.progress-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 2rem;
}

.header-icon {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #0ea5e9, #38bdf8);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 4px 8px rgba(14, 165, 233, 0.2);
}

.default-icon svg {
    color: white;
}

.header-content {
    flex: 1;
}

.progress-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
    line-height: 1.3;
}

.progress-subtitle {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
    line-height: 1.5;
}

.percentage-display {
    flex-shrink: 0;
    font-size: 1.5rem;
    font-weight: 800;
    color: #0ea5e9;
    background: rgba(14, 165, 233, 0.1);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid rgba(14, 165, 233, 0.2);
    text-align: center;
}

.percentage-to-go {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    margin-top: 0.25rem;
    opacity: 0.8;
}

/* Progress Bar Styles */
.modern-progress-bar {
    position: relative;
    margin-bottom: 1.5rem;
}

.progress-track {
    width: 100%;
    height: 12px;
    background: #f1f5f9;
    border-radius: 8px;
    overflow: hidden;
    position: relative;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg,
            #0ea5e9 0%,
            #38bdf8 50%,
            #0ea5e9 100%);
    border-radius: 8px;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    z-index: 2;
}

/* Progress to go track - menunjukkan sisa progress */
.progress-to-go-track {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    background: linear-gradient(90deg,
            transparent 0%,
            rgba(14, 165, 233, 0.1) 100%);
    border-radius: 0 8px 8px 0;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1;
}

.fill-glow {
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.4) 50%,
            transparent 100%);
    animation: fillShine 2s ease-in-out infinite;
}

@keyframes fillShine {
    0% {
        left: -100%;
    }

    100% {
        left: 100%;
    }
}

/* Milestone Indicators */
.milestones {
    display: flex;
    justify-content: space-between;
    position: absolute;
    top: -6px;
    left: 25%;
    right: 25%;
    pointer-events: none;
}

.milestone {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
}

.milestone::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e2e8f0;
    border: 2px solid white;
    transition: all 0.3s ease;
    z-index: 3;
}

.milestone.active::before {
    background: #0ea5e9;
    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.2);
    transform: scale(1.2);
}

.milestone-label {
    font-size: 0.7rem;
    color: #64748b;
    font-weight: 500;
    margin-top: 12px;
    opacity: 0.7;
}

.milestone.active .milestone-label {
    color: #0ea5e9;
    opacity: 1;
    font-weight: 600;
}

/* Progress Meta Information */
.progress-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1rem;
}

.meta-info .info-text {
    font-size: 0.875rem;
    color: #64748b;
    font-weight: 500;
}

.to-go-text {
    font-size: 0.875rem;
    color: #94a3b8;
    font-weight: 500;
    margin-left: 0.5rem;
}

.progress-stats {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
}

.stats-text {
    font-size: 0.875rem;
    font-weight: 600;
    color: #0ea5e9;
}

.to-go-stats {
    font-size: 0.75rem;
    color: #94a3b8;
    font-weight: 500;
}

/* Loading State */
.loading-indicator {
    text-align: center;
    padding: 2rem 0;
}

.loading-dots {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #0ea5e9;
    animation: dotPulse 1.4s ease-in-out infinite both;
}

.dot:nth-child(1) {
    animation-delay: -0.32s;
}

.dot:nth-child(2) {
    animation-delay: -0.16s;
}

@keyframes dotPulse {

    0%,
    80%,
    100% {
        transform: scale(0.8);
        opacity: 0.5;
    }

    40% {
        transform: scale(1.2);
        opacity: 1;
    }
}

.loading-text {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
}

/* Progress Steps */
.progress-steps {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #f1f5f9;
}

/* Success State */
.progress-fill[style*="width: 100%"] {
    background: linear-gradient(90deg, #10b981, #34d399);
}

.progress-fill[style*="width: 100%"] .fill-glow {
    background: linear-gradient(90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.6) 50%,
            transparent 100%);
}

/* Hover Effects */
.modern-progress-container:hover {
    transform: translateY(-2px);
    box-shadow:
        0 8px 25px -3px rgba(0, 0, 0, 0.1),
        0 4px 6px -2px rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease;
}

/* Responsive Design */
@media (max-width: 768px) {
    .modern-progress-container {
        padding: 1.5rem;
        margin: 1rem 0;
    }

    .progress-header {
        flex-direction: column;
        text-align: center;
        gap: 1rem;
    }

    .header-icon {
        align-self: center;
    }

    .percentage-display {
        align-self: center;
    }

    .progress-meta {
        flex-direction: column;
        gap: 0.5rem;
        text-align: center;
    }

    .progress-stats {
        align-items: center;
    }

    .to-go-summary {
        flex-direction: column;
        gap: 1rem;
    }
}

@media (max-width: 480px) {
    .modern-progress-container {
        padding: 1rem;
        border-radius: 12px;
    }

    .progress-title {
        font-size: 1.125rem;
    }

    .percentage-display {
        font-size: 1.25rem;
        padding: 0.375rem 0.75rem;
    }

    .milestone-label {
        font-size: 0.65rem;
    }
}

/* Dark Mode Support */
@media (prefers-color-scheme: dark) {
    .modern-progress-container {
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border-color: rgba(255, 255, 255, 0.1);
    }

    .progress-title {
        color: #f1f5f9;
    }

    .progress-subtitle {
        color: #94a3b8;
    }

    .progress-track {
        background: #334155;
    }

    .milestone::before {
        background: #475569;
        border-color: #1e293b;
    }

    .progress-steps {
        border-top-color: #334155;
    }

    .to-go-summary {
        background: rgba(30, 41, 59, 0.5);
        border-color: rgba(51, 65, 85, 0.5);
    }

    .to-go-text,
    .to-go-stats,
    .percentage-to-go {
        color: #cbd5e1;
    }
}

/* Animation for initial load */
.modern-progress-container {
    animation: slideUpFade 0.5s ease-out;
}

@keyframes slideUpFade {
    from {
        opacity: 0;
        transform: translateY(20px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Print Styles */
@media print {
    .modern-progress-container {
        box-shadow: none;
        border: 1px solid #e2e8f0;
        background: white;
    }

    .fill-glow {
        display: none;
    }
}
</style>