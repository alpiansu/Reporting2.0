<template>
    <Card class="filter-card">
        <template #content>
            <div class="filter-container">
                <!-- Periode Filter -->
                <div class="filter-group">
                    <label for="periode" class="filter-label">
                        <i class="pi pi-calendar"></i>
                        Periode Closing
                    </label>
                    <Calendar id="periode" v-model="selectedDate" view="month" dateFormat="mm/yy"
                        placeholder="Pilih Bulan/Tahun" :maxDate="today" showIcon class="w-full"
                        @date-select="handlePeriodeChange" />
                </div>

                <!-- Cabang Filter -->
                <div class="filter-group">
                    <label for="cabang" class="filter-label">
                        <i class="pi pi-building"></i>
                        Cabang
                    </label>
                    <Dropdown id="cabang" v-model="localCabang" :options="cabangOptions" optionLabel="namacab"
                        optionValue="kdcab" placeholder="Pilih Cabang" class="w-full" @change="handleCabangChange" />
                </div>

                <!-- Search Input -->
                <div class="filter-group flex-grow">
                    <label for="search" class="filter-label">
                        <i class="pi pi-search"></i>
                        Pencarian
                    </label>
                    <div class="search-box">
                        <InputText id="search" v-model="localSearch" placeholder="Cari kode toko, nama toko..."
                            class="w-full" @input="handleSearchChange" />
                        <Button v-if="localSearch" icon="pi pi-times" class="p-button-text p-button-sm clear-btn"
                            @click="clearSearch" />
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="filter-actions">
                    <Button icon="pi pi-refresh" label="Refresh" class="p-button-outlined" @click="$emit('refresh')" />
                    <Button icon="pi pi-bolt" label="Mulai Screening" class="p-button-primary" :disabled="!localPeriode"
                        @click="$emit('start-screening')" />
                </div>
            </div>
        </template>
    </Card>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import Card from 'primevue/card';
import Calendar from 'primevue/calendar';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import { useCabangStore } from '@/stores';

const props = defineProps({
    periode: String,
    cabang: String,
    search: String
});

const emit = defineEmits(['update:periode', 'update:cabang', 'update:search', 'refresh', 'start-screening']);

const cabangStore = useCabangStore();

// State
const selectedDate = ref(null);
const localPeriode = ref(props.periode);
const localCabang = ref(props.cabang);
const localSearch = ref(props.search);
const today = ref(new Date());
const cabangOptions = ref([]);
const searchTimeout = ref(null);

// Initialize
onMounted(async () => {
    // Load cabang options
    const cabangData = cabangStore.allCabang || [];
    cabangOptions.value = [
        { kdcab: 'All', namacab: 'SEMUA CABANG' },
        ...cabangData
    ];

    // Set default periode if not set
    if (!props.periode) {
        const now = new Date();
        selectedDate.value = now;
        handlePeriodeChange();
    } else {
        // Parse existing periode to date
        const year = parseInt('20' + props.periode.substring(0, 2));
        const month = parseInt(props.periode.substring(2, 4)) - 1;
        selectedDate.value = new Date(year, month);
    }
});

// Watch props changes
watch(() => props.periode, (newVal) => {
    localPeriode.value = newVal;
    if (newVal && newVal.length === 4) {
        const year = parseInt('20' + newVal.substring(0, 2));
        const month = parseInt(newVal.substring(2, 4)) - 1;
        selectedDate.value = new Date(year, month);
    }
});

watch(() => props.cabang, (newVal) => {
    localCabang.value = newVal;
});

watch(() => props.search, (newVal) => {
    localSearch.value = newVal;
});

// Methods
const handlePeriodeChange = () => {
    if (selectedDate.value) {
        const year = selectedDate.value.getFullYear().toString().slice(-2);
        const month = (selectedDate.value.getMonth() + 1).toString().padStart(2, '0');
        const periode = year + month;
        localPeriode.value = periode;
        emit('update:periode', periode);
    }
};

const handleCabangChange = () => {
    emit('update:cabang', localCabang.value);
};

const handleSearchChange = () => {
    if (searchTimeout.value) {
        clearTimeout(searchTimeout.value);
    }

    searchTimeout.value = setTimeout(() => {
        emit('update:search', localSearch.value);
    }, 500);
};

const clearSearch = () => {
    localSearch.value = '';
    emit('update:search', '');
};
</script>

<style scoped>
.filter-card {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.filter-container {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: flex-end;
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 200px;
}

.filter-group.flex-grow {
    flex: 1;
}

.filter-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    color: #374151;
}

.filter-label i {
    color: #3b82f6;
}

.search-box {
    position: relative;
    display: flex;
    align-items: center;
}

.clear-btn {
    position: absolute;
    right: 0.5rem;
}

.filter-actions {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
    margin-left: auto;
}

:deep(.p-calendar),
:deep(.p-dropdown),
:deep(.p-inputtext) {
    width: 100%;
}

@media (max-width: 1024px) {
    .filter-container {
        flex-direction: column;
    }

    .filter-group {
        width: 100%;
        min-width: unset;
    }

    .filter-actions {
        width: 100%;
        margin-left: 0;
    }

    .filter-actions button {
        flex: 1;
    }
}

@media (max-width: 576px) {
    .filter-actions {
        flex-direction: column;
    }

    .filter-actions button {
        width: 100%;
    }
}
</style>