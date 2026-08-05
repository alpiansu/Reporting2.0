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

<style scoped src="./index.style.css"></style>