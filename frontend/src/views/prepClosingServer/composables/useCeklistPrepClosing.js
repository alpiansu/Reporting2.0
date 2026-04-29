/**
 * Composable: useCeklistPrepClosing
 * Shared state + data-loading logic for all 4 tabs
 */
import { ref, reactive, computed } from 'vue';
import * as api from '../services/ceklistPrepClosing.service.js';

export function useCeklistPrepClosing() {
  // ─── Filter State ────────────────────────────────────────────────────────
  const filters    = reactive({ periode: '', cabang: 'All' });
  const periodeDate = ref(null);

  const paramsStr = computed(() => {
    const p = filters.periode ? `periode=${filters.periode}` : '';
    const c = filters.cabang && filters.cabang !== 'All' ? `&cabang=${filters.cabang}` : '';
    return p + c;
  });

  // ─── Loading flags ───────────────────────────────────────────────────────
  const loading   = ref(false);
  const exporting = ref(false);

  // ─── Data ────────────────────────────────────────────────────────────────
  const hddRows     = ref([]);
  const tampungRows = ref([]);
  const idtRows     = ref([]);
  const rekapData   = ref({ data: [], ruleKeys: [], total: 0 });
  const summary     = ref(null);

  // ─── Load All ────────────────────────────────────────────────────────────
  async function loadAll() {
    if (!filters.periode) return;
    loading.value = true;
    try {
      const [hdd, tamp, idt, rekap, sum] = await Promise.all([
        api.getSpaceHdd(paramsStr.value),
        api.getSpaceTampung(paramsStr.value),
        api.getImportIdt(paramsStr.value),
        api.getRekapScreening(paramsStr.value),
        api.getSummary(paramsStr.value),
      ]);
      hddRows.value     = hdd?.data ?? hdd ?? [];
      tampungRows.value = tamp?.data ?? tamp ?? [];
      idtRows.value     = idt?.data ?? idt ?? [];
      rekapData.value   = rekap ?? { data: [], ruleKeys: [], total: 0 };
      summary.value     = sum?.summary ?? null;
    } finally {
      loading.value = false;
    }
  }

  // ─── Export ──────────────────────────────────────────────────────────────
  async function doExport() {
    exporting.value = true;
    try {
      await api.exportExcel(paramsStr.value, `Ceklist_Prepare_Closing_${filters.periode}.xlsx`);
    } finally {
      exporting.value = false;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function handlePeriodeSelect() {
    if (periodeDate.value) {
      const y = periodeDate.value.getFullYear().toString().slice(-2);
      const m = (periodeDate.value.getMonth() + 1).toString().padStart(2, '0');
      filters.periode = y + m;
    }
  }

  function formatTgl(d) {
    if (!d) return null;
    if (typeof d === 'string') return d;
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  return {
    filters, periodeDate, paramsStr,
    loading, exporting,
    hddRows, tampungRows, idtRows, rekapData, summary,
    loadAll, doExport,
    handlePeriodeSelect, formatTgl,
  };
}
