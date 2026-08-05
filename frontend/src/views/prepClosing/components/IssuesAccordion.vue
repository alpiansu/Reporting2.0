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
                <IssueCard v-for="(issue, issueIndex) in group.issues" :key="issueIndex" :issue="issue" :ruleInfo="rulesMap[issue.ruleKey] || null" />
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
    },
    rulesMap: {
        type: Object,
        default: () => ({})
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

<style scoped src="./IssuesAccordion.style.css"></style>