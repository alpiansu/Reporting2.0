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

<style scoped src="./BranchTopItemsModal.style.css"></style>
