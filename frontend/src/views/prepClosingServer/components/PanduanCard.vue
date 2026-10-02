<template>
  <div v-if="panduan" class="panduan-card">
    <div v-if="!hideHead" class="panduan-head">
      <span class="panduan-title">
        {{ panduan.KDCAB }} · {{ panduan.NAMACAB || '—' }}
      </span>
      <Tag :value="panduan.OS || '—'" :severity="panduan.OS === 'WINDOWS' ? 'info' : 'warning'" />
    </div>

    <div class="panduan-grid">
      <!-- Server Bulanan -->
      <div class="panduan-section">
        <div class="panduan-section-title"><i class="pi pi-server"></i> Server Bulanan</div>
        <div class="panduan-row" v-if="panduan.REMOTE_BULANAN">
          <span class="panduan-label">Remote</span>
          <Tag :value="panduan.REMOTE_BULANAN" :severity="methodSeverity(panduan.REMOTE_BULANAN)" />
          <code v-if="connStringBulanan" class="cred cred-conn">{{ connStringBulanan }}</code>
        </div>
        <div class="panduan-row">
          <span class="panduan-label">IP</span>
          <code class="cred cred-ip">{{ panduan.IP_BULANAN || '—' }}</code>
        </div>
        <div v-if="panduan.USER_BULANAN || panduan.PASS_BULANAN" class="panduan-row">
          <span class="panduan-label">User</span>
          <span class="cred">{{ panduan.USER_BULANAN || '—' }}</span>
        </div>
        <div v-if="panduan.USER_BULANAN || panduan.PASS_BULANAN" class="panduan-row">
          <span class="panduan-label">Pass{{ panduan.REMOTE_BULANAN === 'VNC' ? ' VNC' : '' }}</span>
          <span class="cred">
            {{ hideSecrets ? '••••••' : (panduan.PASS_BULANAN || '—') }}
            <button v-if="panduan.PASS_BULANAN" type="button" class="eye-btn" @click="hideSecrets = !hideSecrets">
              <i :class="hideSecrets ? 'pi pi-eye' : 'pi pi-eye-slash'"></i>
            </button>
          </span>
        </div>
        <div v-if="panduan.PORT_BULANAN" class="panduan-row">
          <span class="panduan-label">Port</span>
          <code class="cred">{{ panduan.PORT_BULANAN }}</code>
        </div>
      </div>

      <!-- Database -->
      <div class="panduan-section">
        <div class="panduan-section-title"><i class="pi pi-database"></i> Database Bulanan</div>
        <div v-if="panduan.DB_USER" class="panduan-row">
          <span class="panduan-label">User</span>
          <span class="cred">{{ panduan.DB_USER }}</span>
        </div>
        <div v-if="panduan.DB_PASS" class="panduan-row">
          <span class="panduan-label">Pass</span>
          <span class="cred">
            {{ hideSecrets ? '••••••' : panduan.DB_PASS }}
            <button type="button" class="eye-btn" @click="hideSecrets = !hideSecrets">
              <i :class="hideSecrets ? 'pi pi-eye' : 'pi pi-eye-slash'"></i>
            </button>
          </span>
        </div>
        <div v-if="panduan.DB_PORT" class="panduan-row">
          <span class="panduan-label">Port</span>
          <code class="cred">{{ panduan.DB_PORT }}</code>
        </div>
      </div>

      <!-- HDD Check -->
      <div class="panduan-section panduan-section-hdd">
        <div class="panduan-section-title"><i class="pi pi-hdd"></i> Cek HDD</div>
        <p class="panduan-hdd">{{ panduan.HDD_CHECK || '—' }}</p>
      </div>

      <!-- Server Tampung -->
      <div class="panduan-section">
        <div class="panduan-section-title"><i class="pi pi-inbox"></i> Server Tampung</div>
        <div class="panduan-row" v-if="panduan.REMOTE_TAMPUNG">
          <span class="panduan-label">Remote</span>
          <Tag :value="panduan.REMOTE_TAMPUNG" :severity="methodSeverity(panduan.REMOTE_TAMPUNG)" />
        </div>
        <div class="panduan-row">
          <span class="panduan-label">IP</span>
          <code class="cred cred-ip">{{ panduan.IP_TAMPUNG || '—' }}</code>
        </div>
        <div v-if="panduan.USER_TAMPUNG" class="panduan-row">
          <span class="panduan-label">User</span>
          <span class="cred">{{ panduan.USER_TAMPUNG }}</span>
        </div>
        <div v-if="panduan.PASS_TAMPUNG" class="panduan-row">
          <span class="panduan-label">Pass</span>
          <span class="cred">
            {{ hideSecrets ? '••••••' : panduan.PASS_TAMPUNG }}
            <button type="button" class="eye-btn" @click="hideSecrets = !hideSecrets">
              <i :class="hideSecrets ? 'pi pi-eye' : 'pi pi-eye-slash'"></i>
            </button>
          </span>
        </div>
        <div v-if="panduan.VNC_PASS_TAMPUNG" class="panduan-row">
          <span class="panduan-label">Pass VNC</span>
          <span class="cred">
            {{ hideSecrets ? '••••••' : panduan.VNC_PASS_TAMPUNG }}
            <button type="button" class="eye-btn" @click="hideSecrets = !hideSecrets">
              <i :class="hideSecrets ? 'pi pi-eye' : 'pi pi-eye-slash'"></i>
            </button>
          </span>
        </div>
        <div class="panduan-row">
          <span class="panduan-label">Path</span>
          <code class="cred cred-path">{{ panduan.PATH_TAMPUNG || '—' }}</code>
        </div>
      </div>
    </div>

    <div v-if="panduan.CATATAN" class="panduan-note">
      <i class="pi pi-info-circle"></i> {{ panduan.CATATAN }}
    </div>
  </div>

  <div v-else class="panduan-card panduan-empty">
    <i class="pi pi-info-circle"></i>
    <span>Belum ada panduan untuk cabang ini.</span>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import Tag from 'primevue/tag';

const props = defineProps({
  panduan: { type: Object, default: null },
  // Sembunyikan header judul (KDCAB + OS) — dipakai bila caller sudah menampilkan judul sendiri
  hideHead: { type: Boolean, default: false },
});

const hideSecrets = ref(true);

function methodSeverity(method = '') {
  const m = String(method).toLowerCase();
  if (m.includes('ssh')) return 'contrast';
  if (m.includes('vnc')) return 'warn';
  if (m.includes('rdp')) return 'info';
  return 'secondary';
}

const connStringBulanan = computed(() => {
  const p = props.panduan;
  if (!p?.IP_BULANAN) return '';
  const m = String(p.REMOTE_BULANAN || '').toLowerCase();
  if (m.includes('ssh')) {
    const user = p.USER_BULANAN || 'user';
    const port = p.PORT_BULANAN ? ` -p ${p.PORT_BULANAN}` : '';
    return `ssh ${user}@${p.IP_BULANAN}${port}`;
  }
  if (m.includes('vnc')) return `${p.IP_BULANAN} (VNC)`;
  if (m.includes('rdp')) return `${p.IP_BULANAN} (RDP)`;
  return '';
});
</script>

<style scoped>
.panduan-card {
  border: 1px solid var(--surface-border, #e0e0e0);
  border-radius: 8px;
  padding: 12px 14px;
  background: var(--surface-card, #fff);
  margin-bottom: 10px;
}
.panduan-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.panduan-title {
  font-weight: 600;
  font-size: 0.95rem;
}
.panduan-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}
.panduan-section {
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--surface-50, #f8f9fa);
}
.panduan-section-title {
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--text-color-secondary);
  margin-bottom: 6px;
}
.panduan-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 0.85rem;
}
.panduan-label {
  min-width: 34px;
  color: var(--text-color-secondary);
  font-size: 0.78rem;
}
.cred {
  font-family: 'Consolas', 'Courier New', monospace;
  background: #fff3cd;
  border: 1px solid #ffe08a;
  color: #7a5a00;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 0.85rem;
  word-break: break-all;
}
.cred-ip {
  background: #d4edda;
  border-color: #a9dcb8;
  color: #155724;
  font-weight: 600;
}
.cred-conn {
  background: #e2e3e5;
  border-color: #c6c8ca;
  color: #383d41;
}
.cred-path {
  background: #d1ecf1;
  border-color: #a8d8e3;
  color: #0c5460;
}
.panduan-hdd {
  margin: 0;
  font-size: 0.85rem;
  color: #856404;
  background: #fff3cd;
  border-left: 3px solid #ffc107;
  padding: 4px 8px;
  border-radius: 4px;
}
.panduan-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 8px;
  font-size: 0.82rem;
  color: var(--text-color-secondary);
  background: var(--surface-50);
  border-radius: 6px;
  padding: 6px 8px;
}
.panduan-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-color-secondary);
  font-size: 0.9rem;
}
.eye-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--primary-color, #2196f3);
  padding: 2px;
  margin-left: 4px;
}
</style>