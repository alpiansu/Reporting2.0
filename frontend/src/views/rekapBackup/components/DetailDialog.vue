<template>
  <Dialog
    :visible="visible"
    modal
    :style="{ width: '92vw', maxWidth: '1100px' }"
    :closable="true"
    @update:visible="val => $emit('update:visible', val)"
    @show="loadResume"
    class="detail-dialog"
  >
    <!-- Custom Header -->
    <template #header>
      <div class="flex align-items-center gap-3">
        <div class="dialog-header-icon">
          <i :class="['pi text-lg', type === 'harian' ? 'pi-calendar' : 'pi-briefcase']"></i>
        </div>
        <div class="flex flex-column">
          <span class="font-bold text-900" style="font-size: 1rem; line-height: 1.3; text-transform: capitalize;">
            Resume Data {{ type }}
          </span>
          <span class="text-500" style="font-size: 0.78rem;">Cabang: {{ cabang }}</span>
        </div>
      </div>
    </template>

    <!-- Content -->
    <div style="min-height: 400px; padding: 1.25rem 1.5rem;">
      <transition name="slide-fade" mode="out-in">

        <!-- ===== Resume View ===== -->
        <div v-if="viewMode === 'resume'" key="resume">
          <div class="resume-info-bar">
            <p>Menampilkan seluruh history data {{ type }} untuk cabang <strong>{{ cabang }}</strong>. Klik tombol panah untuk melihat detail logs per periode.</p>
            <Button
              icon="pi pi-refresh"
              label="Refresh"
              class="p-button-text p-button-sm"
              style="white-space: nowrap; font-weight: 600; height: 34px;"
              @click="loadResume"
              :loading="loading"
            />
          </div>

          <DataTable
            :value="resumeData"
            :loading="loading"
            responsiveLayout="scroll"
            stripedRows
            emptyMessage="Tidak ada data ditemukan."
            class="datatable-dialog"
            paginator
            :rows="8"
          >
            <Column field="periode" header="Periode" sortable style="width: 130px; font-weight: 700;">
              <template #body="{ data }">
                <span style="font-weight: 700; color: #1e293b;">{{ data.periode }}</span>
              </template>
            </Column>

            <Column field="jml_toko_aktif" header="Toko Aktif" style="width: 120px; text-align: center;">
              <template #body="{ data }">
                <Tag severity="info" :value="String(data.jml_toko_aktif ?? '-')" style="min-width: 48px; justify-content: center;" />
              </template>
            </Column>

            <Column field="jml_cek" header="Cek / Files" style="width: 120px; text-align: center;">
              <template #body="{ data }">
                <Tag severity="success" :value="String(data.jml_cek ?? '-')" style="min-width: 48px; justify-content: center;" />
              </template>
            </Column>

            <Column v-if="type === 'bulanan'" field="jenis_file" header="Jenis File" style="width: 120px;"></Column>

            <Column field="note" header="Catatan" style="min-width: 180px;">
              <template #body="{ data }">
                <span style="font-size: 0.82rem; color: #64748b; line-height: 1.5;">{{ data.note || '—' }}</span>
              </template>
            </Column>

            <Column header="" style="width: 60px; text-align: center;">
              <template #body="{ data }">
                <Button
                  icon="pi pi-chevron-right"
                  class="p-button-rounded p-button-primary p-button-sm p-button-outlined"
                  style="width: 34px; height: 34px;"
                  v-tooltip.left="'Lihat Detail Logs'"
                  @click="openDeepDetail(data.periode)"
                />
              </template>
            </Column>
          </DataTable>
        </div>

        <!-- ===== Deep Detail View ===== -->
        <div v-else-if="viewMode === 'detail'" key="detail">
          <div class="detail-header">
            <div class="detail-header-left">
              <Button
                icon="pi pi-arrow-left"
                label="Kembali"
                class="p-button-outlined p-button-secondary detail-back-btn"
                @click="viewMode = 'resume'"
              />
              <div class="detail-title-block">
                <h3>Log Detail Backup</h3>
                <span>Periode: {{ selectedPeriode }}</span>
              </div>
            </div>
            <div class="detail-search-wrapper">
              <i class="pi pi-search detail-search-icon"></i>
              <InputText
                v-model="deepSearch"
                placeholder="Cari KDTK atau keterangan..."
                class="detail-search-input"
              />
            </div>
          </div>

          <DataTable
            :value="filteredDeepDetail"
            :loading="loadingDeep"
            responsiveLayout="scroll"
            stripedRows
            emptyMessage="Tidak ada log ditemukan."
            class="datatable-dialog"
            scrollable
            scrollHeight="420px"
          >
            <Column field="kdtk" header="KDTK" sortable style="width: 110px;">
              <template #body="{ data }">
                <span style="font-weight: 700; color: var(--primary-color); font-size: 0.875rem;">{{ data.kdtk }}</span>
              </template>
            </Column>

            <Column field="periode" header="Tanggal / Periode" sortable style="width: 155px;">
              <template #body="{ data }">
                <span style="font-size: 0.85rem; color: #334155;">{{ data.periode }}</span>
              </template>
            </Column>

            <Column field="stat" header="Status" style="width: 100px;">
              <template #body="{ data }">
                <Tag :severity="getStatusSeverity(data.stat)" :value="data.stat || '-'" style="min-width: 60px; justify-content: center;" />
              </template>
            </Column>

            <Column field="jml_isi" header="Isi" style="width: 70px; text-align: center;">
              <template #body="{ data }">
                <span style="font-size: 0.85rem;">{{ data.jml_isi ?? '-' }}</span>
              </template>
            </Column>

            <Column field="note" header="Keterangan" style="min-width: 180px;">
              <template #body="{ data }">
                <span style="font-size: 0.8rem; color: #64748b;">{{ data.note || '—' }}</span>
              </template>
            </Column>

            <Column field="path" header="Path Penyimpanan" style="min-width: 300px;">
              <template #body="{ data }">
                <span class="path-cell" v-tooltip.top="data.path || ''">{{ data.path || '—' }}</span>
              </template>
            </Column>
          </DataTable>
        </div>

      </transition>
    </div>
  </Dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { rekapBackupService } from '@/services';
import Tag from 'primevue/tag';

const props = defineProps({
  visible: { type: Boolean, default: false },
  cabang: { type: String, default: '' },
  type: { type: String, default: 'harian' },
});

const emit = defineEmits(['update:visible']);
const toast = useToast();

const viewMode = ref('resume');
const loading = ref(false);
const resumeData = ref([]);

const loadingDeep = ref(false);
const deepDetailData = ref([]);
const selectedPeriode = ref('');
const deepSearch = ref('');

const filteredDeepDetail = computed(() => {
  if (!deepSearch.value) return deepDetailData.value;
  const q = deepSearch.value.toLowerCase();
  return deepDetailData.value.filter(d =>
    d.kdtk?.toLowerCase().includes(q) ||
    d.note?.toLowerCase().includes(q)
  );
});

const loadResume = async () => {
  if (!props.cabang) return;
  viewMode.value = 'resume';
  loading.value = true;
  try {
    const data = await rekapBackupService.getResume(props.type, props.cabang);
    resumeData.value = Array.isArray(data) ? data : [];
  } catch {
    resumeData.value = [];
    toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat resume data', life: 3000 });
  } finally {
    loading.value = false;
  }
};

const openDeepDetail = async (periode) => {
  selectedPeriode.value = periode;
  viewMode.value = 'detail';
  loadingDeep.value = true;
  deepSearch.value = '';
  try {
    const data = await rekapBackupService.getDetail(props.type, props.cabang, periode, 'OK');
    deepDetailData.value = Array.isArray(data) ? data : [];
  } catch {
    deepDetailData.value = [];
    toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat detail logs', life: 3000 });
  } finally {
    loadingDeep.value = false;
  }
};

const getStatusSeverity = (stat) => {
  if (!stat) return 'secondary';
  const s = stat.toLowerCase();
  if (s === 'ok' || s === '1' || s === 'success') return 'success';
  if (s === 'pending' || s === 'process') return 'warning';
  return 'danger';
};

watch(() => props.visible, (val) => {
  if (!val) {
    setTimeout(() => {
      viewMode.value = 'resume';
      resumeData.value = [];
      deepDetailData.value = [];
      deepSearch.value = '';
    }, 300);
  }
});
</script>

<style scoped>
@import './DetailDialog.style.css';

/* DataTable deep overrides — butuh :deep() scoped context */
:deep(.datatable-dialog .p-datatable-thead > tr > th) {
  background: #f8fafc;
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.75rem 1rem;
  border-bottom: 2px solid #e2e8f0;
}

:deep(.datatable-dialog .p-datatable-tbody > tr > td) {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f8fafc;
  vertical-align: middle;
}

:deep(.datatable-dialog .p-datatable-tbody > tr) {
  transition: background-color 0.15s;
}

:deep(.datatable-dialog .p-datatable-tbody > tr:hover) {
  background-color: #f8fafc !important;
}

:deep(.datatable-dialog .p-paginator) {
  border-top: 1px solid #f1f5f9;
  padding: 0.75rem 1rem;
  background: #fafafa;
}

:deep(.detail-dialog .p-dialog-header) {
  padding: 1.25rem 1.5rem 1rem;
  border-bottom: 1px solid #f1f5f9;
}

:deep(.detail-dialog .p-dialog-content) {
  padding: 0;
}
</style>
