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
          <div class="text-xl font-bold capitalize mb-1 dialog-header-title" style="line-height: 1.2;">Resume Data {{ type }}</div>
          <div class="text-sm dialog-header-subtitle">
            <span class="font-bold dialog-header-cabang">{{ getCabangName(cabang) }}</span>
            <span class="font-mono"> — {{ formatCode(cabang) }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Content ── -->
    <div class="dialog-content">
      <transition name="slide-fade" mode="out-in">

        <!-- ============ RESUME VIEW ============ -->
        <div v-if="viewMode === 'resume'" key="resume">
          <div class="detail-nav" style="margin-bottom: 1rem; background: var(--surface-ground); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--surface-border);">
            <div class="detail-nav__left" style="flex: 1;">
              <p style="margin: 0; font-size: 0.825rem; color: var(--text-color-secondary); line-height: 1.5;">
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

          <!-- Scorecards Ringkasan Periode Cabang (Dialog Level 1) -->
          <div class="audit-scorecards mb-3">
            <div class="audit-card audit-card--total">
              <div class="audit-card__icon"><i class="pi pi-calendar"></i></div>
              <div class="audit-card__body">
                <span class="audit-card__label">Total Periode History</span>
                <span class="audit-card__val">{{ formatNumber(resumeData.length) }}</span>
              </div>
            </div>
            <div class="audit-card audit-card--lengkap">
              <div class="audit-card__icon"><i class="pi pi-check-circle"></i></div>
              <div class="audit-card__body">
                <span class="audit-card__label">Periode Lengkap (100%)</span>
                <span class="audit-card__val">{{ formatNumber(resumeLengkapCount) }}</span>
              </div>
            </div>
            <div class="audit-card audit-card--kurang">
              <div class="audit-card__icon"><i class="pi pi-exclamation-triangle"></i></div>
              <div class="audit-card__body">
                <span class="audit-card__label">Periode Ada Defect</span>
                <span class="audit-card__val">{{ formatNumber(resumeDefectCount) }}</span>
              </div>
            </div>
            <div class="audit-card audit-card--tidakada">
              <div class="audit-card__icon"><i class="pi pi-clock"></i></div>
              <div class="audit-card__body">
                <span class="audit-card__label">Belum Diaudit / Tidak Bisa Dicek</span>
                <span class="audit-card__val">{{ formatNumber(resumeBelumAuditCount) }}</span>
              </div>
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

            <!-- Status Audit WRC -->
            <Column field="audit_status" header="Status Audit WRC" sortable style="width: 175px; text-align: center;">
              <template #body="{ data }">
                <Tag
                  :severity="data.audit_severity || 'secondary'"
                  :value="data.audit_label || 'Belum Diaudit'"
                  :icon="data.audit_status === 'LENGKAP' ? 'pi pi-check' : (data.audit_status === 'BERMASALAH' ? 'pi pi-exclamation-triangle' : (data.audit_status === 'TIDAK_DAPAT_DIPERIKSA' ? 'pi pi-question-circle' : 'pi pi-shield'))"
                  :class="['audit-status-tag', getAuditTagClass(data)]"
                  :style="getAuditTagStyle()"
                  v-tooltip.top="data.audit_status === 'BELUM_AUDIT' ? 'Klik untuk verifikasi kelengkapan data vs WRC' : 'Klik untuk melihat rincian hasil audit'"
                  @click="openAudit(data.periode)"
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
            <Column header="Aksi" style="width: 110px; text-align: center;">
              <template #body="{ data }">
                <div class="flex align-items-center justify-content-center gap-2">
                  <Button
                    icon="pi pi-shield"
                    class="p-button-rounded p-button-sm p-button-outlined p-button-warning"
                    style="width: 34px; height: 34px;"
                    v-tooltip.top="'Audit Kelengkapan WRC'"
                    @click="openAudit(data.periode)"
                  />
                  <Button
                    icon="pi pi-chevron-right"
                    class="p-button-rounded p-button-sm p-button-outlined"
                    style="width: 34px; height: 34px;"
                    v-tooltip.left="'Lihat Log Detail'"
                    @click="openDeepDetail(data.periode)"
                  />
                </div>
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
            <div class="flex align-items-center gap-2">
              <Button
                icon="pi pi-shield"
                label="Audit WRC"
                class="p-button-outlined p-button-warning p-button-sm"
                v-tooltip.top="'Audit kelengkapan data vs WRC periode ini'"
                @click="openAudit(selectedPeriode)"
              />
              <div class="search-wrapper">
                <i class="pi pi-search search-icon"></i>
                <InputText
                  v-model="deepSearch"
                  placeholder="Cari KDTK, IP, path..."
                  class="search-input"
                />
              </div>
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
                <span class="cell-primary font-mono font-medium">{{ formatCode(data.kdtk) }}</span>
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
                <span class="cell-date" style="font-size: 0.78rem; color: var(--text-color-secondary);">
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
          <div class="detail-pagination-info" style="font-size: 0.8rem; color: var(--text-color-secondary); padding: 0.5rem 0.25rem;">
            <span>Menampilkan {{ detailRangeStart }}–{{ detailRangeEnd }} dari {{ detailTotal.toLocaleString('id-ID') }} record</span>
          </div>
        </div>

        <!-- ============ AUDIT VIEW ============ -->
        <div v-else-if="viewMode === 'audit'" key="audit">
          <!-- Nav bar -->
          <div class="detail-nav">
            <div class="detail-nav__left">
              <Button
                icon="pi pi-arrow-left"
                label="Kembali"
                class="p-button-outlined p-button-secondary detail-nav__back"
                @click="backFromAudit"
              />
              <div class="detail-nav__title">
                <h3>Audit Kelengkapan Data vs WRC</h3>
                <span v-if="type === 'bulanan'">
                  {{ getCabangName(cabang) }} · Periode: {{ auditPeriode }} · Ground Truth: kodetoko_{{ auditYymm }} vs backup_bulanan_{{ auditYear }}
                </span>
                <span v-else>
                  {{ getCabangName(cabang) }} · Periode: {{ auditPeriode }} · Ground Truth: kodetoko_{{ auditYymm }}, lpm_{{ auditYymm }}, mstran_{{ auditYymm }}
                </span>
              </div>
            </div>
            <div class="flex align-items-center gap-2 flex-wrap">
              <Button
                icon="pi pi-refresh"
                label="Reload Data"
                class="p-button-outlined p-button-secondary p-button-sm"
                v-tooltip.top="'Muat ulang data audit dari cache lokal / database'"
                :loading="auditLoading"
                @click="runAudit(false)"
                style="margin-right: 0.5rem;"
              />
              <Button
                icon="pi pi-sync"
                label="Audit Ulang WRC"
                class="p-button-outlined p-button-warning p-button-sm"
                v-tooltip.top="'Jalankan audit ulang segar langsung ke database WRC cabang'"
                :loading="auditLoading"
                @click="runAudit(true)"
                style="margin-right: 0.5rem;"
              />
              <Button
                icon="pi pi-file-excel"
                label="Export Excel"
                class="p-button-success p-button-sm"
                v-tooltip.top="'Unduh laporan audit kelengkapan ke Excel'"
                :loading="auditExporting"
                :disabled="!auditData || !auditData.stores?.length"
                @click="exportAudit"
              />
            </div>
          </div>

          <!-- Banner Peringatan jika data WRC tidak ada di cabang -->
          <div v-if="auditData?.summary?.wrc_available === false" class="expansion-alert expansion-alert--danger mb-3" style="display: flex; align-items: flex-start; gap: 0.75rem;">
            <i class="pi pi-exclamation-circle text-xl alert-icon-danger" style="margin-top: 2px;"></i>
            <div>
              <div class="font-bold text-sm alert-title-danger">Data Master WRC Tidak Tersedia</div>
              <div class="text-xs mt-1 alert-desc-danger" style="line-height: 1.5;">
                {{ auditData.summary.message || 'Tabel transaksi/kodetoko untuk periode ini tidak ditemukan di database WRC cabang (sudah diarsipkan atau belum terbentuk).' }}<br>
                Status kelengkapan ditandai sebagai <strong>Tidak Dapat Diperiksa</strong>. Daftar di bawah hanya menampilkan data yang terdata di server central.
              </div>
            </div>
          </div>

          <!-- Scorecard Metrik Resume -->
          <div class="audit-scorecards">
            <div class="audit-card audit-card--total">
              <div class="audit-card__icon"><i class="pi pi-building"></i></div>
              <div class="audit-card__body">
                <span class="audit-card__label">Toko Aktif di WRC (kodetoko)</span>
                <span class="audit-card__val">
                  {{ auditData?.summary?.wrc_available === false ? '0 (WRC N/A)' : formatNumber(auditData?.summary?.total_toko_wrc ?? 0) }}
                </span>
              </div>
            </div>
            <div class="audit-card audit-card--lengkap">
              <div class="audit-card__icon"><i class="pi pi-check-circle"></i></div>
              <div class="audit-card__body">
                <span class="audit-card__label">{{ type === 'bulanan' ? 'Backup Lengkap & Valid' : 'Lengkap (100% Ada)' }}</span>
                <span class="audit-card__val">{{ formatNumber(auditData?.summary?.lengkap ?? 0) }}</span>
              </div>
            </div>
            <div class="audit-card audit-card--kurang">
              <div class="audit-card__icon"><i class="pi pi-exclamation-triangle"></i></div>
              <div class="audit-card__body">
                <span class="audit-card__label">{{ type === 'bulanan' ? 'Data NOK / Gagal' : 'Kurang Tanggal' }}</span>
                <span class="audit-card__val">{{ formatNumber(type === 'bulanan' ? (auditData?.summary?.data_nok ?? 0) : (auditData?.summary?.kurang_tanggal ?? 0)) }}</span>
              </div>
            </div>
            <div class="audit-card audit-card--tidakada">
              <div class="audit-card__icon">
                <i :class="['pi', auditData?.summary?.wrc_available === false ? 'pi-question-circle' : 'pi-times-circle']"></i>
              </div>
              <div class="audit-card__body">
                <span class="audit-card__label">{{ auditData?.summary?.wrc_available === false ? 'Tidak Dapat Diperiksa' : 'Tidak Ada Backup' }}</span>
                <span class="audit-card__val">
                  {{ auditData?.summary?.wrc_available === false ? formatNumber(auditData?.summary?.tidak_dapat_diperiksa ?? 0) : formatNumber(auditData?.summary?.tidak_ada ?? 0) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Filter & Search Toolbar -->
          <div class="audit-toolbar">
            <div class="flex align-items-center gap-2" style="flex: 1; max-width: 420px;">
              <div class="search-wrapper" style="width: 100%;">
                <i class="pi pi-search search-icon"></i>
                <InputText
                  v-model="auditSearch"
                  placeholder="Cari kode toko atau nama toko..."
                  class="search-input"
                />
              </div>
            </div>
            <div class="flex align-items-center gap-2">
              <Dropdown
                v-model="auditStatusFilter"
                :options="statusFilterOptions"
                optionLabel="label"
                optionValue="value"
                class="audit-status-dropdown"
                style="min-width: 280px;"
              />
            </div>
          </div>

          <!-- DataTable Audit Toko Bulanan (Tanpa expander) -->
          <DataTable
            v-if="type === 'bulanan'"
            :value="filteredAuditStores"
            :loading="auditLoading"
            dataKey="kdtk"
            responsiveLayout="scroll"
            stripedRows
            emptyMessage="Tidak ada data audit bulanan ditemukan."
            class="datatable-dialog"
            paginator
            :rows="15"
            :rowsPerPageOptions="[15, 30, 50, 100]"
            sortMode="single"
          >
            <!-- Kode Toko -->
            <Column field="kdtk" header="Kode Toko" sortable style="width: 110px;">
              <template #body="{ data }">
                <span class="cell-primary font-mono font-medium">{{ formatCode(data.kdtk) }}</span>
              </template>
            </Column>

            <!-- Nama Toko -->
            <Column field="nama_toko" header="Nama Toko" sortable style="min-width: 200px;">
              <template #body="{ data }">
                <span class="cell-bold">{{ data.nama_toko || '—' }}</span>
              </template>
            </Column>

            <!-- Status Kelengkapan -->
            <Column field="status" header="Status Kelengkapan" sortable style="width: 175px; text-align: center;">
              <template #body="{ data }">
                <Tag
                  v-if="data.status === 'LENGKAP'"
                  severity="success"
                  value="LENGKAP"
                  icon="pi pi-check"
                />
                <Tag
                  v-else-if="data.status === 'DATA_NOK'"
                  severity="warning"
                  value="DATA NOK"
                  icon="pi pi-exclamation-triangle"
                />
                <Tag
                  v-else-if="data.status === 'TIDAK_DAPAT_DIPERIKSA'"
                  severity="secondary"
                  value="TIDAK DAPAT DIPERIKSA"
                  icon="pi pi-question-circle"
                />
                <Tag
                  v-else
                  severity="danger"
                  value="TIDAK ADA"
                  icon="pi pi-times"
                />
              </template>
            </Column>

            <!-- Stat di DB -->
            <Column field="stat" header="Stat di DB" sortable style="width: 110px; text-align: center;">
              <template #body="{ data }">
                <Tag
                  v-if="data.stat"
                  :severity="getStatusSeverity(data.stat)"
                  :value="data.stat"
                />
                <span v-else class="text-400 font-mono text-xs">—</span>
              </template>
            </Column>

            <!-- Jml Isi -->
            <Column field="jml_isi" header="Jml Isi" sortable style="width: 110px; text-align: right;">
              <template #body="{ data }">
                <span class="cell-num">{{ formatNumber(data.jml_isi) }}</span>
              </template>
            </Column>

            <!-- Path Backup -->
            <Column field="path" header="Path Backup" style="min-width: 220px;">
              <template #body="{ data }">
                <span v-if="data.path" class="cell-path" v-tooltip.top="data.path">{{ data.path }}</span>
                <span v-else class="text-400 font-mono text-xs">—</span>
              </template>
            </Column>

            <!-- Catatan -->
            <Column field="note" header="Catatan" style="min-width: 160px;">
              <template #body="{ data }">
                <span class="note-text">{{ data.note || '—' }}</span>
              </template>
            </Column>

            <!-- Diperbarui -->
            <Column field="updtime" header="Diperbarui" sortable style="width: 160px;">
              <template #body="{ data }">
                <span class="cell-date">{{ formatDate(data.updtime) }}</span>
              </template>
            </Column>
          </DataTable>

          <!-- DataTable Audit Toko Harian (dengan row expansion) -->
          <DataTable
            v-else
            :value="filteredAuditStores"
            :loading="auditLoading"
            v-model:expandedRows="auditExpandedRows"
            dataKey="kdtk"
            responsiveLayout="scroll"
            stripedRows
            emptyMessage="Tidak ada data audit harian ditemukan."
            class="datatable-dialog"
            paginator
            :rows="15"
            :rowsPerPageOptions="[15, 30, 50, 100]"
            sortMode="single"
          >
            <!-- Expander Column -->
            <Column expander style="width: 3.5rem; text-align: center;" />

            <!-- Kode Toko -->
            <Column field="kdtk" header="Kode Toko" sortable style="width: 110px;">
              <template #body="{ data }">
                <span class="cell-primary font-mono font-medium">{{ formatCode(data.kdtk) }}</span>
              </template>
            </Column>

            <!-- Nama Toko -->
            <Column field="nama_toko" header="Nama Toko" sortable style="min-width: 200px;">
              <template #body="{ data }">
                <span class="cell-bold">{{ data.nama_toko || '—' }}</span>
              </template>
            </Column>

            <!-- Status -->
            <Column field="status" header="Status Kelengkapan" sortable style="width: 175px; text-align: center;">
              <template #body="{ data }">
                <Tag
                  v-if="data.status === 'LENGKAP'"
                  severity="success"
                  value="LENGKAP"
                  icon="pi pi-check"
                />
                <Tag
                  v-else-if="data.status === 'KURANG_TANGGAL'"
                  severity="warning"
                  value="KURANG TGL"
                  icon="pi pi-exclamation-triangle"
                />
                <Tag
                  v-else-if="data.status === 'TIDAK_DAPAT_DIPERIKSA'"
                  severity="secondary"
                  value="TIDAK DAPAT DIPERIKSA"
                  icon="pi pi-question-circle"
                />
                <Tag
                  v-else
                  severity="danger"
                  value="TIDAK ADA"
                  icon="pi pi-times"
                />
              </template>
            </Column>

            <!-- Hari WRC -->
            <Column field="total_hari_wrc" header="Hari WRC" sortable style="width: 110px; text-align: right;">
              <template #body="{ data }">
                <Tag severity="info" :value="data.total_hari_wrc" style="min-width: 42px; justify-content: center;" />
              </template>
            </Column>

            <!-- Hari Backup -->
            <Column field="total_hari_backup" header="Hari Backup" sortable style="width: 110px; text-align: right;">
              <template #body="{ data }">
                <Tag severity="success" :value="data.total_hari_backup" style="min-width: 42px; justify-content: center;" />
              </template>
            </Column>

            <!-- Selisih Hari -->
            <Column field="selisih_hari" header="Selisih" sortable style="width: 100px; text-align: right;">
              <template #body="{ data }">
                <Tag
                  :severity="data.selisih_hari > 0 ? 'warning' : 'secondary'"
                  :value="data.selisih_hari"
                  style="min-width: 42px; justify-content: center;"
                />
              </template>
            </Column>

            <!-- Keterangan Tanggal -->
            <Column header="Rincian Masalah" style="min-width: 220px;">
              <template #body="{ data }">
                <span v-if="data.status === 'LENGKAP'" class="text-success font-medium text-xs">
                  <i class="pi pi-check text-xs mr-1"></i> Semua tanggal ter-backup
                </span>
                <span v-else-if="data.status === 'TIDAK_DAPAT_DIPERIKSA'" class="text-color-secondary font-medium text-xs">
                  <i class="pi pi-question-circle text-xs mr-1"></i> Data WRC tidak tersedia di cabang
                </span>
                <span v-else-if="data.status === 'TIDAK_ADA'" class="text-danger font-medium text-xs">
                  <i class="pi pi-times text-xs mr-1"></i> 0 file dari {{ data.total_hari_wrc }} hari aktif WRC
                </span>
                <div v-else class="flex align-items-center gap-1 flex-wrap">
                  <span v-if="data.missing_dates?.length" class="audit-defect-badge audit-defect-badge--missing">
                    {{ data.missing_dates.length }} tgl bolong
                  </span>
                  <span v-if="data.incomplete_dates?.length" class="audit-defect-badge audit-defect-badge--corrupt">
                    {{ data.incomplete_dates.length }} tgl gagal/0
                  </span>
                </div>
              </template>
            </Column>

            <!-- Row Expansion: Rincian Detail Tanggal Kurang -->
            <template #expansion="{ data: store }">
              <div class="audit-expansion-panel">
                <div class="audit-expansion-panel__header">
                  <div>
                    <h4 class="m-0 text-sm font-bold">Rincian Tanggal — {{ formatCode(store.kdtk) }} ({{ store.nama_toko }})</h4>
                    <span class="text-xs text-color-secondary">
                      WRC mencatat {{ store.total_hari_wrc }} hari transaksi. Backup valid: {{ store.total_hari_backup }} hari. Selisih: {{ store.selisih_hari }} hari.
                    </span>
                  </div>
                </div>

                <div v-if="store.status === 'LENGKAP'" class="expansion-alert expansion-alert--success">
                  <i class="pi pi-check-circle mr-2"></i>
                  Data toko ini 100% lengkap. Seluruh {{ store.total_hari_wrc }} tanggal transaksi di WRC memiliki file backup valid di server central.
                </div>

                <div v-else-if="store.status === 'TIDAK_ADA'" class="expansion-alert expansion-alert--danger">
                  <div class="mb-2">
                    <i class="pi pi-times-circle mr-2"></i>
                    <strong>Peringatan:</strong> Toko ini tercatat aktif di WRC (kodetoko_{{ auditYymm }}) dengan total {{ store.total_hari_wrc }} hari transaksi, namun sama sekali TIDAK MEMILIKI file backup di database central.
                  </div>
                  <div class="text-xs font-semibold mb-1 expansion-subheading">Daftar Tanggal Transaksi di WRC yang Hilang:</div>
                  <div class="date-chip-grid">
                    <span v-for="tgl in store.missing_dates" :key="tgl.tanggal" class="date-chip date-chip--missing">
                      {{ tgl.tanggal }}
                    </span>
                  </div>
                </div>

                <div v-else class="expansion-detail-content">
                  <!-- 1. Tanggal yang Bolong (Tidak ada backup) -->
                  <div v-if="store.missing_dates?.length" class="expansion-section">
                    <div class="expansion-section__title text-danger">
                      <i class="pi pi-calendar-times mr-1"></i>
                      Tanggal Bolong / Tidak Ada File Backup ({{ store.missing_dates.length }} hari):
                    </div>
                    <div class="date-chip-grid">
                      <span v-for="m in store.missing_dates" :key="m.tanggal" class="date-chip date-chip--missing" v-tooltip.top="m.reason">
                        {{ m.tanggal }}
                      </span>
                    </div>
                  </div>

                  <!-- 2. Tanggal yang Ada tetapi Status False / Jml Isi 0 -->
                  <div v-if="store.incomplete_dates?.length" class="expansion-section mt-3">
                    <div class="expansion-section__title text-warning">
                      <i class="pi pi-exclamation-triangle mr-1"></i>
                      Tanggal Terdata tetapi Status Gagal / Ukuran 0 ({{ store.incomplete_dates.length }} hari):
                    </div>
                    <div class="table-responsive mt-1">
                      <table class="audit-defect-table">
                        <thead>
                          <tr>
                            <th>Tanggal</th>
                            <th>Status di DB</th>
                            <th>Jml Isi</th>
                            <th>Catatan / Note</th>
                            <th>Path Simpan</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="inc in store.incomplete_dates" :key="inc.tanggal">
                            <td class="font-mono font-bold">{{ inc.tanggal }}</td>
                            <td><Tag severity="danger" :value="inc.stat" /></td>
                            <td>{{ formatNumber(inc.jml_isi) }}</td>
                            <td class="defect-note">{{ inc.note || '—' }}</td>
                            <td class="defect-path">{{ inc.path || '—' }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </DataTable>
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

const formatCode = (val) => {
  if (val === null || val === undefined) return '';
  return String(val).replace(/^#+/, '').trim();
};

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

const getAuditTagStyle = () => ({
  cursor: 'pointer',
  minWidth: '120px',
  justifyContent: 'center',
  transition: 'all 0.2s ease',
});

const getAuditTagClass = (data) => {
  if (data.audit_status !== 'BERMASALAH') return '';
  const defects = Number(
    data.audit_defect_count ??
    ((data.audit_summary?.data_nok || 0) + (data.audit_summary?.kurang_tanggal || 0) + (data.audit_summary?.tidak_ada || 0))
  );

  if (defects <= 1) return 'audit-status-tag--minor';
  if (defects <= 5) return 'audit-status-tag--medium';
  if (defects <= 20) return 'audit-status-tag--major';
  return 'audit-status-tag--critical';
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

const resumeLengkapCount = computed(() => resumeData.value.filter(r => r.audit_status === 'LENGKAP').length);
const resumeDefectCount = computed(() => resumeData.value.filter(r => r.audit_status === 'BERMASALAH').length);
const resumeBelumAuditCount = computed(() => resumeData.value.filter(r => !r.audit_status || r.audit_status === 'BELUM_AUDIT' || r.audit_status === 'TIDAK_DAPAT_DIPERIKSA').length);

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

// ── Audit Kelengkapan WRC ────────────────────────────────────
const auditPeriode = ref('');
const auditYymm = ref('');
const auditYear = ref('');
const auditLoading = ref(false);
const auditExporting = ref(false);
const auditData = ref(null);
const auditSearch = ref('');
const auditStatusFilter = ref('ALL');
const auditExpandedRows = ref({});
const previousViewMode = ref('resume');

const statusFilterOptions = computed(() => {
  if (props.type === 'bulanan') {
    return [
      { label: 'Semua Status Toko', value: 'ALL' },
      { label: 'Hanya Bermasalah (NOK / Tidak Ada)', value: 'ISSUES' },
      { label: 'Data NOK Saja', value: 'DATA_NOK' },
      { label: 'Tidak Ada Backup Saja', value: 'TIDAK_ADA' },
      { label: 'Tidak Dapat Diperiksa Saja', value: 'TIDAK_DAPAT_DIPERIKSA' },
      { label: 'Lengkap (Valid) Saja', value: 'LENGKAP' },
    ];
  }
  return [
    { label: 'Semua Status Toko', value: 'ALL' },
    { label: 'Hanya Bermasalah (Kurang / Tidak Ada)', value: 'ISSUES' },
    { label: 'Kurang Tanggal Saja', value: 'KURANG_TANGGAL' },
    { label: 'Tidak Ada di Backup Saja', value: 'TIDAK_ADA' },
    { label: 'Tidak Dapat Diperiksa Saja', value: 'TIDAK_DAPAT_DIPERIKSA' },
    { label: 'Lengkap (100%) Saja', value: 'LENGKAP' },
  ];
});

const openAudit = async (periode) => {
  previousViewMode.value = viewMode.value;
  auditPeriode.value = periode;
  auditData.value = null; // WAJIB: Reset data lama agar tidak nyangkut dari periode sebelumnya

  const cleaned = String(periode || "").trim().replace(/[^\d-]/g, "");
  if (cleaned.length === 4) {
    auditYymm.value = cleaned;
    auditYear.value = `20${cleaned.substring(0, 2)}`;
  } else if (cleaned.length >= 6) {
    const digitsOnly = cleaned.replace(/-/g, "");
    auditYear.value = digitsOnly.substring(0, 4);
    auditYymm.value = `${digitsOnly.substring(2, 4)}${digitsOnly.substring(4, 6)}`;
  } else {
    auditYymm.value = '';
    auditYear.value = '';
  }

  viewMode.value = 'audit';
  auditSearch.value = '';
  auditStatusFilter.value = 'ALL';
  auditExpandedRows.value = {};
  await runAudit(false);
};

const backFromAudit = () => {
  auditData.value = null; // Bersihkan state audit saat kembali
  viewMode.value = previousViewMode.value || 'resume';
  loadResume(); // Muat ulang resume agar status snapshot terbaru ter-update di tabel level 1
};

const runAudit = async (forceRefresh = false) => {
  if (!props.cabang || !auditPeriode.value) return;
  auditLoading.value = true;
  auditData.value = null; // Reset saat audit/reload dimulai
  try {
    const res = await rekapBackupService.auditCompleteness({
      cabang: props.cabang,
      periode: auditPeriode.value,
      type: props.type,
      forceRefresh
    });
    auditData.value = res.data;
    if (forceRefresh) {
      toast.add({
        severity: 'success',
        summary: 'Audit Selesai',
        detail: `Berhasil mengaudit ${res.data?.summary?.total_toko_wrc || 0} toko vs WRC`,
        life: 3000
      });
    } else {
      toast.add({
        severity: 'info',
        summary: 'Data Dimuat',
        detail: `Memuat data audit ${props.type} untuk periode ${auditPeriode.value}`,
        life: 2500
      });
    }
  } catch (err) {
    auditData.value = null; // Pastikan data tetap null jika terjadi kegagalan
    const msg = err?.response?.data?.message || err.message || 'Gagal menjalankan audit kelengkapan data';
    toast.add({ severity: 'error', summary: 'Error Audit', detail: msg, life: 5000 });
  } finally {
    auditLoading.value = false;
  }
};

const exportAudit = async () => {
  if (!props.cabang || !auditPeriode.value) return;
  auditExporting.value = true;
  try {
    const response = await rekapBackupService.exportAuditExcel(props.cabang, auditPeriode.value, props.type);
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AUDIT_KELENGKAPAN_BACKUP_${props.type.toUpperCase()}_${props.cabang}_${auditPeriode.value}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast.add({ severity: 'success', summary: 'Export Berhasil', detail: 'File Excel audit berhasil diunduh', life: 3000 });
  } catch (err) {
    const msg = err?.response?.data?.message || err.message || 'Gagal mengunduh file Excel';
    toast.add({ severity: 'error', summary: 'Export Gagal', detail: msg, life: 3500 });
  } finally {
    auditExporting.value = false;
  }
};

const filteredAuditStores = computed(() => {
  if (!auditData.value || !Array.isArray(auditData.value.stores)) return [];
  let list = auditData.value.stores;

  // Filter status
  if (auditStatusFilter.value === 'ISSUES') {
    if (props.type === 'bulanan') {
      list = list.filter(s => s.status === 'DATA_NOK' || s.status === 'TIDAK_ADA' || s.status === 'TIDAK_DAPAT_DIPERIKSA');
    } else {
      list = list.filter(s => s.status === 'KURANG_TANGGAL' || s.status === 'TIDAK_ADA' || s.status === 'TIDAK_DAPAT_DIPERIKSA');
    }
  } else if (auditStatusFilter.value !== 'ALL') {
    list = list.filter(s => s.status === auditStatusFilter.value);
  }

  // Filter text search
  if (auditSearch.value) {
    const q = auditSearch.value.toLowerCase().trim();
    list = list.filter(s =>
      s.kdtk?.toLowerCase().includes(q) ||
      s.nama_toko?.toLowerCase().includes(q)
    );
  }

  return list;
});

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
      auditData.value      = null;
      auditSearch.value    = '';
      auditStatusFilter.value = 'ALL';
      auditExpandedRows.value = {};
      cancelEdit();
      cancelResumeEdit();
    }, 300);
  }
});
</script>

<style scoped>
@import './DetailDialog.style.css';
</style>
