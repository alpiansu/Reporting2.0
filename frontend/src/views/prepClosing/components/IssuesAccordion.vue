<template>
    <Accordion :multiple="true" :activeIndex="activeIndexes">
        <AccordionTab v-for="(group, index) in issues" :key="group.category">
            <template #header>
                <div class="accordion-header">
                    <div class="header-left">
                        <i :class="group.icon" :style="{ color: group.color }"></i>
                        <span class="category-label">{{ group.label }}</span>
                        <Badge :value="group.issues.length" :severity="getBadgeSeverity(group)" />
                    </div>
                    <div class="header-right">
                        <Tag v-if="hasCriticalIssues(group)" value="CRITICAL" severity="danger"
                            icon="pi pi-exclamation-circle" />
                    </div>
                </div>
            </template>

            <div class="issues-container">
                <IssueCard v-for="(issue, issueIndex) in group.issues" :key="issueIndex" :issue="issue" />
            </div>
        </AccordionTab>
    </Accordion>
</template>

<script setup>
import { ref } from 'vue';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import Badge from 'primevue/badge';
import Tag from 'primevue/tag';
import IssueCard from './IssueCard.vue';

const props = defineProps({
    issues: {
        type: Array,
        default: () => []
    }
});

// Auto-expand first accordion
const activeIndexes = ref([0]);

const getBadgeSeverity = (group) => {
    const hasCritical = group.issues.some(i => i.severity === 'critical');
    const hasHigh = group.issues.some(i => i.severity === 'high');

    if (hasCritical) return 'danger';
    if (hasHigh) return 'warning';
    return 'info';
};

const hasCriticalIssues = (group) => {
    return group.issues.some(i => i.severity === 'critical');
};
</script>

<style scoped>
.accordion-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0.5rem 0;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.header-left i {
    font-size: 1.5rem;
}

.category-label {
    font-weight: 600;
    font-size: 1rem;
    color: #111827;
}

.header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.issues-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 0;
}

:deep(.p-accordion-header-link) {
    padding: 1rem;
}

:deep(.p-accordion-content) {
    padding: 0 1rem 1rem 1rem;
}
</style>