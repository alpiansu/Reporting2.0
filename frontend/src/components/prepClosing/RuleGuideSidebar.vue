<template>
  <span>
    <Sidebar v-model:visible="visible" position="right" class="p-sidebar-md rule-guide-sidebar">
      <template #header>
        <div class="sidebar-header">
          <div class="sidebar-icon">
            <i class="pi pi-book"></i>
          </div>
          <div>
            <h3 class="sidebar-title">Rule Engine Guide</h3>
            <p class="sidebar-subtitle">Panduan parameter dan operator</p>
          </div>
        </div>
      </template>

      <div class="guide-body">
        <p class="guide-intro">
          Panduan ini menjelaskan parameter, variabel konteks, dan operator validasi
          yang bisa Anda gunakan saat membuat SQL kueri rule Anda sendiri.
        </p>

        <Accordion :activeIndex="0" class="guide-accordion">
          <AccordionTab>
            <template #header>
              <div class="acc-tab">
                <span class="acc-num">1</span>
                <span class="acc-label">Interpolasi Variabel (Context Variables)</span>
              </div>
            </template>
            <p class="section-text">Variabel-variabel berikut akan diganti (interpolate) saat rule dieksekusi oleh backend engine.</p>
            <div class="var-list">
              <div class="var-item"><code>{cabang}</code><span>Kode cabang saat ini (misal: "G001")</span></div>
              <div class="var-item"><code>{kdtk}</code><span>Kode toko yang sedang di-screening (misal: "TMK1")</span></div>
              <div class="var-item"><code>{year}</code><span>Tahun dari periode yang dipilih (misal: "2024")</span></div>
              <div class="var-item"><code>{month}</code><span>Bulan dari periode yang dipilih (misal: "08")</span></div>
              <div class="var-item"><code>{periode}</code><span>Representasi periode (misal: "2408")</span></div>
              <div class="var-item"><code>{tblFilet}</code><span>Nama tabel filet toko (misal: "TMK12407")</span></div>
              <div class="var-item"><code>{tblFiletMaju}</code><span>Nama tabel filet maju toko (misal: "TMK12408")</span></div>
            </div>
          </AccordionTab>

          <AccordionTab>
            <template #header>
              <div class="acc-tab">
                <span class="acc-num">2</span>
                <span class="acc-label">Logic & Operator Validasi</span>
              </div>
            </template>
            <p class="section-text">Operator yang tersedia untuk membandingkan hasil Query SQL pertama dengan nilai 'Expected'.</p>
            <DataTable :value="operatorLegends" class="p-datatable-sm operator-table" responsiveLayout="scroll" :showGridlines="false">
              <Column field="op" header="Operator" style="width: 35%">
                <template #body="slotProps">
                  <code class="op-code">{{ slotProps.data.op }}</code>
                </template>
              </Column>
              <Column field="desc" header="Penjelasan" />
            </DataTable>
          </AccordionTab>

          <AccordionTab>
            <template #header>
              <div class="acc-tab">
                <span class="acc-num">3</span>
                <span class="acc-label">Tingkat Keparahan (Severity)</span>
              </div>
            </template>
            <p class="section-text">Tingkat keparahan saat rule mengalami kegagalan (Fail).</p>
            <div class="severity-list">
              <div class="severity-item">
                <Tag value="critical" severity="danger" />
                <span>Toko tidak akan siap closing (Gagal Keras).</span>
              </div>
              <div class="severity-item">
                <Tag value="high" severity="warning" />
                <span>Peringatan bahaya, tetapi opsional untuk diabaikan.</span>
              </div>
              <div class="severity-item">
                <Tag value="medium" severity="info" />
                <span>Perhatian (Info standar / temuan).</span>
              </div>
              <div class="severity-item">
                <Tag value="low" severity="success" />
                <span>Resiko sangat minim.</span>
              </div>
            </div>
          </AccordionTab>

          <AccordionTab>
            <template #header>
              <div class="acc-tab">
                <span class="acc-num">4</span>
                <span class="acc-label">Menggunakan Kueri Generik Kustom</span>
              </div>
            </template>
            <div class="custom-query-guide">
              <p>Untuk menambahkan Rule Kustom Bebas, gunakan Key: <code class="key-highlight">generic_sql_check</code>.</p>
              <p>
                Backend akan mengeksekusi field SQL Anda secara harfiah.
                <strong>ATURAN:</strong> Query pertama Anda (satu kolom, satu baris) harus mengembalikan suatu nilai
                yang nantinya dicocokkan dengan <em>Expected</em> melalui <em>Operator Validasi</em> yang dipilih.
              </p>

              <div class="example-card">
                <div class="example-label">Contoh SQL Rule:</div>
                <code class="example-code">SELECT COUNT(*) FROM master_barang WHERE status_aktif = 0;</code>
                <div class="example-label mt-2">Expected Value:</div>
                <code class="example-code">0</code>
                <div class="example-label mt-2">Operator:</div>
                <code class="example-code">EQUALS</code>
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
import Tag from 'primevue/tag';

const props = defineProps({
  visible: { type: Boolean, default: false }
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
/* === Header === */
.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sidebar-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  flex-shrink: 0;
}

.sidebar-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
}

.sidebar-subtitle {
  margin: 0;
  font-size: 0.75rem;
  color: #64748b;
}

/* === Guide Body === */
.guide-body {
  padding: 0 0.25rem;
}

.guide-intro {
  font-size: 0.85rem;
  color: #64748b;
  line-height: 1.55;
  margin-bottom: 1.25rem;
}

/* === Accordion Tab Header === */
.acc-tab {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.acc-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: #e0e7ff;
  color: #4f46e5;
  font-size: 0.72rem;
  font-weight: 700;
  flex-shrink: 0;
}

.acc-label {
  font-weight: 600;
  font-size: 0.88rem;
  color: #1e293b;
}

/* === Section Text === */
.section-text {
  font-size: 0.83rem;
  color: #64748b;
  line-height: 1.55;
  margin: 0 0 0.875rem 0;
}

/* === Variable List === */
.var-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.var-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.625rem;
  background: #f8fafc;
  border-radius: 0.375rem;
  font-size: 0.83rem;
}

.var-item code {
  font-weight: 700;
  color: #3b82f6;
  background: #eff6ff;
  padding: 0.15rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.78rem;
  white-space: nowrap;
  min-width: 100px;
  text-align: center;
}

.var-item span {
  color: #475569;
}

/* === Operator Table === */
.op-code {
  font-weight: 700;
  color: #7c3aed;
  background: #f5f3ff;
  padding: 0.15rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
}

:deep(.operator-table .p-datatable-tbody > tr > td) {
  padding: 0.5rem 0.625rem;
  font-size: 0.83rem;
}

:deep(.operator-table .p-datatable-thead > tr > th) {
  padding: 0.5rem 0.625rem;
  font-size: 0.78rem;
  font-weight: 600;
  background: #f8fafc;
}

/* === Severity List === */
.severity-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.severity-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.625rem;
  background: #f8fafc;
  border-radius: 0.375rem;
  font-size: 0.83rem;
  color: #475569;
}

/* === Custom Query Guide === */
.custom-query-guide {
  font-size: 0.85rem;
  color: #475569;
  line-height: 1.6;
}

.custom-query-guide p {
  margin: 0 0 0.5rem 0;
}

.key-highlight {
  font-weight: 700;
  color: #3b82f6;
  background: #eff6ff;
  padding: 0.15rem 0.5rem;
  border-radius: 0.25rem;
}

.example-card {
  margin-top: 0.75rem;
  padding: 0.875rem;
  background: #1e293b;
  border-radius: 0.5rem;
}

.example-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.example-code {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.78rem;
  color: #a5f3fc;
  word-break: break-all;
}

/* === Accordion overrides === */
:deep(.guide-accordion .p-accordion-content) {
  padding: 0.75rem 1rem 1rem;
}

:deep(.guide-accordion .p-accordion-header .p-accordion-header-link) {
  padding: 0.875rem 1rem;
}

.rule-guide-sidebar {
  width: 450px !important;
}

@media (max-width: 991px) {
  .rule-guide-sidebar {
    width: 100% !important;
  }
}
</style>
