<template>
    <div class="dashboard-container">
        <!-- Summary Cards -->
        <div class="summary-grid">
            <!-- Total Stores Card -->
            <Card class="summary-card card-blue">
                <template #content>
                    <div class="card-content">
                        <div class="card-icon blue">
                            <i class="pi pi-building"></i>
                        </div>
                        <div class="card-info">
                            <div class="card-label">Total Toko</div>
                            <div class="card-value">
                                <Skeleton v-if="loading" width="80px" height="2rem" />
                                <span v-else>{{ formatNumber(summary.total_stores) }}</span>
                            </div>
                        </div>
                    </div>
                </template>
            </Card>

            <!-- Ready Stores Card -->
            <Card class="summary-card card-green">
                <template #content>
                    <div class="card-content">
                        <div class="card-icon green">
                            <i class="pi pi-check-circle"></i>
                        </div>
                        <div class="card-info">
                            <div class="card-label">Toko Siap</div>
                            <div class="card-value">
                                <Skeleton v-if="loading" width="80px" height="2rem" />
                                <template v-else>
                                    <span>{{ formatNumber(summary.ready_stores) }}</span>
                                    <span class="percentage">({{ readyPercentage }}%)</span>
                                </template>
                            </div>
                        </div>
                    </div>
                </template>
            </Card>

            <!-- Stores with Issues Card -->
            <Card class="summary-card card-orange">
                <template #content>
                    <div class="card-content">
                        <div class="card-icon orange">
                            <i class="pi pi-exclamation-triangle"></i>
                        </div>
                        <div class="card-info">
                            <div class="card-label">Toko dengan Issues</div>
                            <div class="card-value">
                                <Skeleton v-if="loading" width="80px" height="2rem" />
                                <span v-else>{{ formatNumber(summary.stores_with_issues) }}</span>
                            </div>
                        </div>
                    </div>
                </template>
            </Card>

            <!-- Critical Issues Card -->
            <Card class="summary-card card-red">
                <template #content>
                    <div class="card-content">
                        <div class="card-icon red">
                            <i class="pi pi-times-circle"></i>
                        </div>
                        <div class="card-info">
                            <div class="card-label">Critical Issues</div>
                            <div class="card-value">
                                <Skeleton v-if="loading" width="80px" height="2rem" />
                                <span v-else>{{ formatNumber(summary.total_critical_issues) }}</span>
                            </div>
                        </div>
                    </div>
                </template>
            </Card>
        </div>

        <!-- Rules Grid -->
        <RulesGrid :rules="rulesSummary || []" :selected-keys="selectedRuleKeys || []" @rule-selected="onRuleSelected" />
    </div>
</template>

<script setup>
import { computed } from 'vue';
import Card from 'primevue/card';
import Skeleton from 'primevue/skeleton';
import { formatNumber } from '../utils/formatters';
import RulesGrid from './RulesGrid.vue';

const props = defineProps({
    summary: Object,
    loading: Boolean,
    rulesSummary: Array,
    selectedRuleKeys: Array
});

const emit = defineEmits(['rule-selected']);
const onRuleSelected = (keys) => emit('rule-selected', keys);

const readyPercentage = computed(() => {
    if (!props.summary || props.summary.total_stores === 0) return '0.0';
    const percentage = (props.summary.ready_stores / props.summary.total_stores) * 100;
    return percentage.toFixed(1);
});
</script>

<style scoped>
.dashboard-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
}

.summary-card {
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.summary-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.card-content {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.card-icon {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.75rem;
}

.card-icon.blue {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
}

.card-icon.green {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
}

.card-icon.orange {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
}

.card-icon.red {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
}

.card-info {
    flex: 1;
}

.card-label {
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 500;
    margin-bottom: 0.25rem;
}

.card-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: #111827;
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
}

.percentage {
    font-size: 1rem;
    color: #10b981;
    font-weight: 600;
}

.category-card {
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.category-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    padding: 1rem;
}

.category-header i {
    color: #3b82f6;
}

.category-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
}

.category-item {
    padding: 1rem;
    border: 1px solid #e5e7eb;
    border-left-width: 4px;
    border-radius: 8px;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    background: white;
}

.category-item:hover {
    background: #f9fafb;
    transform: translateX(4px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.category-icon {
    font-size: 1.5rem;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: rgba(59, 130, 246, 0.1);
}

.category-info {
    flex: 1;
}

.category-label {
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.25rem;
}

.category-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 0.5rem;
}

.category-count {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.stores-count {
    font-size: 0.75rem;
    color: #9ca3af;
}

@media (max-width: 1024px) {
    .summary-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    .category-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 576px) {
    .summary-grid {
        grid-template-columns: 1fr;
    }

    .card-value {
        font-size: 1.5rem;
    }

    .card-icon {
        width: 50px;
        height: 50px;
        font-size: 1.5rem;
    }
}
</style>
