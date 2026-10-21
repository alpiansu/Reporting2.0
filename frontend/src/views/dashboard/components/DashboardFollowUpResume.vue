<template>
  <div class="followup-resume-section mb-5">
    <!-- Header Resume & Periode Filter -->
    <div class="resume-header-card">
      <div class="header-left">
        <div class="header-icon-box">
          <i class="pi pi-bell"></i>
        </div>
        <div>
          <h2 class="resume-title">Resume Tindak Lanjut & Kesiapan Closing</h2>
          <p class="resume-subtitle">
            Ringkasan status penyesuaian toko, selisih virtual margin based, dan kesiapan storage server closing per cabang
          </p>
        </div>
      </div>
      <div class="header-right">
        <div class="periode-control">
          <span class="periode-label"><i class="pi pi-calendar mr-1"></i> Periode:</span>
          <Dropdown
            v-model="selectedPeriode"
            :options="periodeOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Pilih Periode"
            class="periode-dropdown"
            @change="loadResumeData"
          />
        </div>
        <Button
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          v-tooltip.top="'Refresh Resume'"
          @click="loadResumeData"
          :loading="loading"
        />
      </div>
    </div>

    <!-- 3 KPI Cards Ringkasan -->
    <div class="kpi-grid">
      <!-- Card 1: Penyesuaian Toko -->
      <div class="kpi-card card-penyesuaian" :class="{ 'has-alert': (kpi.penyesuaian?.unfollowedStores || 0) > 0 }">
        <div class="kpi-card-header">
          <div class="kpi-icon-wrapper icon-penyesuaian">
            <i class="pi pi-sliders-h"></i>
          </div>
          <div class="kpi-badge-wrap">
            <Tag
              v-if="(kpi.penyesuaian?.fantasticCount || 0) > 0"
              severity="danger"
              value="Fantastis!"
              icon="pi pi-exclamation-triangle"
              class="cursor-pointer"
              @click="openFantasticDialog"
            />
            <Tag
              v-else-if="(kpi.penyesuaian?.unfollowedStores || 0) === 0"
              severity="success"
              value="Selesai"
              icon="pi pi-check-circle"
            />
          </div>
        </div>
        <div class="kpi-card-body">
          <div class="kpi-label">Penyesuaian Belum FU</div>
          <div v-if="loading" class="my-2">
            <Skeleton width="60%" height="2rem" />
          </div>
          <div v-else class="kpi-main-stat">
            <span class="stat-number">{{ kpi.penyesuaian?.unfollowedStores ?? 0 }}</span>
            <span class="stat-unit">Toko</span>
          </div>
          <div class="kpi-sub-stat">
            <span class="sub-label">Total Akumulasi Selisih:</span>
            <span class="sub-value">{{ formatCurrency(kpi.penyesuaian?.totalNominalUnfollowed) }}</span>
          </div>
          <div class="kpi-accumulation-hint">
            <i class="pi pi-info-circle mr-1"></i>
            <span>Akumulasi dari {{ kpi.penyesuaian?.unfollowedStores ?? 0 }} toko belum difollow-up</span>
          </div>
          <div class="kpi-stats-grid" v-if="(kpi.penyesuaian?.unfollowedStores || 0) > 0">
            <div class="kpi-mini-stat" v-tooltip.top="'Rata-rata selisih per toko belum FU'">
              <span class="mini-label">Rata-rata:</span>
              <span class="mini-val">{{ formatCurrency(kpi.penyesuaian?.avgNominalUnfollowed) }}</span>
            </div>
            <div class="kpi-mini-stat" v-tooltip.top="`Toko selisih tertinggi: ${kpi.penyesuaian?.maxStore?.kdtk || '—'}`">
              <span class="mini-label">Tertinggi (Max):</span>
              <span class="mini-val text-red-600 font-bold">{{ formatCurrency(kpi.penyesuaian?.maxNominalUnfollowed) }}</span>
            </div>
            <div class="kpi-mini-stat" v-tooltip.top="`Toko selisih terendah: ${kpi.penyesuaian?.minStore?.kdtk || '—'}`">
              <span class="mini-label">Terendah (Min):</span>
              <span class="mini-val text-emerald-600 font-semibold">{{ formatCurrency(kpi.penyesuaian?.minNominalUnfollowed) }}</span>
            </div>
          </div>
          <div v-if="(kpi.penyesuaian?.fantasticCount || 0) > 0" class="fantastic-notice" @click="openFantasticDialog">
            <i class="pi pi-bolt mr-1"></i>
            <span>{{ kpi.penyesuaian.fantasticCount }} toko bernilai fantastis (≥ Rp 1 Jt)</span>
            <i class="pi pi-angle-right ml-1"></i>
          </div>
        </div>
        <div class="kpi-card-footer">
          <button class="footer-link-btn" @click="navigateTo('/penyesuaian')">
            <span>Buka Penyesuaian</span>
            <i class="pi pi-arrow-right"></i>
          </button>
        </div>
      </div>

      <!-- Card 2: Saldo Virtual Margin Based -->
      <div class="kpi-card card-virtual" :class="{ 'has-alert': (kpi.virtualMrg?.unfollowedItems || 0) > 0 }">
        <div class="kpi-card-header">
          <div class="kpi-icon-wrapper icon-virtual">
            <i class="pi pi-shopping-bag"></i>
          </div>
          <div class="kpi-badge-wrap">
            <Tag
              v-if="(kpi.virtualMrg?.unfollowedItems || 0) === 0"
              severity="success"
              value="Aman"
              icon="pi pi-check-circle"
            />
            <Tag
              v-else
              severity="warn"
              :value="`${kpi.virtualMrg?.unfollowedShops || 0} Toko`"
            />
          </div>
        </div>
        <div class="kpi-card-body">
          <div class="kpi-label">Saldo Virtual Belum FU</div>
          <div v-if="loading" class="my-2">
            <Skeleton width="60%" height="2rem" />
          </div>
          <div v-else class="kpi-main-stat">
            <span class="stat-number">{{ kpi.virtualMrg?.unfollowedItems ?? 0 }}</span>
            <span class="stat-unit">Item</span>
          </div>
          <div class="kpi-sub-stat">
            <span class="sub-label">Toko Terdampak:</span>
            <span class="sub-value">{{ kpi.virtualMrg?.unfollowedShops ?? 0 }} Toko</span>
          </div>
          <div class="kpi-info-hint">
            <i class="pi pi-info-circle mr-1"></i>
            <span>Selisih saldo item virtual margin based</span>
          </div>
        </div>
        <div class="kpi-card-footer">
          <button class="footer-link-btn" @click="navigateTo('/rekon-virtual-margin-based')">
            <span>Buka Saldo Virtual</span>
            <i class="pi pi-arrow-right"></i>
          </button>
        </div>
      </div>

      <!-- Card 3: Checklist Closing Server (Space HDD) -->
      <div class="kpi-card card-closing" :class="{ 'has-alert': (kpi.closingSpace?.totalNeedsFu || 0) > 0 }">
        <div class="kpi-card-header">
          <div class="kpi-icon-wrapper icon-closing">
            <i class="pi pi-server"></i>
          </div>
          <div class="kpi-badge-wrap">
            <Tag
              v-if="(kpi.closingSpace?.criticalUnfollowed || 0) > 0"
              severity="danger"
              :value="`${kpi.closingSpace.criticalUnfollowed} Kritis`"
              icon="pi pi-exclamation-triangle"
            />
            <Tag
              v-else-if="(kpi.closingSpace?.warningUnfollowed || 0) > 0"
              severity="warn"
              :value="`${kpi.closingSpace.warningUnfollowed} Warning`"
            />
            <Tag
              v-else-if="(kpi.closingSpace?.uncheckedBranches || 0) > 0"
              severity="secondary"
              :value="`${kpi.closingSpace.uncheckedBranches} Belum Cek`"
            />
            <Tag
              v-else
              severity="success"
              value="Siap Closing"
              icon="pi pi-check-circle"
            />
          </div>
        </div>
        <div class="kpi-card-body">
          <div class="kpi-label">Storage Server Perlu FU</div>
          <div v-if="loading" class="my-2">
            <Skeleton width="60%" height="2rem" />
          </div>
          <div v-else class="kpi-main-stat">
            <span class="stat-number">{{ kpi.closingSpace?.totalNeedsFu ?? 0 }}</span>
            <span class="stat-unit">Cabang</span>
          </div>
          <div class="kpi-sub-breakdown">
            <span class="badge-mini bg-red" v-tooltip.top="'Storage server tersisa < 10 GB & belum FU'">
              {{ kpi.closingSpace?.criticalUnfollowed ?? 0 }} Kritis (&lt;10G)
            </span>
            <span class="badge-mini bg-amber" v-tooltip.top="'Storage server tersisa < 30 GB & belum FU'">
              {{ kpi.closingSpace?.warningUnfollowed ?? 0 }} Warning (&lt;30G)
            </span>
            <span class="badge-mini bg-gray" v-tooltip.top="'Belum dilakukan pengecekan disk space'">
              {{ kpi.closingSpace?.uncheckedBranches ?? 0 }} Belum Cek
            </span>
          </div>
        </div>
        <div class="kpi-card-footer">
          <button class="footer-link-btn" @click="navigateTo('/prep-closing-server')">
            <span>Buka Checklist Closing</span>
            <i class="pi pi-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Matriks Attention Cabang -->
    <div class="branch-matrix-card">
      <div class="matrix-card-header">
        <div class="matrix-header-left">
          <span class="matrix-title">
            <i class="pi pi-list-check mr-2"></i>
            Matriks Kasus Per Cabang
          </span>
          <span class="matrix-subtitle">
            Klik nama cabang atau tombol terkait untuk langsung menuju halaman penanganan
          </span>
        </div>

        <div class="matrix-header-right">
          <!-- Filter Tabs -->
          <div class="filter-pills">
            <button
              type="button"
              class="pill-btn"
              :class="{ active: activeFilter === 'needsAttention' }"
              @click="activeFilter = 'needsAttention'"
            >
              Perlu FU Saja ({{ countAttention }})
            </button>
            <button
              type="button"
              class="pill-btn"
              :class="{ active: activeFilter === 'all' }"
              @click="activeFilter = 'all'"
            >
              Semua Cabang ({{ branches.length }})
            </button>
            <button
              type="button"
              class="pill-btn"
              :class="{ active: activeFilter === 'penyesuaian' }"
              @click="activeFilter = 'penyesuaian'"
            >
              Penyesuaian ({{ countPenyesuaian }})
            </button>
            <button
              type="button"
              class="pill-btn"
              :class="{ active: activeFilter === 'virtual' }"
              @click="activeFilter = 'virtual'"
            >
              Saldo Virtual ({{ countVirtual }})
            </button>
            <button
              type="button"
              class="pill-btn"
              :class="{ active: activeFilter === 'space' }"
              @click="activeFilter = 'space'"
            >
              Space Closing ({{ countSpace }})
            </button>
          </div>

          <!-- Quick Search -->
          <IconField iconPosition="left" class="search-field">
            <InputIcon class="pi pi-search" />
            <InputText
              v-model="searchQuery"
              placeholder="Cari cabang..."
              class="p-inputtext-sm search-input"
            />
          </IconField>
        </div>
      </div>

      <!-- Table Matriks -->
      <DataTable
        :value="filteredBranches"
        :loading="loading"
        responsiveLayout="scroll"
        class="matrix-datatable"
        paginator
        :rows="10"
        :rowsPerPageOptions="[10, 20, 50]"
        emptyMessage="Tidak ada data cabang yang sesuai kriteria filter"
      >
        <!-- Kolom Cabang -->
        <Column header="Cabang" style="min-width: 180px">
          <template #body="{ data }">
            <div class="branch-cell">
              <span class="branch-code-badge">{{ data.cabang }}</span>
              <div class="branch-info">
                <span class="branch-name">{{ data.namaCabang }}</span>
                <span v-if="data.needsAttention" class="attention-indicator">
                  <span class="pulse-dot"></span> Perlu FU
                </span>
              </div>
            </div>
          </template>
        </Column>

        <!-- Kolom Penyesuaian -->
        <Column header="Penyesuaian Toko" style="min-width: 260px">
          <template #body="{ data }">
            <div v-if="data.penyesuaian?.unfollowedStores > 0" class="case-detail-box">
              <div class="case-line">
                <span class="tag-warn">{{ data.penyesuaian.unfollowedStores }} Toko Belum FU</span>
                <span v-if="data.penyesuaian.fantasticCount > 0" class="tag-fantastic" v-tooltip.top="'Ada selisih ≥ Rp 1 Jt!'">
                  <i class="pi pi-bolt"></i> {{ data.penyesuaian.fantasticCount }} Fantastis
                </span>
              </div>
              <div class="case-nominal">
                Total Akumulasi: <strong>{{ formatCurrency(data.penyesuaian.totalNominalUnfollowed) }}</strong>
              </div>
              <div class="case-stats-row">
                <span class="stat-pill">
                  Rata-rata: <strong>{{ formatCurrency(data.penyesuaian.avgNominalUnfollowed) }}</strong> / toko
                </span>
                <span class="stat-pill text-muted">
                  Rentang: Min {{ formatCurrency(data.penyesuaian.minNominalUnfollowed) }} ~ Max {{ formatCurrency(data.penyesuaian.maxNominalUnfollowed) }}
                </span>
              </div>
              <button
                class="direct-link-btn"
                @click="navigateTo(`/penyesuaian?cabang=${data.cabang}&periode=${selectedPeriode}`)"
              >
                Tindak Lanjut <i class="pi pi-external-link"></i>
              </button>
            </div>
            <div v-else class="case-safe">
              <i class="pi pi-check text-green-500 mr-1"></i>
              <span>Semua FU / Tidak ada selisih</span>
            </div>
          </template>
        </Column>

        <!-- Kolom Saldo Virtual Margin Based -->
        <Column header="Saldo Virtual Mrg" style="min-width: 200px">
          <template #body="{ data }">
            <div v-if="data.virtualMrg?.unfollowedItems > 0" class="case-detail-box">
              <div class="case-line">
                <span class="tag-orange">{{ data.virtualMrg.unfollowedItems }} Item Belum FU</span>
              </div>
              <div class="case-nominal">
                Tersebar di <strong>{{ data.virtualMrg.unfollowedShops }} Toko</strong>
              </div>
              <button
                class="direct-link-btn"
                @click="navigateTo(`/rekon-virtual-margin-based?cabang=${data.cabang}&periode=${selectedPeriode}`)"
              >
                Tindak Lanjut <i class="pi pi-external-link"></i>
              </button>
            </div>
            <div v-else class="case-safe">
              <i class="pi pi-check text-green-500 mr-1"></i>
              <span>Aman</span>
            </div>
          </template>
        </Column>

        <!-- Kolom Space Server Closing -->
        <Column header="Kesiapan Space Server" style="min-width: 220px">
          <template #body="{ data }">
            <div class="case-detail-box">
              <div class="space-status-line">
                <!-- Status Tag -->
                <span v-if="data.closingSpace?.status === 'critical'" class="tag-danger">
                  <i class="pi pi-exclamation-triangle mr-1"></i> Kritis
                </span>
                <span v-else-if="data.closingSpace?.status === 'warning'" class="tag-amber">
                  <i class="pi pi-exclamation-circle mr-1"></i> Warning
                </span>
                <span v-else-if="data.closingSpace?.status === 'unchecked'" class="tag-secondary">
                  Belum Cek
                </span>
                <span v-else class="tag-success">
                  <i class="pi pi-check mr-1"></i> Aman
                </span>

                <!-- Sisa GB -->
                <span class="space-gb-value">
                  {{ data.closingSpace?.freeSpace || (data.closingSpace?.freeSpaceGb ? `${data.closingSpace.freeSpaceGb} GB` : '—') }}
                </span>
              </div>

              <!-- FU Info -->
              <div class="space-fu-info">
                <template v-if="data.closingSpace?.needsFu">
                  <span class="text-rose-600 font-semibold"><i class="pi pi-clock mr-1"></i> Belum FU Server</span>
                </template>
                <template v-else-if="data.closingSpace?.hasFu">
                  <span class="text-emerald-600 text-xs" :title="data.closingSpace.fu">
                    <i class="pi pi-check-circle mr-1"></i> FU: {{ data.closingSpace.fu }}
                  </span>
                </template>
                <template v-else>
                  <span class="text-gray-400 text-xs">Kapasitas aman</span>
                </template>
              </div>

              <button
                v-if="data.closingSpace?.needsFu"
                class="direct-link-btn"
                @click="navigateTo(`/prep-closing-server?periode=${selectedPeriode}`)"
              >
                Cek Storage Server <i class="pi pi-external-link"></i>
              </button>
            </div>
          </template>
        </Column>

        <!-- Kolom Aksi Cepat -->
        <Column header="Navigasi" style="min-width: 120px; text-align: center">
          <template #body="{ data }">
            <div class="action-btn-group">
              <Button
                icon="pi pi-sliders-h"
                rounded
                text
                severity="secondary"
                size="small"
                v-tooltip.top="'Buka Penyesuaian Cabang Ini'"
                @click="navigateTo(`/penyesuaian?cabang=${data.cabang}&periode=${selectedPeriode}`)"
              />
              <Button
                icon="pi pi-shopping-bag"
                rounded
                text
                severity="secondary"
                size="small"
                v-tooltip.top="'Buka Saldo Virtual Cabang Ini'"
                @click="navigateTo(`/rekon-virtual-margin-based?cabang=${data.cabang}&periode=${selectedPeriode}`)"
              />
              <Button
                icon="pi pi-server"
                rounded
                text
                severity="secondary"
                size="small"
                v-tooltip.top="'Buka Checklist Closing'"
                @click="navigateTo(`/prep-closing-server?periode=${selectedPeriode}`)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Modal Dialog Toko Nilai Fantastis -->
    <Dialog
      v-model:visible="showFantasticDialog"
      header="Daftar Toko Penyesuaian Nilai Fantastis (≥ Rp 1.000.000 Belum FU)"
      :modal="true"
      :style="{ width: '70vw', maxWidth: '850px' }"
      class="p-dialog-custom"
    >
      <div class="dialog-body">
        <p class="dialog-desc">
          Toko-toko berikut memiliki nilai selisih penyesuaian yang fantastis (nominal absolut ≥ Rp 1.000.000) dan belum dilengkapi catatan/tindak lanjut pada periode <strong>{{ selectedPeriode }}</strong>:
        </p>

        <DataTable
          :value="kpi.penyesuaian?.fantasticStores || []"
          responsiveLayout="scroll"
          class="fantastic-datatable"
          paginator
          :rows="5"
        >
          <Column field="cabang" header="Cabang" style="width: 100px">
            <template #body="{ data }">
              <span class="branch-code-badge">{{ data.cabang }}</span>
            </template>
          </Column>
          <Column field="kdtk" header="Kode Toko" style="width: 110px">
            <template #body="{ data }">
              <span class="font-mono font-bold">{{ data.kdtk }}</span>
            </template>
          </Column>
          <Column field="namaToko" header="Nama Toko" style="min-width: 180px">
            <template #body="{ data }">
              {{ data.namaToko || data.kdtk }}
            </template>
          </Column>
          <Column field="sesuai" header="Nilai Selisih" style="min-width: 140px; text-align: right">
            <template #body="{ data }">
              <span class="font-bold text-red-600">
                {{ formatCurrency(data.sesuai) }}
              </span>
            </template>
          </Column>
          <Column header="Aksi" style="width: 130px; text-align: center">
            <template #body="{ data }">
              <Button
                label="Buka Toko"
                icon="pi pi-external-link"
                size="small"
                outlined
                severity="danger"
                @click="openStoreInPenyesuaian(data)"
              />
            </template>
          </Column>
        </DataTable>
      </div>
      <template #footer>
        <Button label="Tutup" icon="pi pi-times" text @click="showFantasticDialog = false" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';
import dashboardService from '@/services/dashboard.service';

const router = useRouter();

// State
const loading = ref(true);
const selectedPeriode = ref('');
const periodeOptions = ref([]);
const kpi = ref({
  penyesuaian: {},
  virtualMrg: {},
  closingSpace: {},
});
const branches = ref([]);
const activeFilter = ref('needsAttention');
const searchQuery = ref('');
const showFantasticDialog = ref(false);

// Generate 6 Periode terakhir (Format YYMM)
const initPeriodeOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const value = `${yy}${mm}`;
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) + ` (${value})`;
    options.push({ label, value });
  }
  periodeOptions.value = options;
  selectedPeriode.value = options[0].value;
};

// Fetch Resume Data dari Backend
const loadResumeData = async () => {
  loading.value = true;
  try {
    const res = await dashboardService.getFollowUpResume(selectedPeriode.value);
    if (res) {
      kpi.value = res.kpi || {};
      branches.value = res.branches || [];
    }
  } catch (err) {
    console.error('Error fetching dashboard follow-up resume:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  initPeriodeOptions();
  loadResumeData();
});

// Format currency
const formatCurrency = (val) => {
  if (val === null || val === undefined || isNaN(val)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
};

// Navigasi cepat
const navigateTo = (path) => {
  router.push(path);
};

// Buka dialog toko fantastis
const openFantasticDialog = () => {
  showFantasticDialog.value = true;
};

// Buka spesifik toko di halaman penyesuaian
const openStoreInPenyesuaian = (store) => {
  showFantasticDialog.value = false;
  router.push(`/penyesuaian?cabang=${store.cabang}&toko=${store.kdtk}&periode=${selectedPeriode.value}`);
};

// Counts untuk Tabs
const countAttention = computed(() => {
  return branches.value.filter((b) => b.needsAttention).length;
});
const countPenyesuaian = computed(() => {
  return branches.value.filter((b) => (b.penyesuaian?.unfollowedStores || 0) > 0).length;
});
const countVirtual = computed(() => {
  return branches.value.filter((b) => (b.virtualMrg?.unfollowedItems || 0) > 0).length;
});
const countSpace = computed(() => {
  return branches.value.filter((b) => b.closingSpace?.needsFu).length;
});

// Filtered Branches
const filteredBranches = computed(() => {
  let list = branches.value;

  // Filter tab
  if (activeFilter.value === 'needsAttention') {
    list = list.filter((b) => b.needsAttention);
  } else if (activeFilter.value === 'penyesuaian') {
    list = list.filter((b) => (b.penyesuaian?.unfollowedStores || 0) > 0);
  } else if (activeFilter.value === 'virtual') {
    list = list.filter((b) => (b.virtualMrg?.unfollowedItems || 0) > 0);
  } else if (activeFilter.value === 'space') {
    list = list.filter((b) => b.closingSpace?.needsFu);
  }

  // Filter pencarian
  if (searchQuery.value.trim() !== '') {
    const q = searchQuery.value.trim().toLowerCase();
    list = list.filter(
      (b) =>
        (b.cabang && b.cabang.toLowerCase().includes(q)) ||
        (b.namaCabang && b.namaCabang.toLowerCase().includes(q))
    );
  }

  return list;
});
</script>

<style scoped>
/* ── Section Container ────────────────────────────────────────── */
.followup-resume-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ── Resume Header Card ──────────────────────────────────────── */
.resume-header-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.04) 0%, rgba(79, 70, 229, 0.08) 100%);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 12px;
  padding: 1rem 1.25rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.header-icon-box {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 10px;
  background: var(--primary-color, #3b82f6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.25);
}

.resume-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-color, #1e293b);
  margin: 0;
}

.resume-subtitle {
  font-size: 0.8rem;
  color: var(--text-color-secondary, #64748b);
  margin: 0.2rem 0 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.periode-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.periode-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-color-secondary, #64748b);
}

.periode-dropdown {
  min-width: 170px;
  font-size: 0.85rem;
}

/* ── 3 KPI Cards Grid ────────────────────────────────────────── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

@media (max-width: 1024px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}

.kpi-card {
  background: var(--surface-card, #ffffff);
  border: 1px solid var(--surface-border, #e2e8f0);
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.05);
}

.kpi-card.has-alert {
  border-left: 4px solid #ef4444;
}

.kpi-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.kpi-icon-wrapper {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
}

.icon-penyesuaian {
  background: rgba(168, 85, 247, 0.12);
  color: #9333ea;
}

.icon-virtual {
  background: rgba(14, 165, 233, 0.12);
  color: #0284c7;
}

.icon-closing {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}

.kpi-label {
  font-size: 0.825rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-color-secondary, #64748b);
}

.kpi-main-stat {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  margin: 0.25rem 0 0.5rem;
}

.stat-number {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-color, #0f172a);
  line-height: 1;
}

.stat-unit {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-color-secondary, #64748b);
}

.kpi-sub-stat {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  padding: 0.35rem 0;
  border-top: 1px dashed var(--surface-border, #e2e8f0);
}

.sub-label {
  color: var(--text-color-secondary, #64748b);
}

.sub-value {
  font-weight: 700;
  color: #dc2626;
}

.fantastic-notice {
  margin-top: 0.5rem;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #b91c1c;
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  font-size: 0.775rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background 0.15s ease;
}

.fantastic-notice:hover {
  background: rgba(239, 68, 68, 0.15);
}

.kpi-info-hint {
  font-size: 0.775rem;
  color: var(--text-color-secondary, #64748b);
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
}

.kpi-sub-breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.5rem;
}

.badge-mini {
  font-size: 0.725rem;
  font-weight: 600;
  padding: 0.2rem 0.45rem;
  border-radius: 4px;
}

.bg-red {
  background: rgba(239, 68, 68, 0.15);
  color: #b91c1c;
}

.bg-amber {
  background: rgba(245, 158, 11, 0.15);
  color: #b45309;
}

.bg-gray {
  background: rgba(100, 116, 139, 0.15);
  color: #475569;
}

.kpi-card-footer {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--surface-border, #f1f5f9);
}

.footer-link-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  padding: 0.35rem 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--primary-color, #2563eb);
  cursor: pointer;
  transition: gap 0.2s ease, color 0.15s ease;
}

.footer-link-btn:hover {
  color: #1d4ed8;
}

.footer-link-btn:hover .pi-arrow-right {
  transform: translateX(4px);
}

.footer-link-btn .pi-arrow-right {
  transition: transform 0.2s ease;
}

/* ── Matriks Cabang Card ─────────────────────────────────────── */
.branch-matrix-card {
  background: var(--surface-card, #ffffff);
  border: 1px solid var(--surface-border, #e2e8f0);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.matrix-card-header {
  padding: 1.25rem;
  border-bottom: 1px solid var(--surface-border, #e2e8f0);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.matrix-header-left {
  display: flex;
  flex-direction: column;
}

.matrix-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-color, #0f172a);
}

.matrix-subtitle {
  font-size: 0.8rem;
  color: var(--text-color-secondary, #64748b);
  margin-top: 0.15rem;
}

.matrix-header-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.filter-pills {
  display: flex;
  background: var(--surface-ground, #f1f5f9);
  padding: 3px;
  border-radius: 8px;
  gap: 2px;
}

.pill-btn {
  background: none;
  border: none;
  padding: 0.35rem 0.7rem;
  font-size: 0.775rem;
  font-weight: 600;
  color: var(--text-color-secondary, #64748b);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pill-btn:hover {
  color: var(--text-color, #0f172a);
}

.pill-btn.active {
  background: var(--surface-card, #ffffff);
  color: var(--primary-color, #2563eb);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.search-field {
  width: 180px;
}

.search-input {
  width: 100%;
}

/* ── Matrix DataTable Details ────────────────────────────────── */
.branch-cell {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.branch-code-badge {
  background: #0f172a;
  color: #fff;
  font-family: monospace;
  font-weight: 700;
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.branch-info {
  display: flex;
  flex-direction: column;
}

.branch-name {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-color, #1e293b);
}

.attention-indicator {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.725rem;
  font-weight: 700;
  color: #dc2626;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #ef4444;
  display: inline-block;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}

.case-detail-box {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.case-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tag-warn {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
  font-weight: 700;
  font-size: 0.75rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.tag-fantastic {
  background: rgba(239, 68, 68, 0.15);
  color: #b91c1c;
  font-weight: 800;
  font-size: 0.725rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.tag-orange {
  background: rgba(249, 115, 22, 0.12);
  color: #c2410c;
  font-weight: 700;
  font-size: 0.75rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.tag-danger {
  background: rgba(239, 68, 68, 0.15);
  color: #b91c1c;
  font-weight: 700;
  font-size: 0.75rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.tag-amber {
  background: rgba(245, 158, 11, 0.15);
  color: #b45309;
  font-weight: 700;
  font-size: 0.75rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.tag-secondary {
  background: rgba(100, 116, 139, 0.12);
  color: #475569;
  font-weight: 600;
  font-size: 0.75rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.tag-success {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
  font-weight: 600;
  font-size: 0.75rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.case-nominal {
  font-size: 0.775rem;
  color: var(--text-color-secondary, #64748b);
}

.case-safe {
  font-size: 0.8rem;
  color: var(--text-color-secondary, #64748b);
  display: flex;
  align-items: center;
}

.space-status-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.space-gb-value {
  font-size: 0.825rem;
  font-weight: 700;
  color: var(--text-color, #1e293b);
}

.space-fu-info {
  font-size: 0.75rem;
}

.direct-link-btn {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--primary-color, #2563eb);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  width: fit-content;
  margin-top: 0.15rem;
}

.direct-link-btn:hover {
  text-decoration: underline;
}

.action-btn-group {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
}

/* ── Dialog Custom ───────────────────────────────────────────── */
.dialog-desc {
  font-size: 0.875rem;
  color: var(--text-color-secondary, #64748b);
  margin-bottom: 1rem;
}

/* ── Additional Accumulation & Stats Styles ── */
.kpi-accumulation-hint {
  font-size: 0.725rem;
  color: var(--text-color-secondary, #64748b);
  margin-top: 0.2rem;
  margin-bottom: 0.4rem;
  display: flex;
  align-items: center;
}

.kpi-stats-grid {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.4rem 0.6rem;
  background: var(--surface-ground, #f8fafc);
  border-radius: 6px;
  border: 1px solid var(--surface-border, #e2e8f0);
  margin: 0.35rem 0;
}

.kpi-mini-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
}

.mini-label {
  color: var(--text-color-secondary, #64748b);
}

.mini-val {
  font-weight: 600;
  color: var(--text-color, #1e293b);
}

.case-stats-row {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.725rem;
  color: var(--text-color-secondary, #64748b);
  margin: 0.15rem 0;
}

.stat-pill {
  line-height: 1.25;
}

.text-muted {
  opacity: 0.85;
}

</style>
