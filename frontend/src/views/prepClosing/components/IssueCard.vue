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
                    <!-- Technical Query Section -->
                    <div v-if="ruleInfo && ruleInfo.query" class="query-section">
                        <h5 class="query-section-title">
                            <i class="pi pi-database"></i>
                            Technical Query
                        </h5>

                        <div class="query-meta-tags">
                            <Tag :value="ruleInfo.query.type" severity="info" />
                            <Tag :value="ruleInfo.validation.operator" severity="warn" />
                            <Tag v-if="extractedTables.length > 0" :value="`Table: ${extractedTables.join(', ')}`" severity="secondary" />
                        </div>

                        <div class="query-sql-block">
                            <div class="sql-header">
                                <i class="pi pi-code"></i>
                                <span>SQL Query</span>
                                <button class="copy-btn" :class="{ 'copy-btn-done': copyFeedback }" @click="copyToClipboard(ruleInfo.query.sql)" :title="copyFeedback ? 'Tersalin!' : 'Salin SQL'">
                                    <i :class="copyFeedback ? 'pi pi-check' : 'pi pi-copy'"></i>
                                </button>
                            </div>
                            <pre class="sql-code"><code>{{ ruleInfo.query.sql }}</code></pre>
                        </div>

                        <div v-if="ruleInfo.description" class="query-description">
                            <i class="pi pi-info-circle"></i>
                            <span>{{ ruleInfo.description }}</span>
                        </div>
                    </div>

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
    },
    ruleInfo: {
        type: Object,
        default: null
    }
});

const expanded = ref(false);
const copyFeedback = ref(false);

const severityConfig = computed(() => SEVERITY_CONFIG[props.issue.severity]);

const severityStyle = computed(() => ({
    backgroundColor: severityConfig.value.bgColor,
    color: severityConfig.value.color,
    borderColor: severityConfig.value.color
}));

const toggleExpand = () => {
    expanded.value = !expanded.value;
};

// Extract table names from SQL query for display
const extractedTables = computed(() => {
    if (!props.ruleInfo?.query?.sql) return [];
    const sql = props.ruleInfo.query.sql.toUpperCase();
    const tablePattern = /(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/g;
    const tables = new Set();
    let match;
    while ((match = tablePattern.exec(sql)) !== null) {
        const table = match[1];
        // Skip SQL keywords that might be matched
        if (!['SELECT', 'WHERE', 'AND', 'OR', 'SET', 'VALUES', 'IN', 'AS', 'ON', 'DATABASE', 'SCHEMA', 'COUNT', 'COALESCE', 'IFNULL', 'SUM', 'DISTINCT', 'REPLACE', 'CAST', 'GROUP_CONCAT', 'CONCAT', 'MAX'].includes(table)) {
            tables.add(table);
        }
    }
    return Array.from(tables);
});

// Copy to clipboard helper with visual feedback
const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        copyFeedback.value = true;
        setTimeout(() => { copyFeedback.value = false; }, 1500);
    } catch {
        console.warn('Failed to copy to clipboard');
    }
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

<style scoped src="./IssueCard.style.css"></style>