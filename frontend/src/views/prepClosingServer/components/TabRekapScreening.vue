<template>
  <div class="tab-content">
    <div v-if="data.total > 0" class="rekap-info-bar">
      <i class="pi pi-exclamation-triangle mr-2 text-orange-400"></i>
      <span>{{ data.total }} toko masih memiliki issue. Rule keys: </span>
      <Tag v-for="key in data.ruleKeys?.slice(0, 8)" :key="key" :value="key" severity="warning" class="ml-1 tag-sm" />
      <span v-if="data.ruleKeys?.length > 8" class="ml-1 text-color-secondary text-sm">
        +{{ data.ruleKeys.length - 8 }} lainnya
      </span>
    </div>

    <DataTable :value="data.data" :loading="loading" class="ceklist-table rekap-table"
      stripedRows responsiveLayout="scroll" scrollable scrollHeight="500px">
      <template #empty>
        <div class="table-empty text-green-500">
          <i class="pi pi-check-circle"></i>
          <span>Semua toko sudah READY untuk periode ini 🎉</span>
        </div>
      </template>
      <Column field="cab"   header="CAB"   style="width:70px"  frozen />
      <Column field="kdtk"  header="KDTK"  style="width:75px"  frozen />
      <Column header="Failed/Total" style="width:110px">
        <template #body="{ data: row }">
          <span class="text-sm">{{ row.failedRules }}/{{ row.totalRules }}</span>
        </template>
      </Column>
      <Column field="criticalIssues" header="Critical" style="width:80px">
        <template #body="{ data: row }">
          <Tag v-if="row.criticalIssues > 0" :value="String(row.criticalIssues)" severity="danger" />
          <span v-else class="text-color-secondary">0</span>
        </template>
      </Column>
      <Column field="lastScreened" header="Last Screened" style="width:140px">
        <template #body="{ data: row }">
          <span class="text-sm text-color-secondary">{{ formatDate(row.lastScreened) }}</span>
        </template>
      </Column>
      <Column v-for="key in data.ruleKeys" :key="key" :header="key" style="width:110px">
        <template #body="{ data: row }">
          <Tag v-if="row[key] !== null && row[key] !== undefined"
            :value="row[key] === true ? 'FAIL' : String(row[key])"
            severity="danger" class="tag-sm" />
          <span v-else class="text-color-secondary text-sm">—</span>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup>
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';

defineProps({
  data:    { type: Object, default: () => ({ data: [], ruleKeys: [], total: 0 }) },
  loading: { type: Boolean, default: false },
});

function formatDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' });
}
</script>
