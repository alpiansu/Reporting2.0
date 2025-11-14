<template>
  <div class="data-table-wrapper">
    <div class="detail-table-container">
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
          <div v-if="searchable" class="search-container">
            <div class="search-box">
              <i class="pi pi-search search-icon"></i>
              <input type="text" v-model="internalSearchQuery" :placeholder="searchPlaceholder" class="search-input" @input="handleSearch">
              <button v-if="internalSearchQuery" @click="clearSearch" class="clear-search-btn" type="button">
                <i class="pi pi-times"></i>
              </button>
            </div>
          </div>
          <div class="table-stats">
            <span class="stat-item">
              <i class="pi pi-list"></i>
              <span> Total: {{ totalRecords }} record </span>
            </span>
          </div>
          <div v-if="$slots['controls']" class="custom-controls">
            <slot name="controls"></slot>
          </div>
        </div>
      </div>
      <div class="table-responsive" :style="{ maxHeight: maxHeight }">
        <table class="detail-table" :style="{ minWidth: minTableWidth }">
          <thead>
            <tr>
              <th v-for="(column, index) in displayColumns" :key="index" :class="[column.align ? `text-${column.align}` : '', column.headerClass || '', { 'sortable': sortable }]" :style="getColumnStyle(column)" @click="sortable ? handleSort(column.field) : null">
                <div class="th-content">
                  <span>{{ column.label }}</span>
                  <i v-if="sortable && internalSortColumn === column.field" :class="getSortIcon()" class="sort-icon"></i>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!rows.length && !loading">
              <td :colspan="displayColumns.length" class="empty-row">
                <div class="empty-state">
                  <i class="pi pi-inbox" style="font-size: 2.5rem; color: #94a3b8;"></i>
                  <p>{{ emptyMessage }}</p>
                </div>
              </td>
            </tr>
            <tr v-else-if="loading">
              <td :colspan="displayColumns.length" class="loading-row">
                <div class="loading-state">
                  <i class="pi pi-spin pi-spinner" style="font-size: 2rem; color: #3b82f6;"></i>
                  <p>Memuat data...</p>
                </div>
              </td>
            </tr>
            <tr v-else v-for="(row, rowIndex) in rows" :key="getRowKey(row, rowIndex)" :class="getRowClass(row, rowIndex)" @click="handleRowClick(row, rowIndex)">
              <td v-for="(column, colIndex) in displayColumns" :key="colIndex" :class="[column.align ? `text-${column.align}` : '', column.cellClass || '']" :style="getCellStyle(row, column)">
                <slot v-if="$slots[`cell-${column.field}`]" :name="`cell-${column.field}`" :row="row" :column="column" :value="getNestedValue(row, column.field)" :index="rowIndex"></slot>
                <span v-else>{{ formatCellValue(row, column) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pagination-container" v-if="totalPages > 1">
        <div class="pagination-info">
          <span class="records-info">Menampilkan halaman {{ internalCurrentPage }} dari {{ totalPages }}</span>
        </div>
        <div class="pagination-controls">
          <button @click="goToFirstPage" :disabled="internalCurrentPage === 1" class="btn btn-nav" type="button"><i class="pi pi-angle-double-left"></i></button>
          <button @click="prevPage" :disabled="internalCurrentPage === 1" class="btn btn-nav" type="button"><i class="pi pi-angle-left"></i></button>
          <div class="page-numbers" v-if="showPageNumbers">
            <button v-for="page in visiblePages" :key="page" @click="goToPage(page)" :class="['btn', 'btn-page', { 'active': page === internalCurrentPage }]" type="button">{{ page }}</button>
          </div>
          <button @click="nextPage" :disabled="internalCurrentPage === totalPages" class="btn btn-nav" type="button"><i class="pi pi-angle-right"></i></button>
          <button @click="goToLastPage" :disabled="internalCurrentPage === totalPages" class="btn btn-nav" type="button"><i class="pi pi-angle-double-right"></i></button>
        </div>
        <div class="items-per-page">
          <label for="itemsPerPage">Data per halaman:</label>
          <select id="itemsPerPage" v-model.number="internalItemsPerPage" @change="handleItemsPerPageChange" class="form-select-sm">
            <option v-for="option in itemsPerPageOptions" :key="option" :value="option">{{ option }}</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  fetcher: { type: Function, required: true },
  query: { type: Object, default: () => ({}) },
  columns: { type: Array, default: () => [] },
  autoColumns: { type: Boolean, default: true },
  title: { type: String, default: 'Data Table' },
  icon: { type: String, default: 'pi pi-table' },
  maxHeight: { type: String, default: '500px' },
  minTableWidth: { type: String, default: '100%' },
  searchable: { type: Boolean, default: true },
  searchPlaceholder: { type: String, default: 'Cari data...' },
  sortable: { type: Boolean, default: true },
  itemsPerPageOptions: { type: Array, default: () => [10, 25, 50, 100] },
  initialItemsPerPage: { type: Number, default: 25 },
  initialPage: { type: Number, default: 1 },
  initialSortColumn: { type: String, default: '' },
  initialSortOrder: { type: String, default: 'asc' },
  initialSearchQuery: { type: String, default: '' },
  striped: { type: Boolean, default: false },
  hoverable: { type: Boolean, default: true },
  rowKey: { type: String, default: 'id' },
  rowClass: { type: [String, Function], default: '' },
  clickableRows: { type: Boolean, default: false },
  emptyMessage: { type: String, default: 'Tidak ada data untuk ditampilkan' },
  showPageNumbers: { type: Boolean, default: true },
  maxVisiblePages: { type: Number, default: 5 }
})

const emit = defineEmits(['page-change','items-per-page-change','sort-change','search-change','row-click','loaded'])

const rows = ref([])
const totalRecords = ref(0)
const loading = ref(false)
const error = ref('')
const internalCurrentPage = ref(props.initialPage)
const internalItemsPerPage = ref(props.initialItemsPerPage)
const internalSortColumn = ref(props.initialSortColumn)
const internalSortOrder = ref(props.initialSortOrder)
const internalSearchQuery = ref(props.initialSearchQuery)
const internalColumns = ref(props.columns)

const totalPages = computed(() => {
  if (!totalRecords.value || !internalItemsPerPage.value) return 1
  return Math.max(1, Math.ceil(totalRecords.value / internalItemsPerPage.value))
})

const visiblePages = computed(() => {
  const pages = []
  const total = totalPages.value
  const current = internalCurrentPage.value
  const max = props.maxVisiblePages
  if (total <= max) {
    for (let i=1;i<=total;i++) pages.push(i)
  } else {
    const half = Math.floor(max/2)
    let start = Math.max(1, current - half)
    let end = Math.min(total, start + max - 1)
    if (end - start < max - 1) start = Math.max(1, end - max + 1)
    for (let i=start;i<=end;i++) pages.push(i)
  }
  return pages
})

const displayColumns = computed(() => internalColumns.value && internalColumns.value.length ? internalColumns.value : [])

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

function formatCellValue(row, column) {
  const value = getNestedValue(row, column.field)
  if (value === null || value === undefined || value === '') return column.emptyValue || '-'
  if (column.formatter && typeof column.formatter === 'function') return column.formatter(value, row)
  return value
}

function getColumnStyle(column) {
  const styles = {}
  if (column.width) styles.width = column.width
  if (column.minWidth) styles.minWidth = column.minWidth
  if (column.maxWidth) styles.maxWidth = column.maxWidth
  return styles
}

function getCellStyle(row, column) {
  if (typeof column.cellStyle === 'function') return column.cellStyle(getNestedValue(row, column.field), row)
  return column.cellStyle || {}
}

function getRowClass(row, index) {
  const classes = []
  if (props.striped && index % 2 === 1) classes.push('striped-row')
  if (props.hoverable) classes.push('hoverable-row')
  if (typeof props.rowClass === 'function') classes.push(props.rowClass(row, index))
  else if (props.rowClass) classes.push(props.rowClass)
  return classes.join(' ')
}

function getRowKey(row, index) {
  return row[props.rowKey] || `row-${index}`
}

async function loadData() {
  loading.value = true
  error.value = ''
  const params = {
    page: internalCurrentPage.value,
    limit: internalItemsPerPage.value,
    sortColumn: internalSortColumn.value,
    sortOrder: internalSortOrder.value,
    searchQuery: internalSearchQuery.value,
    ...props.query
  }
  try {
    const result = await props.fetcher(params)
    rows.value = Array.isArray(result?.data) ? result.data : []
    totalRecords.value = Number(result?.total) || 0
    internalCurrentPage.value = Number(result?.page) || internalCurrentPage.value
    internalItemsPerPage.value = Number(result?.limit) || internalItemsPerPage.value
    if (props.autoColumns && rows.value.length && (!internalColumns.value || !internalColumns.value.length)) {
      internalColumns.value = Object.keys(rows.value[0]).map(k => ({ field: k, label: k }))
    }
    emit('loaded', { data: rows.value, total: totalRecords.value, page: internalCurrentPage.value, limit: internalItemsPerPage.value })
  } catch (e) {
    error.value = e?.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  internalCurrentPage.value = 1
  emit('search-change', internalSearchQuery.value)
  loadData()
}

function clearSearch() {
  internalSearchQuery.value = ''
  handleSearch()
}

function handleSort(field) {
  if (internalSortColumn.value === field) internalSortOrder.value = internalSortOrder.value === 'asc' ? 'desc' : 'asc'
  else internalSortColumn.value = field, internalSortOrder.value = 'asc'
  emit('sort-change', { column: internalSortColumn.value, order: internalSortOrder.value })
  loadData()
}

function getSortIcon() {
  return internalSortOrder.value === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'
}

function goToPage(page) {
  if (page < 1 || page > totalPages.value) return
  internalCurrentPage.value = page
  emit('page-change', { page })
  loadData()
}

function goToFirstPage() { goToPage(1) }
function prevPage() { goToPage(internalCurrentPage.value - 1) }
function nextPage() { goToPage(internalCurrentPage.value + 1) }
function goToLastPage() { goToPage(totalPages.value) }

function handleItemsPerPageChange() {
  internalCurrentPage.value = 1
  emit('items-per-page-change', internalItemsPerPage.value)
  loadData()
}

function handleRowClick(row, index) {
  if (props.clickableRows) emit('row-click', { row, index })
}

watch(() => props.columns, (newVal) => { internalColumns.value = newVal || [] })
watch(() => props.query, () => { internalCurrentPage.value = 1; loadData() }, { deep: true })

onMounted(() => { loadData() })
</script>

<style scoped>
.data-table-wrapper {
  width: 100%;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.detail-table-container {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.2s ease-in-out;
}

.detail-table-container:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.table-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.table-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #1e293b;
  letter-spacing: -0.025em;
}

.table-title i {
  color: #3b82f6;
  font-size: 1.1rem;
}

.table-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.search-container {
  position: relative;
}

.search-box {
  display: flex;
  align-items: center;
  position: relative;
}

.search-input {
  padding: 0.625rem 2.5rem 0.625rem 2.5rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  background: #ffffff;
  transition: all 0.2s ease-in-out;
  min-width: 240px;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-input::placeholder {
  color: #9ca3af;
  font-weight: 400;
}

.search-icon {
  position: absolute;
  left: 0.875rem;
  color: #9ca3af;
  font-size: 0.875rem;
  z-index: 1;
}

.clear-search-btn {
  position: absolute;
  right: 0.875rem;
  background: transparent;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s ease-in-out;
  z-index: 1;
}

.clear-search-btn:hover {
  color: #6b7280;
  background: #f3f4f6;
}

.table-stats {
  display: flex;
  align-items: center;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  background: #f9fafb;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.stat-item i {
  color: #3b82f6;
  font-size: 0.875rem;
}

.custom-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.table-responsive {
  overflow: auto;
  background: #ffffff;
}

table.detail-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.875rem;
}

thead th {
  position: sticky;
  top: 0;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  font-weight: 600;
  padding: 0.875rem 1rem;
  border-bottom: 2px solid #e5e7eb;
  color: #374151;
  text-align: left;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.th-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sort-icon {
  font-size: 0.75rem;
  color: #6b7280;
  transition: color 0.2s ease-in-out;
}

.sortable:hover .sort-icon {
  color: #3b82f6;
}

.sortable:hover{
  cursor: pointer;
}

tbody td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid #f3f4f6;
  color: #4b5563;
  font-weight: 500;
  transition: all 0.2s ease-in-out;
}

tbody tr:last-child td {
  border-bottom: none;
}

.striped-row {
  background: #f9fafb;
}

.hoverable-row:hover {
  background: #f8fafc;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.empty-row,
.loading-row {
  text-align: center;
}

.empty-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  color: #9ca3af;
}

.empty-state p,
.loading-state p {
  margin-top: 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
}

.loading-state i {
  color: #3b82f6;
}

.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  gap: 1rem;
  flex-wrap: wrap;
  background: #f9fafb;
}

.pagination-info {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.records-info {
  background: #ffffff;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.btn {
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-nav {
  background: #ffffff;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-nav:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
  color: #1e293b;
}

.btn-page {
  background: #ffffff;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-page:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.btn-page.active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  border-color: #3b82f6;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.items-per-page {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.form-select-sm {
  padding: 0.375rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  background: #ffffff;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.form-select-sm:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.title-extra {
  margin-left: 1rem;
  padding-left: 1rem;
  border-left: 1px solid #e5e7eb;
}

/* Responsive design */
@media (max-width: 768px) {
  .table-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .table-controls {
    width: 100%;
    justify-content: space-between;
  }
  
  .search-input {
    min-width: 200px;
  }
  
  .pagination-container {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .pagination-controls {
    order: -1;
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 640px) {
  .table-header {
    padding: 1rem;
  }
  
  .table-title {
    font-size: 1rem;
  }
  
  .table-controls {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  
  .search-input {
    min-width: 100%;
  }
  
  .pagination-container {
    padding: 0.75rem;
  }
  
  .items-per-page {
    width: 100%;
    justify-content: space-between;
  }
  
  .form-select-sm {
    flex: 1;
  }
}
</style>
