<template>
  <div class="store-management-view">
    <!-- Compact Header Section -->
    <header class="view-header">
      <div class="header-main">
        <div class="header-icon-box">
          <i class="pi pi-building"></i>
        </div>
        <div class="header-text">
          <h1 class="header-title">Store Management</h1>
          <p class="header-subtitle">Kelola data master toko, server IP, dan konfigurasi cabang</p>
        </div>
      </div>
      <div class="header-actions">
        <button
          type="button"
          class="btn-header-secondary"
          :disabled="loading"
          @click="refreshStores"
          title="Muat ulang data"
        >
          <i class="pi pi-refresh" :class="{ 'pi-spin': loading }"></i>
          <span>Refresh</span>
        </button>

        <button
          v-if="canEdit"
          type="button"
          class="btn-header-secondary"
          @click="openCsvUploadDialog"
          :title="csvSnapshotReady ? 'Upload CSV lainnya' : 'Upload master CSV'"
        >
          <i class="pi pi-upload"></i>
          <span>{{ csvSnapshotReady ? 'Upload CSV Lainnya' : 'Upload Master CSV' }}</span>
        </button>

        <button
          v-if="isSuperAdmin"
          type="button"
          class="btn-header-primary"
          @click="openAddStoreDialog"
        >
          <i class="pi pi-plus"></i>
          <span>Tambah Toko</span>
        </button>
      </div>
    </header>

    <!-- KPI & Sync Summary Bar (Compact) -->
    <section class="kpi-summary-strip">
      <div class="kpi-card">
        <div class="kpi-icon-wrapper total">
          <i class="pi pi-shopping-bag"></i>
        </div>
        <div class="kpi-content">
          <span class="kpi-label">Total Toko</span>
          <span class="kpi-value">{{ pagination?.totalItems || 0 }}</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrapper induk">
          <i class="pi pi-server"></i>
        </div>
        <div class="kpi-content">
          <span class="kpi-label">Snapshot INDUK</span>
          <span class="kpi-value">{{ syncStatus?.snapshot?.stats?.induk ?? '-' }}</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrapper stb">
          <i class="pi pi-desktop"></i>
        </div>
        <div class="kpi-content">
          <span class="kpi-label">Snapshot STB</span>
          <span class="kpi-value">{{ syncStatus?.snapshot?.stats?.stb ?? '-' }}</span>
        </div>
      </div>

      <div class="kpi-card kpi-sync-info" v-if="canEdit">
        <div class="kpi-icon-wrapper sync">
          <i class="pi pi-sync"></i>
        </div>
        <div class="kpi-content">
          <span class="kpi-label">Status Sinkronisasi</span>
          <span class="kpi-subtext" :title="lastSyncText">
            {{ lastSyncText }}
          </span>
        </div>
      </div>
    </section>

    <!-- Controls Toolbar (Search, Filter, View Mode) -->
    <section class="toolbar-section">
      <div class="toolbar-left">
        <!-- Search Input -->
        <div class="search-box-compact">
          <i class="pi pi-search search-icon"></i>
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Cari kode, nama toko, cabang, IP host..."
            @input="handleSearch"
            class="search-input-compact"
          />
          <button v-if="searchQuery" class="clear-search-btn" @click="clearSearch" title="Hapus pencarian">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <!-- Quick Type Filter -->
        <div class="quick-filter-group">
          <button
            type="button"
            class="quick-filter-btn"
            :class="{ active: !selectedNotesType }"
            @click="setQuickType('')"
          >
            Semua
          </button>
          <button
            type="button"
            class="quick-filter-btn"
            :class="{ active: selectedNotesType === 'INDUK' }"
            @click="setQuickType('INDUK')"
          >
            INDUK
          </button>
          <button
            type="button"
            class="quick-filter-btn"
            :class="{ active: selectedNotesType === 'STB' }"
            @click="setQuickType('STB')"
          >
            STB
          </button>
        </div>

        <!-- Advanced Filter Dropdown Toggle -->
        <div class="filter-dropdown-wrapper">
          <button
            type="button"
            class="filter-toggle-btn"
            :class="{ 'filter-active': hasAdvancedFilter, 'is-open': showFilterMenu }"
            @click="toggleFilterMenu"
          >
            <i class="pi pi-filter"></i>
            <span>Filter Lanjutan</span>
            <span v-if="activeFilterCount > 0" class="filter-count-badge">{{ activeFilterCount }}</span>
            <i class="pi pi-chevron-down caret-icon" :class="{ 'rotated': showFilterMenu }"></i>
          </button>

          <!-- Filter Popup Menu -->
          <div v-if="showFilterMenu" class="filter-popover" @click.stop>
            <div class="filter-popover-header">
              <span class="popover-title">Filter Parameter</span>
              <button class="popover-close" @click="showFilterMenu = false">
                <i class="pi pi-times"></i>
              </button>
            </div>

            <div class="filter-popover-body">
              <div class="filter-category">
                <span class="category-title">Region</span>
                <div class="checkbox-list">
                  <label v-for="region in regions" :key="region.id" class="custom-checkbox-label">
                    <input type="checkbox" :value="region.id" v-model="selectedRegions" @change="applyFilters" />
                    <span class="checkbox-indicator"></span>
                    <span>{{ region.name }}</span>
                  </label>
                </div>
              </div>

              <div class="filter-category">
                <span class="category-title">Kota (City)</span>
                <div class="checkbox-list">
                  <label v-for="city in cities" :key="city.id" class="custom-checkbox-label">
                    <input type="checkbox" :value="city.id" v-model="selectedCities" @change="applyFilters" />
                    <span class="checkbox-indicator"></span>
                    <span>{{ city.name }}</span>
                  </label>
                </div>
              </div>

              <div class="filter-category">
                <span class="category-title">Status</span>
                <div class="checkbox-list">
                  <label v-for="status in statuses" :key="status.id" class="custom-checkbox-label">
                    <input type="checkbox" :value="status.id" v-model="selectedStatuses" @change="applyFilters" />
                    <span class="checkbox-indicator"></span>
                    <span>{{ status.name }}</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="filter-popover-footer">
              <button type="button" class="btn-clear-filters" @click="clearFilters">Reset Filter</button>
              <button type="button" class="btn-apply-filters" @click="applyFilters">Terapkan</button>
            </div>
          </div>
        </div>

        <!-- Reset All Filter Button if Active -->
        <button
          v-if="hasAnyFilter"
          type="button"
          class="btn-reset-compact"
          @click="resetAllFilters"
          title="Reset semua filter dan pencarian"
        >
          <i class="pi pi-times-circle"></i>
          <span>Reset</span>
        </button>
      </div>

      <!-- Right: View Mode Toggle -->
      <div class="toolbar-right">
        <div class="view-mode-toggle">
          <button
            type="button"
            class="mode-btn"
            :class="{ active: viewMode === 'table' }"
            @click="viewMode = 'table'"
            title="Tampilan Tabel (Rekomendasi - Ringkas)"
          >
            <i class="pi pi-table"></i>
            <span>Tabel</span>
          </button>
          <button
            type="button"
            class="mode-btn"
            :class="{ active: viewMode === 'cards' }"
            @click="viewMode = 'cards'"
            title="Tampilan Kartu Ringkas"
          >
            <i class="pi pi-th-large"></i>
            <span>Kartu</span>
          </button>
        </div>
      </div>
    </section>

    <!-- Main Content Area -->
    <main class="store-data-container">
      <!-- Loading State -->
      <div v-if="loading" class="data-loading-state">
        <i class="pi pi-spin pi-spinner loading-spinner-icon"></i>
        <div class="loading-text-group">
          <h4>Memuat Data Toko...</h4>
          <p>Mengambil data master toko dari server</p>
        </div>
      </div>

      <!-- Data View: Table Mode (Default, High Density & Zero-Scroll) -->
      <div v-else-if="!loading && filteredStores.length > 0 && viewMode === 'table'" class="table-card-wrapper">
        <div class="table-responsive-box">
          <table class="store-table-compact">
            <thead>
              <tr>
                <th class="th-code">Kode Toko</th>
                <th class="th-station">Station</th>
                <th class="th-name">Nama Toko</th>
                <th class="th-branch">Cabang</th>
                <th class="th-host">DB Host IP</th>
                <th class="th-type">Tipe</th>
                <th class="th-address">Alamat</th>
                <th class="th-updated">Terakhir Update</th>
                <th class="th-actions text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="store in filteredStores"
                :key="store.id"
                class="store-row-item"
                @click="viewStoreDetail(store)"
              >
                <!-- Kode Toko -->
                <td class="td-code">
                  <span class="store-code-badge">{{ store.storeCode }}</span>
                </td>

                <!-- Station -->
                <td class="td-station">
                  <span class="station-badge">{{ store.station || '01' }}</span>
                </td>

                <!-- Nama Toko -->
                <td class="td-name">
                  <div class="store-name-text" :title="store.storeName">
                    {{ store.storeName }}
                  </div>
                </td>

                <!-- Cabang -->
                <td class="td-branch">
                  <span class="branch-pill">{{ store.branch }}</span>
                </td>

                <!-- DB Host IP -->
                <td class="td-host">
                  <div class="host-ip-wrapper">
                    <i class="pi pi-server host-icon"></i>
                    <span class="host-ip-text">{{ store.dbHost }}</span>
                  </div>
                </td>

                <!-- Tipe / Notes -->
                <td class="td-type">
                  <span class="type-pill" :class="getTypeBadgeClass(store.notes)">
                    {{ store.notes || 'INDUK' }}
                  </span>
                </td>

                <!-- Alamat -->
                <td class="td-address">
                  <span class="address-text" :title="store.address || '-'">
                    {{ store.address || '-' }}
                  </span>
                </td>

                <!-- Terakhir Update -->
                <td class="td-updated">
                  <span class="updated-timestamp" :title="formatDate(store.updatedAt)">
                    {{ formatCompactDate(store.updatedAt) }}
                  </span>
                </td>

                <!-- Actions -->
                <td class="td-actions text-center" @click.stop>
                  <div class="row-action-buttons">
                    <button
                      type="button"
                      class="row-action-btn view"
                      title="Lihat Detail Lengkap"
                      @click="viewStoreDetail(store)"
                    >
                      <i class="pi pi-eye"></i>
                    </button>
                    <button
                      v-if="canEdit"
                      type="button"
                      class="row-action-btn edit"
                      title="Edit Toko"
                      @click="openEditStoreDialog(store)"
                    >
                      <i class="pi pi-pencil"></i>
                    </button>
                    <button
                      v-if="isSuperAdmin"
                      type="button"
                      class="row-action-btn delete"
                      title="Hapus Toko"
                      @click="confirmDelete(store)"
                    >
                      <i class="pi pi-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Data View: Compact Cards Mode (Alternative Grid) -->
      <div v-else-if="!loading && filteredStores.length > 0 && viewMode === 'cards'" class="cards-grid-compact">
        <div
          v-for="store in filteredStores"
          :key="store.id"
          class="compact-store-card"
          @click="viewStoreDetail(store)"
        >
          <div class="card-header-compact">
            <div class="card-identity">
              <span class="card-code">{{ store.storeCode }}</span>
              <span class="card-station">{{ store.station }}</span>
              <h3 class="card-title" :title="store.storeName">{{ store.storeName }}</h3>
            </div>
            <span class="type-pill" :class="getTypeBadgeClass(store.notes)">
              {{ store.notes }}
            </span>
          </div>

          <div class="card-body-compact">
            <div class="card-detail-row">
              <span class="detail-label"><i class="pi pi-sitemap"></i> Cabang:</span>
              <span class="detail-val font-semibold">{{ store.branch }}</span>
            </div>
            <div class="card-detail-row">
              <span class="detail-label"><i class="pi pi-server"></i> DB Host:</span>
              <span class="detail-val font-mono">{{ store.dbHost }}</span>
            </div>
            <div class="card-detail-row" v-if="store.address">
              <span class="detail-label"><i class="pi pi-map-marker"></i> Alamat:</span>
              <span class="detail-val text-truncate" :title="store.address">{{ store.address }}</span>
            </div>
          </div>

          <div class="card-footer-compact" @click.stop>
            <span class="footer-time">{{ formatCompactDate(store.updatedAt) }}</span>
            <div class="footer-actions">
              <button
                type="button"
                class="row-action-btn view"
                title="Lihat Detail"
                @click="viewStoreDetail(store)"
              >
                <i class="pi pi-eye"></i>
              </button>
              <button
                v-if="canEdit"
                type="button"
                class="row-action-btn edit"
                title="Edit Toko"
                @click="openEditStoreDialog(store)"
              >
                <i class="pi pi-pencil"></i>
              </button>
              <button
                v-if="isSuperAdmin"
                type="button"
                class="row-action-btn delete"
                title="Hapus Toko"
                @click="confirmDelete(store)"
              >
                <i class="pi pi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state-card">
        <i class="pi pi-inbox empty-state-icon"></i>
        <h3 class="empty-state-title">
          {{ searchQuery || hasAdvancedFilter ? 'Toko Tidak Ditemukan' : 'Belum Ada Data Toko' }}
        </h3>
        <p class="empty-state-desc">
          {{
            searchQuery || hasAdvancedFilter
              ? 'Tidak ada toko yang sesuai dengan parameter pencarian atau filter yang aktif.'
              : 'Belum ada data toko yang tersimpan. Silakan upload master CSV atau tambahkan toko secara manual.'
          }}
        </p>
        <div class="empty-state-actions">
          <button
            v-if="searchQuery || hasAdvancedFilter"
            type="button"
            class="btn-header-secondary"
            @click="resetAllFilters"
          >
            <i class="pi pi-filter-slash"></i>
            <span>Reset Pencarian</span>
          </button>
          <button
            v-if="isSuperAdmin"
            type="button"
            class="btn-header-primary"
            @click="openAddStoreDialog"
          >
            <i class="pi pi-plus"></i>
            <span>Tambah Toko Baru</span>
          </button>
        </div>
      </div>
    </main>

    <!-- Compact Pagination Footer -->
    <footer v-if="stores.length > 0 && pagination" class="view-footer-pagination">
      <div class="pagination-summary">
        <span>Menampilkan <strong>{{ startItem }}</strong> - <strong>{{ endItem }}</strong> dari <strong>{{ pagination.totalItems }}</strong> toko</span>
      </div>

      <div class="pagination-nav-group">
        <button
          type="button"
          class="nav-btn"
          :disabled="pagination.currentPage <= 1 || loading"
          @click="handlePageChange(pagination.currentPage - 1)"
        >
          <i class="pi pi-chevron-left"></i>
          <span>Sebelumnya</span>
        </button>

        <div class="nav-pages-indicator">
          <span>Halaman <strong>{{ pagination.currentPage }}</strong> / {{ pagination.totalPages }}</span>
        </div>

        <button
          type="button"
          class="nav-btn"
          :disabled="pagination.currentPage >= pagination.totalPages || loading"
          @click="handlePageChange(pagination.currentPage + 1)"
        >
          <span>Berikutnya</span>
          <i class="pi pi-chevron-right"></i>
        </button>
      </div>
    </footer>

    <!-- Add/Edit Store Dialog (Redesigned) -->
    <div v-if="showAddStoreDialog" class="dialog-overlay-modern" @click="closeStoreDialog">
      <div class="dialog-content-modern store-form-modal" @click.stop>
        <!-- Modal Header -->
        <div class="dialog-header-modern" :class="{ 'edit-mode': isEditing }">
          <div class="dialog-title-section">
            <div class="dialog-icon-badge" :class="isEditing ? 'edit' : 'add'">
              <i class="pi" :class="isEditing ? 'pi-pencil' : 'pi-plus'"></i>
            </div>
            <div>
              <h2 class="dialog-title">{{ isEditing ? 'Edit Data Toko' : 'Tambah Toko Baru' }}</h2>
              <span class="dialog-subtitle-badge" v-if="isEditing">
                Kode Toko: <strong>{{ formStore.storeCode }}</strong>
              </span>
              <span class="dialog-subtitle" v-else>
                Lengkapi konfigurasi server dan informasi toko
              </span>
            </div>
          </div>
          <button class="dialog-close-btn" @click="closeStoreDialog" title="Tutup">
            <i class="pi pi-times"></i>
          </button>
        </div>

        <!-- Modal Body -->
        <div class="dialog-body-modern">
          <form @submit.prevent="handleSubmit" class="store-form-redesign">
            <!-- Section 1: Identitas Toko -->
            <div class="form-section-card">
              <div class="section-card-title">
                <i class="pi pi-id-card"></i>
                <span>Identitas Toko</span>
              </div>
              <div class="form-grid-inner">
                <div class="form-group-redesign">
                  <label for="storeCode" class="form-label-redesign">
                    Kode Toko <span class="required-star">*</span>
                  </label>
                  <div class="input-with-icon">
                    <i class="pi pi-tag input-icon"></i>
                    <input
                      id="storeCode"
                      v-model="formStore.storeCode"
                      type="text"
                      placeholder="e.g. F001"
                      required
                      class="form-input-redesign font-mono"
                    />
                  </div>
                  <span class="field-hint">Kode unik 4 karakter</span>
                </div>

                <div class="form-group-redesign">
                  <label for="station" class="form-label-redesign">
                    Station / Kasir <span class="required-star">*</span>
                  </label>
                  <div class="input-with-icon">
                    <i class="pi pi-desktop input-icon"></i>
                    <input
                      id="station"
                      v-model="formStore.station"
                      type="text"
                      placeholder="e.g. 01 atau STB"
                      required
                      class="form-input-redesign"
                    />
                  </div>
                  <span class="field-hint">Nomor station atau peran</span>
                </div>

                <div class="form-group-redesign full-width">
                  <label for="storeName" class="form-label-redesign">
                    Nama Toko <span class="required-star">*</span>
                  </label>
                  <div class="input-with-icon">
                    <i class="pi pi-building input-icon"></i>
                    <input
                      id="storeName"
                      v-model="formStore.storeName"
                      type="text"
                      placeholder="Masukkan nama lengkap toko"
                      required
                      class="form-input-redesign font-semibold"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Section 2: Jaringan & Tipe Server -->
            <div class="form-section-card">
              <div class="section-card-title">
                <i class="pi pi-server"></i>
                <span>Koneksi & Tipe Server</span>
              </div>
              <div class="form-grid-inner">
                <div class="form-group-redesign">
                  <label for="branch" class="form-label-redesign">
                    Kode Cabang <span class="required-star">*</span>
                  </label>
                  <div class="input-with-icon">
                    <i class="pi pi-sitemap input-icon"></i>
                    <input
                      id="branch"
                      v-model="formStore.branch"
                      type="text"
                      placeholder="e.g. G001"
                      required
                      class="form-input-redesign font-mono"
                    />
                  </div>
                </div>

                <div class="form-group-redesign">
                  <label for="dbHost" class="form-label-redesign">
                    Database Host IP <span class="required-star">*</span>
                  </label>
                  <div class="input-with-icon">
                    <i class="pi pi-database input-icon"></i>
                    <input
                      id="dbHost"
                      v-model="formStore.dbHost"
                      type="text"
                      placeholder="e.g. 10.12.x.x"
                      required
                      class="form-input-redesign font-mono"
                    />
                  </div>
                  <span class="field-hint">IP server MySQL POS toko</span>
                </div>

                <!-- Tipe Server (Segmented Cards) -->
                <div class="form-group-redesign full-width">
                  <label class="form-label-redesign">
                    Tipe Server Toko <span class="required-star">*</span>
                  </label>
                  <div class="segmented-type-selector">
                    <label
                      class="type-choice-card"
                      :class="{ 'is-selected': formStore.notes === 'INDUK' }"
                    >
                      <input
                        type="radio"
                        value="INDUK"
                        v-model="formStore.notes"
                        name="storeNotesType"
                        class="sr-only"
                      />
                      <i class="pi pi-server choice-icon induk"></i>
                      <div class="choice-text">
                        <span class="choice-name">INDUK</span>
                        <span class="choice-desc">Main Server POS</span>
                      </div>
                    </label>

                    <label
                      class="type-choice-card"
                      :class="{ 'is-selected': formStore.notes === 'STB' }"
                    >
                      <input
                        type="radio"
                        value="STB"
                        v-model="formStore.notes"
                        name="storeNotesType"
                        class="sr-only"
                      />
                      <i class="pi pi-desktop choice-icon stb"></i>
                      <div class="choice-text">
                        <span class="choice-name">STB</span>
                        <span class="choice-desc">Standby Server</span>
                      </div>
                    </label>

                    <label
                      class="type-choice-card"
                      :class="{ 'is-selected': formStore.notes === 'OTHER' }"
                    >
                      <input
                        type="radio"
                        value="OTHER"
                        v-model="formStore.notes"
                        name="storeNotesType"
                        class="sr-only"
                      />
                      <i class="pi pi-cog choice-icon other"></i>
                      <div class="choice-text">
                        <span class="choice-name">OTHER</span>
                        <span class="choice-desc">Server Lainnya</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Section 3: Lokasi & Alamat -->
            <div class="form-section-card">
              <div class="section-card-title">
                <i class="pi pi-map-marker"></i>
                <span>Lokasi & Alamat</span>
              </div>
              <div class="form-group-redesign full-width">
                <label for="storeAddress" class="form-label-redesign">
                  Alamat Lengkap (Opsional)
                </label>
                <div class="input-with-icon">
                  <i class="pi pi-map-marker input-icon"></i>
                  <input
                    id="storeAddress"
                    v-model="formStore.address"
                    type="text"
                    placeholder="Masukkan alamat atau lokasi toko..."
                    class="form-input-redesign"
                  />
                </div>
              </div>
            </div>

            <!-- Form Action Buttons -->
            <div class="form-actions-redesign">
              <button
                type="button"
                class="btn-form-cancel"
                @click="closeStoreDialog"
                :disabled="formLoading"
              >
                <i class="pi pi-times"></i>
                <span>Batal</span>
              </button>
              <button
                type="submit"
                class="btn-form-submit"
                :disabled="formLoading"
              >
                <i v-if="!formLoading" class="pi" :class="isEditing ? 'pi-check' : 'pi-plus'"></i>
                <i v-else class="pi pi-spin pi-spinner"></i>
                <span>{{ formLoading ? (isEditing ? 'Memperbarui...' : 'Menyimpan...') : (isEditing ? 'Simpan Perubahan' : 'Tambah Toko') }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog (100% Intact) -->
    <div v-if="showDeleteDialog" class="dialog-overlay-modern" @click="closeDeleteDialog">
      <div class="dialog-content-modern sm" @click.stop>
        <div class="dialog-header-modern danger">
          <div class="dialog-title-section">
            <i class="pi pi-exclamation-triangle dialog-icon danger"></i>
            <h2 class="dialog-title">Delete Store</h2>
          </div>
          <button class="dialog-close-btn" @click="closeDeleteDialog">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="dialog-body-modern text-center">
          <p class="delete-msg">Are you sure you want to delete <strong>{{ storeToDelete?.storeName }}</strong>?</p>
          <p class="delete-sub-msg">This action cannot be undone and will remove all associated store record.</p>

          <div class="form-actions-modern mt-6">
            <button class="btn-secondary" @click="closeDeleteDialog" :disabled="formLoading">Cancel</button>
            <button class="btn-danger" @click="handleDeleteStore" :disabled="formLoading">
              <span v-if="!formLoading">Delete Store</span>
              <div v-else class="loading-spinner">
                <i class="pi pi-spin pi-spinner"></i>
                <span>Deleting...</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Sync Confirmation Dialog (24h guard) (100% Intact) -->
    <div v-if="showSyncConfirmDialog" class="dialog-overlay-modern" @click.self="closeSyncConfirmDialog">
      <div class="dialog-content-modern sm" @click.stop>
        <div class="dialog-header-modern warning">
          <div class="dialog-title-section">
            <i class="pi pi-exclamation-triangle dialog-icon warning"></i>
            <h2 class="dialog-title">Konfirmasi Sync Ulang</h2>
          </div>
          <button class="dialog-close-btn" @click="closeSyncConfirmDialog">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="dialog-body-modern text-center">
          <p class="delete-msg">
            Data master toko baru saja di-update oleh <strong>{{ syncConfirmLastSync?.syncedByFullName || syncConfirmLastSync?.syncedBy || '-' }}</strong>
            pada <strong>{{ formatDateTime(syncConfirmLastSync?.lastSyncedAt) }}</strong>
            (sumber: {{ syncConfirmLastSync?.source || '-' }}).
          </p>
          <p class="delete-sub-msg">
            Apakah Anda tetap ingin melakukan sinkronisasi master toko lagi?
          </p>

          <div class="form-actions-modern mt-6">
            <button class="btn-secondary" @click="closeSyncConfirmDialog" :disabled="isSyncingAfterUpload">Batal</button>
            <button class="btn-primary" @click="runSyncAfterUploadWithForce()" :disabled="isSyncingAfterUpload">
              <span v-if="!isSyncingAfterUpload">Ya, Lanjutkan</span>
              <div v-else class="loading-spinner">
                <i class="pi pi-spin pi-spinner"></i>
                <span>Menyinkronkan...</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Store Detail Dialog Component (100% Intact) -->
    <StoreDetails
      :is-open="showDetailDialog"
      :store="selectedStore"
      @close="closeDetailDialog"
    />

    <!-- CSV Upload Dialog (100% Intact) -->
    <div v-if="showCsvUploadDialog" class="dialog-overlay-modern" @click.self="closeCsvUploadDialog">
      <div class="dialog-content-modern sm" @click.stop>
        <div class="dialog-header-modern">
          <div class="dialog-title-section">
            <i class="pi pi-file-excel dialog-icon"></i>
            <h2 class="dialog-title">Upload Master Toko (CSV)</h2>
          </div>
          <button class="dialog-close-btn" @click="closeCsvUploadDialog">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="dialog-body-modern">
          <p class="delete-sub-msg">
            Format yang didukung: <code>master-tokomain.csv</code>.
            Setelah upload, sistem otomatis memproses update data master toko.
          </p>

          <div
            class="csv-upload-area"
            :class="{ 'is-busy': uploadStage === 'uploading' || uploadStage === 'syncing' }"
            @click="triggerFilePicker"
          >
            <input
              ref="csvFileInput"
              type="file"
              accept=".csv"
              class="file-input-hidden"
              @change="onCsvFileChange"
            />

            <!-- Stage: uploading -->
            <div v-if="uploadStage === 'uploading'" class="csv-stage">
              <i class="pi pi-spin pi-spinner csv-stage-icon"></i>
              <p class="csv-stage-title">Mengupload file...</p>
              <p class="csv-stage-sub">{{ csvFile?.name }}</p>
            </div>

            <!-- Stage: syncing -->
            <div v-else-if="uploadStage === 'syncing'" class="csv-stage">
              <i class="pi pi-spin pi-spinner csv-stage-icon"></i>
              <p class="csv-stage-title">Memproses update master toko...</p>
              <p class="csv-stage-sub">Update IP & nama, lalu menyamakan kode cabang dari semua server WRC. Proses ini bisa memakan waktu beberapa menit.</p>
            </div>

            <!-- Stage: select / error -->
            <template v-else>
              <div v-if="!csvFile" class="csv-upload-prompt">
                <i class="pi pi-upload csv-prompt-icon"></i>
                <p>Pilih file CSV</p>
              </div>
              <div v-else class="csv-upload-preview">
                <i class="pi pi-file-excel csv-prompt-icon"></i>
                <span class="csv-file-name">{{ csvFile.name }}</span>
                <button class="csv-file-remove" @click.stop="clearCsvFile">
                  <i class="pi pi-times"></i>
                </button>
              </div>
            </template>
          </div>

          <div class="form-actions-modern">
            <button class="btn-secondary" :disabled="uploadStage === 'uploading' || uploadStage === 'syncing'" @click="closeCsvUploadDialog">Batal</button>
            <button
              class="btn-primary"
              :disabled="!csvFile || uploadStage === 'uploading' || uploadStage === 'syncing'"
              @click="uploadCsv"
            >
              <i v-if="uploadStage === 'uploading' || uploadStage === 'syncing'" class="pi pi-spin pi-spinner"></i>
              {{ uploadStage === 'syncing' ? 'Memproses...' : 'Upload & Update' }}
            </button>
          </div>

          <p v-if="csvUploadMessage && uploadStage === 'error'" class="csv-upload-message error">
            {{ csvUploadMessage }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useStoreStore, useAuthStore } from '../../stores';
import { useToastService } from '../../utils/toast';
import StoreDetails from './StoreDetails.vue';
import storeService from '../../services/store.service.js';

const router = useRouter();
const storeStore = useStoreStore();
const authStore = useAuthStore();
const toast = useToastService();

const csvFileInput = ref(null);

// Role Computeds
const userRole = computed(() => authStore.user?.role || 'user');
const isSuperAdmin = computed(() => userRole.value === 'superadmin');
const isAdmin = computed(() => userRole.value === 'admin');
const canEdit = computed(() => isSuperAdmin.value || isAdmin.value);

// View Mode: 'table' (default zero-scroll) vs 'cards'
const viewMode = ref('table');

// State
const searchQuery = ref('');
const selectedNotesType = ref(''); // Quick filter for INDUK / STB / OTHER
const showFilterMenu = ref(false);
const selectedRegions = ref([]);
const selectedCities = ref([]);
const selectedStatuses = ref([]);
const showAddStoreDialog = ref(false);
const showDeleteDialog = ref(false);
const showDetailDialog = ref(false);
const formLoading = ref(false);
const isEditing = ref(false);
const storeToDelete = ref(null);
const selectedStore = ref(null);

// Master store sync state
const syncStatus = ref(null);
const syncing = ref(false);
const showSyncConfirmDialog = ref(false);
const syncConfirmLastSync = ref(null);
const syncResult = ref(null);

// CSV Upload state — uploadStage: select | uploading | syncing | error
const showCsvUploadDialog = ref(false);
const uploadStage = ref('select');
const csvFile = ref(null);
const csvUploadMessage = ref('');
const csvSnapshot = ref(null);
const isSyncingAfterUpload = ref(false);
const csvSnapshotReady = computed(() => csvSnapshot.value !== null);

const formStore = ref({
  id: null,
  storeCode: '',
  storeName: '',
  branch: '',
  station: '01',
  dbHost: '',
  notes: 'INDUK',
  address: ''
});

// Get data from store
const stores = computed(() => storeStore.allStores);
const loading = computed(() => storeStore.isLoading);
const pagination = computed(() => storeStore.getPagination);
const startItem = computed(() => storeStore.getPagination.startItem);
const endItem = computed(() => storeStore.getPagination.endItem);

// Mock data for regions until we have a proper region service
const regions = ref([
  { id: 'North', name: 'North' },
  { id: 'South', name: 'South' },
  { id: 'East', name: 'East' },
  { id: 'West', name: 'West' },
  { id: 'Central', name: 'Central' }
]);

// Mock data for cities until we have a proper city service
const cities = ref([
  { id: 'Jakarta', name: 'Jakarta' },
  { id: 'Surabaya', name: 'Surabaya' },
  { id: 'Bandung', name: 'Bandung' },
  { id: 'Medan', name: 'Medan' },
  { id: 'Makassar', name: 'Makassar' }
]);

const statuses = ref([
  { id: 'active', name: 'Active' },
  { id: 'inactive', name: 'Inactive' },
  { id: 'pending', name: 'Pending' }
]);

// Filter count badge
const activeFilterCount = computed(() => {
  return selectedRegions.value.length + selectedCities.value.length + selectedStatuses.value.length;
});

const hasAdvancedFilter = computed(() => activeFilterCount.value > 0);
const hasAnyFilter = computed(() => {
  return !!searchQuery.value || !!selectedNotesType.value || hasAdvancedFilter.value;
});

// Client-side quick filter for notes type (INDUK / STB / OTHER) on current page
const filteredStores = computed(() => {
  const list = stores.value || [];
  if (!selectedNotesType.value) {
    return list;
  }
  return list.filter(s => {
    const note = (s.notes || '').toUpperCase();
    if (selectedNotesType.value === 'INDUK') return note === 'INDUK';
    if (selectedNotesType.value === 'STB') return note === 'STB';
    return note !== 'INDUK' && note !== 'STB';
  });
});

// Search timeout for debouncing
let searchTimeout = null;

// Fetch stores on mount
onMounted(async () => {
  try {
    await storeStore.fetchStores({
      page: 1,
      limit: 10
    });
  } catch (error) {
    console.error('Error fetching stores:', error);
    toast.showError('Error', 'Failed to load stores');
  }

  if (canEdit.value) {
    await loadSyncStatus();
  }
});

const refreshStores = async () => {
  try {
    await storeStore.fetchStores({
      page: pagination.value?.currentPage || 1,
      limit: 10,
      search: searchQuery.value || ''
    });
    if (canEdit.value) {
      await loadSyncStatus();
    }
    toast.showSuccess('Refresh', 'Data toko berhasil diperbarui');
  } catch (err) {
    toast.showError('Error', 'Gagal memuat ulang data toko');
  }
};

const loadSyncStatus = async () => {
  try {
    const data = await storeService.getSyncStatus();
    syncStatus.value = data;
  } catch (error) {
    console.error('Error fetching sync status:', error);
  }
};

const lastSyncText = computed(() => {
  const lastSync = syncStatus.value?.lastSync;
  if (!lastSync) return 'Belum pernah sync';
  return `${formatCompactDate(lastSync.lastSyncedAt)} · oleh ${lastSync.syncedBy}`;
});

const csvSnapshotText = computed(() => {
  if (!csvSnapshot.value) return 'Belum ada CSV';
  return `${csvSnapshot.value.stats?.induk ?? 0} induk, ${csvSnapshot.value.stats?.stb ?? 0} stb · ${formatDate(csvSnapshot.value.updatedAt)}`;
});

const runSyncAfterUploadWithForce = async () => {
  if (isSyncingAfterUpload.value) return;
  showSyncConfirmDialog.value = false;
  syncConfirmLastSync.value = null;
  isSyncingAfterUpload.value = true;
  try {
    const result = await storeService.syncMasterCsv(true);

    if (result.needsSnapshot) {
      toast.showError('Sinkronisasi Master Toko', result.message || 'Belum ada data CSV.');
      return;
    }

    if (result.needsConfirmation) {
      syncConfirmLastSync.value = result.lastSync || null;
      showSyncConfirmDialog.value = true;
      return;
    }

    syncResult.value = result;
    await loadSyncStatus();
  } catch (error) {
    console.error('Error syncing master stores:', error);
    toast.showError('Sinkronisasi Master Toko', error?.response?.data?.message || 'Gagal melakukan sinkronisasi master toko');
  } finally {
    isSyncingAfterUpload.value = false;
  }
};

const closeSyncConfirmDialog = () => {
  if (syncing.value) return;
  showSyncConfirmDialog.value = false;
  syncConfirmLastSync.value = null;
};

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const formatDate = (dateString) => {
  if (!dateString) return 'Never';
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return new Date(dateString).toLocaleString(undefined, options);
};

const formatCompactDate = (dateString) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
};

const openCsvUploadDialog = () => {
  csvFile.value = null;
  csvUploadMessage.value = '';
  uploadStage.value = 'select';
  showCsvUploadDialog.value = true;
};

const closeCsvUploadDialog = () => {
  if (uploadStage.value === 'uploading' || uploadStage.value === 'syncing') return;
  showCsvUploadDialog.value = false;
};

const triggerFilePicker = () => {
  if (uploadStage.value !== 'select' && uploadStage.value !== 'error') return;
  csvFileInput.value?.click();
};

const onCsvFileChange = (event) => {
  const file = event.target.files?.[0];
  if (file) {
    csvFile.value = file;
    csvUploadMessage.value = '';
  }
};

const clearCsvFile = () => {
  csvFile.value = null;
  if (csvFileInput.value) csvFileInput.value.value = '';
  csvUploadMessage.value = '';
};

const uploadCsv = async () => {
  if (!csvFile.value || uploadStage.value === 'uploading' || uploadStage.value === 'syncing') return;

  uploadStage.value = 'uploading';
  csvUploadMessage.value = '';
  try {
    const result = await storeService.uploadMasterCsv(csvFile.value);
    if (!result.success) {
      uploadStage.value = 'error';
      csvUploadMessage.value = result.message || 'Upload gagal.';
      return;
    }
    csvSnapshot.value = result.snapshot;
  } catch (error) {
    uploadStage.value = 'error';
    csvUploadMessage.value = error?.response?.data?.message || 'Terjadi kesalahan saat upload CSV.';
    return;
  }

  uploadStage.value = 'syncing';
  isSyncingAfterUpload.value = true;
  try {
    const sync = await storeService.syncMasterCsv(false);

    if (sync.needsSnapshot) {
      uploadStage.value = 'error';
      csvUploadMessage.value = sync.message || 'Belum ada data CSV.';
      return;
    }

    if (sync.needsConfirmation) {
      syncConfirmLastSync.value = sync.lastSync || null;
      showSyncConfirmDialog.value = true;
      showCsvUploadDialog.value = false;
      uploadStage.value = 'select';
      return;
    }

    syncResult.value = sync;
    await loadSyncStatus();
    showCsvUploadDialog.value = false;
    uploadStage.value = 'select';
    toast.showSuccess('Sukses', 'Data master toko berhasil disinkronisasi.');
  } catch (error) {
    uploadStage.value = 'error';
    csvUploadMessage.value = error?.response?.data?.message || 'Gagal melakukan sinkronisasi master toko.';
  } finally {
    isSyncingAfterUpload.value = false;
  }
};

// Quick Type Filter
const setQuickType = (type) => {
  selectedNotesType.value = type;
};

// Search handling
watch(searchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    applyFilters();
  }, 350);
});

const handleSearch = () => {
  // Handled by debounced watcher
};

const clearSearch = () => {
  searchQuery.value = '';
  applyFilters();
};

const toggleFilterMenu = () => {
  showFilterMenu.value = !showFilterMenu.value;
};

const applyFilters = async () => {
  try {
    const options = {
      page: 1,
      limit: 10,
      search: searchQuery.value || ''
    };

    if (selectedRegions.value.length > 0) {
      options.region = selectedRegions.value.join(',');
    }
    if (selectedCities.value.length > 0) {
      options.city = selectedCities.value.join(',');
    }
    if (selectedStatuses.value.length > 0) {
      options.status = selectedStatuses.value.join(',');
    }

    await storeStore.fetchStores(options);
    showFilterMenu.value = false;
  } catch (error) {
    console.error('Error applying filters:', error);
    toast.showError('Error', 'Failed to apply filters');
  }
};

const clearFilters = () => {
  selectedRegions.value = [];
  selectedCities.value = [];
  selectedStatuses.value = [];
  applyFilters();
};

const resetAllFilters = () => {
  searchQuery.value = '';
  selectedNotesType.value = '';
  selectedRegions.value = [];
  selectedCities.value = [];
  selectedStatuses.value = [];
  applyFilters();
};

const getTypeBadgeClass = (notes) => {
  const n = (notes || '').toUpperCase();
  if (n === 'INDUK') return 'pill-induk';
  if (n === 'STB') return 'pill-stb';
  return 'pill-other';
};

const viewStoreDetail = (store) => {
  selectedStore.value = store;
  showDetailDialog.value = true;
};

const closeDetailDialog = () => {
  showDetailDialog.value = false;
  selectedStore.value = null;
};

const openAddStoreDialog = () => {
  isEditing.value = false;
  formStore.value = {
    id: null,
    storeCode: '',
    storeName: '',
    branch: '',
    station: '01',
    dbHost: '',
    notes: 'INDUK',
    address: ''
  };
  showAddStoreDialog.value = true;
};

const openEditStoreDialog = (store) => {
  isEditing.value = true;
  formStore.value = {
    id: store.id,
    storeCode: store.storeCode,
    storeName: store.storeName,
    branch: store.branch,
    station: store.station,
    dbHost: store.dbHost,
    notes: store.notes || 'INDUK',
    address: store.address || ''
  };
  showAddStoreDialog.value = true;
};

const closeStoreDialog = () => {
  showAddStoreDialog.value = false;
};

const confirmDelete = (store) => {
  storeToDelete.value = store;
  showDeleteDialog.value = true;
};

const closeDeleteDialog = () => {
  showDeleteDialog.value = false;
  storeToDelete.value = null;
};

const handleSubmit = async () => {
  formLoading.value = true;
  try {
    const storeData = { ...formStore.value };
    if (isEditing.value) {
      await storeStore.updateStore(storeData.id, storeData);
      toast.showSuccess('Success', 'Store updated successfully');
    } else {
      await storeStore.createStore(storeData);
      toast.showSuccess('Success', 'Store created successfully');
    }
    closeStoreDialog();
  } catch (error) {
    console.error('Error submitting store:', error);
    toast.showError('Error', isEditing.value ? 'Failed to update store' : 'Failed to create store');
  } finally {
    formLoading.value = false;
  }
};

const handleDeleteStore = async () => {
  if (!storeToDelete.value) return;
  formLoading.value = true;
  try {
    await storeStore.deleteStore(storeToDelete.value.id);
    toast.showSuccess('Success', 'Store deleted successfully');
    closeDeleteDialog();
  } catch (error) {
    console.error('Error deleting store:', error);
    toast.showError('Error', 'Failed to delete store');
  } finally {
    formLoading.value = false;
  }
};

const handlePageChange = async (page) => {
  try {
    const options = {
      page,
      limit: 10,
      search: searchQuery.value || ''
    };
    if (selectedRegions.value.length > 0) {
      options.region = selectedRegions.value.join(',');
    }
    if (selectedStatuses.value.length > 0) {
      options.status = selectedStatuses.value.join(',');
    }
    await storeStore.fetchStores(options);
  } catch (error) {
    console.error('Error changing page:', error);
    toast.showError('Error', 'Failed to load page');
  }
};
</script>

<style scoped src="./index.style.css"></style>