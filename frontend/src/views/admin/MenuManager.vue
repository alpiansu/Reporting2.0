<template>
  <div class="menu-manager">
    <div class="page-header">
      <h1>Menu Manager</h1>
      <p>Kelola menu navigasi aplikasi berdasarkan peran pengguna</p>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Daftar Menu</h2>
        <button class="add-button" @click="showAddMenuModal = true">
          <i class="pi pi-plus"></i> Tambah Menu Baru
        </button>
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
          <button class="add-button" @click="showAddMenuModal = true">
            <i class="pi pi-plus"></i> Tambah Menu Baru
          </button>
        </div>

        <div v-else>
          <div v-for="(category, index) in menuStore.menuCategories" :key="index" class="menu-category mb-4">
            <div class="menu-category-header">
              <h3>{{ category.name }}</h3>
              <div class="action-buttons">
                <button class="edit-button" @click="editCategory(category)">
                  <i class="pi pi-pencil"></i>
                </button>
                <button class="delete-button" @click="confirmDeleteCategory(category)">
                  <i class="pi pi-trash"></i>
                </button>
              </div>
            </div>

            <div class="table-container">
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
                        <button class="edit-button" @click="editMenuItem(category, item)">
                          <i class="pi pi-pencil"></i>
                        </button>
                        <button class="delete-button" @click="confirmDeleteMenuItem(category, item)">
                          <i class="pi pi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal for adding/editing menu category -->
    <div v-if="showCategoryModal" class="modal-backdrop"></div>
    <div class="modal" :class="{ 'show': showCategoryModal }" tabindex="-1" role="dialog" v-if="showCategoryModal">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ isEditingCategory ? 'Edit Kategori Menu' : 'Tambah Kategori Menu' }}</h5>
            <button type="button" class="modal-close" @click="closeCategoryModal">
              <i class="pi pi-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveCategory">
              <div class="form-group">
                <label for="categoryName">Nama Kategori</label>
                <input type="text" class="form-input" id="categoryName" v-model="categoryForm.name" required>
              </div>
              <div class="form-group">
                <label for="categoryOrder">Urutan</label>
                <input type="number" class="form-input" id="categoryOrder" v-model="categoryForm.order" required
                  min="0">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="cancel-button" @click="closeCategoryModal">Batal</button>
            <button type="button" class="submit-button" @click="saveCategory">Simpan</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal for adding/editing menu item -->
    <div v-if="showMenuItemModal" class="modal-backdrop"></div>
    <div class="modal" :class="{ 'show': showMenuItemModal }" tabindex="-1" role="dialog" v-if="showMenuItemModal">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ isEditingMenuItem ? 'Edit Menu Item' : 'Tambah Menu Item' }}</h5>
            <button type="button" class="modal-close" @click="closeMenuItemModal">
              <i class="pi pi-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveMenuItem">
              <div class="form-group">
                <label for="menuCategory">Kategori</label>
                <select class="form-select" id="menuCategory" v-model="menuItemForm.categoryId" required>
                  <option v-for="category in menuStore.menuCategories" :key="category.id" :value="category.id">
                    {{ category.name }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label for="menuText">Nama Menu</label>
                <input type="text" class="form-input" id="menuText" v-model="menuItemForm.text" required>
              </div>
              <div class="form-group">
                <label for="menuIcon">Icon (PrimeIcons)</label>
                <input type="text" class="form-input" id="menuIcon" v-model="menuItemForm.icon" placeholder="pi-home">
              </div>
              <div class="form-group">
                <label for="menuPath">Path</label>
                <input type="text" class="form-input" id="menuPath" v-model="menuItemForm.path" required>
              </div>
              <div class="form-group">
                <label>Peran yang Diizinkan</label>
                <div class="checkbox-group">
                  <div class="checkbox-item">
                    <input type="checkbox" id="roleAdmin" value="admin" v-model="menuItemForm.roles">
                    <label for="roleAdmin">Admin</label>
                  </div>
                  <div class="checkbox-item">
                    <input type="checkbox" id="roleUser" value="user" v-model="menuItemForm.roles">
                    <label for="roleUser">User</label>
                  </div>
                  <div class="checkbox-item">
                    <input type="checkbox" id="roleManager" value="superadmin" v-model="menuItemForm.roles">
                    <label for="roleManager">Super Admin</label>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label for="menuKeywords">Keywords (dipisahkan dengan koma)</label>
                <input type="text" class="form-input" id="menuKeywords" v-model="menuItemForm.keywordsInput"
                  placeholder="dashboard, home, beranda">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="cancel-button" @click="closeMenuItemModal">Batal</button>
            <button type="button" class="submit-button" @click="saveMenuItem">Simpan</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <div v-if="showConfirmModal" class="modal-backdrop"></div>
    <div class="modal" :class="{ 'show': showConfirmModal }" tabindex="-1" role="dialog" v-if="showConfirmModal">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Konfirmasi</h5>
            <button type="button" class="modal-close" @click="closeConfirmModal">
              <i class="pi pi-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <p>{{ confirmMessage }}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="cancel-button" @click="closeConfirmModal">Batal</button>
            <button type="button" class="delete-button" @click="confirmCallback()">Hapus</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useMenuStore } from '../../stores';
import { useToastService } from '../../utils/toast';

const menuStore = useMenuStore();
const toast = useToastService();

// State for modals
const showAddMenuModal = ref(false);
const showCategoryModal = ref(false);
const showMenuItemModal = ref(false);
const showConfirmModal = ref(false);

// State for editing
const isEditingCategory = ref(false);
const isEditingMenuItem = ref(false);
const currentCategoryId = ref(null);
const currentMenuItemId = ref(null);

// Form data
const categoryForm = ref({
  id: null,
  name: '',
  order: 0
});

const menuItemForm = ref({
  id: null,
  categoryId: null,
  text: '',
  icon: '',
  path: '',
  roles: [],
  keywordsInput: ''
});

// Confirmation modal
const confirmMessage = ref('');
const confirmCallback = ref(null);

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
  isEditingCategory.value = false;
  categoryForm.value = {
    id: null,
    name: '',
    order: menuStore.menuCategories.length + 1
  };
  showCategoryModal.value = true;
}

function editCategory(category) {
  isEditingCategory.value = true;
  categoryForm.value = {
    id: category.id,
    name: category.name,
    order: category.order || 0
  };
  currentCategoryId.value = category.id;
  showCategoryModal.value = true;
}

async function saveCategory() {
  try {
    if (isEditingCategory.value) {
      await menuStore.updateMenu({
        id: currentCategoryId.value,
        name: categoryForm.value.name,
        order: categoryForm.value.order
      });
      toast.showSuccess('Success', 'Menu category updated successfully');
    } else {
      await menuStore.createMenu({
        name: categoryForm.value.name,
        items: [],
        order: categoryForm.value.order
      });
      toast.showSuccess('Success', 'Menu category created successfully');
    }
    closeCategoryModal();
  } catch (error) {
    console.error('Failed to save category:', error);
    toast.showError('Error', 'Failed to save menu category');
  }
}

function confirmDeleteCategory(category) {
  confirmMessage.value = `Are you sure you want to delete the category "${category.name}" and all its menu items?`;
  confirmCallback.value = async () => {
    try {
      await menuStore.deleteMenu(category.id);
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
  categoryForm.value = {
    id: null,
    name: '',
    order: 0
  };
}

// Menu item methods
function addMenuItem() {
  isEditingMenuItem.value = false;
  menuItemForm.value = {
    id: null,
    categoryId: menuStore.menuCategories.length > 0 ? menuStore.menuCategories[0].id : null,
    text: '',
    icon: '',
    path: '',
    roles: ['admin'],
    keywordsInput: ''
  };
  showMenuItemModal.value = true;
}

function editMenuItem(category, item) {
  isEditingMenuItem.value = true;
  menuItemForm.value = {
    id: item.id,
    categoryId: category.id,
    text: item.text,
    icon: item.icon,
    path: item.path,
    roles: [...(item.roles || [])],
    keywordsInput: (item.keywords || []).join(', ')
  };
  currentCategoryId.value = category.id;
  currentMenuItemId.value = item.id;
  showMenuItemModal.value = true;
}

async function saveMenuItem() {
  try {
    const keywords = menuItemForm.value.keywordsInput
      .split(',')
      .map(keyword => keyword.trim())
      .filter(keyword => keyword !== '');

    const menuItemData = {
      id: menuItemForm.value.id,
      text: menuItemForm.value.text,
      icon: menuItemForm.value.icon,
      path: menuItemForm.value.path,
      roles: menuItemForm.value.roles,
      keywords: keywords
    };

    if (isEditingMenuItem.value) {
      // Find the category
      const category = menuStore.menuCategories.find(cat => cat.id === currentCategoryId.value);
      if (!category) {
        throw new Error('Category not found');
      }

      // Update the menu item
      const updatedItems = category.items.map(item => {
        if (item.id === currentMenuItemId.value) {
          return { ...item, ...menuItemData };
        }
        return item;
      });

      // If category changed, remove from old and add to new
      if (currentCategoryId.value !== menuItemForm.value.categoryId) {
        // Remove from old category
        const updatedOldCategory = {
          ...category,
          items: category.items.filter(item => item.id !== currentMenuItemId.value)
        };
        await menuStore.updateMenu(updatedOldCategory);

        // Add to new category
        const newCategory = menuStore.menuCategories.find(cat => cat.id === menuItemForm.value.categoryId);
        if (!newCategory) {
          throw new Error('New category not found');
        }

        const updatedNewCategory = {
          ...newCategory,
          items: [...newCategory.items, menuItemData]
        };
        await menuStore.updateMenu(updatedNewCategory);
      } else {
        // Update in the same category
        const updatedCategory = {
          ...category,
          items: updatedItems
        };
        await menuStore.updateMenu(updatedCategory);
      }

      toast.showSuccess('Success', 'Menu item updated successfully');
    } else {
      // Find the category
      const category = menuStore.menuCategories.find(cat => cat.id === menuItemForm.value.categoryId);
      if (!category) {
        throw new Error('Category not found');
      }

      // Generate a new ID for the menu item
      menuItemData.id = Date.now().toString();

      // Add the new menu item to the category
      const updatedCategory = {
        ...category,
        items: [...category.items, menuItemData]
      };

      await menuStore.updateMenu(updatedCategory);
      toast.showSuccess('Success', 'Menu item created successfully');
    }

    closeMenuItemModal();
  } catch (error) {
    console.error('Failed to save menu item:', error);
    toast.showError('Error', 'Failed to save menu item');
  }
}

function confirmDeleteMenuItem(category, item) {
  confirmMessage.value = `Are you sure you want to delete the menu item "${item.text}"?`;
  confirmCallback.value = async () => {
    try {
      // Remove the item from the category
      const updatedCategory = {
        ...category,
        items: category.items.filter(i => i.id !== item.id)
      };

      await menuStore.updateMenu(updatedCategory);
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
  menuItemForm.value = {
    id: null,
    categoryId: null,
    text: '',
    icon: '',
    path: '',
    roles: [],
    keywordsInput: ''
  };
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
}
</script>

<style scoped>
.menu-manager {
  padding: 1rem;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 0.5rem;
}

.page-header p {
  color: var(--text-secondary-color);
  font-size: 0.9rem;
}

.card {
  background-color: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border-radius: 0.5rem;
  margin-bottom: 2rem;
  overflow: hidden;
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
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background-color 0.2s;
}

.add-button:hover {
  background-color: var(--primary-color-darken);
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

/* Modal styles */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  z-index: 1040;
  backdrop-filter: blur(2px);
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  z-index: 1050;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal.show {
  display: flex;
}

.modal-dialog {
  position: relative;
  width: 100%;
  margin: 0 auto;
  max-width: 500px;
  transform: translateY(0);
  transition: transform 0.3s ease-out;
}

.modal-content {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  outline: 0;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #eee;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--primary-color, #3B82F6);
}

.modal-close {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: #666;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.modal-close:hover {
  color: var(--primary-color, #3B82F6);
}

.modal-body {
  position: relative;
  flex: 1 1 auto;
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #eee;
  gap: 0.75rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.form-input,
.form-select {
  display: block;
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-size: 0.95rem;
  line-height: 1.5;
  color: #333;
  background-color: #fff;
  background-clip: padding-box;
  border: 1px solid #ddd;
  border-radius: 4px;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.form-input:focus,
.form-select:focus {
  border-color: var(--primary-color, #3B82F6);
  outline: 0;
  box-shadow: 0 0 0 0.2rem rgba(59, 130, 246, 0.25);
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-item input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
}

.checkbox-item label {
  margin-bottom: 0;
  font-weight: normal;
}

.submit-button {
  padding: 0.625rem 1.25rem;
  font-size: 0.95rem;
  font-weight: 500;
  color: #fff;
  background-color: var(--primary-color, #3B82F6);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-button:hover {
  background-color: var(--primary-dark-color, #2563EB);
}

.cancel-button {
  padding: 0.625rem 1.25rem;
  font-size: 0.95rem;
  font-weight: 500;
  color: #666;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.cancel-button:hover {
  background-color: #e5e5e5;
}
</style>