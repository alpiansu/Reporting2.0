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

/* ==============================
   Technical Query Section
   ============================== */
.query-section {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #0f172a;
    border-radius: 8px;
    border: 1px solid #1e293b;
}

.query-section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.75rem 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: #e2e8f0;
}

.query-section-title i {
    color: #3b82f6;
}

.query-meta-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
}

.query-meta-tags :deep(.p-tag) {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.3px;
}

.query-sql-block {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    overflow: hidden;
}

.sql-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: #1a2332;
    border-bottom: 1px solid #334155;
    font-size: 0.7rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.sql-header i {
    font-size: 0.8rem;
}

.copy-btn {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
}

.copy-btn:hover {
    background: #334155;
    color: #e2e8f0;
}

.copy-btn:active {
    transform: scale(0.9);
}

.copy-btn-done {
    color: #22c55e !important;
}

.copy-btn-done:hover {
    background: #14532d !important;
    color: #22c55e !important;
}

.sql-code {
    margin: 0;
    padding: 0.75rem;
    overflow-x: auto;
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
    font-size: 0.78rem;
    line-height: 1.6;
    color: #e2e8f0;
    white-space: pre-wrap;
    word-break: break-word;
}

.sql-code code {
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
    color: #e2e8f0;
}

.query-description {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding: 0.625rem 0.75rem;
    background: #1a2332;
    border-radius: 6px;
    border: 1px solid #334155;
    font-size: 0.78rem;
    color: #94a3b8;
    line-height: 1.5;
}

.query-description i {
    color: #3b82f6;
    margin-top: 0.125rem;
    flex-shrink: 0;
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

    .sql-code {
        font-size: 0.7rem;
        padding: 0.5rem;
    }

    .query-section {
        padding: 0.75rem;
    }
}
</style>