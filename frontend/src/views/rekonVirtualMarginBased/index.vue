<template>
  <div class="rekon-virtual-mrg-view">
    <!-- Compact Header Section -->
    <header class="view-header">
      <div class="header-main">
        <div class="header-icon-box">
          <i class="pi pi-calculator"></i>
        </div>
        <div class="header-text">
          <h1 class="header-title">Hasil Rekonsiliasi Saldo Virtual Margin Based</h1>
          <p class="header-subtitle">
            Informasi saldo virtual berdasarkan margin produk per toko &amp; deteksi selisih stok secara otomatis
          </p>
        </div>
      </div>
      <div class="header-actions">
        <!-- Active Filter Badge -->
        <div v-if="activePeriode" class="active-filter-badge">
          <i class="pi pi-calendar"></i>
          <span>Periode: <strong>{{ activePeriode }}</strong></span>
          <span v-if="activeCab" class="cab-sub-badge">Cabang: {{ activeCab }}</span>
        </div>

        <!-- Sync Cache DB Button (Superadmin Only) -->
        <button
          v-if="showResults && isSuperAdmin"
          type="button"
          class="btn-header-sync"
          :disabled="isSyncing"
          @click="openSyncDialog"
          title="Sinkronkan ulang file cache JSON dari database Central MySQL (Khusus Superadmin)"
        >
          <i class="pi" :class="isSyncing ? 'pi-spin pi-spinner' : 'pi-database'"></i>
          <span>{{ isSyncing ? 'Menyinkronkan...' : 'Sync Cache DB' }}</span>
        </button>

        <!-- Refresh Button -->
        <button
          v-if="showResults"
          type="button"
          class="btn-header-secondary"
          :disabled="isSyncing"
          @click="refreshResults"
          title="Muat ulang hasil rekonsiliasi"
        >
          <i class="pi pi-refresh"></i>
          <span>Refresh Hasil</span>
        </button>
      </div>
    </header>

    <!-- Confirmation Dialog for Sync (Superadmin Only) -->
    <Dialog
      v-model:visible="showSyncConfirmDialog"
      header="Konfirmasi Sinkronisasi Cache DB"
      :modal="true"
      :closable="!isSyncing"
      class="sync-confirm-dialog"
      :style="{ width: '450px' }"
    >
      <div class="sync-dialog-content">
        <div class="sync-warning-icon">
          <i class="pi pi-exclamation-triangle"></i>
        </div>
        <div class="sync-dialog-text">
          <p>
            Tindakan ini akan membaca ulang data dari tabel <strong>saldo_virtual</strong> di Central MySQL untuk periode <strong>{{ activePeriode }}</strong> dan menimpa file cache JSON di server.
          </p>
          <small class="sync-dialog-subtext">
            Gunakan fitur ini jika Anda baru saja melakukan intervensi SQL langsung pada database.
          </small>
        </div>
      </div>
      <template #footer>
        <Button
          label="Batal"
          icon="pi pi-times"
          class="p-button-text p-button-secondary"
          :disabled="isSyncing"
          @click="showSyncConfirmDialog = false"
        />
        <Button
          label="Ya, Sinkronkan"
          icon="pi pi-check"
          class="p-button-warning"
          :loading="isSyncing"
          @click="executeSyncFromDb"
        />
      </template>
    </Dialog>

    <div class="content-container">
      <!-- Form Section -->
      <RekonVirtualMrgForm @view-results="handleViewResults" />
      
      <!-- Results Section -->
      <div v-if="showResults" class="results-section">
        <RekonVirtualMrgResults 
          ref="resultsComponent"
          :cab="activeCab" 
          :periode="activePeriode" 
          :auto-load="true"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { useToastService } from '../../utils/toast';
import rekonVirtualMrgService from '../../services/rekonVirtualMrg.service';
import RekonVirtualMrgForm from '../../components/rekonVirtualMrg/RekonVirtualMrgForm.vue';
import RekonVirtualMrgResults from '../../components/rekonVirtualMrg/RekonVirtualMrgResults.vue';

// Auth & Toast
const authStore = useAuthStore();
const toast = useToastService();
const isSuperAdmin = computed(() => authStore.user?.role === 'superadmin');

// State
const activeCab = ref('');
const activePeriode = ref('');
const resultsComponent = ref(null);
const isSyncing = ref(false);
const showSyncConfirmDialog = ref(false);

// Computed
const showResults = computed(() => {
  return !!activePeriode.value;
});

// Methods
const handleViewResults = (data) => {
  activeCab.value = data.cab;
  activePeriode.value = data.periode;
  
  if (resultsComponent.value) {
    setTimeout(() => {
      if (resultsComponent.value && typeof resultsComponent.value.loadResults === 'function') {
        resultsComponent.value.loadResults();
      } else {
        console.warn('loadResults function not available on resultsComponent');
      }
    }, 200);
  }
};

const refreshResults = () => {
  if (resultsComponent.value && typeof resultsComponent.value.loadResults === 'function') {
    resultsComponent.value.loadResults();
  }
};

const openSyncDialog = () => {
  if (!activePeriode.value) return;
  showSyncConfirmDialog.value = true;
};

const executeSyncFromDb = async () => {
  if (!activePeriode.value) return;
  try {
    isSyncing.value = true;
    const response = await rekonVirtualMrgService.syncJson(activePeriode.value);
    showSyncConfirmDialog.value = false;

    const count = response?.data?.totalRecords !== undefined
      ? response.data.totalRecords
      : (response?.totalRecords || 0);

    toast.showSuccess(
      'Sinkronisasi Berhasil',
      `File JSON periode ${activePeriode.value} berhasil disinkronkan dari database (${count} item diperbarui).`
    );

    // Refresh tabel hasil otomatis agar tampilan sinkron dengan file JSON terbaru
    refreshResults();
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message || 'Gagal menyinkronkan data dari database';
    toast.showError('Sinkronisasi Gagal', errorMsg);
  } finally {
    isSyncing.value = false;
  }
};
</script>

<style scoped src="./index.style.css"></style>
