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

<style scoped src="./StatusPieChart.style.css"></style>
