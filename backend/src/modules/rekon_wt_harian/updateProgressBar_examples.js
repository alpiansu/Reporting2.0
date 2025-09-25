/**
 * Contoh penggunaan function updateProgressBar()
 * File ini hanya untuk dokumentasi dan contoh penggunaan
 */

// Import service (contoh)
// import RekonWtHarianService from './rekon_wt_harian.service.js';

class ExampleUsage {
  constructor() {
    // this.service = new RekonWtHarianService();
  }

  async exampleUsage() {
    const progressId = 'example-progress-id';
    const totalStores = 100;

    // 1. Inisialisasi progress (0%)
    this.service.updateProgressBar(progressId, {
      processedStores: 0,
      totalStores: totalStores,
      cab: 'CAB001',
      period: '2024-01',
      customMessage: 'Memulai proses rekonsiliasi...'
    });

    // 2. Update progress saat memproses toko (contoh: 25%)
    this.service.updateProgressBar(progressId, {
      processedStores: 25,
      totalStores: totalStores,
      currentStore: 'STORE025',
      storesWithDifferences: 3,
      totalDifferences: 15,
      cab: 'CAB001',
      period: '2024-01'
    });

    // 3. Update progress dengan pesan custom (contoh: 50%)
    this.service.updateProgressBar(progressId, {
      processedStores: 50,
      totalStores: totalStores,
      currentStore: 'STORE050',
      storesWithDifferences: 8,
      totalDifferences: 42,
      cab: 'CAB001',
      period: '2024-01',
      customMessage: 'Sedang memproses batch kedua...'
    });

    // 4. Update progress hampir selesai (contoh: 90%)
    this.service.updateProgressBar(progressId, {
      processedStores: 90,
      totalStores: totalStores,
      currentStore: 'STORE090',
      storesWithDifferences: 15,
      totalDifferences: 78,
      cab: 'CAB001',
      period: '2024-01'
    });

    // 5. Progress selesai (100%)
    this.service.updateProgressBar(progressId, {
      processedStores: totalStores,
      totalStores: totalStores,
      storesWithDifferences: 18,
      totalDifferences: 95,
      cab: 'CAB001',
      period: '2024-01',
      customMessage: 'Proses rekonsiliasi selesai!'
    });
  }

  // Contoh penggunaan minimal (hanya parameter wajib)
  async minimalUsage() {
    const progressId = 'minimal-progress-id';
    
    // Hanya dengan parameter wajib
    this.service.updateProgressBar(progressId, {
      processedStores: 10,
      totalStores: 50
    });
  }

  // Contoh penggunaan dalam loop
  async loopUsage() {
    const progressId = 'loop-progress-id';
    const stores = ['STORE001', 'STORE002', 'STORE003', 'STORE004', 'STORE005'];
    const totalStores = stores.length;
    let processedStores = 0;
    let storesWithDifferences = 0;
    let totalDifferences = 0;

    // Inisialisasi
    this.service.updateProgressBar(progressId, {
      processedStores: 0,
      totalStores: totalStores,
      customMessage: 'Memulai proses...'
    });

    // Loop memproses setiap toko
    for (const store of stores) {
      // Simulasi proses toko
      const result = await this.processStore(store);
      
      processedStores++;
      
      // Update jika ada perbedaan
      if (result.differences && result.differences.length > 0) {
        storesWithDifferences++;
        totalDifferences += result.differences.length;
      }

      // Update progress setiap toko
      this.service.updateProgressBar(progressId, {
        processedStores: processedStores,
        totalStores: totalStores,
        currentStore: store,
        storesWithDifferences: storesWithDifferences,
        totalDifferences: totalDifferences,
        cab: 'CAB001',
        period: '2024-01'
      });
    }
  }

  // Simulasi proses toko
  async processStore(storeCode) {
    // Simulasi hasil
    return {
      differences: Math.random() > 0.7 ? [{ type: 'difference', value: 100 }] : []
    };
  }
}

/**
 * Parameter yang tersedia untuk updateProgressBar():
 * 
 * WAJIB:
 * - progressId: string - ID progress yang sedang berjalan
 * - totalStores: number - Total toko yang akan diproses
 * 
 * OPSIONAL:
 * - processedStores: number (default: 0) - Jumlah toko yang sudah diproses
 * - currentStore: string (default: '') - Kode toko yang sedang diproses
 * - storesWithDifferences: number (default: 0) - Jumlah toko dengan perbedaan
 * - totalDifferences: number (default: 0) - Total perbedaan yang ditemukan
 * - cab: string (default: '') - Kode cabang
 * - period: string (default: '') - Periode
 * - customMessage: string (default: '') - Pesan custom, jika tidak ada akan generate otomatis
 * 
 * KEUNTUNGAN:
 * 1. Kode lebih clean dan reusable
 * 2. Konsisten dalam format pesan dan data
 * 3. Mudah di-maintain
 * 4. Validasi parameter otomatis
 * 5. Perhitungan persentase otomatis
 * 6. Logging otomatis
 */

export default ExampleUsage;