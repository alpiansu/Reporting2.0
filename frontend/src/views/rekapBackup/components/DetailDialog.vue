<template>
  <Dialog
    :visible="visible"
    modal
    :header="`Resume Data ${type} - Cabang ${cabang}`"
    :style="{ width: '85vw', maxWidth: '1200px' }"
    :closable="true"
    @update:visible="val => $emit('update:visible', val)"
    @show="loadResume"
  >
    <div v-if="viewMode === 'resume'">
      <div class="flex justify-content-between mb-3">
        <p class="text-sm text-color-secondary m-0">Menampilkan seluruh history data {{ type }} untuk cabang {{ cabang }}. Klik tombol info untuk melihat detail mendalam per periode.</p>
        <Button icon="pi pi-refresh" label="Refresh" class="p-button-text p-button-sm" @click="loadResume" />
      </div>

      <DataTable
        :value="resumeData"
        :loading="loading"
        responsive-layout="scroll"
        class="p-datatable-sm"
        empty-message="Tidak ada data ditemukan."
        striped-rows
      >
        <Column field="periode" header="Periode" sortable></Column>
        <Column field="jml_toko_aktif" header="Toko Aktif"></Column>
        <Column field="jml_cek" header="Jml Cek / Files"></Column>
        <Column v-if="type === 'bulanan'" field="jenis_file" header="Jenis File"></Column>
        <Column field="note" header="Note"></Column>
        <Column header="Aksi" style="width: 80px" bodyStyle="text-align: center">
          <template #body="{ data }">
            <Button
              icon="pi pi-info-circle"
              class="p-button-rounded p-button-info p-button-text"
              v-tooltip.top="'Lihat Detail Logs'"
              @click="openDeepDetail(data.periode)"
            />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Deep Detail View -->
    <div v-if="viewMode === 'detail'">
      <div class="flex align-items-center mb-3">
        <Button icon="pi pi-arrow-left" label="Kembali" class="p-button-text p-button-sm mr-3" @click="viewMode = 'resume'" />
        <h3 class="m-0 text-lg">Logs Detail - Periode {{ selectedPeriode }}</h3>
      </div>

      <DataTable
        :value="deepDetailData"
        :loading="loadingDeep"
        responsive-layout="scroll"
        class="p-datatable-sm"
        empty-message="Tidak ada detail logs ditemukan."
        striped-rows
        scrollable
        scrollHeight="400px"
      >
        <Column field="kdtk" header="KDTK" sortable></Column>
        <Column field="periode" header="Tanggal/Periode"></Column>
        <Column field="stat" header="Status"></Column>
        <Column field="jml_isi" header="Jml Isi"></Column>
        <Column field="note" header="Note"></Column>
        <Column field="path" header="Path Penyimpanan" style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></Column>
      </DataTable>
    </div>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue';
import axios from 'axios';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
  visible: { type: Boolean, default: false },
  cabang: { type: String, default: '' },
  type: { type: String, default: 'harian' }, // 'harian' or 'bulanan'
});

const emit = defineEmits(['update:visible']);
const toast = useToast();

const viewMode = ref('resume'); // 'resume' | 'detail'
const loading = ref(false);
const resumeData = ref([]);

const loadingDeep = ref(false);
const deepDetailData = ref([]);
const selectedPeriode = ref('');

const loadResume = async () => {
  if (!props.cabang) return;
  viewMode.value = 'resume';
  loading.value = true;
  try {
    const res = await axios.get(`/api/rekap-backup/${props.type}/resume/${props.cabang}`);
    resumeData.value = res.data;
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat resume data', life: 3000 });
  } finally {
    loading.value = false;
  }
};

const openDeepDetail = async (periode) => {
  selectedPeriode.value = periode;
  viewMode.value = 'detail';
  loadingDeep.value = true;
  try {
    // Note: old project passed kriteria. Usually 'stat' = 1 or 'OK'. We'll pass 'OK' as default or fetch all.
    // If backend expects specific criteria, we can pass it, or we pass 'All'.
    // In old project, what is kriteria? Let's assume 'OK' for now, or maybe the API handles it.
    const res = await axios.get(`/api/rekap-backup/${props.type}/detail/${props.cabang}/${periode}/OK`);
    deepDetailData.value = res.data;
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat detail logs', life: 3000 });
  } finally {
    loadingDeep.value = false;
  }
};

// Reset when closed
watch(() => props.visible, (val) => {
  if (!val) {
    setTimeout(() => {
      viewMode.value = 'resume';
      resumeData.value = [];
      deepDetailData.value = [];
    }, 300);
  }
});
</script>

<style scoped>
/* Optional styling */
</style>
