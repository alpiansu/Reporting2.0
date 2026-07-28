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

<style scoped>
.konversi-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.5rem 0;
}

.empty-section {
  text-align: center;
  padding: 2rem;
  color: #9ca3af;
}

.info-panel {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.75rem 1rem;
}
.info-row {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding-right: 1.5rem;
  border-right: 1px solid #e5e7eb;
}
.info-row:last-child { border-right: none; }
.info-label { font-size: 0.65rem; font-weight: 600; color: #6b7280; text-transform: uppercase; }
.info-value { font-size: 0.9rem; font-weight: 700; color: #1e293b; font-family: monospace; }

.section-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}
.section-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e5e7eb;
  font-weight: 600;
  font-size: 0.875rem;
  color: #374151;
}
.section-card-body {
  padding: 0.75rem 1rem;
}

.param-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
}
.param-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.5rem 0.75rem;
  background: #fafbfc;
  border-radius: 6px;
  border: 1px solid #f1f5f9;
}
.param-label { font-size: 0.65rem; font-weight: 600; color: #6b7280; text-transform: uppercase; }
.param-value { font-size: 0.9rem; font-weight: 700; color: #1e293b; font-family: monospace; }

/* Chain Transaksi */
.chain-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}
.chain-bpb { background: #eff6ff; border-color: #bfdbfe; }
.chain-ko { background: #faf5ff; border-color: #e9d5ff; }
.chain-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-top: 0.3rem;
  flex-shrink: 0;
}
.chain-bpb .chain-dot { background: #3b82f6; }
.chain-ko .chain-dot { background: #8b5cf6; }
.chain-content { flex: 1; }
.chain-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}
.chain-badge {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  color: #fff;
}
.badge-bpb { background: #3b82f6; }
.badge-ko { background: #8b5cf6; }
.chain-label { font-size: 0.8rem; font-weight: 600; color: #374151; }
.chain-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.78rem;
  color: #475569;
}
.chain-detail strong { font-family: monospace; font-weight: 700; }
.docno { color: #6b7280; font-family: monospace; }

.chain-arrow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0 0.25rem 1.5rem;
  color: #9ca3af;
  font-size: 0.75rem;
}
.chain-arrow i { font-size: 0.8rem; }
.chain-arrow-label { color: #9ca3af; }

/* Result / Kesimpulan */
.result-card {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}
.result-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  font-weight: 600;
  font-size: 0.875rem;
}
.result-body {
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  line-height: 1.6;
}
.result-body p { margin: 0; }
.hint { color: #9ca3af; font-style: italic; font-size: 0.8rem; margin-top: 0.5rem !important; }

.result-ok { background: #f0fdf4; }
.result-ok .result-header { background: #dcfce7; color: #166534; }

.result-info { background: #f0f9ff; }
.result-info .result-header { background: #e0f2fe; color: #1e40af; }

.result-warn { background: #fefce8; }
.result-warn .result-header { background: #fef9c3; color: #854d0e; }

.val-ok { color: #15803d; }
.val-warn { color: #d97706; }
.val-critical { color: #b91c1c; font-weight: 700; }

.footer-actions { display: flex; justify-content: flex-end; }
.btn-cancel {
  background: linear-gradient(135deg, #6b7280, #4b5563); color: #fff;
  padding: 0.625rem 1.5rem; border: none; border-radius: 10px; font-size: 0.9375rem;
  font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem;
}
.btn-cancel:hover { background: linear-gradient(135deg, #4b5563, #374151); }
</style>
