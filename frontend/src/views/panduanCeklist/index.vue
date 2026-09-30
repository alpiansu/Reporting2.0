<template>
  <div class="panduan-ceklist-view">
    <PageHeader
      title="Panduan Ceklist Closing Bulanan"
      subtitle="Kelola guide Before Closing Bulanan per cabang"
      description="Data referensi akses server bulanan, database, dan server tampung per cabang. Informasi ini dipakai untuk auto-fill dan ditampilkan sebagai panduan di halaman Ceklist Prepare Closing." />

    <div class="content-container">
      <div class="table-toolbar">
        <Button icon="pi pi-refresh" label="Muat Ulang" class="p-button-secondary p-button-sm"
          :loading="loading" @click="loadData" />
        <Button icon="pi pi-plus" label="Tambah Panduan" class="p-button-primary p-button-sm"
          @click="openCreate" />
      </div>

      <DataTable :value="rows" :loading="loading" class="panduan-table" stripedRows
        responsiveLayout="scroll">
        <template #empty>
          <div class="table-empty"><i class="pi pi-inbox"></i><span>Belum ada panduan.</span></div>
        </template>

        <Column field="KDCAB" header="KDCAB" style="width:80px" />
        <Column field="NAMACAB" header="Nama Cabang" style="min-width:130px">
          <template #body="{ data }">{{ data.NAMACAB || '—' }}</template>
        </Column>
        <Column header="OS" style="width:90px">
          <template #body="{ data }">
            <Tag :value="data.OS || '—'" :severity="data.OS === 'WINDOWS' ? 'info' : 'warning'" />
          </template>
        </Column>
        <Column header="Server Bulanan" style="min-width:210px">
          <template #body="{ data }">
            <div class="cell-stack">
              <code class="cell-ip">{{ data.IP_BULANAN || '—' }}</code>
              <span v-if="data.USER_BULANAN || data.PASS_BULANAN" class="cell-sub cred-soft">
                {{ data.USER_BULANAN || '—' }} / {{ data.PASS_BULANAN ? '••••' : '—' }}
              </span>
            </div>
          </template>
        </Column>
        <Column header="Database" style="min-width:150px">
          <template #body="{ data }">
            <div class="cell-stack">
              <span>{{ data.DB_USER || '—' }}</span>
              <span class="cell-sub">pass {{ data.DB_PASS ? '••••' : '—' }} :{{ data.DB_PORT || '3306' }}</span>
            </div>
          </template>
        </Column>
        <Column header="Cek HDD" style="min-width:200px">
          <template #body="{ data }">
            <span class="cell-hdd ">{{ data.HDD_CHECK || '—' }}</span>
          </template>
        </Column>
        <Column header="Server Tampung" style="min-width:210px">
          <template #body="{ data }">
            <div class="cell-stack">
              <code class="cell-ip">{{ data.IP_TAMPUNG || '—' }}</code>
              <span class="cell-sub" v-if="data.PATH_TAMPUNG">{{ data.PATH_TAMPUNG }}</span>
            </div>
          </template>
        </Column>
        <Column header="Aksi" style="width:90px">
          <template #body="{ data }">
            <div class="row-actions">
              <Button icon="pi pi-pencil" class="p-button-text p-button-sm p-button-info"
                v-tooltip.top="'Edit'" @click="openEdit(data)" />
              <Button icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger"
                v-tooltip.top="'Hapus'" @click="askDelete(data)" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Create / Edit Dialog -->
    <Dialog v-model:visible="dlgVisible" :header="isEdit ? 'Edit Panduan ' + form.kdcab : 'Tambah Panduan'"
      modal class="panduan-dialog" :style="{ width: '720px' }">
      <div class="panduan-form">
        <div class="form-section">
          <div class="form-section-title"><i class="pi pi-tag"></i> Identitas</div>
          <div class="form-grid">
            <div class="form-field">
              <label>KDCAB <span class="req">*</span></label>
              <InputText v-model="form.kdcab" placeholder="G033" class="w-full" :disabled="isEdit" />
            </div>
            <div class="form-field">
              <label>Nama Cabang</label>
              <InputText v-model="form.namacab" placeholder="TANGERANG 2" class="w-full" />
            </div>
            <div class="form-field">
              <label>OS</label>
              <Dropdown v-model="form.os" :options="['WINDOWS','LINUX']" placeholder="Pilih OS" class="w-full" />
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title"><i class="pi pi-server"></i> Server Bulanan</div>
          <div class="form-grid">
            <div class="form-field">
              <label>IP Address</label>
              <InputText v-model="form.ip_bulanan" placeholder="192.168.36.100" class="w-full" />
            </div>
            <div class="form-field">
              <label>User</label>
              <InputText v-model="form.user_bulanan" placeholder="root / edp / kosong (VNC)" class="w-full" />
            </div>
            <div class="form-field">
              <label>Password</label>
              <div class="pwd-field">
                <InputText v-model="form.pass_bulanan" :type="showPwd.bulanan ? 'text' : 'password'" class="w-full" autocomplete="off" />
                <button type="button" class="pwd-eye" @click="togglePwd('bulanan')" v-tooltip.top="'Tampilkan/Sembunyikan'">
                  <i :class="showPwd.bulanan ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                </button>
              </div>
            </div>
            <div class="form-field">
              <label>Port</label>
              <InputText v-model="form.port_bulanan" placeholder="22 / 2808" class="w-full" />
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title"><i class="pi pi-database"></i> Database Bulanan</div>
          <div class="form-grid">
            <div class="form-field">
              <label>DB User</label>
              <InputText v-model="form.db_user" placeholder="root" class="w-full" />
            </div>
            <div class="form-field">
              <label>DB Password</label>
              <div class="pwd-field">
                <InputText v-model="form.db_pass" :type="showPwd.db ? 'text' : 'password'" class="w-full" autocomplete="off" />
                <button type="button" class="pwd-eye" @click="togglePwd('db')" v-tooltip.top="'Tampilkan/Sembunyikan'">
                  <i :class="showPwd.db ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                </button>
              </div>
            </div>
            <div class="form-field">
              <label>DB Port</label>
              <InputText v-model="form.db_port" placeholder="3306" class="w-full" />
            </div>
            <div class="form-field form-field-full">
              <label>Cek HDD</label>
              <InputText v-model="form.hdd_check" placeholder="df -h /home, min 50 GB" class="w-full" />
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title"><i class="pi pi-inbox"></i> Server Tampung</div>
          <div class="form-grid">
            <div class="form-field">
              <label>IP Address</label>
              <InputText v-model="form.ip_tampung" placeholder="192.168.36.134" class="w-full" />
            </div>
            <div class="form-field">
              <label>User</label>
              <InputText v-model="form.user_tampung" placeholder="SERVER FTP" class="w-full" />
            </div>
            <div class="form-field">
              <label>Password</label>
              <div class="pwd-field">
                <InputText v-model="form.pass_tampung" :type="showPwd.tampung ? 'text' : 'password'" class="w-full" autocomplete="off" />
                <button type="button" class="pwd-eye" @click="togglePwd('tampung')" v-tooltip.top="'Tampilkan/Sembunyikan'">
                  <i :class="showPwd.tampung ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                </button>
              </div>
            </div>
            <div class="form-field form-field-full">
              <label>Path Tampung</label>
              <InputText v-model="form.path_tampung" placeholder="E:\G026\BACKUP\BULANAN" class="w-full" />
            </div>
            <div class="form-field form-field-full">
              <label>Catatan</label>
              <Textarea v-model="form.catatan" rows="2" class="w-full" placeholder="Catatan tambahan..." />
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Batal" icon="pi pi-times" class="p-button-text" @click="dlgVisible = false" />
        <Button label="Simpan" icon="pi pi-save" class="p-button-primary" :loading="saving" @click="save" />
      </template>
    </Dialog>

    <!-- Confirm Delete -->
    <Dialog v-model:visible="confirmDlg.visible" header="Konfirmasi Hapus" modal :style="{ width: '380px' }">
      <div class="confirm-body">
        <i class="pi pi-exclamation-triangle confirm-icon"></i>
        <p>Hapus panduan untuk {{ confirmDlg.row?.KDCAB }} ({{ confirmDlg.row?.NAMACAB || '' }})?</p>
      </div>
      <template #footer>
        <Button label="Batal" icon="pi pi-times" class="p-button-text" @click="confirmDlg.visible = false" />
        <Button label="Hapus" icon="pi pi-trash" class="p-button-danger" :loading="deleting" @click="doDelete" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import PageHeader from '@/components/PageHeader.vue';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import * as api from '@/services/panduan.service.js';

const toast = useToast();
const rows = ref([]);
const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const dlgVisible = ref(false);
const isEdit = ref(false);
const confirmDlg = reactive({ visible: false, row: null });
const showPwd = reactive({ bulanan: false, db: false, tampung: false });

const form = reactive({
  kdcab: '', namacab: '', os: 'WINDOWS',
  ip_bulanan: '', user_bulanan: '', pass_bulanan: '', port_bulanan: '',
  db_user: '', db_pass: '', db_port: '', hdd_check: '',
  ip_tampung: '', user_tampung: '', pass_tampung: '', path_tampung: '',
  catatan: '',
});

const COL_MAP = {
  kdcab: 'KDCAB', namacab: 'NAMACAB', os: 'OS',
  ip_bulanan: 'IP_BULANAN', user_bulanan: 'USER_BULANAN', pass_bulanan: 'PASS_BULANAN', port_bulanan: 'PORT_BULANAN',
  db_user: 'DB_USER', db_pass: 'DB_PASS', db_port: 'DB_PORT', hdd_check: 'HDD_CHECK',
  ip_tampung: 'IP_TAMPUNG', user_tampung: 'USER_TAMPUNG', pass_tampung: 'PASS_TAMPUNG', path_tampung: 'PATH_TAMPUNG',
  catatan: 'CATATAN',
};

async function loadData() {
  loading.value = true;
  try {
    rows.value = await api.getPanduan();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 4000 });
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  Object.keys(form).forEach(k => { form[k] = ''; });
  form.os = 'WINDOWS';
  Object.keys(showPwd).forEach(k => { showPwd[k] = false; });
}

function fillFromRow(row) {
  resetForm();
  Object.entries(COL_MAP).forEach(([k, c]) => { form[k] = row[c] ?? ''; });
}

function openCreate() { isEdit.value = false; resetForm(); dlgVisible.value = true; }
function openEdit(row) { isEdit.value = true; fillFromRow(row); dlgVisible.value = true; }

function togglePwd(section) { showPwd[section] = !showPwd[section]; }

function toBody() {
  const body = {};
  Object.entries(COL_MAP).forEach(([k, c]) => { body[c] = (form[k] ?? '').trim(); });
  return body;
}

async function save() {
  if (!form.kdcab) {
    toast.add({ severity: 'warn', summary: 'Validasi', detail: 'KDCAB wajib diisi', life: 3000 }); return;
  }
  saving.value = true;
  try {
    const body = toBody();
    if (isEdit.value) await api.updatePanduan(form.kdcab, body);
    else await api.createPanduan(body);
    dlgVisible.value = false;
    toast.add({ severity: 'success', summary: 'Sukses', detail: 'Panduan tersimpan', life: 3000 });
    await loadData();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 4000 });
  } finally { saving.value = false; }
}

function askDelete(row) { confirmDlg.row = row; confirmDlg.visible = true; }

async function doDelete() {
  deleting.value = true;
  try {
    await api.deletePanduan(confirmDlg.row.KDCAB);
    confirmDlg.visible = false;
    toast.add({ severity: 'success', summary: 'Dihapus', detail: 'Panduan dihapus', life: 3000 });
    await loadData();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: e.message, life: 4000 });
  } finally { deleting.value = false; }
}

onMounted(loadData);
</script>

<style scoped>
.table-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.table-empty {
  display: flex; align-items: center; gap: 8px;
  justify-content: center; padding: 32px 0;
  color: var(--text-color-secondary);
}
.cell-stack { display: flex; flex-direction: column; gap: 2px; }
.cell-sub { font-size: 0.8rem; color: var(--text-color-secondary); }
.cell-ip {
  font-family: 'Consolas', monospace;
  background: #d4edda; border: 1px solid #a9dcb8; color: #155724;
  border-radius: 4px; padding: 0 6px;
  width: fit-content;
}
.cred-soft { font-family: 'Consolas', monospace; }
.cell-hdd {}

.panduan-form { display: flex; flex-direction: column; gap: 12px; }
.form-section {
  border: 1px solid var(--surface-border, #e0e0e0);
  border-radius: 8px;
  padding: 10px 12px;
}
.form-section-title {
  font-size: 0.8rem; font-weight: 600; text-transform: uppercase;
  color: var(--text-color-secondary); margin-bottom: 8px;
}
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; }
.form-field { display: flex; flex-direction: column; gap: 4px; }
.form-field-full { grid-column: 1 / -1; }
.req { color: #dc2626; }
.pwd-field { position: relative; }
.pwd-eye {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer;
  color: var(--text-color-secondary);
}
.pwd-eye:hover { color: var(--primary-color, #2196f3); }
.row-actions { display: flex; gap: 2px; }
.confirm-body { display: flex; align-items: center; gap: 10px; }
.confirm-icon { color: #f59e0b; font-size: 1.4rem; }
</style>