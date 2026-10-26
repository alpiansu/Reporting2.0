<template>
  <div v-if="show" class="modal-backdrop" @click="handleClose"></div>
  <div v-if="show" class="modal show" tabindex="-1" role="dialog" @click.self="handleClose">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <!-- Header -->
        <div class="modal-header header-danger">
          <div class="title-with-icon">
            <i class="pi pi-exclamation-triangle header-icon"></i>
            <div>
              <h5 class="modal-title">Validasi Station Toko Gagal</h5>
              <span class="modal-subtitle">Format BC Khusus mewajibkan station 2 digit angka dan bukan '00'</span>
            </div>
          </div>
          <button type="button" class="modal-close" @click="handleClose" title="Tutup">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <!-- Alert Banner -->
          <div class="cancel-banner">
            <i class="pi pi-ban banner-icon"></i>
            <div class="banner-text">
              <span class="banner-title">Proses Export File CSV Dibatalkan</span>
              <span class="banner-desc">
                Ditemukan <strong>{{ invalidStores.length }} toko</strong> pada file adjustment Anda yang memiliki informasi station tidak sesuai di master Stores.
                Silakan lakukan perbaikan data station pada toko-toko berikut sebelum mengulang export.
              </span>
            </div>
          </div>

          <!-- Stores Table -->
          <div class="error-table-wrapper">
            <table class="error-table">
              <thead>
                <tr>
                  <th style="width: 140px;">Baris di File CSV</th>
                  <th style="width: 110px;">Kode Toko</th>
                  <th>Nama Toko</th>
                  <th style="width: 120px; text-align: center;">Station di Stores</th>
                  <th>Keterangan / Kendala</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in invalidStores" :key="index">
                  <td class="td-rows">
                    <span v-for="row in (item.rows || []).slice(0, 5)" :key="row" class="row-chip">
                      Baris {{ row }}
                    </span>
                    <span v-if="(item.rows || []).length > 5" class="row-chip more">
                      +{{ item.rows.length - 5 }} lainnya
                    </span>
                  </td>
                  <td class="td-code">
                    <span class="store-code-badge">{{ item.storeCode }}</span>
                  </td>
                  <td class="td-name">
                    {{ item.storeName || '-' }}
                  </td>
                  <td class="td-station text-center">
                    <span class="station-invalid-badge">
                      {{ item.currentStation || '-' }}
                    </span>
                  </td>
                  <td class="td-reason">
                    <i class="pi pi-times-circle reason-icon"></i>
                    <span>{{ item.reason }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Instruction Box -->
          <div class="instruction-box">
            <i class="pi pi-info-circle instruction-icon"></i>
            <div class="instruction-text">
              <strong>Langkah Perbaikan:</strong>
              <ol>
                <li>Buka menu <strong>Stores</strong> (atau klik tombol <em>"Buka Halaman Stores"</em> di bawah).</li>
                <li>Cari kode toko yang tercantum di atas, klik tombol <strong>Edit</strong>.</li>
                <li>Perbarui kolom <strong>Station</strong> menjadi dua digit angka valid (misal: <code>01</code>, <code>02</code>, <code>05</code>, <code>08</code>, dan pastikan bukan <code>00</code>).</li>
                <li>Simpan perubahan toko, kemudian ulangi proses upload & export file penyesuaian di halaman ini.</li>
              </ol>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="handleClose">
            <i class="pi pi-times"></i>
            <span>Tutup</span>
          </button>
          <button type="button" class="btn btn-primary" @click="handleNavigateStores">
            <i class="pi pi-external-link"></i>
            <span>Buka Halaman Stores</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  invalidStores: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['close', 'navigateStores']);

const handleClose = () => {
  emit('close');
};

const handleNavigateStores = () => {
  emit('navigateStores');
};
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(4px);
  z-index: 1040;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: all 0.25s ease-out;
  padding: 1rem;
}

.modal.show {
  opacity: 1;
  visibility: visible;
}

.modal-dialog {
  width: 100%;
  max-width: 820px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-content {
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border: 1px solid #e2e8f0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.modal-header.header-danger {
  padding: 1.15rem 1.4rem;
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  color: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-with-icon {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.header-icon {
  font-size: 1.6rem;
  color: #fee2e2;
}

.modal-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #ffffff;
}

.modal-subtitle {
  font-size: 0.8rem;
  color: #fecaca;
  display: block;
  margin-top: 0.15rem;
}

.modal-close {
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: #ffffff;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.4rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  transition: background 0.2s ease;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.modal-body {
  padding: 1.25rem 1.4rem;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.cancel-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 0.9rem 1.1rem;
  margin-bottom: 1.15rem;
}

.banner-icon {
  font-size: 1.4rem;
  color: #dc2626;
  margin-top: 0.1rem;
}

.banner-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.banner-title {
  font-weight: 700;
  color: #991b1b;
  font-size: 0.925rem;
}

.banner-desc {
  font-size: 0.825rem;
  color: #7f1d1d;
  line-height: 1.45;
}

.error-table-wrapper {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 1.15rem;
}

.error-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.error-table thead {
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.error-table th {
  padding: 0.65rem 0.85rem;
  text-align: left;
  font-weight: 600;
  color: #475569;
  font-size: 0.775rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.error-table td {
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
  vertical-align: middle;
}

.error-table tbody tr:last-child td {
  border-bottom: none;
}

.error-table tbody tr:hover {
  background: #f8fafc;
}

.td-rows {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.row-chip {
  display: inline-block;
  font-size: 0.725rem;
  font-weight: 600;
  background: #f1f5f9;
  color: #475569;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
}

.row-chip.more {
  background: #e2e8f0;
  color: #334155;
}

.store-code-badge {
  display: inline-block;
  font-family: monospace;
  font-weight: 700;
  color: #0369a1;
  background: #e0f2fe;
  padding: 0.2rem 0.5rem;
  border-radius: 5px;
}

.station-invalid-badge {
  display: inline-block;
  font-family: monospace;
  font-weight: 700;
  color: #dc2626;
  background: #fee2e2;
  border: 1px solid #fca5a5;
  padding: 0.2rem 0.6rem;
  border-radius: 5px;
  font-size: 0.85rem;
}

.td-reason {
  color: #b91c1c;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.reason-icon {
  color: #dc2626;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.instruction-box {
  display: flex;
  gap: 0.75rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  padding: 0.85rem 1.1rem;
}

.instruction-icon {
  color: #16a34a;
  font-size: 1.25rem;
  margin-top: 0.15rem;
}

.instruction-text {
  font-size: 0.8rem;
  color: #14532d;
  line-height: 1.5;
}

.instruction-text strong {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.825rem;
}

.instruction-text ol {
  margin: 0;
  padding-left: 1.15rem;
}

.instruction-text code {
  background: #dcfce7;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-weight: 600;
  color: #15803d;
}

.modal-footer {
  padding: 1rem 1.4rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.25rem;
  border-radius: 7px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
}

.btn-secondary:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.btn-primary {
  background: linear-gradient(135deg, #0284c7, #0369a1);
  border: 1px solid #0284c7;
  color: #ffffff;
  box-shadow: 0 2px 4px rgba(2, 132, 199, 0.2);
}

.btn-primary:hover {
  background: linear-gradient(135deg, #0369a1, #075985);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(2, 132, 199, 0.3);
}
</style>
