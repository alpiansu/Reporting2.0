<template>
    <Card class="pie-chart-card">
        <template #header>
            <div class="chart-header">
                <h3 class="chart-title">
                    <i class="pi pi-chart-pie"></i>
                    Status Kesiapan Toko
                </h3>
            </div>
        </template>
        <template #content>
            <div class="chart-container">
                <!-- Loading State -->
                <div v-if="loading" class="chart-loading">
                    <Skeleton width="100%" height="300px" />
                </div>

                <!-- Chart -->
                <div v-else-if="hasData" class="chart-wrapper">
                    <Pie :data="chartData" :options="chartOptions" />
                </div>

                <!-- No Data -->
                <div v-else class="chart-no-data">
                    <i class="pi pi-info-circle"></i>
                    <p>Belum ada data tersedia</p>
                </div>
            </div>

            <!-- Legend -->
            <div v-if="hasData && !loading" class="custom-legend">
                <div class="legend-item ready">
                    <div class="legend-color" style="background: #10b981;"></div>
                    <div class="legend-info">
                        <span class="legend-label">Toko Ready</span>
                        <span class="legend-value">{{ summary.ready_stores || 0 }} Toko</span>
                    </div>
                </div>
                <div class="legend-item not-ready">
                    <div class="legend-color" style="background: #ef4444;"></div>
                    <div class="legend-info">
                        <span class="legend-label">Toko Belum Ready</span>
                        <span class="legend-value">{{ notReadyCount }} Toko</span>
                    </div>
                </div>
            </div>
        </template>
    </Card>
</template>

<script setup>
import { computed, watch, ref } from 'vue';
import { Pie } from 'vue-chartjs';
import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    CategoryScale
} from 'chart.js';
import Card from 'primevue/card';
import Skeleton from 'primevue/skeleton';

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, ArcElement, CategoryScale);

const props = defineProps({
    summary: {
        type: Object,
        default: () => ({})
    },
    loading: {
        type: Boolean,
        default: false
    }
});

// Animation state
const chartData = ref({ labels: [], datasets: [] });

// Computed
const hasData = computed(() => {
    return props.summary && typeof props.summary.total_stores === 'number' && props.summary.total_stores > 0;
});

const notReadyCount = computed(() => {
    if (!props.summary || !props.summary.total_stores) return 0;
    return (props.summary.total_stores - props.summary.ready_stores) || 0;
});

// Watch for summary changes and update chart with animation
watch(() => props.summary, (newSummary) => {
    if (newSummary && hasData.value) {
        updateChartData();
    }
}, { deep: true });

// Initialize chart data
const updateChartData = () => {
    if (!hasData.value) {
        chartData.value = { labels: [], datasets: [] };
        return;
    }

    const readyCount = props.summary.ready_stores || 0;
    const notReady = notReadyCount.value;

    chartData.value = {
        labels: ['Toko Ready', 'Toko Belum Ready'],
        datasets: [{
            data: [readyCount, notReady],
            backgroundColor: [
                '#10b981', // Green for ready
                '#ef4444'  // Red for not ready
            ],
            hoverBackgroundColor: [
                '#059669', // Darker green on hover
                '#dc2626'  // Darker red on hover
            ],
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverBorderWidth: 3
        }]
    };
};

// Chart options
const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
        animateRotate: true,
        animateScale: true,
        duration: 800,
        easing: 'easeInOutQuart'
    },
    plugins: {
        legend: {
            display: false // We'll use custom legend
        },
        tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
                size: 14,
                weight: 'bold'
            },
            bodyFont: {
                size: 13
            },
            cornerRadius: 8,
            displayColors: true,
            callbacks: {
                label: function(context) {
                    const label = context.label || '';
                    const value = context.parsed || 0;
                    const total = props.summary.total_stores || 0;
                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                    return `${label}: ${value} Toko (${percentage}%)`;
                }
            }
        }
    }
};

// Initialize
updateChartData();
</script>

<style scoped>
.pie-chart-card {
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
}

.chart-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 1rem 1.5rem;
    color: white;
}

.chart-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.chart-title i {
    font-size: 1.25rem;
}

.chart-container {
    padding: 1.5rem;
    position: relative;
    min-height: 300px;
}

.chart-wrapper {
    height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.chart-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
}

.chart-no-data {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    color: #9ca3af;
}

.chart-no-data i {
    font-size: 3rem;
    margin-bottom: 0.5rem;
}

.chart-no-data p {
    margin: 0;
    font-size: 0.875rem;
}

.custom-legend {
    padding: 1rem 1.5rem 1.5rem;
    display: flex;
    justify-content: center;
    gap: 2rem;
    flex-wrap: wrap;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    background: #f9fafb;
    transition: transform 0.2s ease;
}

.legend-item:hover {
    transform: translateY(-2px);
    background: #f3f4f6;
}

.legend-color {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    flex-shrink: 0;
}

.legend-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.legend-label {
    font-size: 0.75rem;
    color: #6b7280;
    font-weight: 500;
}

.legend-value {
    font-size: 0.875rem;
    color: #111827;
    font-weight: 700;
}

@media (max-width: 768px) {
    .custom-legend {
        gap: 1rem;
    }

    .legend-item {
        flex: 1;
        min-width: 140px;
    }

    .chart-container {
        min-height: 250px;
    }

    .chart-wrapper {
        height: 250px;
    }
}
</style>
