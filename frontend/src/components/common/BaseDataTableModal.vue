<template>
    <div class="data-table-wrapper">
        <div class="detail-table-container">
            <!-- Table Header -->
            <div class="table-header">
                <div class="table-title-section">
                    <h4 class="table-title">
                        <i v-if="icon" :class="icon"></i>
                        {{ title }}
                    </h4>
                    <div v-if="$slots['title-extra']" class="title-extra">
                        <slot name="title-extra"></slot>
                    </div>
                </div>

                <div class="table-controls">
                    <!-- Search Box -->
                    <div v-if="searchable" class="search-container">
                        <div class="search-box">
                            <i class="pi pi-search search-icon"></i>
                            <input type="text" v-model="internalSearchQuery" :placeholder="searchPlaceholder"
                                class="search-input" @input="handleSearch">
                            <button v-if="internalSearchQuery" @click="clearSearch" class="clear-search-btn"
                                title="Hapus pencarian" type="button">
                                <i class="pi pi-times"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Stats -->
                    <div class="table-stats">
                        <span class="stat-item">
                            <i class="pi pi-list"></i>
                            <span v-if="internalSearchQuery && totalRecords !== filteredTotal">
                                {{ filteredTotal }} dari {{ totalRecords }} record
                            </span>
                            <span v-else>
                                Total: {{ totalRecords }} record
                            </span>
                        </span>
                    </div>

                    <!-- Custom Controls Slot -->
                    <div v-if="$slots['controls']" class="custom-controls">
                        <slot name="controls"></slot>
                    </div>
                </div>
            </div>

            <!-- Table Body -->
            <div class="table-responsive" :style="{ maxHeight: maxHeight }">
                <table class="detail-table" :style="{ minWidth: minTableWidth }">
                    <thead>
                        <tr>
                            <th v-for="(column, index) in columns" :key="index" :class="[
                            column.align ? `text-${column.align}` : '',
                            column.headerClass || '',
                            { 'sortable': column.sortable }
                        ]" :style="getColumnStyle(column)" @click="column.sortable ? handleSort(column.field) : null">
                                <div class="th-content">
                                    <span>{{ column.label }}</span>
                                    <i v-if="column.sortable" :class="getSortIcon(column.field)" class="sort-icon"></i>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Empty State -->
                        <tr v-if="!paginatedData.length && !loading">
                            <td :colspan="columns.length" class="empty-row">
                                <div class="empty-state">
                                    <i class="pi pi-inbox" style="font-size: 2.5rem; color: #94a3b8;"></i>
                                    <p>{{ emptyMessage }}</p>
                                </div>
                            </td>
                        </tr>

                        <!-- Loading State -->
                        <tr v-else-if="loading">
                            <td :colspan="columns.length" class="loading-row">
                                <div class="loading-state">
                                    <i class="pi pi-spin pi-spinner" style="font-size: 2rem; color: #3b82f6;"></i>
                                    <p>Memuat data...</p>
                                </div>
                            </td>
                        </tr>

                        <!-- Data Rows -->
                        <tr v-else v-for="(row, rowIndex) in paginatedData" :key="getRowKey(row, rowIndex)"
                            :class="getRowClass(row, rowIndex)" @click="handleRowClick(row, rowIndex)">
                            <td v-for="(column, colIndex) in columns" :key="colIndex" :class="[
                            column.align ? `text-${column.align}` : '',
                            column.cellClass || '',
                            getCellClass(row, column)
                        ]" :style="getCellStyle(row, column)">
                                <!-- Custom Cell Slot -->
                                <slot v-if="$slots[`cell-${column.field}`]" :name="`cell-${column.field}`" :row="row"
                                    :column="column" :value="getNestedValue(row, column.field)"
                                    :index="getCurrentRowIndex(rowIndex)">
                                </slot>

                                <!-- Default Cell Content -->
                                <span v-else>
                                    {{ formatCellValue(row, column) }}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Pagination -->
            <div class="pagination-container" v-if="paginated && totalPages > 1">
                <div class="pagination-info">
                    <span class="records-info">
                        Menampilkan {{ startIndex + 1 }}-{{ endIndex }} dari {{ filteredTotal }} data
                        <strong>(Halaman {{ currentPage }} dari {{ totalPages }})</strong>
                    </span>
                </div>

                <div class="pagination-controls">
                    <button @click="goToFirstPage" :disabled="currentPage === 1" class="btn btn-nav"
                        title="Halaman pertama" type="button">
                        <i class="pi pi-angle-double-left"></i>
                    </button>
                    <button @click="prevPage" :disabled="currentPage === 1" class="btn btn-nav"
                        title="Halaman sebelumnya" type="button">
                        <i class="pi pi-angle-left"></i>
                    </button>

                    <!-- Page Numbers -->
                    <div class="page-numbers" v-if="showPageNumbers">
                        <button v-for="page in visiblePages" :key="page" @click="goToPage(page)"
                            :class="['btn', 'btn-page', { 'active': page === currentPage }]" type="button">
                            {{ page }}
                        </button>
                    </div>

                    <button @click="nextPage" :disabled="currentPage === totalPages" class="btn btn-nav"
                        title="Halaman selanjutnya" type="button">
                        <i class="pi pi-angle-right"></i>
                    </button>
                    <button @click="goToLastPage" :disabled="currentPage === totalPages" class="btn btn-nav"
                        title="Halaman terakhir" type="button">
                        <i class="pi pi-angle-double-right"></i>
                    </button>
                </div>

                <div class="items-per-page">
                    <label for="itemsPerPage">Data per halaman:</label>
                    <select id="itemsPerPage" v-model="internalItemsPerPage" @change="handleItemsPerPageChange"
                        class="form-select-sm">
                        <option v-for="option in itemsPerPageOptions" :key="option" :value="option">
                            {{ option }}
                        </option>
                    </select>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
    // Data
    data: {
        type: Array,
        default: () => []
    },
    columns: {
        type: Array,
        required: true,
        validator: (columns) => {
            return columns.every(col => col.field && col.label);
        }
    },

    // Pagination
    paginated: {
        type: Boolean,
        default: true
    },
    itemsPerPage: {
        type: Number,
        default: 25
    },
    itemsPerPageOptions: {
        type: Array,
        default: () => [10, 25, 50, 100]
    },
    totalRecords: {
        type: Number,
        default: 0
    },
    currentPage: {
        type: Number,
        default: 1
    },

    // Search
    searchable: {
        type: Boolean,
        default: true
    },
    searchQuery: {
        type: String,
        default: ''
    },
    searchPlaceholder: {
        type: String,
        default: 'Cari data...'
    },
    searchFields: {
        type: Array,
        default: () => []
    },

    // Sorting
    sortable: {
        type: Boolean,
        default: true
    },
    sortColumn: {
        type: String,
        default: ''
    },
    sortOrder: {
        type: String,
        default: 'asc',
        validator: (value) => ['asc', 'desc'].includes(value)
    },

    // Styling
    title: {
        type: String,
        default: 'Data Table'
    },
    icon: {
        type: String,
        default: 'pi pi-table'
    },
    maxHeight: {
        type: String,
        default: '500px'
    },
    minTableWidth: {
        type: String,
        default: '100%'
    },
    striped: {
        type: Boolean,
        default: false
    },
    hoverable: {
        type: Boolean,
        default: true
    },

    // States
    loading: {
        type: Boolean,
        default: false
    },
    emptyMessage: {
        type: String,
        default: 'Tidak ada data untuk ditampilkan'
    },

    // Row
    rowKey: {
        type: String,
        default: 'id'
    },
    rowClass: {
        type: [String, Function],
        default: ''
    },
    clickableRows: {
        type: Boolean,
        default: false
    },

    // Pagination Display
    showPageNumbers: {
        type: Boolean,
        default: true
    },
    maxVisiblePages: {
        type: Number,
        default: 5
    }
});

const emit = defineEmits([
    'page-change',
    'sort-change',
    'search',
    'items-per-page-change',
    'row-click'
]);

// Internal State
const internalSearchQuery = ref(props.searchQuery);
const internalItemsPerPage = ref(props.itemsPerPage);
const internalSortColumn = ref(props.sortColumn);
const internalSortOrder = ref(props.sortOrder);
const internalCurrentPage = ref(props.currentPage);

// Computed
const filteredData = computed(() => {
    if (!internalSearchQuery.value.trim()) {
        return props.data;
    }

    const query = internalSearchQuery.value.toLowerCase();
    const fieldsToSearch = props.searchFields.length
        ? props.searchFields
        : props.columns.map(col => col.field);

    return props.data.filter(row => {
        return fieldsToSearch.some(field => {
            const value = getNestedValue(row, field);
            return value && value.toString().toLowerCase().includes(query);
        });
    });
});

const sortedData = computed(() => {
    if (!internalSortColumn.value || !props.sortable) {
        return filteredData.value;
    }

    const data = [...filteredData.value];
    const column = props.columns.find(col => col.field === internalSortColumn.value);

    if (!column || !column.sortable) {
        return data;
    }

    return data.sort((a, b) => {
        const aValue = getNestedValue(a, internalSortColumn.value);
        const bValue = getNestedValue(b, internalSortColumn.value);

        // Handle null/undefined
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        // Custom sort function
        if (column.sortFunction) {
            return column.sortFunction(aValue, bValue, internalSortOrder.value);
        }

        // Default sort
        let comparison = 0;
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
        } else {
            comparison = String(aValue).localeCompare(String(bValue));
        }

        return internalSortOrder.value === 'asc' ? comparison : -comparison;
    });
});

const filteredTotal = computed(() => filteredData.value.length);

const totalPages = computed(() => {
    if (!props.paginated) return 1;
    return Math.ceil(filteredTotal.value / internalItemsPerPage.value);
});

const startIndex = computed(() => {
    if (!props.paginated) return 0;
    return (internalCurrentPage.value - 1) * internalItemsPerPage.value;
});

const endIndex = computed(() => {
    if (!props.paginated) return filteredTotal.value;
    return Math.min(startIndex.value + internalItemsPerPage.value, filteredTotal.value);
});

const paginatedData = computed(() => {
    if (!props.paginated) {
        return sortedData.value;
    }
    return sortedData.value.slice(startIndex.value, endIndex.value);
});

const visiblePages = computed(() => {
    if (!props.showPageNumbers) return [];

    const pages = [];
    const total = totalPages.value;
    const current = internalCurrentPage.value;
    const max = props.maxVisiblePages;

    if (total <= max) {
        for (let i = 1; i <= total; i++) {
            pages.push(i);
        }
    } else {
        const half = Math.floor(max / 2);
        let start = Math.max(1, current - half);
        let end = Math.min(total, start + max - 1);

        if (end - start < max - 1) {
            start = Math.max(1, end - max + 1);
        }

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
    }

    return pages;
});

// Methods
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
}

function formatCellValue(row, column) {
    const value = getNestedValue(row, column.field);

    if (value === null || value === undefined || value === '') {
        return column.emptyValue || '-';
    }

    // Custom formatter
    if (column.formatter && typeof column.formatter === 'function') {
        return column.formatter(value, row);
    }

    return value;
}

function getColumnStyle(column) {
    const styles = {};

    if (column.width) styles.width = column.width;
    if (column.minWidth) styles.minWidth = column.minWidth;
    if (column.maxWidth) styles.maxWidth = column.maxWidth;

    return styles;
}

function getCellClass(row, column) {
    if (typeof column.cellClass === 'function') {
        return column.cellClass(getNestedValue(row, column.field), row);
    }
    return '';
}

function getCellStyle(row, column) {
    if (typeof column.cellStyle === 'function') {
        return column.cellStyle(getNestedValue(row, column.field), row);
    }
    return column.cellStyle || {};
}

function getRowClass(row, index) {
    const classes = [];

    if (props.striped && index % 2 === 1) {
        classes.push('striped-row');
    }

    if (props.clickableRows) {
        classes.push('clickable-row');
    }

    if (typeof props.rowClass === 'function') {
        classes.push(props.rowClass(row, index));
    } else if (props.rowClass) {
        classes.push(props.rowClass);
    }

    return classes.join(' ');
}

function getRowKey(row, index) {
    return row[props.rowKey] || `row-${index}`;
}

function getCurrentRowIndex(paginatedIndex) {
    return startIndex.value + paginatedIndex;
}

function handleSearch() {
    internalCurrentPage.value = 1;
    emit('search', internalSearchQuery.value);
}

function clearSearch() {
    internalSearchQuery.value = '';
    handleSearch();
}

function handleSort(field) {
    const column = props.columns.find(col => col.field === field);
    if (!column || !column.sortable) return;

    if (internalSortColumn.value === field) {
        internalSortOrder.value = internalSortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
        internalSortColumn.value = field;
        internalSortOrder.value = 'asc';
    }

    emit('sort-change', {
        column: internalSortColumn.value,
        order: internalSortOrder.value
    });
}

function getSortIcon(field) {
    if (internalSortColumn.value !== field) {
        return 'pi pi-sort-alt';
    }
    return internalSortOrder.value === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down';
}

function goToPage(page) {
    if (page < 1 || page > totalPages.value) return;
    internalCurrentPage.value = page;
    emit('page-change', page);
}

function goToFirstPage() {
    goToPage(1);
}

function prevPage() {
    goToPage(internalCurrentPage.value - 1);
}

function nextPage() {
    goToPage(internalCurrentPage.value + 1);
}

function goToLastPage() {
    goToPage(totalPages.value);
}

function handleItemsPerPageChange() {
    internalCurrentPage.value = 1;
    emit('items-per-page-change', internalItemsPerPage.value);
}

function handleRowClick(row, index) {
    if (props.clickableRows) {
        emit('row-click', { row, index: getCurrentRowIndex(index) });
    }
}

// Watchers
watch(() => props.searchQuery, (newValue) => {
    internalSearchQuery.value = newValue;
});

watch(() => props.itemsPerPage, (newValue) => {
    internalItemsPerPage.value = newValue;
});

watch(() => props.currentPage, (newValue) => {
    internalCurrentPage.value = newValue;
});

watch(() => props.sortColumn, (newValue) => {
    internalSortColumn.value = newValue;
});

watch(() => props.sortOrder, (newValue) => {
    internalSortOrder.value = newValue;
});
</script>

<style scoped>
/* Container */
.data-table-wrapper {
    width: 100%;
}

.detail-table-container {
    background: white;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    overflow: hidden;
    box-shadow:
        0 4px 12px rgba(0, 0, 0, 0.05),
        0 0 0 1px rgba(255, 255, 255, 0.5) inset;
}

/* Table Header */
.table-header {
    padding: 1.5rem 2rem;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
}

.table-title-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
}

.table-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    letter-spacing: -0.02em;
}

.table-title i {
    font-size: 1.375rem;
    color: #667eea;
}

.title-extra {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.table-controls {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    flex-wrap: wrap;
}

/* Search */
.search-container {
    position: relative;
}

.search-box {
    position: relative;
    display: flex;
    align-items: center;
}

.search-input {
    padding: 0.625rem 2.75rem 0.625rem 2.75rem;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 0.9375rem;
    width: 280px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: white;
    font-family: inherit;
}

.search-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
    transform: translateY(-1px);
}

.search-input::placeholder {
    color: #9ca3af;
}

.search-icon {
    position: absolute;
    left: 1rem;
    color: #6b7280;
    font-size: 1rem;
    pointer-events: none;
    transition: color 0.3s ease;
}

.search-input:focus~.search-icon {
    color: #667eea;
}

.clear-search-btn {
    position: absolute;
    right: 0.625rem;
    background: #fef2f2;
    border: none;
    color: #ef4444;
    cursor: pointer;
    padding: 0.375rem;
    border-radius: 6px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
}

.clear-search-btn:hover {
    background: #fee2e2;
    transform: scale(1.1);
}

.clear-search-btn:active {
    transform: scale(0.95);
}

/* Stats */
.table-stats {
    display: flex;
    gap: 1rem;
}

.stat-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 0.9375rem;
    color: #6b7280;
    font-weight: 500;
    padding: 0.5rem 1rem;
    background: white;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.stat-item i {
    color: #667eea;
}

.custom-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

/* Table */
.table-responsive {
    overflow-x: auto;
    overflow-y: auto;
    border-radius: 0;
    position: relative;
}

/* Custom Scrollbar */
.table-responsive::-webkit-scrollbar {
    width: 10px;
    height: 10px;
}

.table-responsive::-webkit-scrollbar-track {
    background: #f1f5f9;
}

.table-responsive::-webkit-scrollbar-thumb {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 10px;
}

.table-responsive::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
}

.table-responsive::-webkit-scrollbar-corner {
    background: #f1f5f9;
}

.detail-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9375rem;
    background: white;
}

.detail-table thead {
    position: sticky;
    top: 0;
    z-index: 10;
    background: white;
}

.detail-table th {
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    padding: 1rem 0.875rem;
    text-align: left;
    font-weight: 600;
    color: #374151;
    border-bottom: 2px solid #e5e7eb;
    white-space: nowrap;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    transition: background 0.2s ease;
}

.detail-table th.sortable {
    cursor: pointer;
    user-select: none;
}

.detail-table th.sortable:hover {
    background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
}

.th-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
}

.sort-icon {
    color: #9ca3af;
    font-size: 0.875rem;
    transition: all 0.2s ease;
}

.detail-table th.sortable:hover .sort-icon {
    color: #667eea;
}

.detail-table td {
    padding: 1rem 0.875rem;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: middle;
    transition: all 0.2s ease;
}

.detail-table tbody tr {
    transition: all 0.2s ease;
}

.detail-table tbody tr:hover {
    background: #f9fafb;
}

.detail-table tbody tr.striped-row {
    background: #f9fafb;
}

.detail-table tbody tr.striped-row:hover {
    background: #f3f4f6;
}

.detail-table tbody tr.clickable-row {
    cursor: pointer;
}

.detail-table tbody tr.clickable-row:hover {
    background: #ede9fe;
    transform: translateX(2px);
}

.detail-table .text-left {
    text-align: left;
}

.detail-table .text-center {
    text-align: center;
}

.detail-table .text-right {
    text-align: right;
}

/* Empty & Loading States */
.empty-row,
.loading-row {
    background: white !important;
}

.empty-state,
.loading-state {
    text-align: center;
    padding: 3rem 2rem;
    color: #6b7280;
}

.empty-state i,
.loading-state i {
    display: block;
    margin-bottom: 1rem;
}

.empty-state p,
.loading-state p {
    margin: 0;
    font-size: 1rem;
    font-weight: 500;
}

.loading-state .pi-spinner {
    animation: smoothSpin 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes smoothSpin {
    0% {
        transform: rotate(0deg);
        opacity: 0.8;
    }

    50% {
        opacity: 1;
    }

    100% {
        transform: rotate(360deg);
        opacity: 0.8;
    }
}

/* Pagination */
.pagination-container {
    padding: 1.25rem 2rem;
    background: linear-gradient(to top, #f8fafc 0%, white 100%);
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1.25rem;
}

.pagination-info {
    color: #6b7280;
    font-size: 0.9375rem;
    font-weight: 500;
}

.records-info strong {
    color: #374151;
}

.pagination-controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.page-numbers {
    display: flex;
    gap: 0.375rem;
    margin: 0 0.5rem;
}

.items-per-page {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 0.9375rem;
    color: #6b7280;
    font-weight: 500;
}

.form-select-sm {
    padding: 0.5rem 0.75rem;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.9375rem;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
    font-weight: 500;
}

.form-select-sm:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-select-sm:hover {
    border-color: #cbd5e1;
}

/* Buttons */
.btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 8px;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    text-decoration: none;
    font-family: inherit;
    min-width: 36px;
    position: relative;
    overflow: hidden;
}

.btn::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transform: translate(-50%, -50%);
    transition: width 0.4s, height 0.4s;
}

.btn:hover::before {
    width: 200px;
    height: 200px;
}

.btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none !important;
}

.btn:disabled:hover::before {
    width: 0;
    height: 0;
}

.btn-nav {
    background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
    color: #374151;
    padding: 0.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    border: 1px solid #e5e7eb;
}

.btn-nav:hover:not(:disabled) {
    background: linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.btn-nav:active:not(:disabled) {
    transform: translateY(0);
}

.btn-page {
    background: white;
    color: #6b7280;
    padding: 0.5rem 0.875rem;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.btn-page:hover:not(:disabled) {
    background: #f9fafb;
    color: #374151;
    border-color: #667eea;
}

.btn-page.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-color: #667eea;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-page.active:hover {
    background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
}

/* Responsive Design */
@media (max-width: 1024px) {
    .table-header {
        padding: 1.25rem 1.5rem;
    }

    .search-input {
        width: 220px;
    }

    .pagination-container {
        padding: 1rem 1.5rem;
    }
}

@media (max-width: 768px) {
    .table-header {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
        padding: 1rem 1.25rem;
    }

    .table-title-section {
        width: 100%;
    }

    .table-controls {
        width: 100%;
        flex-direction: column;
        align-items: stretch;
        gap: 1rem;
    }

    .search-container {
        width: 100%;
    }

    .search-box {
        width: 100%;
    }

    .search-input {
        width: 100%;
    }

    .table-stats {
        width: 100%;
        justify-content: space-between;
    }

    .custom-controls {
        width: 100%;
    }

    .pagination-container {
        flex-direction: column;
        align-items: stretch;
        text-align: center;
        gap: 1rem;
        padding: 1rem 1.25rem;
    }

    .pagination-info {
        order: 1;
    }

    .items-per-page {
        order: 2;
        justify-content: center;
    }

    .pagination-controls {
        order: 3;
        justify-content: center;
    }

    .page-numbers {
        display: none;
    }

    .detail-table {
        font-size: 0.8125rem;
    }

    .detail-table th,
    .detail-table td {
        padding: 0.75rem 0.5rem;
    }

    .table-title {
        font-size: 1.125rem;
    }

    .table-title i {
        font-size: 1.25rem;
    }
}

@media (max-width: 480px) {
    .table-header {
        padding: 0.875rem 1rem;
    }

    .table-title {
        font-size: 1rem;
    }

    .table-controls {
        gap: 0.75rem;
    }

    .search-input {
        font-size: 0.875rem;
        padding: 0.5rem 2.5rem 0.5rem 2.5rem;
    }

    .stat-item {
        font-size: 0.8125rem;
        padding: 0.375rem 0.75rem;
    }

    .pagination-container {
        padding: 0.875rem 1rem;
    }

    .pagination-info {
        font-size: 0.8125rem;
    }

    .items-per-page {
        font-size: 0.8125rem;
    }

    .btn-nav {
        padding: 0.375rem;
        min-width: 32px;
    }

    .detail-table {
        font-size: 0.75rem;
    }

    .detail-table th,
    .detail-table td {
        padding: 0.625rem 0.375rem;
    }
}

/* Browser Compatibility */
@supports not (position: sticky) {
    .detail-table thead {
        position: relative;
    }
}

/* Firefox Scrollbar */
.table-responsive {
    scrollbar-width: thin;
    scrollbar-color: #667eea #f1f5f9;
}

/* Print Styles */
@media print {

    .table-header,
    .pagination-container {
        display: none;
    }

    .detail-table-container {
        box-shadow: none;
        border: 1px solid #ddd;
    }

    .table-responsive {
        max-height: none !important;
        overflow: visible !important;
    }

    .detail-table tbody tr:hover {
        background: transparent !important;
    }
}

/* High Contrast Mode */
@media (prefers-contrast: high) {

    .detail-table th,
    .detail-table td {
        border: 1px solid #000;
    }

    .btn {
        border: 2px solid currentColor;
    }
}

/* Dark Mode Support (Optional) */
@media (prefers-color-scheme: dark) {
    .detail-table-container {
        background: #1f2937;
        border-color: #374151;
    }

    .table-header {
        background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
    }

    .table-title {
        color: #f9fafb;
    }

    .detail-table th {
        background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
        color: #f9fafb;
        border-bottom-color: #4b5563;
    }

    .detail-table td {
        color: #e5e7eb;
        border-bottom-color: #374151;
    }

    .detail-table tbody tr:hover {
        background: #374151;
    }

    .search-input,
    .form-select-sm {
        background: #374151;
        color: #f9fafb;
        border-color: #4b5563;
    }

    .stat-item {
        background: #374151;
        color: #e5e7eb;
        border-color: #4b5563;
    }

    .pagination-container {
        background: linear-gradient(to top, #374151 0%, #1f2937 100%);
        border-top-color: #4b5563;
    }

    .pagination-info {
        color: #e5e7eb;
    }
}
</style>