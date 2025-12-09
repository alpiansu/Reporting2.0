<template>
    <Dialog v-model:visible="localVisible" :header="dialogTitle" :modal="true" :closable="true" :dismissableMask="true"
        :style="{ width: '90vw', maxWidth: '1200px' }" @hide="handleClose">
        <template #header>
            <div class="detail-header">
                <div class="header-title">
                    <i class="pi pi-shop"></i>
                    <div>
                        <h3>{{ store?.KDTK }} - {{ store?.NAMA }} ({{ store?.CAB }})</h3>
                        <Badge :value="store?.IS_READY ? 'SIAP' : 'BELUM SIAP'"
                            :severity="store?.IS_READY ? 'success' : 'danger'" />
                    </div>
                </div>
            </div>
        </template>

        <div v-if="loading" class="loading-container">
            <ProgressSpinner />
            <p>Memuat detail toko...</p>
        </div>

        <div v-else-if="store" class="detail-content">
            <!-- Summary Section -->
            <div class="summary-section">
                <Card>
                    <template #content>
                        <div class="summary-grid">
                            <div class="summary-item">
                                <i class="pi pi-list-check"></i>
                                <div>
                                    <div class="summary-label">Total Rules</div>
                                    <div class="summary-value">{{ store.TOTAL_RULES }}</div>
                                </div>
                            </div>
                            <div class="summary-item">
                                <i class="pi pi-check"></i>
                                <div>
                                    <div class="summary-label">Passed</div>
                                    <div class="summary-value text-success">{{ store.PASSED_RULES }}</div>
                                </div>
                            </div>
                            <div class="summary-item">
                                <i class="pi pi-times"></i>
                                <div>
                                    <div class="summary-label">Failed</div>
                                    <div class="summary-value text-danger">{{ store.FAILED_RULES }}</div>
                                </div>
                            </div>
                            <div class="summary-item">
                                <i class="pi pi-exclamation-triangle"></i>
                                <div>
                                    <div class="summary-label">Critical</div>
                                    <div class="summary-value text-warning">{{ store.CRITICAL_ISSUES }}</div>
                                </div>
                            </div>
                        </div>
                    </template>
                </Card>
            </div>

            <!-- Issues Section -->
            <div v-if="store.ISSUES && store.ISSUES.length > 0" class="issues-section">
                <h4 class="section-title">
                    <i class="pi pi-exclamation-circle"></i>
                    Issues Ditemukan
                </h4>
                <IssuesAccordion :issues="groupedIssues" />
            </div>

            <!-- Note Section -->
            <div class="note-section">
                <Card>
                    <template #header>
                        <div class="note-header">
                            <i class="pi pi-comment"></i>
                            <span>Catatan</span>
                        </div>
                    </template>
                    <template #content>
                        <div v-if="store.note" class="note-display">
                            <p>{{ store.note.noteText }}</p>
                            <div class="note-meta">
                                <span><i class="pi pi-user"></i> {{ store.note.fullName || store.note.pic }}</span>
                                <span><i class="pi pi-clock"></i> {{ formatDateTime(store.note.updated_at) }}</span>
                            </div>
                        </div>
                        <div v-else class="no-note">
                            <i class="pi pi-info-circle"></i>
                            <p>Belum ada catatan untuk toko ini</p>
                        </div>
                    </template>
                </Card>
            </div>
        </div>

        <template #footer>
            <div class="footer-actions">
                <Button :label="store?.note ? 'Edit Note' : 'Tambah Note'" icon="pi pi-comment" class="p-button-info"
                    @click="handleEditNote" />
                <Button label="Tutup" icon="pi pi-times" class="p-button-secondary" @click="handleClose" />
            </div>
        </template>
    </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Card from 'primevue/card';
import Badge from 'primevue/badge';
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

const dialogTitle = computed(() => {
    if (!props.store) return 'Detail Toko';
    return `Detail - ${props.store.KDTK}`;
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
    emit('edit-note');
};
</script>

<style scoped>
.detail-header {
    width: 100%;
}

.header-title {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.header-title i {
    font-size: 2rem;
    color: #3b82f6;
}

.header-title h3 {
    margin: 0;
    font-size: 1.25rem;
    color: #111827;
}

.loading-container {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
}

.detail-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.summary-section {
    margin-bottom: 1rem;
}

.summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1.5rem;
}

.summary-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 8px;
}

.summary-item i {
    font-size: 2rem;
    color: #3b82f6;
}

.summary-label {
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 0.25rem;
}

.summary-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
}

.text-success {
    color: #10b981 !important;
}

.text-danger {
    color: #ef4444 !important;
}

.text-warning {
    color: #f59e0b !important;
}

.section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin-bottom: 1rem;
}

.section-title i {
    color: #ef4444;
}

.note-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: #111827;
}

.note-header i {
    color: #3b82f6;
}

.note-display {
    padding: 1rem;
    background: #f9fafb;
    border-radius: 8px;
    border-left: 4px solid #3b82f6;
}

.note-display p {
    margin: 0 0 1rem 0;
    color: #374151;
    line-height: 1.6;
}

.note-meta {
    display: flex;
    gap: 1.5rem;
    font-size: 0.875rem;
    color: #6b7280;
}

.note-meta span {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.no-note {
    text-align: center;
    padding: 2rem;
    color: #9ca3af;
}

.no-note i {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    display: block;
}

.footer-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
}

@media (max-width: 768px) {
    .summary-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    .footer-actions {
        flex-direction: column;
    }

    .footer-actions button {
        width: 100%;
    }
}
</style>