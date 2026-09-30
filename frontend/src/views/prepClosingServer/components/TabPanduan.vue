<template>
  <div class="tab-panduan">
    <div class="panduan-banner">
      <i class="pi pi-book"></i>
      <span>
        Panduan "Before Closing Bulanan" per cabang (sumber:
        <a href="http://192.168.133.3/regForum/public/d/382-juklak-berfore-closing-bulanan" target="_blank" rel="noopener">
          JUKLAK Before Closing Bulanan
        </a>).
        Informasi kredensial ditandai agar mudah dilihat — dikelola di
        <router-link to="/panduan-ceklist" class="panduan-link">menu Panduan Ceklist</router-link>.
      </span>
    </div>

    <div v-if="loading" class="panduan-loading"><i class="pi pi-spin pi-spinner"></i> Memuat panduan...</div>

    <div v-else-if="panduanRows.length > 0">
      <Accordion class="panduan-accordion">
        <AccordionTab v-for="p in panduanRows" :key="p.KDCAB">
          <template #header>
            <span class="acc-header">
              <b>{{ p.KDCAB }}</b>&nbsp;{{ p.NAMACAB || '' }}
              <Tag :value="p.OS || '—'" :severity="p.OS === 'WINDOWS' ? 'info' : 'warning'" class="ml-2" />
              <code class="acc-ip" v-if="p.IP_BULANAN">{{ p.IP_BULANAN }}</code>
            </span>
          </template>
          <PanduanCard :panduan="p" />
        </AccordionTab>
      </Accordion>
    </div>

    <div v-else class="panduan-empty-state">
      <i class="pi pi-inbox"></i>
      <span>Belum ada data panduan.</span>
    </div>
  </div>
</template>

<script setup>
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import Tag from 'primevue/tag';
import PanduanCard from './PanduanCard.vue';

defineProps({
  panduanRows: { type: Array, default: () => [] },
  loading:     { type: Boolean, default: false },
});
</script>

<style scoped>
.tab-panduan { padding: 4px 2px; }
.panduan-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #e3f2fd;
  border-left: 4px solid #1976d2;
  color: #0d47a1;
  padding: 10px 14px;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 0.9rem;
}
.panduan-banner a.panduan-link { color: #0d47a1; font-weight: 600; }
.panduan-loading, .panduan-empty-state {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  padding: 32px 0;
  color: var(--text-color-secondary);
}
.acc-header { display: flex; align-items: center; gap: 6px; }
.acc-ip {
  font-family: 'Consolas', monospace;
  background: #d4edda;
  border: 1px solid #a9dcb8;
  color: #155724;
  border-radius: 4px;
  padding: 0 6px;
  margin-left: 8px;
}
</style>