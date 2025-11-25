<template>
    <Card class="table-card">
        <template #header>
            <div class="table-header">
                <div class="header-title">
                    <i class="pi pi-list"></i>
                    <span>Daftar Toko</span>
                </div>
                <div class="header-actions">
                    <Button icon="pi pi-refresh" label="Refresh" class="p-button-outlined p-button-sm"
                        @click="$emit('refresh')" />
                    <Button icon="pi pi-file-excel" label="Export" class="p-button-success p-button-sm"
                        @click="exportToExcel" />
                </div>
            </div>
        </template>

        <template #content>
            <DataTable :value="data" :loading="loading" :paginator="true" :rows="pagination.itemsPerPage"
                :totalRecords="pagination.total" :lazy="true" :rowsPerPageOptions="[10, 25, 50, 100]"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                currentPageReportTemplate="Menampilkan {first} - {last} dari {totalRecords} toko"
                responsiveLayout="scroll" stripedRows @page="handlePageChange" @sort="handleSortChange">
                <template #empty>
                    <div class="empty-state">
                        <i class="pi pi-inbox"></i>
                        <p>Tidak ada data toko yang ditemukan</p>
                    </div>
                </template>

                <template #loading>
                    <div class="loading-state">
                        <ProgressSpinner style="width: 50px; height: 50px" />
                        <p>Memuat data...</p>
                    </div>
                </template>

                <!-- Status Column -->
                <Column header="Status" style="width: 80px">
                    <template #body="{ data: item }">
                        <div class="status-icon">
                            <i :class="item.IS_READY ? 'pi pi-check-circle' : 'pi pi-times-circle'"
                                :style="{ color: item.IS_READY ? '#10b981' : '#ef4444' }"
                                v-tooltip.top="item.IS_READY ? 'Siap Closing' : 'Belum Siap'"></i>
                        </div>
                    </template>
                </Column>

                <!-- Store Code Column -->
                <Column field="KDTK" header="KDTK" :sortable="true" style="min-width: 100px">
                    <template #body="{ data: item }">
                        <a href="#" class="store-link" @click.prevent="$emit('view-details', item)">
                            {{ item.KDTK }}
                        </a>
                    </template>
                </Column>

                <!-- Store Name Column -->
                <Column field="NAMA" header="Nama Toko" :sortable="true" style="min-width: 200px">
                    <template #body="{ data: item }">
                        {{ item.NAMA || '-' }}
                    </template>
                </Column>

                <!-- Progress Column -->
                <Column header="Progress" style="min-width: 250px">
                    <template #body="{ data: item }">
                        <div class="progress-container">
                            <ProgressBar :value="getProgressPercentage(item)" :showValue="true"
                                :class="getProgressClass(item)" />
                            <div class="progress-info">
                                <span>{{ item.PASSED_RULES }} / {{ item.TOTAL_RULES }} rules</span>
                            </div>
                        </div>
                    </template>
                </Column>

                <!-- Critical Issues Column -->
                <Column header="Critical" style="width: 100px">
                    <template #body="{ data: item }">
                        <Badge v-if="item.CRITICAL_ISSUES > 0" :value="item.CRITICAL_ISSUES" severity="danger" />
                        <span v-else class="text-muted">-</span>
                    </template>
                </Column>

                <!-- Last Screened Column -->
                <Column field="LAST_SCREENED" header="Terakhir Screening" :sortable="true" style="min-width: 150px">
                    <template #body="{ data: item }">
                        <span v-tooltip.top="formatDateTime(item.LAST_SCREENED)">
                            {{ formatRelativeTime(item.LAST_SCREENED) }}
                        </span>
                    </template>
                </Column>

                <!-- Note Column -->
                <Column header="Note" style="width: 80px">
                    <template #body="{ data: item }">
                        <i v-if="item.note" class="pi pi-comment note-icon has-note" v-tooltip.top="item.note.noteText"
                            @click="$emit('edit-note', item)"></i>
                        <i v-else class="pi pi-comment-o note-icon no-note" v-tooltip.top="'Tambah note'"
                            @click="$emit('edit-note', item)"></i>
                    </template>
                </Column>

                <!-- Actions Column -->
                <Column header="Actions" style="width: 200px">
                    <template #body="{ data: item }">
                        <div class="action-buttons">
                            <Button icon="pi pi-eye" label="Detail" class="p-button-info p-button-sm"
                                @click="$emit('view-details', item)" />
                            <Button :icon="isStoreLoading(item.KDTK) ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'"
                                class="p-button-outlined p-button-sm" :disabled="isStoreLoading(item.KDTK)"
                                v-tooltip.top="'Re-screen'" @click="handleReScreen(item)" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </template>
    </Card>
</template>

<script setup>
import { ref } from 'vue';
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import ProgressBar from 'primevue/progressbar';
import ProgressSpinner from 'primevue/progressspinner';
import * as XLSX from 'xlsx';
import { formatDateTime, formatRelativeTime } from '../utils/formatters';

const props = defineProps({
    data: {
        type: Array,
        default: () => []
    },
    loading: {
        type: Boolean,
        default: false
    },
    error: {
        type: String,
        default: null
    },
    pagination: {
        type: Object,
        required: true
    },
    periode: {
        type: String,
        required: true
    },
    onReScreen: {
        type: Function,
        required: true
    }
});

const emit = defineEmits([
    'refresh',
    'page-change',
    'items-per-page-change',
    'sort-change',
    'view-details',
    're-screen',
    'edit-note'
]);

// State untuk tracking loading per toko
const loadingStores = ref(new Set());

// Fungsi untuk cek apakah toko sedang loading
const isStoreLoading = (kdtk) => {
    return loadingStores.value.has(kdtk);
};

// Fungsi untuk set loading state
const setStoreLoading = (kdtk, isLoading) => {
    if (isLoading) {
        loadingStores.value.add(kdtk);
    } else {
        loadingStores.value.delete(kdtk);
    }
    // Trigger reactivity
    loadingStores.value = new Set(loadingStores.value);
};

// ===== Handler re-screen menggunakan callback props =====
const handleReScreen = async (item) => {
    // Set loading state untuk toko ini
    setStoreLoading(item.KDTK, true);

    try {
        // Panggil callback function dari parent (yang mengembalikan Promise)
        await props.onReScreen(item);
    } catch (err) {
        console.error('Error re-screening store:', err);
        // Error sudah di-handle di parent, tapi kita tetap catch di sini
    } finally {
        // Reset loading state
        setStoreLoading(item.KDTK, false);
    }
};

const getProgressPercentage = (item) => {
    if (item.TOTAL_RULES === 0) return 0;
    return Math.round((item.PASSED_RULES / item.TOTAL_RULES) * 100);
};

const getProgressClass = (item) => {
    const percentage = getProgressPercentage(item);
    if (percentage === 100) return 'progress-success';
    if (percentage >= 80) return 'progress-warning';
    return 'progress-danger';
};

const handlePageChange = (event) => {
    emit('page-change', {
        page: event.page + 1,
        itemsPerPage: event.rows
    });
};

const handleSortChange = (event) => {
    emit('sort-change', {
        sortColumn: event.sortField,
        sortOrder: event.sortOrder === 1 ? 'ASC' : 'DESC'
    });
};

const exportToExcel = () => {
    const exportData = props.data.map(item => ({
        'Kode Toko': item.KDTK,
        'Nama Toko': item.NAMA,
        'Cabang': item.CAB,
        'Total Rules': item.TOTAL_RULES,
        'Passed Rules': item.PASSED_RULES,
        'Failed Rules': item.FAILED_RULES,
        'Critical Issues': item.CRITICAL_ISSUES,
        'Status': item.IS_READY ? 'Siap' : 'Belum Siap',
        'Last Screened': formatDateTime(item.LAST_SCREENED),
        'Note': item.note?.noteText || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'Prep Closing');

    const filename = `prep_closing_${props.periode}_${new Date().getTime()}.xlsx`;
    XLSX.writeFile(wb, filename);
};
</script>

<style scoped>
.table-card {
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
}

.header-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
}

.header-title i {
    color: #3b82f6;
}

.header-actions {
    display: flex;
    gap: 0.5rem;
}

.status-icon {
    text-align: center;
    font-size: 1.5rem;
}

.store-link {
    color: #3b82f6;
    text-decoration: none;
    font-weight: 600;
}

.store-link:hover {
    text-decoration: underline;
}

.progress-container {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.progress-info {
    font-size: 0.75rem;
    color: #6b7280;
    text-align: center;
}

:deep(.progress-success .p-progressbar-value) {
    background: #10b981;
}

:deep(.progress-warning .p-progressbar-value) {
    background: #f59e0b;
}

:deep(.progress-danger .p-progressbar-value) {
    background: #ef4444;
}

.note-icon {
    font-size: 1.25rem;
    cursor: pointer;
    transition: color 0.2s ease;
}

.note-icon.has-note {
    color: #3b82f6;
}

.note-icon.no-note {
    color: #9ca3af;
}

.note-icon:hover {
    color: #2563eb;
}

.action-buttons {
    display: flex;
    gap: 0.5rem;
}

.empty-state,
.loading-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
}

.empty-state i,
.loading-state i {
    font-size: 3rem;
    margin-bottom: 1rem;
    display: block;
}

.text-muted {
    color: #9ca3af;
}

@media (max-width: 768px) {
    .table-header {
        flex-direction: column;
        gap: 1rem;
    }

    .header-actions {
        width: 100%;
    }

    .header-actions button {
        flex: 1;
    }
}
</style>