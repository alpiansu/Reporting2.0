<template>
  <BaseModalDetail :show="show" title="Detail Penyesuaian" icon="pi pi-list" size="full" @close="$emit('close')"
    class="penyesuaian-detail-modal">
    <template #header-info>
      <div class="header-info-container">
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">
              <i class="pi pi-calendar"></i>
              <span>Periode</span>
            </div>
            <div class="info-value">{{ periode }}</div>
          </div>
          <div class="info-item">
            <div class="info-label">
              <i class="pi pi-building"></i>
              <span>Cabang</span>
            </div>
            <div class="info-value">{{ cab }}</div>
          </div>
          <div class="info-item">
            <div class="info-label">
              <i class="pi pi-shop"></i>
              <span>Toko</span>
            </div>
            <div class="info-value">{{ kdtk }}</div>
          </div>
          <div class="info-item">
            <div class="info-label">
              <i class="pi pi-dollar"></i>
              <span>Penyesuaian Toko</span>
            </div>
            <div class="info-value">{{ sesuai }}</div>
          </div>
        </div>
      </div>
    </template>
    <template #content>
      <div class="content-container">
        <BaseServerDataTableModal :title="'Detail Data'" :icon="'pi pi-table'" :fetcher="fetchDetail"
          :query="{ kdtk: kdtk, periode: periode }" :columns="columns" :autoColumns="true" :initialItemsPerPage="10"
          :minTableWidth="'1200px'" :maxHeight="'500px'" :searchable="true" :sortable="true"
          class="detail-table-wrapper">
          <template #cell-PRDCD="{ row, value }">
            <a href="#" class="prdcd-link" @click.prevent="openInspector(value, row.BEGBAL)">{{ value }}</a>
          </template>
        </BaseServerDataTableModal>

        <StoreItemInspectorDialog
          v-if="showInspector"
          :show="showInspector"
          :kdtk="kdtk"
          :prdcd="selectedPrdcd"
          :cab="cab"
          :periode="periode"
          :begbal="selectedBegbal"
          @close="showInspector = false"
        />
      </div>
    </template>
    <template #footer>
      <div class="footer-container">
        <button type="button" class="btn btn-cancel" @click="$emit('close')">
          <i class="pi pi-times"></i>
          <span>Tutup</span>
        </button>
      </div>
    </template>
  </BaseModalDetail>
</template>

<script setup>
import { ref } from 'vue'
import BaseModalDetail from '@/components/common/BaseModalDetail.vue'
import BaseServerDataTableModal from '@/components/common/BaseServerDataTableModal.vue'
import penyesuaianService from '@/services/penyesuaian.service.js'
import StoreItemInspectorDialog from './StoreItemInspectorDialog.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  periode: { type: String, required: true },
  cab: { type: String, required: true },
  kdtk: { type: String, required: true },
  sesuai: {type: String, required: true},
})

const emit = defineEmits(['close'])

const columns = ref([]);
const showInspector = ref(false);
const selectedPrdcd = ref('');
const selectedBegbal = ref('');

function openInspector(prdcd, begbal) {
  selectedPrdcd.value = prdcd;
  selectedBegbal.value = begbal;
  showInspector.value = true;
}

async function fetchDetail(params) {
  const res = await penyesuaianService.getStoreRecords(props.kdtk, props.periode, params);

  // Pastikan ambil data array yang valid
  const dataArray = Array.isArray(res?.data?.data)
    ? res.data.data
    : Array.isArray(res?.data)
      ? res.data
      : [];

  return {
    data: dataArray,
    total: Number(res?.data?.total) || Number(res?.total) || 0,
    page: Number(res?.data?.page) || Number(res?.page) || params.page || 1,
    limit: Number(res?.data?.limit) || Number(res?.limit) || params.limit || 10,
    totalPages: Number(res?.data?.totalPages) || Number(res?.totalPages) || 1
  };
}

</script>

<style scoped>
.penyesuaian-detail-modal {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header-info-container {
  padding: 1rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  padding: 0.5rem 0;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease-in-out;
}

.info-item:hover {
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.info-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-label i {
  color: #3b82f6;
  font-size: 0.875rem;
}

.info-value {
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}

.content-container {
  padding: 0.5rem 0;
}

.detail-table-wrapper {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.footer-container {
  display: flex;
  justify-content: flex-end;
  padding: 1rem 0;
}

.btn-cancel {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(107, 114, 128, 0.3);
  padding: 0.625rem 1.5rem;
  border: none;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-cancel:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(107, 114, 128, 0.4);
  background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
}

.prdcd-link {
  color: #2563eb;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
  font-family: monospace;
}

.prdcd-link:hover {
  color: #1d4ed8;
}

.btn-cancel:active {
  transform: translateY(0);
}

/* Responsive design */
@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .info-item {
    padding: 0.75rem;
  }
  
  .footer-container {
    justify-content: center;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .header-info-container {
    padding: 0.75rem 0;
  }
  
  .info-value {
    font-size: 0.875rem;
  }
  
  .btn {
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
  }
}
</style>
