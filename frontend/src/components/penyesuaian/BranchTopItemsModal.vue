<template>
  <BaseModalDetail :show="show" :title="`Top Item Cabang ${cabang}`" icon="pi pi-sitemap" size="full" @close="$emit('close')"
    class="branch-top-modal">
    <template #header-info>
      <div class="header-info-container">
        <div class="info-grid">
          <div class="info-item"><span class="info-label">Cabang</span>
            <div class="info-value-row"><Tag :value="cabang" severity="info" /><span>{{ namaCabang }}</span></div>
          </div>
          <div class="info-item"><span class="info-label">Periode</span><span class="info-value">{{ periodeDisplay }}</span></div>
          <div class="info-item"><span class="info-label">Total Item</span><span class="info-value">{{ stats.totalRecords || 0 }}</span></div>
          <div class="info-item"><span class="info-label">Top 10</span><span class="info-value">{{ stats.topCount || 0 }}</span></div>
        </div>
      </div>
    </template>

    <template #content>
      <div v-if="loading" class="loading-section"><i class="pi pi-spin pi-spinner"></i><p>Memuat data...</p></div>
      <div v-else-if="error" class="error-section"><i class="pi pi-exclamation-triangle"></i><p>{{ error }}</p></div>
      <div v-else-if="!items.length" class="empty-section"><i class="pi pi-info-circle"></i><p>Tidak ada data</p></div>
      <div v-else class="content">
        <!-- Top 10 Items List -->
        <div class="top-section">
          <div class="section-label">
            <i class="pi pi-arrow-up chart-icon-positive"></i>
            <span>Top 10 Item Penyebab Penyesuaian</span>
            <Tag :value="`${items.length} item`" severity="info" />
          </div>
          <div class="top-items-list">
            <div v-for="(item, index) in items" :key="item.prdcd + item.kdtk" class="top-item-row"
              :class="{ 'item-positive': item.sesui >= 0, 'item-negative': item.sesui < 0 }">
              <div class="item-rank" :class="item.sesui >= 0 ? 'rank-pos' : 'rank-neg'">{{ index + 1 }}</div>
              <div class="item-info">
                <div class="item-name">{{ item.name }}</div>
                <div class="item-detail">
                  <span class="item-prdcd">{{ item.prdcd }}</span>
                  <span class="item-sep">•</span>
                  <span class="item-store">{{ item.kdtk }} - {{ item.storeName }}</span>
                </div>
              </div>
              <div class="item-value" :class="item.sesui >= 0 ? 'positive' : 'negative'">
                {{ formatCurrency(item.sesui) }}
              </div>
              <div class="item-bar-wrap">
                <div class="item-bar" :class="item.sesui >= 0 ? 'bar-pos' : 'bar-neg'"
                  :style="{ width: getBarWidth(item) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Explanation -->
        <div class="info-note">
          <i class="pi pi-info-circle"></i>
          <span>Menampilkan 10 item dengan nilai absolut penyesuaian terbesar di cabang {{ cabang }}.</span>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="footer-actions">
        <Button label="Tutup" icon="pi pi-times" severity="secondary" @click="$emit('close')" />
      </div>
    </template>
  </BaseModalDetail>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import BaseModalDetail from '@/components/common/BaseModalDetail.vue'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import penyesuaianService from '@/services/penyesuaian.service.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  cabang: { type: String, default: '' },
  namaCabang: { type: String, default: '' },
  periode: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const loading = ref(false)
const error = ref('')
const items = ref([])
const stats = ref({ totalRecords: 0, topCount: 0 })

const periodeDisplay = computed(() => {
  if (!props.periode) return ''
  const year = '20' + props.periode.slice(0, 2)
  const month = props.periode.slice(2)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
  return `${monthNames[parseInt(month) - 1] || month} ${year}`
})

const maxAbsValue = computed(() => {
  if (!items.value.length) return 1
  return Math.max(...items.value.map(i => Math.abs(i.sesui)))
})

function getBarWidth(item) {
  return (Math.abs(item.sesui) / maxAbsValue.value) * 100
}

function formatCurrency(value) {
  const num = Number(value) || 0
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(num)
}

async function fetchTopItems() {
  if (!props.cabang || !props.periode) return
  loading.value = true
  error.value = ''
  items.value = []
  try {
    const res = await penyesuaianService.getBranchTopItems(props.cabang, props.periode)
    const data = res?.data
    items.value = data?.data || []
    stats.value = {
      totalRecords: data?.totalRecords || 0,
      topCount: data?.total || 0,
    }
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

watch(() => props.show, (val) => {
  if (val) {
    items.value = []
    error.value = ''
    fetchTopItems()
  }
})
</script>

<style scoped>
.branch-top-modal { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
.header-info-container { padding: 1rem 0; }
.info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; }
.info-item {
  display: flex; flex-direction: column; gap: 0.35rem;
  padding: 0.65rem 0.85rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb;
}
.info-label { font-size: 0.65rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.03em; }
.info-value-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; font-weight: 600; }
.info-value { font-size: 0.9rem; font-weight: 700; color: #1e293b; }

.loading-section, .error-section, .empty-section {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 200px; color: #9ca3af; gap: 0.75rem; padding: 2rem;
}
.loading-section i, .error-section i, .empty-section i { font-size: 2rem; opacity: 0.6; }
.error-section { color: #ef4444; }

.content { padding: 0.5rem 0; display: flex; flex-direction: column; gap: 1rem; }

.section-label {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.9rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;
}
.chart-icon-positive { color: #10b981; }

.top-items-list { display: flex; flex-direction: column; gap: 0.35rem; }

.top-item-row {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.6rem 0.85rem; border-radius: 8px;
  border: 1px solid #f3f4f6; transition: all 0.15s ease;
}
.top-item-row:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.07); }

.item-positive { background: linear-gradient(90deg, #f0fdf4 0%, #ffffff 30%); border-left: 3px solid #10b981; }
.item-negative { background: linear-gradient(90deg, #fef2f2 0%, #ffffff 30%); border-left: 3px solid #ef4444; }

.item-rank {
  width: 26px; height: 26px; border-radius: 50%;
  font-size: 0.75rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.rank-pos { background: #d1fae5; color: #059669; }
.rank-neg { background: #fee2e2; color: #dc2626; }

.item-info { flex: 1; min-width: 0; }
.item-name { font-size: 0.85rem; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-detail { display: flex; align-items: center; gap: 0.35rem; font-size: 0.7rem; color: #6b7280; margin-top: 0.1rem; }
.item-prdcd { font-family: monospace; }
.item-sep { color: #d1d5db; }
.item-store { color: #6b7280; }

.item-value {
  font-size: 0.85rem; font-weight: 700; font-family: monospace;
  min-width: 130px; text-align: right; flex-shrink: 0;
}
.positive { color: #059669; }
.negative { color: #dc2626; }

.item-bar-wrap {
  width: 80px; height: 6px; background: #e5e7eb; border-radius: 3px;
  overflow: hidden; flex-shrink: 0;
}
.item-bar { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
.bar-pos { background: linear-gradient(90deg, #10b981, #059669); }
.bar-neg { background: linear-gradient(90deg, #ef4444, #dc2626); }

.info-note {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.65rem 1rem; background: #f0f9ff; border: 1px solid #bae6fd;
  border-radius: 8px; font-size: 0.8rem; color: #0369a1;
}

.footer-actions { display: flex; justify-content: flex-end; padding: 0.5rem 0; }

@media (max-width: 768px) {
  .info-grid { grid-template-columns: 1fr 1fr; }
  .top-item-row { flex-wrap: wrap; }
  .item-value { min-width: 100px; }
}
</style>
