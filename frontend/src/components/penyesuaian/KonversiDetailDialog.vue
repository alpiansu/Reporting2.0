<template>
  <BaseModalDetail :show="show" :title="'Detail Analisis Konversi'" icon="pi pi-arrows-alt" size="large" @close="$emit('close')">
    <template #content>
      <div v-if="!detail" class="empty-section">Tidak ada data analisis konversi</div>

      <div v-else class="konversi-content">
        <!-- Item Info -->
        <div class="info-panel">
          <div class="info-row">
            <span class="info-label">Item Konversi (PLU_KONV)</span>
            <span class="info-value">{{ detail.pluKonv }} — {{ detail.singkatanPluKonv || '-' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Waktu Transaksi KO</span>
            <span class="info-value">{{ formatDate(detail.addtimeKo) }}</span>
          </div>
        </div>

        <!-- Status: Tidak ditemukan -->
        <div v-if="!detail.found" class="result-card result-warn">
          <div class="result-header">
            <i class="pi pi-exclamation-triangle"></i>
            <span>PLU Asal Tidak Ditemukan</span>
          </div>
          <div class="result-body">
            <p>{{ detail.kesimpulan }}</p>
            <p class="hint">Kemungkinan: item konversi bukan hasil racikan dari item lain, atau data konversi_plu tidak tersedia.</p>
          </div>
        </div>

        <!-- Ditemukan -->
        <template v-if="detail.found">
          <!-- PLU Asal Info -->
          <div class="section-card">
            <div class="section-card-header">
              <i class="pi pi-box"></i>
              <span>PLU Asal: {{ detail.pluAsal }} — {{ detail.singkatanPluAsal || '-' }}</span>
            </div>
            <div class="section-card-body">
              <div class="param-grid">
                <div class="param-item">
                  <span class="param-label">Ratio Konversi</span>
                  <span class="param-value">{{ detail.nilai }}</span>
                </div>
                <div class="param-item">
                  <span class="param-label">ACOST PLU ASAL</span>
                  <span class="param-value">{{ fmt(detail.acostAsal) }}</span>
                </div>
                <div class="param-item">
                  <span class="param-label">Acost PLU KONV Seharusnya</span>
                  <span class="param-value">{{ fmt(detail.expectedPrice) }}</span>
                </div>
                <div class="param-item">
                  <span class="param-label">Acost PLU KONV Aktual</span>
                  <span class="param-value" :class="selisihClass(detail.selisih)">{{ fmt(detail.actualPrice) }}</span>
                </div>
                <div class="param-item">
                  <span class="param-label">Selisih</span>
                  <span class="param-value" :class="selisihClass(detail.selisih)">{{ fmt(detail.selisih) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Chain Transaksi -->
          <div class="section-card">
            <div class="section-card-header">
              <i class="pi pi-sitemap"></i>
              <span>Rantai Transaksi</span>
            </div>
            <div class="section-card-body">
              <!-- BPB Asal -->
              <div v-if="detail.bpbAsal" class="chain-item chain-bpb">
                <div class="chain-dot"></div>
                <div class="chain-content">
                  <div class="chain-header">
                    <span class="chain-badge badge-bpb">BPB</span>
                     <span class="chain-label">Pembelian Barang — PLU {{ detail.pluAsal }} {{ detail.singkatanPluAsal ? '(' + detail.singkatanPluAsal + ')' : '' }}</span>
                  </div>
                  <div class="chain-detail">
                    <span>Harga: <strong>{{ fmt(detail.bpbAsal.PRICE || detail.bpbAsal.price) }}</strong></span>
                    <span>Qty: <strong>{{ fmt(detail.bpbAsal.QTY || detail.bpbAsal.qty) }}</strong></span>
                    <span>Tanggal: {{ formatDate(detail.bpbAsal.BUKTI_TGL || detail.bpbAsal.bukti_tgl) }}</span>
                    <span v-if="detail.bpbAsal.BUKTI_NO || detail.bpbAsal.bukti_no" class="docno">
                      No: {{ detail.bpbAsal.BUKTI_NO || detail.bpbAsal.bukti_no }}
                    </span>
                  </div>
                </div>
              </div>
              <!-- Arrow down -->
              <div class="chain-arrow">
                <i class="pi pi-arrow-down"></i>
                <span class="chain-arrow-label">menyebabkan ↓</span>
              </div>
              <!-- KO Konversi -->
              <div class="chain-item chain-ko">
                <div class="chain-dot"></div>
                <div class="chain-content">
                  <div class="chain-header">
                    <span class="chain-badge badge-ko">KO</span>
                     <span class="chain-label">Konversi Racikan — PLU {{ detail.pluKonv }} {{ detail.singkatanPluKonv ? '(' + detail.singkatanPluKonv + ')' : '' }}</span>
                  </div>
                  <div class="chain-detail">
                    <span>Harga: <strong>{{ fmt(detail.hargaSebelum) }}</strong> → <strong :class="selisihClass(detail.selisih)">{{ fmt(detail.actualPrice) }}</strong></span>
                    <span>Tanggal: {{ formatDate(detail.addtimeKo) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Kesimpulan -->
          <div class="result-card" :class="detail.kesimpulan === 'BPB_PLU_ASAL' ? 'result-ok' : 'result-info'">
            <div class="result-header">
              <i :class="detail.kesimpulan === 'BPB_PLU_ASAL' ? 'pi pi-check-circle' : 'pi pi-info-circle'"></i>
              <span>Kesimpulan</span>
            </div>
            <div class="result-body">
              <p>{{ detail.narasi }}</p>
            </div>
          </div>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="footer-actions">
        <button type="button" class="btn btn-cancel" @click="$emit('close')">
          <i class="pi pi-times"></i><span>Tutup</span>
        </button>
      </div>
    </template>
  </BaseModalDetail>
</template>

<script setup>
import BaseModalDetail from '@/components/common/BaseModalDetail.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  detail: { type: Object, default: null },
})

defineEmits(['close'])

function fmt(val) {
  if (val === null || val === undefined) return '-'
  const n = Number(val)
  if (isNaN(n)) return String(val)
  return n.toLocaleString('en-US')
}

function formatDate(val) {
  if (!val) return '-'
  const d = new Date(val)
  if (isNaN(d.getTime())) return String(val)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function selisihClass(val) {
  const n = Number(val) || 0
  if (n > 500) return 'val-critical'
  if (n > 100) return 'val-warn'
  return 'val-ok'
}
</script>

<style scoped src="./KonversiDetailDialog.style.css"></style>
