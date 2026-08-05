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
                <IssuesAccordion :issues="groupedIssues" :rulesMap="rulesMap" />
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
import { prepClosingApi } from '@/services/prepClosing.service';

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

// Rules Map: ruleKey → { query, validation, description }
const rulesMap = ref({});

const fetchRulesConfig = async () => {
    try {
        const response = await prepClosingApi.getRulesConfig();
        const rulesData = response.data || response;
        const rules = rulesData.rules || [];
        const map = {};
        for (const rule of rules) {
            map[rule.key] = {
                query: rule.query || null,
                validation: rule.validation || null,
                description: rule.description || '',
                name: rule.name || '',
            };
        }
        rulesMap.value = map;
    } catch (err) {
        console.warn('[StoreDetailModal] Failed to fetch rules config:', err.message);
        rulesMap.value = {};
    }
};
watch(() => props.visible, (newVal) => {
    if (newVal) {
        // Fetch rules config each time modal opens (in case rules were updated)
        fetchRulesConfig();
    }
});

const handleEditNote = () => {
    emit('edit-note', props.store);
};
</script>

<style scoped src="./StoreDetailModal.style.css"></style>
