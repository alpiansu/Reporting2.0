<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    modal
    :closable="false"
    header="Buat RMB Manual"
    :style="{ width: '80vw', maxWidth: '1000px' }"
    class="rmb-manual-dialog"
  >
    <div class="stepper-container">
      <div class="step-indicator">
        <div class="step" :class="{ active: currentStep === 1, completed: currentStep > 1 }">
          <div class="step-circle">1</div>
          <div class="step-label">Toko & Tanggal</div>
        </div>
        <div class="step-line" :class="{ active: currentStep > 1 }"></div>
        <div class="step" :class="{ active: currentStep === 2, completed: currentStep > 2 }">
          <div class="step-circle">2</div>
          <div class="step-label">Input Produk</div>
        </div>
        <div class="step-line" :class="{ active: currentStep > 2 }"></div>
        <div class="step" :class="{ active: currentStep === 3 }">
          <div class="step-circle">3</div>
          <div class="step-label">Preview & Submit</div>
        </div>
      </div>

      <!-- Step 1: Toko & Tanggal -->
      <div v-if="currentStep === 1" class="step-content">
        <div class="form-group">
          <label>Pilih Toko</label>
          <Dropdown
            v-model="form.selectedStore"
            :options="filteredStores"
            optionLabel="label"
            placeholder="Ketik minimal 2 karakter (kode/nama)..."
            filter
            filterPlaceholder="Cari kode atau nama toko..."
            resetFilterOnHide
            :loading="isLoadingStores"
            class="w-full"
            @filter="searchStore"
            @change="onStoreSelect"
            :disabled="isCheckingConnection"
          >
            <template #value="slotProps">
              <div v-if="slotProps.value">
                {{ slotProps.value.storeCode }} - {{ slotProps.value.storeName }}
              </div>
              <span v-else>Pilih Toko</span>
            </template>
            <template #option="slotProps">
              <div>{{ slotProps.option.storeCode }} - {{ slotProps.option.storeName }}</div>
            </template>
          </Dropdown>
        </div>

        <div class="form-group mt-3">
          <label>Tanggal</label>
          <Calendar
            v-model="form.tanggal"
            dateFormat="yy-mm-dd"
            placeholder="YYYY-MM-DD"
            class="w-full"
            :maxDate="new Date()"
          />
        </div>

        <div class="connection-status mt-4" v-if="form.kdtk">
          <div v-if="isCheckingConnection" class="status-checking">
            <i class="pi pi-spin pi-spinner"></i> Memeriksa koneksi toko...
          </div>
          <div v-else-if="connectionStatus && connectionStatus.connected" class="status-success">
            <i class="pi pi-check-circle"></i> Koneksi berhasil ke {{ connectionStatus.host }}
          </div>
          <div v-else-if="connectionStatus && !connectionStatus.connected" class="status-error">
            <i class="pi pi-times-circle"></i> Koneksi Gagal:
            <span class="error-msg">{{ connectionStatus.errorCode }} - {{ connectionStatus.error }}</span>
          </div>
        </div>
      </div>

      <!-- Step 2: Input Item -->
      <div v-if="currentStep === 2" class="step-content">
        <div class="step-header-info">
          Toko: <strong>{{ form.kdtk }}</strong> | Tanggal: <strong>{{ formatDate(form.tanggal) }}</strong>
        </div>

        <div class="table-responsive mt-3">
          <table class="items-table">
            <thead>
              <tr>
                <th width="50">#</th>
                <th width="350">PRDCD (Min. 3 Karakter)</th>
                <th width="200">NOHP</th>
                <th width="200">TRXID</th>
                <th width="80">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in form.items" :key="index">
                <td class="text-center">{{ index + 1 }}</td>
                <td>
                  <AutoComplete
                    v-model="item.selectedProduct"
                    :suggestions="filteredProducts"
                    @complete="searchProduct"
                    @item-select="onProductSelect($event, index)"
                    optionLabel="prdcd"
                    placeholder="Ketik kode/nama produk..."
                    :minLength="3"
                    class="w-full"
                  >
                    <template #option="slotProps">
                      <div class="product-item">
                        <div class="product-code">{{ slotProps.option.prdcd }}</div>
                        <div class="product-desc">{{ slotProps.option.desc }}</div>
                        <Badge v-if="slotProps.option.merk === 'GAME ONLINE'" value="Game" severity="info" />
                        <Badge v-else value="Virtual" severity="success" />
                      </div>
                    </template>
                  </AutoComplete>
                  <small v-if="isValidProduct(item)" class="block mt-1 font-semibold text-primary">
                    {{ item.selectedProduct.desc }}
                    <Badge v-if="item.selectedProduct.merk === 'GAME ONLINE'" value="Game" severity="info" size="small" class="ml-1" />
                    <Badge v-else value="Virtual" severity="success" size="small" class="ml-1" />
                  </small>
                </td>
                <td>
                  <InputText
                    v-if="!isGameOnline(item)"
                    v-model="item.nohp"
                    placeholder="08xxxxxxxx"
                    class="w-full"
                    :disabled="!isValidProduct(item)"
                  />
                  <div v-else class="text-gray-400 italic text-sm mt-2 text-center">
                    (Game Online)
                  </div>
                </td>
                <td>
                  <InputText 
                    v-model="item.trxid" 
                    placeholder="ID Transaksi" 
                    class="w-full" 
                    :disabled="!isValidProduct(item)" 
                  />
                </td>
                <td class="text-center">
                  <Button
                    icon="pi pi-trash"
                    class="p-button-danger p-button-text p-button-sm"
                    @click="removeItem(index)"
                    :disabled="form.items.length === 1"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <Button
          label="Tambah Baris"
          icon="pi pi-plus"
          class="p-button-outlined p-button-sm mt-3"
          @click="addItem"
        />
      </div>

      <!-- Step 3: Preview -->
      <div v-if="currentStep === 3" class="step-content">
        <div class="preview-header">
          <div class="info-badge">
            <i class="pi pi-store"></i> {{ form.kdtk }} - {{ getStoreName(form.kdtk) }}
          </div>
          <div class="info-badge">
            <i class="pi pi-calendar"></i> {{ formatDate(form.tanggal) }}
          </div>
          <div class="info-badge success">
            <i class="pi pi-list"></i> {{ validItemsCount }} Item Valid
          </div>
        </div>

        <div class="table-responsive mt-4">
          <table class="preview-table">
            <thead>
              <tr>
                <th>#</th>
                <th>PRDCD</th>
                <th>Deskripsi</th>
                <th>NOHP</th>
                <th>TRXID</th>
                <th>QTY</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in validItems" :key="index">
                <td>{{ index + 1 }}</td>
                <td class="font-mono">{{ item.selectedProduct?.prdcd }}</td>
                <td>
                  {{ item.selectedProduct?.desc }}
                  <Badge v-if="isGameOnline(item)" value="Game" severity="info" class="ml-2" />
                </td>
                <td>{{ item.nohp || '-' }}</td>
                <td>{{ item.trxid || '-' }}</td>
                <td>1</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button
          label="Batal / Tutup"
          icon="pi pi-times"
          @click="closeDialog"
          class="p-button-text p-button-secondary"
          :disabled="isSubmitting"
        />
        
        <div class="nav-buttons">
          <Button
            v-if="currentStep > 1"
            label="Kembali"
            icon="pi pi-arrow-left"
            @click="currentStep--"
            class="p-button-outlined"
            :disabled="isSubmitting"
          />
          
          <Button
            v-if="currentStep === 1"
            label="Lanjut"
            iconPos="right"
            icon="pi pi-arrow-right"
            @click="currentStep++"
            class="p-button-primary"
            :disabled="!isStep1Valid"
          />
          
          <Button
            v-if="currentStep === 2"
            label="Preview"
            iconPos="right"
            icon="pi pi-arrow-right"
            @click="currentStep++"
            class="p-button-primary"
            :disabled="!isStep2Valid"
          />
          
          <Button
            v-if="currentStep === 3"
            label="Proses RMB"
            icon="pi pi-check"
            @click="submitManual"
            class="p-button-success"
            :loading="isSubmitting"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script>
import { ref, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import AutoComplete from 'primevue/autocomplete';
import Dialog from 'primevue/dialog';
import Badge from 'primevue/badge';
import dayjs from 'dayjs';

import buatRmbService from '../../../services/buatRmb.service';
import storeService from '../../../services/store.service';

export default {
  name: 'BuatRmbManualInputDialog',
  components: {
    Dropdown,
    Calendar,
    Button,
    InputText,
    AutoComplete,
    Dialog,
    Badge
  },
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:visible', 'success'],
  
  setup(props, { emit }) {
    const toast = useToast();
    
    // State
    const currentStep = ref(1);
    const isCheckingConnection = ref(false);
    const connectionStatus = ref(null);
    const isSubmitting = ref(false);
    const isLoadingStores = ref(false);
    const filteredProducts = ref([]);
    const filteredStores = ref([]);
    
    const defaultItem = () => ({
      selectedProduct: null,
      nohp: '',
      trxid: ''
    });

    const form = ref({
      kdtk: null,
      selectedStore: null,
      tanggal: new Date(),
      items: [defaultItem()]
    });

    // Reset state when dialog opens
    watch(() => props.visible, (newVal) => {
      if (newVal) {
        currentStep.value = 1;
        form.value = {
          kdtk: null,
          selectedStore: null,
          tanggal: new Date(),
          items: [defaultItem()]
        };
        connectionStatus.value = null;
        filteredStores.value = [];
      }
    });

    // Dynamic Server-side Store Search
    let storeSearchTimeout = null;
    const searchStore = (event) => {
      const query = event.value || '';
      
      if (query.trim().length < 2) {
        // Jika sedang kosong, tunjukkan yang selected saja agar dropdown tidak blank total jika ada yang dipilih
        if (form.value.selectedStore) {
          filteredStores.value = [form.value.selectedStore];
        } else {
          filteredStores.value = [];
        }
        return;
      }

      if (storeSearchTimeout) clearTimeout(storeSearchTimeout);
      
      isLoadingStores.value = true;
      storeSearchTimeout = setTimeout(async () => {
        try {
          const response = await storeService.getAllStores({ search: query, limit: 50 });
          if (response.data && response.data.stores) {
            filteredStores.value = response.data.stores.map(store => ({
              ...store,
              label: `${store.storeCode} - ${store.storeName}`
            }));
          }
        } catch (error) {
          console.error("Gagal mengambil data toko:", error);
          filteredStores.value = [];
        } finally {
          isLoadingStores.value = false;
        }
      }, 500); // Debounce
    };

    const onStoreSelect = (event) => {
      if (!event.value) {
        form.value.kdtk = null;
        connectionStatus.value = null;
        return;
      }
      form.value.kdtk = event.value.storeCode;
      handleStoreChange();
    };
    
    // Check Connection
    let checkTimeout = null;
    const handleStoreChange = () => {
      connectionStatus.value = null;
      if (!form.value.kdtk) return;

      isCheckingConnection.value = true;
      
      // Debounce check connection
      if (checkTimeout) clearTimeout(checkTimeout);
      
      checkTimeout = setTimeout(async () => {
        try {
          const response = await buatRmbService.checkStoreConnection(form.value.kdtk);
          // Respons axios biasanya response.data menunjuk ke response JSON dari backend
          // Dari backend: { success: true, data: { message: "...", data: { connected: true, ... } } }
          const responseData = response.data;
          
          if (responseData && responseData.success) {
            // Kita butuh responseData.data.data yang berisi object connected, host, error, dll
            const connectionData = responseData.data?.data || responseData.data;
            connectionStatus.value = connectionData;
          } else {
            connectionStatus.value = {
              connected: false,
              error: responseData?.message || responseData?.data?.message || 'Unknown error',
              errorCode: 'ERR'
            };
          }
        } catch (error) {
          connectionStatus.value = {
            connected: false,
            error: error.response?.data?.message || error.message,
            errorCode: error.response?.data?.data?.errorCode || 'FAILED'
          };
        } finally {
          isCheckingConnection.value = false;
        }
      }, 500);
    };

    // AutoComplete Search
    const searchProduct = async (event) => {
      if (event.query.trim().length < 3) {
        filteredProducts.value = [];
        return;
      }

      try {
        const response = await buatRmbService.searchStoreProducts(form.value.kdtk, event.query);
        const responseData = response.data;
        
        if (responseData && responseData.success) {
          // Response backend dari apiResponse.success membungkus data di dalam responseData.data.data
          filteredProducts.value = responseData.data?.data || responseData.data || [];
        } else {
          filteredProducts.value = [];
        }
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Gagal mengambil data produk dari toko',
          life: 3000
        });
        filteredProducts.value = [];
      }
    };

    const onProductSelect = (event, index) => {
      // Reset nohp when product changes
      form.value.items[index].nohp = '';
    };

    // Item Management
    const addItem = () => {
      form.value.items.push(defaultItem());
    };

    const removeItem = (index) => {
      if (form.value.items.length > 1) {
        form.value.items.splice(index, 1);
      }
    };

    // Helpers
    const getStoreName = (kdtk) => {
      if (form.value.selectedStore && form.value.selectedStore.storeCode === kdtk) {
        return form.value.selectedStore.storeName;
      }
      return '';
    };

    const formatDate = (date) => {
      if (!date) return '';
      return dayjs(date).format('YYYY-MM-DD');
    };

    const isValidProduct = (item) => {
      // Pastikan item.selectedProduct berupa object (hasil klik dari list), bukan text sembarangan
      return item.selectedProduct && 
             typeof item.selectedProduct === 'object' && 
             item.selectedProduct.prdcd;
    };

    const isGameOnline = (item) => {
      return isValidProduct(item) && item.selectedProduct.merk === 'GAME ONLINE';
    };

    // Validation
    const isStep1Valid = computed(() => {
      return form.value.kdtk && form.value.tanggal && connectionStatus.value?.connected;
    });

    const isItemValid = (item) => {
      if (!item.selectedProduct) return false;
      
      // If NOT game online, NOHP is required
      if (!isGameOnline(item) && (!item.nohp || item.nohp.trim() === '')) {
        return false;
      }
      
      return true;
    };

    const validItems = computed(() => {
      return form.value.items.filter(item => isItemValid(item));
    });

    const validItemsCount = computed(() => validItems.value.length);

    const isStep2Valid = computed(() => {
      return validItemsCount.value > 0;
    });

    // Submit
    const closeDialog = () => {
      emit('update:visible', false);
    };

    const submitManual = async () => {
      if (!isStep1Valid.value || !isStep2Valid.value) return;

      isSubmitting.value = true;
      try {
        const payload = {
          kdtk: form.value.kdtk,
          tanggal: formatDate(form.value.tanggal),
          items: validItems.value.map(item => ({
            prdcd: item.selectedProduct.prdcd,
            nohp: isGameOnline(item) ? '' : item.nohp,
            trxid: item.trxid || ''
          }))
        };

        const response = await buatRmbService.insertManual(payload);
        
        if (response.data && response.data.success) {
          toast.add({
            severity: 'success',
            summary: 'Berhasil',
            detail: 'RMB Manual berhasil diproses',
            life: 5000
          });
          emit('success', response.data.data);
          closeDialog();
        } else {
          throw new Error(response.data?.message || 'Gagal memproses RMB');
        }
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.message || error.message || 'Gagal memproses RMB',
          life: 5000
        });
      } finally {
        isSubmitting.value = false;
      }
    };

    return {
      currentStep,
      form,
      isCheckingConnection,
      connectionStatus,
      isSubmitting,
      isLoadingStores,
      filteredProducts,
      filteredStores,
      
      handleStoreChange,
      searchStore,
      onStoreSelect,
      searchProduct,
      onProductSelect,
      addItem,
      removeItem,
      getStoreName,
      formatDate,
      isValidProduct,
      isGameOnline,
      
      isStep1Valid,
      isStep2Valid,
      validItems,
      validItemsCount,
      
      closeDialog,
      submitManual
    };
  }
};
</script>

<style scoped>
.stepper-container {
  padding: 1rem 0;
}

.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2rem;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 2;
}

.step-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: #e2e8f0;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  margin-bottom: 0.5rem;
  transition: all 0.3s ease;
  border: 2px solid #e2e8f0;
}

.step-label {
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
  transition: all 0.3s ease;
}

.step.active .step-circle {
  background-color: #eff6ff;
  border-color: var(--primary-color, #0ea5e9);
  color: var(--primary-color, #0ea5e9);
}

.step.active .step-label {
  color: var(--primary-color, #0ea5e9);
  font-weight: 600;
}

.step.completed .step-circle {
  background-color: var(--primary-color, #0ea5e9);
  border-color: var(--primary-color, #0ea5e9);
  color: white;
}

.step.completed .step-label {
  color: #1e293b;
}

.step-line {
  flex: 1;
  max-width: 150px;
  height: 2px;
  background-color: #e2e8f0;
  margin: 0 1rem;
  position: relative;
  top: -12px;
  transition: all 0.3s ease;
}

.step-line.active {
  background-color: var(--primary-color, #0ea5e9);
}

.step-content {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  min-height: 300px;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: #334155;
}

.connection-status {
  padding: 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
}

.status-checking {
  color: #0284c7;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  padding: 0.75rem;
  border-radius: 6px;
}

.status-success {
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 0.75rem;
  border-radius: 6px;
}

.status-error {
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
  padding: 0.75rem;
  border-radius: 6px;
}

.error-msg {
  font-family: monospace;
  display: block;
  margin-top: 0.25rem;
  font-size: 0.8rem;
  word-break: break-all;
}

.items-table, .preview-table {
  width: 100%;
  border-collapse: collapse;
}

.items-table th, .preview-table th {
  text-align: left;
  padding: 0.75rem;
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
  color: #475569;
  font-size: 0.875rem;
}

.items-table td, .preview-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
}

.product-item {
  display: flex;
  flex-direction: column;
}

.product-code {
  font-weight: 600;
  font-size: 0.85rem;
  color: #334155;
}

.product-desc {
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 0.25rem;
}

.step-header-info {
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  border-left: 4px solid var(--primary-color, #0ea5e9);
  margin-bottom: 1rem;
}

.preview-header {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.info-badge {
  background: #f1f5f9;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.info-badge.success {
  background: #dcfce7;
  color: #166534;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.nav-buttons {
  display: flex;
  gap: 0.5rem;
}
</style>
