<template>
  <Dialog
    :visible="visible"
    modal
    :style="{ width: '95vw', maxWidth: '1200px' }"
    :closable="true"
    @update:visible="val => $emit('update:visible', val)"
    @show="loadResume"
    class="detail-dialog"
  >
    <!-- ── Header ── -->
    <template #header>
      <div class="flex align-items-center gap-3" style="width: 100%;">
        <div class="dialog-icon-wrap" :class="{ 'dialog-icon-wrap--warning': type === 'bulanan' }">
          <i :class="['pi text-xl', type === 'harian' ? 'pi-calendar' : 'pi-briefcase']"></i>
        </div>
        <div>
          <div class="text-xl font-bold text-900 capitalize mb-1" style="line-height: 1.2;">Resume Data {{ type }}</div>
          <div class="text-sm text-600">
            <span class="font-bold text-700">{{ getCabangName(cabang) }}</span>
            <span> — {{ cabang }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Content ── -->
    <div class="dialog-content">
      <transition name="slide-fade" mode="out-in">

        <!-- ============ RESUME VIEW ============ -->
        <div v-if="viewMode === 'resume'" key="resume">
          <div class="detail-nav" style="margin-bottom: 1rem; background: #f8fafc; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div class="detail-nav__left" style="flex: 1;">
              <p style="margin: 0; font-size: 0.825rem; color: #475569; line-height: 1.5;">
                Menampilkan history data <strong>{{ type }}</strong> untuk <strong>{{ getCabangName(cabang) }}</strong>.<br>Klik chevron untuk melihat log detail.
              </p>
            </div>
            <div class="flex align-items-center gap-2">
              <div class="search-wrapper">
                <i class="pi pi-search search-icon"></i>
                <InputText
                  v-model="resumeSearch"
                  placeholder="Cari periode atau catatan..."
                  class="search-input"
                />
              </div>
              <Button
                icon="pi pi-refresh"
                class="p-button-outlined p-button-secondary"
                style="height: 36px; width: 36px; padding: 0; border-radius: 8px;"
                v-tooltip.top="'Refresh Data'"
                :loading="loading"
                @click="loadResume"
              />
            </div>
          </div>

          <DataTable
            :value="filteredResumeData"
            :loading="loading"
            responsiveLayout="scroll"
            stripedRows
            emptyMessage="Tidak ada data ditemukan."
            class="datatable-dialog"
            paginator
            :rows="10"
            :rowsPerPageOptions="[10, 25, 50]"
            sortMode="single"
          >
            <!-- Periode -->
            <Column field="periode" header="Periode" sortable style="width: 140px;">
              <template #body="{ data }">
                <span class="cell-bold">{{ data.periode }}</span>
              </template>
            </Column>

            <!-- Toko Aktif -->
            <Column field="jml_toko_aktif" header="Toko Aktif" sortable style="width: 110px; text-align: right;">
              <template #body="{ data }">
                <Tag
                  severity="info"
                  :value="formatNumber(data.jml_toko_aktif)"
                  style="min-width: 52px; justify-content: center;"
                />
              </template>
            </Column>

            <!-- Toko Cek -->
            <Column field="jml_toko_cek" header="Toko Cek" sortable style="width: 110px; text-align: right;">
              <template #body="{ data }">
                <Tag
                  severity="success"
                  :value="formatNumber(data.jml_toko_cek)"
                  style="min-width: 52px; justify-content: center;"
                />
              </template>
            </Column>

            <!-- Path -->
            <Column field="path" header="Path">
              <template #body="{ data }">
                <span v-if="data.path" class="note-text">{{ data.path }}</span>
                <span v-else class="note-text note-text--empty">—</span>
              </template>
            </Column>

            <!-- IP -->
            <Column field="ip" header="IP Address">
              <template #body="{ data }">
                <span v-if="data.ip" class="note-text">{{ data.ip }}</span>
                <span v-else class="note-text note-text--empty">—</span>
              </template>
            </Column>

            <!-- File OK -->
            <Column field="jml_cek" header="File OK" sortable style="width: 110px; text-align: right;">
              <template #body="{ data }">
                <Tag
                  severity="success"
                  :value="formatNumber(data.jml_cek)"
                  style="min-width: 52px; justify-content: center;"
                />
              </template>
            </Column>

            <!-- File NOK -->
            <Column field="data_nok" header="File Nok" sortable style="width: 110px; text-align: right;">
              <template #body="{ data }">
                <Tag
                  severity="danger"
                  :value="formatNumber(data.data_nok)"
                  style="min-width: 52px; justify-content: center;"
                />
              </template>
            </Column>

            <!-- Note -->
            <Column field="note" header="Catatan" style="min-width: 210px;">
              <template #body="{ data }">
                <!-- Edit mode -->
                <div v-if="editingResumeNoteKey === resumeNoteKey(data)" class="note-edit">
                  <Textarea
                    v-model="editingResumeNoteText"
                    rows="3"
                    autoResize
                    class="note-textarea"
                    placeholder="Tulis catatan..."
                    @keydown.esc="cancelResumeEdit"
                  />
                  <div class="note-actions">
                    <Button
                      label="Simpan"
                      icon="pi pi-check"
                      class="p-button-success note-save-btn"
                      :loading="savingResumeNote"
                      @click="saveResumeNote(data)"
                    />
                    <Button
                      icon="pi pi-times"
                      class="p-button-text p-button-secondary note-cancel-btn"
                      v-tooltip.top="'Batal'"
                      :disabled="savingResumeNote"
                      @click="cancelResumeEdit"
                    />
                  </div>
                </div>

                <!-- Display mode -->
                <div v-else class="note-cell">
                  <span :class="['note-text', !data.note && 'note-text--empty']">
                    {{ data.note || '—' }}
                  </span>
                  <Button
                    icon="pi pi-pencil"
                    class="p-button-rounded p-button-text p-button-sm note-pencil"
                    v-tooltip.left="'Edit note'"
                    @click="startResumeEdit(data)"
                  />
                </div>
              </template>
            </Column>

            <!-- Aksi -->
            <Column style="width: 56px; text-align: center;">
              <template #body="{ data }">
                <Button
                  icon="pi pi-chevron-right"
                  class="p-button-rounded p-button-sm p-button-outlined"
                  style="width: 34px; height: 34px;"
                  v-tooltip.left="'Lihat Log Detail'"
                  @click="openDeepDetail(data.periode)"
                />
              </template>
            </Column>
          </DataTable>
        </div>

        <!-- ============ DETAIL VIEW ============ -->
        <div v-else-if="viewMode === 'detail'" key="detail">
          <!-- Nav bar -->
          <div class="detail-nav">
            <div class="detail-nav__left">
              <Button
                icon="pi pi-arrow-left"
                label="Kembali"
                class="p-button-outlined p-button-secondary detail-nav__back"
                @click="viewMode = 'resume'"
              />
              <div class="detail-nav__title">
                <h3>Log Detail Backup</h3>
                <span>{{ getCabangName(cabang) }} · Periode: {{ selectedPeriode }}</span>
              </div>
            </div>
            <div class="search-wrapper">
              <i class="pi pi-search search-icon"></i>
              <InputText
                v-model="deepSearch"
                placeholder="Cari KDTK, IP, path..."
                class="search-input"
              />
            </div>
          </div>
          
          <DataTable
            :value="deepDetailData"
            :loading="loadingDeep"
            responsiveLayout="scroll"
            stripedRows
            emptyMessage="Tidak ada log ditemukan."
            class="datatable-dialog"
            scrollable
            scrollHeight="400px"
            lazy
            paginator
            :rows="detailLimit"
            :rowsPerPageOptions="[10, 25, 50, 100]"
            :totalRecords="detailTotal"
            :first="(detailPage - 1) * detailLimit"
            @page="onDetailPage"
            @sort="onDetailSort"
          >
            <!-- KDTK -->
            <Column field="kdtk" header="KDTK" sortable style="width: 100px;">
              <template #body="{ data }">
                <span class="cell-primary">{{ data.kdtk }}</span>
              </template>
            </Column>

            <!-- Tanggal / Periode -->
            <Column field="periode" header="Tanggal" sortable style="width: 140px;">
              <template #body="{ data }">
                <span class="cell-date">{{ data.periode }}</span>
              </template>
            </Column>

            <!-- Status -->
            <Column field="stat" header="Status" sortable style="width: 90px;">
              <template #body="{ data }">
                <Tag
                  :severity="getStatusSeverity(data.stat)"
                  :value="data.stat || '—'"
                  style="min-width: 50px; justify-content: center;"
                />
              </template>
            </Column>

            <!-- Jml Isi -->
            <Column field="jml_isi" header="Isi" sortable style="width: 80px; text-align: right;">
              <template #body="{ data }">
                <span class="cell-num">{{ formatNumber(data.jml_isi) }}</span>
              </template>
            </Column>

            <!-- IP -->
            <Column field="ip" header="IP" style="width: 130px;">
              <template #body="{ data }">
                <span class="cell-mono" v-tooltip.top="data.ip || ''">{{ data.ip || '—' }}</span>
              </template>
            </Column>

            <!-- Path -->
            <Column field="path" header="Path Simpan" style="min-width: 200px;">
              <template #body="{ data }">
                <span class="cell-path" v-tooltip.top="data.path || ''">{{ data.path || '—' }}</span>
              </template>
            </Column>

            <!-- Waktu Update -->
            <Column field="updtime" header="Diperbarui" sortable style="width: 150px;">
              <template #body="{ data }">
                <span class="cell-date" style="font-size: 0.78rem; color: #94a3b8;">
                  {{ formatDate(data.updtime) }}
                </span>
              </template>
            </Column>

            <!-- Note (editable inline) -->
            <Column field="note" header="Note" style="min-width: 210px;">
              <template #body="{ data }">
                <!-- Edit mode -->
                <div v-if="editingNoteKey === noteKey(data)" class="note-edit">
                  <Textarea
                    v-model="editingNoteText"
                    rows="3"
                    autoResize
                    class="note-textarea"
                    placeholder="Tulis catatan..."
                    @keydown.esc="cancelEdit"
                  />
                  <div class="note-actions">
                    <Button
                      label="Simpan"
                      icon="pi pi-check"
                      class="p-button-success note-save-btn"
                      :loading="savingNote"
                      @click="saveNote(data)"
                    />
                    <Button
                      icon="pi pi-times"
                      class="p-button-text p-button-secondary note-cancel-btn"
                      v-tooltip.top="'Batal'"
                      :disabled="savingNote"
                      @click="cancelEdit"
                    />
                  </div>
                </div>

                <!-- Display mode -->
                <div v-else class="note-cell">
                  <span :class="['note-text', !data.note && 'note-text--empty']">
                    {{ data.note || '—' }}
                  </span>
                  <Button
                    icon="pi pi-pencil"
                    class="p-button-rounded p-button-text p-button-sm note-pencil"
                    v-tooltip.left="'Edit note'"
                    @click="startEdit(data)"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
          <!-- Info pagination -->
          <div class="detail-pagination-info" style="font-size: 0.8rem; color: #64748b; padding: 0.5rem 0.25rem;">
            <span>Menampilkan {{ detailRangeStart }}–{{ detailRangeEnd }} dari {{ detailTotal.toLocaleString('id-ID') }} record</span>
          </div>
        </div>

      </transition>
    </div>
  </Dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import Textarea from 'primevue/textarea';
import Tag from 'primevue/tag';
import { rekapBackupService } from '@/services';
import { useCabangStore } from '@/stores';

const props = defineProps({
  visible: { type: Boolean, default: false },
  cabang:  { type: String,  default: '' },
  type:    { type: String,  default: 'harian' },
});

const emit = defineEmits(['update:visible']);
const toast = useToast();
const cabangStore = useCabangStore();

const getCabangName = (kdcab) => cabangStore.getCabangName(kdcab);

// ── Helpers ──────────────────────────────────────────────────
const formatNumber = (n) => {
  if (n === null || n === undefined || n === '') return '—';
  const num = Number(n);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(num);
};

const formatDate = (val) => {
  if (!val) return '—';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(val));
  } catch {
    return val;
  }
};

const getStatusSeverity = (stat) => {
  if (!stat) return 'secondary';
  const s = stat.toLowerCase();
  if (s === 'ok' || s === '1' || s === 'success') return 'success';
  if (s === 'pending' || s === 'process') return 'warning';
  return 'danger';
};

// ── Resume ───────────────────────────────────────────────────
const viewMode  = ref('resume');
const loading   = ref(false);
const resumeData = ref([]);
const resumeSearch = ref('');

const filteredResumeData = computed(() => {
  if (!resumeSearch.value) return resumeData.value;
  const q = resumeSearch.value.toLowerCase();
  return resumeData.value.filter(d => 
    d.periode?.toLowerCase().includes(q) || 
    d.note?.toLowerCase().includes(q) ||
    d.path?.toLowerCase().includes(q) ||
    d.ip?.toLowerCase().includes(q)
  );
});

const loadResume = async () => {
  if (!props.cabang) return;
  viewMode.value = 'resume';
  loading.value  = true;
  cancelResumeEdit();
  try {
    const data = await rekapBackupService.getResume(props.type, props.cabang);
    resumeData.value = Array.isArray(data) ? data : [];
  } catch {
    resumeData.value = [];
    toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat resume data', life: 3000 });
  } finally {
    loading.value = false;
  }
};

// ── Inline Note Edit (Resume) ────────────────────────────────
const editingResumeNoteKey  = ref(null);   // key = periode
const editingResumeNoteText = ref('');
const savingResumeNote      = ref(false);

const resumeNoteKey = (row) => row.periode;

const startResumeEdit = (row) => {
  editingResumeNoteKey.value  = resumeNoteKey(row);
  editingResumeNoteText.value = row.note ?? '';
};

const cancelResumeEdit = () => {
  editingResumeNoteKey.value  = null;
  editingResumeNoteText.value = '';
};

const saveResumeNote = async (row) => {
  const newNote = editingResumeNoteText.value;
  const oldNote = row.note ?? '';

  if (newNote === '' && oldNote === '') {
    cancelResumeEdit();
    return;
  }

  savingResumeNote.value = true;
  try {
    await rekapBackupService.updateResumeNote(props.type, {
      cabang:  props.cabang,
      periode: row.periode,
      note:    newNote,
    });

    // Update data lokal
    const target = resumeData.value.find(d => resumeNoteKey(d) === resumeNoteKey(row));
    if (target) target.note = newNote;

    toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Note resume berhasil disimpan', life: 2500 });
    cancelResumeEdit();
  } catch (err) {
    const msg = err?.response?.data?.message || 'Gagal menyimpan note resume';
    toast.add({ severity: 'error', summary: 'Gagal', detail: msg, life: 3500 });
  } finally {
    savingResumeNote.value = false;
  }
};

// ── Deep Detail ──────────────────────────────────────────────
const loadingDeep    = ref(false);
const deepDetailData = ref([]);
const selectedPeriode = ref('');
const deepSearch     = ref('');

// Pagination & Sort state (server-side)
const detailPage  = ref(1);
const detailLimit = ref(10);
const detailTotal = ref(0);
const detailSortField = ref('');
const detailSortOrder = ref(1);

const detailRangeStart = computed(() => detailTotal.value === 0 ? 0 : (detailPage.value - 1) * detailLimit.value + 1);
const detailRangeEnd   = computed(() => Math.min(detailPage.value * detailLimit.value, detailTotal.value));

const noteKey = (row) => `${row.kdtk}_${row.periode}`;

// Debounce for server-side searching
let searchTimeout = null;
watch(deepSearch, (newVal) => {
  if (viewMode.value !== 'detail') return;
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    detailPage.value = 1;
    loadDetail(1, detailLimit.value);
  }, 500);
});

const loadDetail = async (page, limit) => {
  loadingDeep.value = true;
  try {
    const res = await rekapBackupService.getDetail(
      props.type, props.cabang, selectedPeriode.value,
      { 
        page, 
        limit, 
        search: deepSearch.value,
        sortField: detailSortField.value,
        sortOrder: detailSortOrder.value
      }
    );
    deepDetailData.value = Array.isArray(res.data) ? res.data : [];
    detailTotal.value    = res.total    ?? 0;
    detailPage.value     = res.page     ?? page;
    detailLimit.value    = res.limit    ?? limit;
  } catch {
    deepDetailData.value = [];
    detailTotal.value    = 0;
    toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat detail logs', life: 3000 });
  } finally {
    loadingDeep.value = false;
  }
};

const onDetailPage = (event) => {
  // PrimeVue lazy paginator: event.first = offset, event.rows = jumlah per halaman
  const newPage  = Math.floor(event.first / event.rows) + 1;
  const newLimit = event.rows;
  detailPage.value  = newPage;
  detailLimit.value = newLimit;
  cancelEdit();
  loadDetail(newPage, newLimit);
};

const onDetailSort = (event) => {
  detailSortField.value = event.sortField;
  detailSortOrder.value = event.sortOrder;
  detailPage.value = 1;
  cancelEdit();
  loadDetail(1, detailLimit.value);
};

const openDeepDetail = async (periode) => {
  selectedPeriode.value = periode;
  viewMode.value = 'detail';
  deepSearch.value = '';
  cancelEdit();
  // Reset ke halaman pertama setiap buka periode baru
  detailPage.value  = 1;
  detailLimit.value = 10;
  await loadDetail(1, 10);
};

// ── Inline Note Edit ─────────────────────────────────────────
const editingNoteKey  = ref(null);   // key unik baris yang sedang diedit
const editingNoteText = ref('');
const savingNote      = ref(false);

const startEdit = (row) => {
  editingNoteKey.value  = noteKey(row);
  editingNoteText.value = row.note ?? '';
};

const cancelEdit = () => {
  editingNoteKey.value  = null;
  editingNoteText.value = '';
};

const saveNote = async (row) => {
  const newNote = editingNoteText.value;
  const oldNote = row.note ?? '';

  // Satu-satunya kondisi skip: keduanya kosong (tidak ada perubahan yang berarti)
  if (newNote === '' && oldNote === '') {
    cancelEdit();
    return;
  }

  savingNote.value = true;
  try {
    await rekapBackupService.updateNote(props.type, {
      cabang:  props.cabang,
      kdtk:    row.kdtk,
      periode: row.periode,
      note:    newNote,
    });

    // Update data lokal
    const target = deepDetailData.value.find(d => noteKey(d) === noteKey(row));
    if (target) target.note = newNote;

    toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Note berhasil disimpan', life: 2500 });
    cancelEdit();
  } catch (err) {
    const msg = err?.response?.data?.message || 'Gagal menyimpan note';
    toast.add({ severity: 'error', summary: 'Gagal', detail: msg, life: 3500 });
  } finally {
    savingNote.value = false;
  }
};

// ── Reset on close ───────────────────────────────────────────
watch(() => props.visible, (val) => {
  if (!val) {
    setTimeout(() => {
      viewMode.value       = 'resume';
      resumeData.value     = [];
      resumeSearch.value   = '';
      deepDetailData.value = [];
      deepSearch.value     = '';
      detailPage.value     = 1;
      detailTotal.value    = 0;
      detailSortField.value = '';
      detailSortOrder.value = 1;
      cancelEdit();
      cancelResumeEdit();
    }, 300);
  }
});
</script>

<style scoped>
@import './DetailDialog.style.css';
</style>
