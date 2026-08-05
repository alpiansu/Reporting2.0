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
                                    <i class="pi pi-inbox" style="font-size: 2.5rem; color: var(--text-color-secondary);"></i>
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

<style scoped src="./BaseDataTableModal.style.css"></style>