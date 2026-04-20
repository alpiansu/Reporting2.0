<template>
  <div class="menu-manager">
    <div class="page-header">
      <div class="header-content">
        <h1>Menu Manager</h1>
        <p>Kelola menu aplikasi dan atur struktur navigasi</p>
      </div>
      <div class="header-actions">
        <button class="add-button" @click="addCategory">
          <i class="pi pi-plus"></i>
          Tambah Kategori
        </button>
        <button class="add-button" @click="addMenuItem">
          <i class="pi pi-plus"></i>
          Tambah Menu Item
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Daftar Menu</h2>
      </div>

      <div class="card-body">
        <div v-if="menuStore.loading" class="loading-state">
          <i class="pi pi-spin pi-spinner"></i>
          <p>Memuat data menu...</p>
        </div>

        <div v-else-if="menuStore.error" class="error-state">
          <i class="pi pi-exclamation-triangle"></i> {{ menuStore.error }}
        </div>

        <div v-else-if="!menuStore.hasMenus" class="empty-state">
          <i class="pi pi-info-circle"></i>
          <p>Belum ada menu yang tersedia</p>
          <div class="empty-actions">
            <button class="add-button" @click="addCategory()">
              <i class="pi pi-plus"></i> Tambah Kategori
            </button>
            <button class="add-button" @click="addMenuItem()">
              <i class="pi pi-plus"></i> Tambah Menu Item
            </button>
          </div>
        </div>

        <div v-else>
          <div v-for="(category, index) in menuStore.menuCategories" :key="index" class="menu-category mb-4">
            <div class="menu-category-header">
              <h3>{{ category.name }}</h3>
              <div class="category-actions">
                <button class="add-item-button" @click="addMenuItemToCategory(category)" title="Tambah item ke kategori ini">
                  <i class="pi pi-plus"></i> Tambah Item
                </button>
                <button class="edit-button" @click="editCategory(category)" title="Edit kategori">
                  <i class="pi pi-pencil"></i>
                </button>
                <button class="delete-button" @click="confirmDeleteCategory(category)" title="Hapus kategori">
                  <i class="pi pi-trash"></i>
                </button>
              </div>
            </div>

            <div v-if="category.items && category.items.length > 0" class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Icon</th>
                    <th>Path</th>
                    <th>Peran</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in category.items" :key="item.id">
                    <td>{{ item.text }}</td>
                    <td><i :class="`pi ${item.icon}`"></i> {{ item.icon }}</td>
                    <td>{{ item.path }}</td>
                    <td>
                      <span v-for="role in item.roles" :key="role" class="role-badge">
                        {{ role }}
                      </span>
                    </td>
                    <td>
                      <div class="action-buttons">
                        <button class="edit-button" @click="editMenuItem(category, item)" title="Edit menu item">
                          <i class="pi pi-pencil"></i>
                        </button>
                        <button class="delete-button" @click="confirmDeleteMenuItem(category, item)" title="Hapus menu item">
                          <i class="pi pi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="category-empty-state">
              <i class="pi pi-info-circle"></i>
              <p>Belum ada menu item dalam kategori ini</p>
              <button class="add-item-button" @click="addMenuItemToCategory(category)">
                <i class="pi pi-plus"></i> Tambah Item Pertama
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Category Dialog -->
    <CategoryDialog 
      :show="showCategoryModal"
      :category="selectedCategory"
      :categories-count="menuStore.menuCategories.length"
      @close="closeCategoryModal"
      @save="saveCategory"
    />

    <!-- Menu Item Dialog -->
    <MenuItemDialog 
      :show="showMenuItemModal"
      :menu-item="selectedMenuItem"
      :category="selectedCategory"
      :categories="menuStore.menuCategories"
      @close="closeMenuItemModal"
      @save="saveMenuItem"
    />

    <!-- Confirmation Dialog -->
    <ConfirmDialog 
      :show="showConfirmModal"
      :title="'Konfirmasi'"
      :message="confirmMessage"
      :confirm-text="'Hapus'"
      :cancel-text="'Batal'"
      :type="'danger'"
      @close="closeConfirmModal"
      @confirm="confirmCallback"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useMenuStore } from '../../stores';
import { useToastService } from '../../utils/toast';
import CategoryDialog from '../../components/CategoryDialog.vue';
import MenuItemDialog from '../../components/MenuItemDialog.vue';
import ConfirmDialog from '../../components/admin/ConfirmDialog.vue';

const menuStore = useMenuStore();
const toast = useToastService();

// State for modals
const showCategoryModal = ref(false);
const showMenuItemModal = ref(false);
const showConfirmModal = ref(false);

// State for selected items
const selectedCategory = ref(null);
const selectedMenuItem = ref(null);
const currentCategoryId = ref(null);
const currentMenuItemId = ref(null);

// Confirmation modal
const confirmMessage = ref('');
const confirmCallback = ref(null);
const confirmType = ref('warning');

// Load menus on component mount
onMounted(async () => {
  try {
    await menuStore.fetchAllMenus();
  } catch (error) {
    console.error('Failed to fetch menus:', error);
    toast.showError('Error', 'Failed to load menus');
  }
});

// Category methods
function addCategory() {
  selectedCategory.value = null;
  showCategoryModal.value = true;
}

function editCategory(category) {
  selectedCategory.value = { ...category };
  showCategoryModal.value = true;
}

async function saveCategory(categoryData) {
  try {
    if (categoryData.id) {
      await menuStore.updateCategory(categoryData.id, categoryData);
      toast.showSuccess('Success', 'Menu category updated successfully');
    } else {
      await menuStore.createCategory(categoryData);
      toast.showSuccess('Success', 'Menu category created successfully');
    }
    showCategoryModal.value = false;
  } catch (error) {
    console.error('Failed to save category:', error);
    toast.showError('Error', 'Failed to save menu category');
  }
}

function confirmDeleteCategory(category) {
  confirmMessage.value = `Are you sure you want to delete the category "${category.name}" and all its menu items?`;
  confirmCallback.value = async () => {
    try {
      await menuStore.deleteCategory(category.id);
      toast.showSuccess('Success', 'Menu category deleted successfully');
      closeConfirmModal();
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.showError('Error', 'Failed to delete menu category');
      closeConfirmModal();
    }
  };
  showConfirmModal.value = true;
}

function closeCategoryModal() {
  showCategoryModal.value = false;
  selectedCategory.value = null;
}

// Menu item methods
function addMenuItem() {
  selectedMenuItem.value = null;
  selectedCategory.value = menuStore.menuCategories.length > 0 ? menuStore.menuCategories[0] : null;
  showMenuItemModal.value = true;
}

function addMenuItemToCategory(category) {
  selectedMenuItem.value = null;
  selectedCategory.value = category;
  showMenuItemModal.value = true;
}

function editMenuItem(category, item) {
  selectedMenuItem.value = { ...item };
  selectedCategory.value = category;
  showMenuItemModal.value = true;
}

async function saveMenuItem(menuItemData) {
  try {
    if (menuItemData.id) {
      // Update existing menu item
      if (selectedCategory.value.id !== menuItemData.categoryId) {
        // First move the item to the new category
        await menuStore.moveMenuItem(selectedCategory.value.id, menuItemData.categoryId, menuItemData.id);
        // Then update the item's data within the new category
        await menuStore.updateMenuItem(menuItemData.categoryId, menuItemData.id, menuItemData);
      } else {
        await menuStore.updateMenuItem(selectedCategory.value.id, menuItemData.id, menuItemData);
      }
      toast.showSuccess('Success', 'Menu item updated successfully');
    } else {
      // Add new menu item
      await menuStore.addMenuItem(menuItemData.categoryId, menuItemData);
      toast.showSuccess('Success', 'Menu item created successfully');
    }

    showMenuItemModal.value = false;
  } catch (error) {
    console.error('Failed to save menu item:', error);
    toast.showError('Error', 'Failed to save menu item');
  }
}

function confirmDeleteMenuItem(category, item) {
  confirmMessage.value = `Are you sure you want to delete the menu item "${item.text}"?`;
  confirmCallback.value = async () => {
    try {
      await menuStore.deleteMenuItem(category.id, item.id);
      toast.showSuccess('Success', 'Menu item deleted successfully');
      closeConfirmModal();
    } catch (error) {
      console.error('Failed to delete menu item:', error);
      toast.showError('Error', 'Failed to delete menu item');
      closeConfirmModal();
    }
  };
  showConfirmModal.value = true;
}

function closeMenuItemModal() {
  showMenuItemModal.value = false;
  selectedMenuItem.value = null;
  selectedCategory.value = null;
}

function confirmAction() {
  if (confirmCallback.value) {
    confirmCallback.value();
  }
}

function closeConfirmModal() {
  showConfirmModal.value = false;
  confirmMessage.value = '';
  confirmCallback.value = null;
  confirmType.value = 'warning';
}
</script>

<style scoped>
.menu-manager {
  padding: 1rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.header-content h1 {
  font-size: 2rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
}

.header-content p {
  margin: 0;
  opacity: 0.9;
  font-size: 1rem;
}

.card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.05);
  margin-bottom: 2rem;
}

.card-header {
  padding: 1rem;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.empty-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
  justify-content: center;
}

.card-body {
  padding: 1rem;
}

.menu-category {
  margin-bottom: 1.5rem;
}

.menu-category-header {
  padding: 0.75rem 0;
  border-bottom: 1px solid #e9ecef;
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.menu-category-header h3 {
  font-size: 1.1rem;
  font-weight: 500;
  margin: 0;
}

.category-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.add-item-button {
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.add-item-button:hover {
  background-color: #218838;
  transform: translateY(-1px);
}

.category-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: #6c757d;
  background-color: #f8f9fa;
  border-radius: 6px;
  margin: 1rem 0;
}

.category-empty-state i {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: #6c757d;
}

.category-empty-state p {
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

/* Table styles */
.table-container {
  overflow-x: auto;
  margin-bottom: 1rem;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  background-color: #f8f9fa;
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-color);
  border-bottom: 1px solid #e9ecef;
}

.data-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #e9ecef;
  font-size: 0.875rem;
}

.data-table tr:hover {
  background-color: #f8f9fa;
}

/* Button styles */
.add-button {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.add-button:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(255, 255, 255, 0.2);
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.edit-button {
  background-color: transparent;
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-button:hover {
  background-color: var(--primary-color);
  color: white;
}

.delete-button {
  background-color: transparent;
  color: var(--danger-color, #dc3545);
  border: 1px solid var(--danger-color, #dc3545);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.delete-button:hover {
  background-color: var(--danger-color, #dc3545);
  color: white;
}

.role-badge {
  display: inline-block;
  background-color: var(--primary-color);
  color: white;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  margin-right: 0.25rem;
  margin-bottom: 0.25rem;
}

/* State styles */
.loading-state,
.empty-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}

.loading-state i,
.empty-state i,
.error-state i {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.loading-state i {
  color: var(--primary-color);
}

.empty-state i {
  color: var(--text-secondary-color);
}

.error-state {
  color: var(--danger-color, #dc3545);
}

.error-state i {
  color: var(--danger-color, #dc3545);
}

/* Modal and form styles moved to separate dialog components */
</style>