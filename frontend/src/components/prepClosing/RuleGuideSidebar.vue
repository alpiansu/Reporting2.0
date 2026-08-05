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

<style scoped src="./RuleGuideSidebar.style.css"></style>
