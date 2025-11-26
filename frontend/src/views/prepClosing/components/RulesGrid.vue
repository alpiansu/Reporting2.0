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

<style scoped>
.rules-grid-card { border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.rules-grid-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; }
.rules-grid-header .title { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #111827; }
.clear-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid #e5e7eb; background: #fff; border-radius: 6px; cursor: pointer; }
.clear-btn:disabled { opacity: .6; cursor: not-allowed; }
.rules-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem; padding: 0.75rem 1rem 1rem; max-height: 420px; overflow-y: auto; }
.grid-empty { padding: 0 1rem 1rem; max-height: unset; overflow: hidden; }
.rule-item { border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.75rem; cursor: pointer; transition: all .2s ease; background: #fff; }
.rule-item:hover { border-color: #3b82f6; box-shadow: 0 4px 12px rgba(59,130,246,.15); transform: translateY(-2px); }
.rule-item.selected { border-color: #3b82f6; background: #f8fbff; }
.item-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.rule-name { font-size: 0.875rem; font-weight: 600; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.severity-pill { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; background: #f3f4f6; color: #374151; }
.item-bottom { display: flex; align-items: baseline; gap: 6px; margin-top: 6px; position: relative; }
.count { font-size: 1.25rem; font-weight: 700; color: #111827; }
.label { font-size: 0.75rem; color: #6b7280; }
.selected-check { position: absolute; right: 4px; bottom: 0; color: #3b82f6; }
.sev-critical { border-left: 4px solid #dc2626; }
.sev-high { border-left: 4px solid #f59e0b; }
.sev-medium { border-left: 4px solid #3b82f6; }
.sev-low { border-left: 4px solid #6b7280; }
.sev-none { border-left: 4px solid #e5e7eb; }
</style>
