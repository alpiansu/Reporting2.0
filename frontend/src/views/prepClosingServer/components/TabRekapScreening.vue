<template>
  <div class="tab-content">
    <div v-if="data.total > 0" class="rekap-info-bar">
      <div class="flex align-items-center flex-wrap gap-1">
        <i class="pi pi-exclamation-triangle mr-2 text-orange-400"></i>
        <span><strong>{{ data.total }}</strong> toko masih memiliki issue. Rule keys: </span>
        <Tag v-for="key in data.ruleKeys?.slice(0, 8)" :key="key" :value="key" severity="warning" class="ml-1 tag-sm" />
        <span v-if="data.ruleKeys?.length > 8" class="ml-1 text-color-secondary text-sm">
          +{{ data.ruleKeys.length - 8 }} lainnya
        </span>
      </div>
    </div>

    <!-- Toolbar with Search & Quick Filter -->
    <div class="tab-toolbar-wrapper" v-if="data.total > 0">
      <div class="filter-pills-row m-0">
        <button
          type="button"
          class="filter-pill"
          :class="{ active: !criticalOnly }"
          @click="criticalOnly = false"
        >
          <i class="pi pi-th-large mr-1"></i> Semua Toko Isu <span class="pill-badge">{{ totalCount }}</span>
        </button>
        <button
          type="button"
          class="filter-pill pill-danger"
          :class="{ active: criticalOnly }"
          @click="criticalOnly = true"
        >
          <i class="pi pi-exclamation-circle mr-1"></i> Hanya Isu Kritis <span class="pill-badge badge-danger">{{ criticalCount }}</span>
        </button>
      </div>

      <div class="tab-search-box">
        <IconField iconPosition="left">
          <InputIcon class="pi pi-search" />
          <InputText v-model="searchQuery" placeholder="Cari kode toko (KDTK) / cabang..." class="p-inputtext-sm search-input" />
        </IconField>
      </div>
    </div>

    <DataTable :value="filteredRows" :loading="loading" class="ceklist-table rekap-table"
      stripedRows responsiveLayout="scroll" scrollable scrollHeight="500px"
      :paginator="filteredRows.length > 20" :rows="20" :rowsPerPageOptions="[20, 50, 100]">
      <template #empty>
        <div class="table-empty text-green-500" v-if="data.total === 0">
          <i class="pi pi-check-circle"></i>
          <span>Semua toko sudah READY untuk periode ini 🎉</span>
        </div>
        <div class="table-empty" v-else>
          <i class="pi pi-search-minus"></i>
          <span>Tidak ada toko yang cocok dengan pencarian / filter.</span>
        </div>
      </template>
      <Column field="cab" header="CAB" style="width:80px" frozen sortable>
        <template #body="{ data: row }">
          <span class="font-mono font-bold text-sm">{{ formatCode(row.cab) }}</span>
        </template>
      </Column>
      <Column field="kdtk" header="KDTK" style="width:95px" frozen sortable>
        <template #body="{ data: row }">
          <span class="font-mono font-medium text-sm text-primary">{{ formatCode(row.kdtk) }}</span>
        </template>
      </Column>
      <Column field="failedRules" header="Failed/Total" style="width:115px" sortable>
        <template #body="{ data: row }">
          <span class="text-sm font-mono">{{ row.failedRules }}/{{ row.totalRules }}</span>
        </template>
      </Column>
      <Column field="criticalIssues" header="Critical" style="width:95px" sortable>
        <template #body="{ data: row }">
          <Tag v-if="row.criticalIssues > 0" :value="String(row.criticalIssues)" severity="danger" />
          <span v-else class="text-color-secondary">0</span>
        </template>
      </Column>
      <Column field="lastScreened" header="Last Screened" style="width:130px" sortable>
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

      <template #paginatorleft>
        <span class="text-xs text-color-secondary">
          Menampilkan {{ filteredRows.length }} dari total {{ data.total }} toko bermasalah
        </span>
      </template>
    </DataTable>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import InputText from 'primevue/inputtext';

const props = defineProps({
  data:    { type: Object, default: () => ({ data: [], ruleKeys: [], total: 0 }) },
  loading: { type: Boolean, default: false },
});

const searchQuery = ref('');
const criticalOnly = ref(false);

const totalCount = computed(() => props.data?.data?.length || 0);
const criticalCount = computed(() => props.data?.data?.filter(r => (r.criticalIssues || 0) > 0).length || 0);

const filteredRows = computed(() => {
  let list = props.data?.data || [];

  if (criticalOnly.value) {
    list = list.filter(r => (r.criticalIssues || 0) > 0);
  }

  const q = searchQuery.value?.trim().toLowerCase();
  if (q) {
    list = list.filter(r => {
      const cab = formatCode(r.cab).toLowerCase();
      const kdtk = formatCode(r.kdtk).toLowerCase();
      return cab.includes(q) || kdtk.includes(q);
    });
  }

  return list;
});

function formatCode(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/^#+/, '').trim();
}

function formatDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' });
}
</script>

<style scoped>
.tab-toolbar-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.tab-search-box {
  min-width: 260px;
  flex: 0 1 auto;
}

.search-input {
  width: 100%;
  border-radius: 8px;
}

.filter-pills-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--surface-border, #e2e8f0);
  background: var(--surface-card, #ffffff);
  color: var(--text-color-secondary, #64748b);
  transition: all 0.18s ease;
}

.filter-pill:hover {
  background: var(--surface-hover, #f1f5f9);
  color: var(--text-color, #1e293b);
  border-color: var(--primary-color, #3b82f6);
}

.filter-pill.active {
  background: var(--primary-color, #3b82f6);
  border-color: var(--primary-color, #3b82f6);
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.25);
}

.pill-badge {
  padding: 0.1rem 0.45rem;
  border-radius: 10px;
  font-size: 0.72rem;
  font-weight: 700;
  background: var(--surface-200, rgba(0, 0, 0, 0.08));
  color: inherit;
}

.filter-pill.active .pill-badge {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

.filter-pill.pill-danger:hover,
.filter-pill.pill-danger.active {
  background: #ef4444;
  border-color: #ef4444;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25);
}
</style>
