<template>
    <div class="dashboard-container">
        <!-- Rules Grid and Pie Chart -->
        <div class="dashboard-grid">
            <div class="grid-item">
                <RulesGrid :rules="rulesSummary || []" :selected-keys="selectedRuleKeys || []" @rule-selected="onRuleSelected" />
            </div>
            <div class="grid-item">
                <StatusPieChart :summary="summary" :loading="loading" />
            </div>
        </div>
    </div>
</template>

<script setup>
import RulesGrid from './RulesGrid.vue';
import StatusPieChart from './StatusPieChart.vue';

const props = defineProps({
    summary: Object,
    loading: Boolean,
    rulesSummary: Array,
    selectedRuleKeys: Array
});

const emit = defineEmits(['rule-selected']);
const onRuleSelected = (keys) => emit('rule-selected', keys);
</script>

<style scoped src="./Dashboard.style.css"></style>
