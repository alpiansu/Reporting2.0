<template>
  <span>
    <Sidebar v-model:visible="visible" position="right" class="p-sidebar-md rule-guide-sidebar">
    <template #header>
      <div class="sidebar-header">
        <i class="pi pi-book text-2xl text-primary"></i>
        <h2 class="m-0">Buku Panduan & Legends Rule</h2>
      </div>
    </template>
    
    <div class="p-fluid">
      <p class="description mb-4 text-gray-600">
        Panduan ini menjelaskan parameter, variabel konteks, dan operator validasi 
        yang bisa Anda gunakan saat membuat SQL kueri rule Anda sendiri.
      </p>

      <Accordion :activeIndex="0">
        <AccordionTab header="1. Interpolasi Variabel (Context Variables)">
          <p class="text-sm">Variabel-variabel berikut akan diganti (interpolate) saat rule dieksekusi oleh backend engine.</p>
          <ul class="legend-list">
            <li><strong><code>{cabang}</code></strong> : Kode cabang saat ini (misal: "G001")</li>
            <li><strong><code>{kdtk}</code></strong> : Kode toko yang sedang di-screening (misal: "TMK1")</li>
            <li><strong><code>{year}</code></strong> : Tahun dari periode yang dipilih (misal: "2024")</li>
            <li><strong><code>{month}</code></strong> : Bulan dari periode yang dipilih (misal: "08")</li>
            <li><strong><code>{periode}</code></strong> : Representasi periode (misal: "2408")</li>
            <li><strong><code>{tblFilet}</code></strong> : Nama tabel filet toko (misal: "TMK12407")</li>
            <li><strong><code>{tblFiletMaju}</code></strong> : Nama tabel filet maju toko (misal: "TMK12408")</li>
          </ul>
        </AccordionTab>

        <AccordionTab header="2. Logic & Operator Validasi">
          <p class="text-sm">Operator yang tersedia untuk membandingkan hasil Query SQL pertama dengan nilai 'Expected' (Nilai Harapan).</p>
          <DataTable :value="operatorLegends" class="p-datatable-sm" responsiveLayout="scroll">
            <Column field="op" header="Operator">
              <template #body="slotProps">
                <Badge :value="slotProps.data.op" severity="info" />
              </template>
            </Column>
            <Column field="desc" header="Penjelasan" />
          </DataTable>
        </AccordionTab>

        <AccordionTab header="3. Tingkat Keparahan (Severity)">
          <p class="text-sm">Tingkat keparahan saat rule mengalami kegagalan (Fail).</p>
          <ul class="legend-list">
            <li>
              <Badge value="critical" severity="danger" /> 
              <span>Toko tidak akan siap closing (Gagal Keras).</span>
            </li>
            <li>
              <Badge value="high" severity="warning" /> 
              <span>Peringatan bahaya, tetapi opsional untuk dizonk.</span>
            </li>
            <li>
              <Badge value="medium" severity="info" /> 
              <span>Perhatian (Info standar / temuan).</span>
            </li>
            <li>
              <Badge value="low" severity="success" /> 
              <span>Resiko sangat minim.</span>
            </li>
          </ul>
        </AccordionTab>

        <AccordionTab header="4. Menggunakan Kueri Generik Kustom">
          <div class="text-sm line-height-3">
            <p>Untuk menambahkan *Rule Kustom Bebas*, gunakan Key: <code class="text-primary font-bold">generic_sql_check</code>.</p>
            <p>
              Dengan ini, backend akan mengeksekusi field SQL Anda secara harfiah. 
              <strong>ATURAN:</strong> Query pertama Anda (satu kolom, satu baris) harus mengembalikan suatu nilai yang nantinya dicocokkan dengan <em>Expected</em> melalui <em>Operator Validasi</em> yang dipilih.
            </p>
            <div class="surface-100 p-2 mt-2 border-round">
              <div class="font-bold">Contoh SQL Rule:</div>
              <code class="block text-xs">SELECT COUNT(*) FROM master_barang WHERE status_aktif = 0;</code>
              <div class="font-bold mt-2">Expected Value:</div>
              <code class="block text-xs">0</code>
              <div class="font-bold mt-2">Operator:</div>
              <code class="block text-xs">EQUALS</code>
            </div>
          </div>
        </AccordionTab>

      </Accordion>
    </div>
  </Sidebar>
  </span>
</template>

<script setup>
import { ref, computed } from 'vue';
import Sidebar from 'primevue/sidebar';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Badge from 'primevue/badge';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:visible']);

const visible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
});

const operatorLegends = ref([
  { op: 'EQUALS', desc: 'Harus sama persis (Cek Value)' },
  { op: 'NOT_EQUALS', desc: 'Tidak Boleh Sama Dengan' },
  { op: 'IS_NULL', desc: 'Harus Kosong (NULL)' },
  { op: 'IS_NOT_NULL', desc: 'Tidak Boleh Kosong' },
  { op: 'GREATER_THAN', desc: 'Hasil SQL > Expected' },
  { op: 'LESS_THAN', desc: 'Hasil SQL < Expected' },
  { op: 'IN', desc: 'Hasil SQL terdapat dalam sekumpulan Expected (pisahkan koma)' },
]);
</script>

<style scoped>
.rule-guide-sidebar {
  width: 450px !important;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.legend-list {
  list-style-type: none;
  padding-left: 0;
  margin: 0;
}

.legend-list li {
  margin-bottom: 0.8rem;
  padding: 0.5rem;
  background: var(--surface-hover);
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

@media (max-width: 991px) {
  .rule-guide-sidebar {
    width: 100% !important;
  }
}
</style>
