<template>
  <Card class="rules-grid-card">
    <template #header>
      <div class="rules-grid-header">
        <div class="title">
          <i class="pi pi-list-check"></i>
          <span>Rules Breakdown</span>
        </div>
        <button class="clear-btn" @click="clearAll" :disabled="selectedKeys.length === 0">
          <i class="pi pi-filter-slash"></i>
          <span>Clear All Filters</span>
        </button>
      </div>
    </template>
    <template #content>
      <div class="rules-grid" :class="gridClass">
        <div v-for="rule in rules" :key="rule.ruleKey"
             class="rule-item"
             :class="[severityClass(rule.severity), { selected: isSelected(rule.ruleKey) }]"
             @click="toggle(rule.ruleKey)">
          <div class="item-top">
            <span class="rule-name" :title="rule.ruleName">{{ rule.ruleName }}</span>
            <span class="severity-pill">
              <i :class="getSeverityIcon(rule.severity)"></i>
            </span>
          </div>
          <div class="item-bottom">
            <span class="count">{{ rule.totalStores }}</span>
            <span class="label">toko bermasalah</span>
            <i v-if="isSelected(rule.ruleKey)" class="pi pi-check selected-check"></i>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup>
import { computed } from 'vue';
import Card from 'primevue/card';

const props = defineProps({
  rules: { type: Array, default: () => [] },
  selectedKeys: { type: Array, default: () => [] }
});
const emit = defineEmits(['rule-selected']);

const isSelected = (key) => props.selectedKeys.includes(key);
const toggle = (key) => {
  let next = [];
  if (isSelected(key)) next = props.selectedKeys.filter(k => k !== key);
  else next = [...props.selectedKeys, key];
  emit('rule-selected', next);
};
const clearAll = () => emit('rule-selected', []);

const getSeverityIcon = (sev) => {
  switch ((sev || '').toLowerCase()) {
    case 'critical': return 'pi pi-times-circle';
    case 'high': return 'pi pi-exclamation-triangle';
    case 'medium': return 'pi pi-info-circle';
    case 'low': return 'pi pi-shield';
    default: return 'pi pi-circle';
  }
};

const severityClass = (sev) => {
  const s = (sev || 'none').toLowerCase();
  return `sev-${s}`;
};

const gridClass = computed(() => (props.rules && props.rules.length === 0) ? 'grid-empty' : '');
</script>

<style scoped src="./RulesGrid.style.css"></style>
