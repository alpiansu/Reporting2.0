<template>
    <Dialog v-model:visible="localVisible" :modal="true" :closable="true" :dismissableMask="true"
        :style="{ width: '90vw', maxWidth: '1100px' }" :breakpoints="{ '960px': '95vw', '640px': '100vw' }"
        class="store-detail-dialog" :draggable="false" @hide="handleClose">

        <template #header>
            <div class="detail-header">
                <div class="header-icon-wrap">
                    <i class="pi pi-shop"></i>
                </div>
                <div class="header-info">
                    <div class="header-title-row">
                        <h3 class="header-title">{{ store?.KDTK }} — {{ store?.NAMA }}</h3>
                        <Tag :value="store?.IS_READY ? 'SIAP' : 'BELUM SIAP'"
                            :severity="store?.IS_READY ? 'success' : 'danger'"
                            class="status-tag" />
                    </div>
                    <span class="header-sub">{{ store?.CAB }}</span>
                </div>
            </div>
        </template>

        <div v-if="loading" class="loading-state">
            <ProgressSpinner />
            <p class="loading-text">Memuat detail toko...</p>
        </div>

        <div v-else-if="store" class="detail-body">
            <!-- Summary Stats -->
            <div class="stats-row">
                <div class="stat-card stat-blue">
                    <div class="stat-icon"><i class="pi pi-list-check"></i></div>
                    <div class="stat-info">
                        <span class="stat-number">{{ store.TOTAL_RULES }}</span>
                        <span class="stat-label">Total Rules</span>
                    </div>
                </div>
                <div class="stat-card stat-green">
                    <div class="stat-icon"><i class="pi pi-check-circle"></i></div>
                    <div class="stat-info">
                        <span class="stat-number">{{ store.PASSED_RULES }}</span>
                        <span class="stat-label">Passed</span>
                    </div>
                </div>
                <div class="stat-card stat-red">
                    <div class="stat-icon"><i class="pi pi-times-circle"></i></div>
                    <div class="stat-info">
                        <span class="stat-number">{{ store.FAILED_RULES }}</span>
                        <span class="stat-label">Failed</span>
                    </div>
                </div>
                <div class="stat-card stat-amber">
                    <div class="stat-icon"><i class="pi pi-exclamation-triangle"></i></div>
                    <div class="stat-info">
                        <span class="stat-number">{{ store.CRITICAL_ISSUES }}</span>
                        <span class="stat-label">Critical</span>
                    </div>
                </div>
            </div>

            <!-- Issues Section -->
            <div v-if="store.ISSUES && store.ISSUES.length > 0" class="section-block">
                <div class="section-block-header">
                    <i class="pi pi-exclamation-circle section-icon-red"></i>
                    <span>Issues Ditemukan</span>
                    <Badge :value="store.ISSUES.length" severity="danger" class="ml-auto" />
                </div>
                <IssuesAccordion :issues="groupedIssues" />
            </div>

            <!-- No Issues State -->
            <div v-else-if="store.ISSUES && store.ISSUES.length === 0" class="no-issues-card">
                <i class="pi pi-check-circle"></i>
                <div>
                    <p class="no-issues-title">Semua Rule Passed</p>
                    <p class="no-issues-sub">Toko ini memenuhi semua kriteria kesiapan closing.</p>
                </div>
            </div>

            <!-- Note Section -->
            <div class="section-block">
                <div class="section-block-header">
                    <i class="pi pi-comment section-icon-blue"></i>
                    <span>Catatan</span>
                </div>
                <div v-if="store.note" class="note-card">
                    <div class="note-card-body">
                        <p class="note-text">{{ store.note.noteText }}</p>
                        <div class="note-meta-row">
                            <span class="note-meta-item"><i class="pi pi-user"></i> {{ store.note.fullName || store.note.pic }}</span>
                            <span class="note-meta-item"><i class="pi pi-clock"></i> {{ formatDateTime(store.note.updated_at) }}</span>
                        </div>
                    </div>
                </div>
                <div v-else class="empty-note">
                    <i class="pi pi-info-circle"></i>
                    <span>Belum ada catatan untuk toko ini.</span>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="detail-footer">
                <Button :label="store?.note ? 'Edit Catatan' : 'Tambah Catatan'" icon="pi pi-comment"
                    class="p-button-outlined p-button-info p-button-sm" @click="handleEditNote" />
                <Button label="Tutup" icon="pi pi-times" class="p-button-text p-button-secondary" @click="handleClose" />
            </div>
        </template>
    </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Badge from 'primevue/badge';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import IssuesAccordion from './IssuesAccordion.vue';
import { formatDateTime } from '../utils/formatters';
import { CATEGORIES } from '../utils/constants';

const props = defineProps({
    visible: Boolean,
    store: Object,
    periode: String,
    loading: Boolean
});

const emit = defineEmits(['update:visible', 'close', 'edit-note']);

const localVisible = ref(props.visible);

watch(() => props.visible, (newVal) => {
    localVisible.value = newVal;
});

watch(localVisible, (newVal) => {
    emit('update:visible', newVal);
});

const groupedIssues = computed(() => {
    if (!props.store?.ISSUES) return [];

    const groups = {};

    props.store.ISSUES.forEach(issue => {
        if (!groups[issue.category]) {
            groups[issue.category] = [];
        }
        groups[issue.category].push(issue);
    });

    return Object.keys(groups)
        .map(category => ({
            category,
            label: CATEGORIES[category]?.label || category,
            icon: CATEGORIES[category]?.icon || 'pi pi-tag',
            color: CATEGORIES[category]?.color || '#6b7280',
            issues: groups[category].sort((a, b) => {
                const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                return severityOrder[a.severity] - severityOrder[b.severity];
            })
        }))
        .sort((a, b) => b.issues.length - a.issues.length);
});

const handleClose = () => {
    localVisible.value = false;
    emit('close');
};

const handleEditNote = () => {
    emit('edit-note', props.store);
};
</script>

<style scoped>
/* === Header === */
.detail-header {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.header-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    border-radius: 0.75rem;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: #fff;
    flex-shrink: 0;
}

.header-icon-wrap i {
    font-size: 1.4rem;
}

.header-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.header-title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.header-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #1e293b;
}

.status-tag {
    font-size: 0.72rem;
    font-weight: 700;
}

.header-sub {
    font-size: 0.82rem;
    color: #64748b;
}

/* === Loading === */
.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem;
}

.loading-text {
    color: #64748b;
    font-size: 0.9rem;
    margin-top: 0.75rem;
}

/* === Body === */
.detail-body {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

/* === Stats Row === */
.stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
}

.stat-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border-radius: 0.625rem;
    border: 1px solid transparent;
}

.stat-blue {
    background: #eff6ff;
    border-color: #dbeafe;
}

.stat-green {
    background: #f0fdf4;
    border-color: #bbf7d0;
}

.stat-red {
    background: #fef2f2;
    border-color: #fecaca;
}

.stat-amber {
    background: #fffbeb;
    border-color: #fde68a;
}

.stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.7);
    flex-shrink: 0;
}

.stat-blue .stat-icon { color: #3b82f6; }
.stat-green .stat-icon { color: #10b981; }
.stat-red .stat-icon { color: #ef4444; }
.stat-amber .stat-icon { color: #f59e0b; }

.stat-info {
    display: flex;
    flex-direction: column;
}

.stat-number {
    font-size: 1.35rem;
    font-weight: 800;
    line-height: 1;
    color: #1e293b;
}

.stat-label {
    font-size: 0.72rem;
    color: #64748b;
    font-weight: 500;
    margin-top: 0.125rem;
}

/* === Section Block === */
.section-block {
    border: 1px solid #e2e8f0;
    border-radius: 0.625rem;
    overflow: hidden;
}

.section-block-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    font-weight: 600;
    font-size: 0.88rem;
    color: #1e293b;
}

.section-icon-red {
    color: #ef4444;
}

.section-icon-blue {
    color: #3b82f6;
}

/* === No Issues === */
.no-issues-card {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1.25rem;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 0.625rem;
}

.no-issues-card i {
    font-size: 2rem;
    color: #10b981;
    flex-shrink: 0;
}

.no-issues-title {
    margin: 0;
    font-weight: 700;
    color: #065f46;
    font-size: 0.95rem;
}

.no-issues-sub {
    margin: 0.125rem 0 0 0;
    font-size: 0.8rem;
    color: #047857;
}

/* === Note Card === */
.note-card {
    padding: 0;
}

.note-card-body {
    padding: 1rem;
}

.note-text {
    margin: 0 0 0.625rem 0;
    color: #334155;
    line-height: 1.6;
    font-size: 0.88rem;
}

.note-meta-row {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    color: #94a3b8;
}

.note-meta-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
}

/* === Empty Note === */
.empty-note {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    color: #94a3b8;
    font-size: 0.85rem;
}

.empty-note i {
    color: #cbd5e1;
}

/* === Footer === */
.detail-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}

@media (max-width: 768px) {
    .stats-row {
        grid-template-columns: repeat(2, 1fr);
    }

    .header-title-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.375rem;
    }

    .detail-footer {
        flex-direction: column-reverse;
        gap: 0.5rem;
        align-items: stretch;
    }

    .detail-footer button {
        width: 100%;
    }
}
</style>
