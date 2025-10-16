# 🚀 Cara Menambah Menu Baru (Super Simple!)

## Langkah-langkah

### 1️⃣ Tambah Menu di Backend

Edit menu lewat Menu Manager atau langsung di backend `menus.json`:

```json
{
  "categoryId": "reports",
  "text": "Nama Menu Baru",
  "icon": "pi-icon-name",
  "path": "/nama-menu-baru",
  "roles": ["admin", "user"],
  "keywords": ["keyword1", "keyword2"],
  "id": "unique-id-generated"
}
```

### 2️⃣ Buat Folder dan File di Frontend

```bash
frontend/src/views/namaMenuBaru/index.vue
```

**Penting:**

- Path di backend pakai **kebab-case**: `/nama-menu-baru`
- Folder di frontend pakai **camelCase**: `namaMenuBaru`

### 3️⃣ Done! ✅

Tidak perlu edit router lagi! 🎉

---

## 📋 Konversi Path ke Folder

| Path Backend          | Folder Frontend            | File        |
| --------------------- | -------------------------- | ----------- |
| `/menu-baru`          | `views/menuBaru/`          | `index.vue` |
| `/laporan-penjualan`  | `views/laporanPenjualan/`  | `index.vue` |
| `/admin/user-manager` | `views/admin/userManager/` | `index.vue` |
| `/data-toko`          | `views/dataToko/`          | `index.vue` |

---

## 📁 Template File `index.vue`

```vue
<script setup>
import { ref } from "vue";

// State & logic komponen Anda
const data = ref([]);

const fetchData = async () => {
  // Fetch data logic
};
</script>

<template>
  <div class="container">
    <h1>Judul Halaman</h1>
    <!-- Konten Anda -->
  </div>
</template>

<style scoped>
/* Styles Anda */
</style>
```

---

## 🔄 Migrasi File Existing

Jika Anda punya file existing, tinggal buat `index.vue` yang re-export:

```vue
<!-- views/adjust/index.vue -->
<script setup>
import AdjustView from "./AdjustView.vue";
</script>

<template>
  <AdjustView />
</template>
```

**Atau jalankan script otomatis:**

```powershell
cd frontend
.\create-index-files.ps1
```

---

## 🎯 Contoh Lengkap

### Backend (menus.json):

```json
{
  "text": "Data Karyawan",
  "icon": "pi-users",
  "path": "/data-karyawan",
  "roles": ["admin"]
}
```

### Frontend:

```
views/
└── dataKaryawan/
    └── index.vue
```

### File `index.vue`:

```vue
<script setup>
import { ref, onMounted } from "vue";
import { karyawanService } from "@/services";

const karyawan = ref([]);

onMounted(async () => {
  const response = await karyawanService.getAll();
  karyawan.value = response.data;
});
</script>

<template>
  <div class="data-karyawan-page">
    <h1>Data Karyawan</h1>
    <!-- Your content here -->
  </div>
</template>
```

---

## ⚡ Tips

- ✅ **Gunakan kebab-case** untuk path di backend (`/menu-baru`)
- ✅ **Gunakan camelCase** untuk nama folder di frontend (`menuBaru`)
- ✅ **File harus bernama** `index.vue`
- ✅ **Test di browser console** untuk melihat error jika ada
- ✅ **Ikuti struktur folder existing** untuk konsistensi

---

## 🐛 Troubleshooting

### Component tidak muncul?

1. Cek console browser untuk error
2. Pastikan path di backend match dengan folder frontend
3. Pastikan file `index.vue` ada di folder yang benar

### Error "Component not found"?

Router akan mencoba:

1. `views/{folderName}/index.vue`
2. `views/{folderName}/{Name}View.vue`

Jika keduanya tidak ada, akan tampil error di console dengan path yang dicoba.

---

## 📚 Dokumentasi Lengkap

Lihat: `DYNAMIC_ROUTING_GUIDE.md` untuk penjelasan detail.

---

**Selamat! Sekarang tambah menu jadi super mudah! 🎊**
