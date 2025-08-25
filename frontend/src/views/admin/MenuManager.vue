<template>
  <div class="menu-manager">
    <div class="page-header">
      <h1>Menu Manager</h1>
      <p>Kelola menu navigasi aplikasi berdasarkan peran pengguna</p>
    </div>

    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h2>Daftar Menu</h2>
        <button class="btn btn-primary" @click="showAddMenuModal = true">
          <i class="pi pi-plus"></i> Tambah Menu Baru
        </button>
      </div>

      <div class="card-body">
        <div v-if="menuStore.loading" class="text-center p-5">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="mt-2">Memuat data menu...</p>
        </div>

        <div v-else-if="menuStore.error" class="alert alert-danger">
          <i class="pi pi-exclamation-triangle"></i> {{ menuStore.error }}
        </div>

        <div v-else-if="!menuStore.hasMenus" class="text-center p-5">
          <i class="pi pi-info-circle fs-1 text-muted"></i>
          <p class="mt-2">Belum ada menu yang tersedia</p>
          <button class="btn btn-primary" @click="showAddMenuModal = true">
            <i class="pi pi-plus"></i> Tambah Menu Baru
          </button>
        </div>

        <div v-else>
          <div v-for="(category, index) in menuStore.menuCategories" :key="index" class="menu-category mb-4">
            <div class="menu-category-header d-flex justify-content-between align-items-center">
              <h3>{{ category.name }}</h3>
              <div class="btn-group">
                <button class="btn btn-sm btn-outline-primary" @click="editCategory(category)">
                  <i class="pi pi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" @click="confirmDeleteCategory(category)">
                  <i class="pi pi-trash"></i>
                </button>
              </div>
            </div>

            <div class="table-responsive">
              <table class="table table-hover">
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
                      <span v-for="role in item.roles" :key="role" class="badge bg-primary me-1">
                        {{ role }}
                      </span>
                    </td>
                    <td>
                      <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary" @click="editMenuItem(category, item)">
                          <i class="pi pi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" @click="confirmDeleteMenuItem(category, item)">
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
    <div class="modal fade" :class="{ 'show d-block': showCategoryModal }" tabindex="-1" role="dialog">
      <div class="modal-dialog" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ isEditingCategory ? 'Edit Kategori Menu' : 'Tambah Kategori Menu' }}</h5>
            <button type="button" class="btn-close" @click="closeCategoryModal"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveCategory">
              <div class="mb-3">
                <label for="categoryName" class="form-label">Nama Kategori</label>
                <input type="text" class="form-control" id="categoryName" v-model="categoryForm.name" required>
              </div>
              <div class="mb-3">
                <label for="categoryOrder" class="form-label">Urutan</label>
                <input type="number" class="form-control" id="categoryOrder" v-model="categoryForm.order">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeCategoryModal">Batal</button>
            <button type="button" class="btn btn-primary" @click="saveCategory">Simpan</button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="showCategoryModal" class="modal-backdrop fade show"></div>

    <!-- Modal for adding/editing menu item -->
    <div class="modal fade" :class="{ 'show d-block': showMenuItemModal }" tabindex="-1" role="dialog">
      <div class="modal-dialog" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ isEditingMenuItem ? 'Edit Menu Item' : 'Tambah Menu Item' }}</h5>
            <button type="button" class="btn-close" @click="closeMenuItemModal"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveMenuItem">
              <div class="mb-3">
                <label for="menuCategory" class="form-label">Kategori</label>
                <select class="form-select" id="menuCategory" v-model="menuItemForm.categoryId" required>
                  <option v-for="category in menuStore.menuCategories" :key="category.id" :value="category.id">
                    {{ category.name }}
                  </option>
                </select>
              </div>
              <div class="mb-3">
                <label for="menuText" class="form-label">Nama Menu</label>
                <input type="text" class="form-control" id="menuText" v-model="menuItemForm.text" required>
              </div>
              <div class="mb-3">
                <label for="menuIcon" class="form-label">Icon (PrimeIcons)</label>
                <input type="text" class="form-control" id="menuIcon" v-model="menuItemForm.icon" placeholder="pi-home">
              </div>
              <div class="mb-3">
                <label for="menuPath" class="form-label">Path</label>
                <input type="text" class="form-control" id="menuPath" v-model="menuItemForm.path" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Peran yang Diizinkan</label>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="roleAdmin" value="admin" v-model="menuItemForm.roles">
                  <label class="form-check-label" for="roleAdmin">Admin</label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="roleManager" value="manager" v-model="menuItemForm.roles">
                  <label class="form-check-label" for="roleManager">Manager</label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="roleUser" value="user" v-model="menuItemForm.roles">
                  <label class="form-check-label" for="roleUser">User</label>
                </div>
              </div>
              <div class="mb-3">
                <label for="menuKeywords" class="form-label">Keywords (dipisahkan dengan koma)</label>
                <input type="text" class="form-control" id="menuKeywords" v-model="menuItemForm.keywordsInput" placeholder="dashboard, home, beranda">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeMenuItemModal">Batal</button>
            <button type="button" class="btn btn-primary" @click="saveMenuItem">Simpan</button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="showMenuItemModal" class="modal-backdrop fade show"></div>

    <!-- Confirmation Modal -->
    <div class="modal fade" :class="{ 'show d-block': showConfirmModal }" tabindex="-1" role="dialog">
      <div class="modal-dialog" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Konfirmasi</h5>
            <button type="button" class="btn-close" @click="closeConfirmModal"></button>
          </div>
          <div class="modal-body">
            <p>{{ confirmMessage }}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeConfirmModal">Batal</button>
            <button type="button" class="btn btn-danger" @click="confirmAction">Hapus</button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="showConfirmModal" class="modal-backdrop fade show"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
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

.card {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border-radius: 0.5rem;
  margin-bottom: 2rem;
}

.card-header {
  padding: 1rem;
  border-bottom: 1px solid #e9ecef;
}

.menu-category-header {
  padding: 0.75rem 0;
  border-bottom: 1px solid #e9ecef;
  margin-bottom: 0.5rem;
}

/* Modal styles */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1040;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1050;
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  outline: 0;
}

.modal-dialog {
  margin: 1.75rem auto;
  max-width: 500px;
}
</style>