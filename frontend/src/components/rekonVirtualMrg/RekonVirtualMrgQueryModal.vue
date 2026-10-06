<template>
  <Dialog
    :visible="visible"
    @update:visible="val => emit('update:visible', val)"
    :modal="true"
    :closable="true"
    :dismissableMask="true"
    class="rekon-query-dialog"
    :style="{ width: '880px', maxWidth: '95vw' }"
    @hide="onClose"
  >
    <template #header>
      <div class="dialog-header-custom">
        <i class="pi pi-database dialog-header-icon"></i>
        <div class="dialog-header-title">Query Pengecekan Saldo Virtual</div>
      </div>
    </template>

    <!-- Context Info Card -->
    <div v-if="item" class="query-info-card">
      <div class="info-item">
        <span class="info-label">Cabang</span>
        <span class="info-value">{{ item.CABANG || '-' }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Toko (Shop)</span>
        <span class="info-value">{{ item.SHOP || '-' }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Tanggal</span>
        <span class="info-value">{{ formatDate(item.TANGGAL) }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Kode Produk</span>
        <span class="info-value">{{ item.PRDCD || '-' }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Nama Produk</span>
        <span class="info-value">{{ item.SINGKATAN || '-' }}</span>
      </div>
      <div class="info-item" v-if="item.SEL !== undefined">
        <span class="info-label">Selisih</span>
        <span class="info-value selisih-val">{{ item.SEL }}</span>
      </div>
    </div>

    <!-- Hint Banner -->
    <div class="query-hint-banner">
      <i class="pi pi-info-circle"></i>
      <span>
        Silakan salin query di bawah ini dan jalankan pada SQL Client (misalnya HeidiSQL atau DBeaver) yang terkoneksi langsung ke database toko terkait.
      </span>
    </div>

    <!-- Query Cards List -->
    <div class="queries-container" v-if="queries && queries.length > 0">
      <div v-for="(q, idx) in queries" :key="idx" class="query-card">
        <div class="query-card-header">
          <div class="query-card-title">
            <i class="pi pi-code"></i>
            <span>{{ q.title || `Query ${idx + 1}` }}</span>
          </div>
          <Button
            size="small"
            outlined
            :severity="copiedIndex === idx ? 'success' : 'secondary'"
            :icon="copiedIndex === idx ? 'pi pi-check' : 'pi pi-copy'"
            :label="copiedIndex === idx ? 'Tersalin!' : 'Salin Query'"
            class="btn-copy-single"
            @click="handleCopySingle(q, idx)"
          />
        </div>
        <div class="query-code-wrapper">
          <pre class="query-code-text"><code>{{ q.sql }}</code></pre>
        </div>
      </div>
    </div>

    <div v-else class="text-center p-4 text-muted">
      <i class="pi pi-exclamation-circle mr-2"></i>
      Tidak ada query yang tersedia untuk ditampilkan.
    </div>

    <template #footer>
      <div class="dialog-footer-content">
        <div class="footer-left">
          <Button
            v-if="queries && queries.length > 0"
            severity="primary"
            :icon="copiedAll ? 'pi pi-check' : 'pi pi-copy'"
            :label="copiedAll ? 'Semua Query Tersalin!' : 'Salin Semua Query'"
            @click="handleCopyAll"
          />
        </div>
        <div class="footer-right">
          <Button
            label="Tutup"
            severity="secondary"
            outlined
            @click="onClose"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref } from 'vue';
import { copyToClipboard } from '../../utils/clipboard.js';
import { useToastService } from '../../utils/toast';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  item: {
    type: Object,
    default: () => ({})
  },
  queries: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:visible', 'close']);
const toast = useToastService();

const copiedIndex = ref(null);
const copiedAll = ref(false);

const formatDate = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const handleCopySingle = async (q, index) => {
  const success = await copyToClipboard(q.sql);
  if (success) {
    copiedIndex.value = index;
    toast.showSuccess('Berhasil', `${q.title || 'Query'} telah disalin ke clipboard`);
    setTimeout(() => {
      if (copiedIndex.value === index) {
        copiedIndex.value = null;
      }
    }, 2000);
  } else {
    toast.showWarning(
      'Perhatian',
      'Gagal menyalin otomatis ke clipboard. Anda dapat menyeleksi dan menyalin teks query secara manual.'
    );
  }
};

const handleCopyAll = async () => {
  if (!props.queries || props.queries.length === 0) return;

  const allQueryText = props.queries
    .map(q => `-- ${q.title}\n${q.sql}`)
    .join('\n\n');

  const success = await copyToClipboard(allQueryText);
  if (success) {
    copiedAll.value = true;
    toast.showSuccess('Berhasil', 'Semua query telah disalin ke clipboard');
    setTimeout(() => {
      copiedAll.value = false;
    }, 2000);
  } else {
    toast.showWarning(
      'Perhatian',
      'Gagal menyalin otomatis ke clipboard. Anda dapat menyeleksi teks query di atas secara manual.'
    );
  }
};

const onClose = () => {
  emit('update:visible', false);
  emit('close');
};
</script>

<style scoped src="./RekonVirtualMrgQueryModal.style.css"></style>
