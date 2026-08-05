<template>
  <div class="daily-reports-tab">
    <PageHeader
      title="Laporan Harian"
      subtitle="Generate dan kelola laporan harian per cabang"
      description="Klik judul laporan di bawah untuk meng-expand form parameter. Setiap laporan dapat diekspor langsung ke CSV."
    />

    <div class="daily-reports-container">
      <!-- Search bar -->
      <div class="daily-reports__search">
        <IconField>
          <InputIcon><i class="pi pi-search" /></InputIcon>
          <InputText
            v-model="searchQuery"
            placeholder="Cari laporan harian..."
            class="w-full"
          />
        </IconField>
      </div>

      <!-- Empty state -->
      <div
        v-if="filteredReports.length === 0 && !searchQuery"
        class="daily-reports__empty"
      >
        <i class="pi pi-inbox text-4xl text-color-secondary mb-3" />
        <p class="font-semibold">Belum ada laporan harian tersedia</p>
      </div>

      <!-- No result -->
      <div
        v-else-if="filteredReports.length === 0"
        class="daily-reports__no-result"
      >
        <i class="pi pi-search text-2xl text-color-secondary mb-2" />
        <p class="text-sm text-color-secondary">Tidak ada laporan yang cocup</p>
      </div>

        <!-- Accordion list -->
      <Accordion
        v-else
        :activeIndex="activeIndex"
        :multiple="false"
        class="daily-reports__accordion"
        @tab-open="onTabOpen"
        @tab-close="onTabClose"
      >
        <AccordionTab
          v-for="(report, index) in filteredReports"
          :key="report.id"
          :headerIcon="null"
          :class="{ 'report-item--active': activeIndex === index }"
        >
          <template #header>
            <div class="daily-report-header">
              <i :class="report.icon || 'pi pi-file'" class="daily-report-header__icon" />
              <div class="daily-report-header__info">
                <span class="daily-report-header__name">{{ report.name }}</span>
                <small v-if="report.subtitle" class="daily-report-header__subtitle">{{ report.subtitle }}</small>
              </div>
              <i
                class="pi"
                :class="activeIndex === index ? 'pi-chevron-up' : 'pi-chevron-down'"
              />
            </div>
          </template>

          <div class="daily-report-content">
            <CustabReportCard v-if="report.id === 'custab'" />
            <div v-else class="daily-report-placeholder">
              <p class="text-color-secondary">Form untuk laporan ini belum tersedia.</p>
            </div>
          </div>
        </AccordionTab>
      </Accordion>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import CustabReportCard from './CustabReportCard.vue';

// ─── Data-driven daily report definitions ─────────────────────────────────────
// Tambahkan laporan harian baru hanya dengan menambah entry di array ini.
// - id       : identifier unik, juga dipakai sebagai activeIndex
// - name     : nama tampil di header accordion
// - icon     : kelas ikon PrimeIcons (opsional, default pi pi-file)
// - subtitle : deskripsi singkat di bawah nama (opsional)
const dailyReports = [
  {
    id: 'custab',
    name: 'Laporan Sales Custab Custom (Harian)',
    icon: 'pi pi-file',
    subtitle: 'Laporan Sales Custab Per Cabang (Harian) dari DT WRC',
  },
];

// ─── State ─────────────────────────────────────────────────────────────────────
const searchQuery = ref('');
const activeIndex = ref(null);

// ─── Computed ──────────────────────────────────────────────────────────────────
const filteredReports = computed(() => {
  if (!searchQuery.value.trim()) return dailyReports;
  const q = searchQuery.value.toLowerCase();
  return dailyReports.filter(r =>
    r.name.toLowerCase().includes(q) ||
    (r.subtitle && r.subtitle.toLowerCase().includes(q))
  );
});

// ─── Handlers ──────────────────────────────────────────────────────────────────
const onTabOpen = (event) => {
  activeIndex.value = event.index;
};

const onTabClose = () => {
  activeIndex.value = null;
};

// Reset search ketika daftar berubah
watch(() => dailyReports, () => {
  searchQuery.value = '';
});
</script>

<style scoped src="./DailyReportsTab.style.css"></style>
