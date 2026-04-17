<template>
    <Card class="issue-card" :class="`severity-${issue.severity}`">
        <template #content>
            <div class="issue-header">
                <div class="header-left">
                    <div class="severity-badge" :style="severityStyle">
                        <i :class="severityConfig.icon"></i>
                        <span>{{ severityConfig.label }}</span>
                    </div>
                    <h4 class="issue-title">{{ issue.ruleName }}</h4>
                </div>
                <Button v-if="issue.ui.expandable" :icon="expanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                    class="p-button-text p-button-sm" @click="toggleExpand" />
            </div>

            <div class="issue-message">
                <i :class="issue.ui.icon" :style="{ color: issue.ui.color }"></i>
                <p>{{ issue.message }}</p>
            </div>

            <div class="issue-values">
                <div class="value-item">
                    <span class="value-label">Expected:</span>
                    <span class="value-content">{{ formatValue(issue.expected) }}</span>
                </div>
                <div class="value-item">
                    <span class="value-label">Actual:</span>
                    <span class="value-content actual">{{ formatValue(issue.actual) }}</span>
                </div>
                <div v-if="issue.delta !== undefined && issue.delta !== null && issue.ui.showDelta" class="value-item">
                    <span class="value-label">Delta:</span>
                    <span class="value-content delta" :class="getDeltaClass(issue.delta)">
                        {{ formatDelta(issue.delta, issue.ui.formatDelta) }}
                    </span>
                </div>
            </div>

            <Transition name="expand">
                <div v-if="expanded" class="issue-details">
                    <div class="help-section">
                        <h5><i class="pi pi-question-circle"></i> Help</h5>
                        <p>{{ issue.ui.helpText }}</p>
                    </div>

                    <div class="metadata-section">
                        <div class="metadata-item">
                            <i class="pi pi-map-marker"></i>
                            <div>
                                <div class="metadata-label">Impact Area</div>
                                <div class="metadata-value">{{ issue.metadata.impactArea }}</div>
                            </div>
                        </div>
                        <div class="metadata-item">
                            <i class="pi pi-clock"></i>
                            <div>
                                <div class="metadata-label">Estimated Fix Time</div>
                                <div class="metadata-value">{{ issue.metadata.estimatedFixTime }}</div>
                            </div>
                        </div>
                        <div class="metadata-item">
                            <i class="pi pi-wrench"></i>
                            <div>
                                <div class="metadata-label">Fixable</div>
                                <div class="metadata-value">
                                    <Tag :value="issue.ui.fixable ? 'Yes' : 'No'"
                                        :severity="issue.ui.fixable ? 'success' : 'danger'" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </template>
    </Card>
</template>

<script setup>
import { ref, computed } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import { SEVERITY_CONFIG } from '../utils/constants';
import { formatCurrency } from '../utils/formatters';

const props = defineProps({
    issue: {
        type: Object,
        required: true
    }
});

const expanded = ref(false);

const severityConfig = computed(() => SEVERITY_CONFIG[props.issue.severity]);

const severityStyle = computed(() => ({
    backgroundColor: severityConfig.value.bgColor,
    color: severityConfig.value.color,
    borderColor: severityConfig.value.color
}));

const toggleExpand = () => {
    expanded.value = !expanded.value;
};

const formatValue = (value) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') return value.toLocaleString('id-ID');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

const formatDelta = (delta, format) => {
    if (delta === null || delta === undefined) return '-';
    const prefix = delta > 0 ? '+' : '';
    if (format === 'currency') {
        return prefix + formatCurrency(delta);
    }
    return prefix + Number(delta).toLocaleString('id-ID');
};

const getDeltaClass = (delta) => {
    if (delta === null || delta === undefined) return 'neutral';
    if (delta > 0) return 'positive';
    if (delta < 0) return 'negative';
    return 'neutral';
};
</script>

<style scoped>
.issue-card {
    border-left: 4px solid;
    transition: all 0.3s ease;
}

.issue-card.severity-critical {
    border-left-color: #dc2626;
}

.issue-card.severity-high {
    border-left-color: #f59e0b;
}

.issue-card.severity-medium {
    border-left-color: #3b82f6;
}

.issue-card.severity-low {
    border-left-color: #6b7280;
}

.issue-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
}

.issue-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
}

.severity-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    border: 1px solid;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    white-space: nowrap;
}

.issue-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
}

.issue-message {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1rem;
    padding: 0.75rem;
    background: #f9fafb;
    border-radius: 6px;
}

.issue-message i {
    font-size: 1.25rem;
    margin-top: 0.125rem;
}

.issue-message p {
    margin: 0;
    color: #374151;
    line-height: 1.5;
    flex: 1;
}

.issue-values {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
}

.value-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.value-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
}

.value-content {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
}

.value-content.actual {
    color: #3b82f6;
}

.value-content.delta.positive {
    color: #10b981;
}

.value-content.delta.negative {
    color: #ef4444;
}

.value-content.delta.neutral {
    color: #6b7280;
}

.issue-details {
    border-top: 1px solid #e5e7eb;
    padding-top: 1rem;
    margin-top: 1rem;
}

.help-section {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #eff6ff;
    border-radius: 6px;
    border-left: 3px solid #3b82f6;
}

.help-section h5 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e40af;
}

.help-section p {
    margin: 0;
    color: #1e3a8a;
    line-height: 1.6;
}

.metadata-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
}

.metadata-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #f9fafb;
    border-radius: 6px;
}

.metadata-item i {
    font-size: 1.25rem;
    color: #6b7280;
}

.metadata-label {
    font-size: 0.75rem;
    color: #6b7280;
    margin-bottom: 0.25rem;
}

.metadata-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
}

.expand-enter-active,
.expand-leave-active {
    transition: all 0.3s ease;
    max-height: 1000px;
    overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
    max-height: 0;
    opacity: 0;
}

@media (max-width: 768px) {
    .issue-values {
        grid-template-columns: 1fr;
    }

    .metadata-section {
        grid-template-columns: 1fr;
    }

    .header-left {
        flex-direction: column;
        align-items: flex-start;
    }
}
</style>