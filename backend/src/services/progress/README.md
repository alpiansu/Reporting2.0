# Global Progress Module

Modul progress global yang dapat digunakan oleh semua module untuk menampilkan progress bar real-time di frontend melalui Server-Sent Events (SSE).

## Fitur Utama

- ✅ **Real-time Updates**: Progress dikirim ke frontend secara real-time melalui SSE
- ✅ **Multi-Module Support**: Dapat digunakan oleh berbagai module secara bersamaan
- ✅ **Type Safety**: Mendukung berbagai tipe proses dengan identifier unik
- ✅ **Auto Cleanup**: Otomatis membersihkan progress lama
- ✅ **Error Handling**: Penanganan error yang komprehensif
- ✅ **Concurrent Process Detection**: Mencegah proses duplikat
- ✅ **Flexible Metadata**: Mendukung metadata custom untuk setiap proses

## Struktur File

```
src/services/progress/
├── GlobalProgressService.js    # Core service untuk manajemen progress
├── ProgressHelper.js           # Helper class untuk kemudahan penggunaan
├── index.js                   # Export module
└── README.md                  # Dokumentasi ini
```

## Quick Start

### 1. Import Module

```javascript
import { ProgressHelper } from '../services/progress/index.js';
// atau
import ProgressHelper from '../services/progress/index.js';
```

### 2. Basic Usage

```javascript
// Start progress
const progressId = ProgressHelper.start({
  processType: 'rekon_wt_harian',
  identifier: 'A001_2024-01',
  totalSteps: 100,
  title: 'Rekon WT Harian Process',
  description: 'Processing rekon for branch A001'
});

// Update progress
ProgressHelper.updateStep(progressId, {
  currentStep: 50,
  message: 'Processing data...'
});

// Complete progress
ProgressHelper.complete(progressId, {
  message: 'Process completed successfully'
});
```

## API Reference

### ProgressHelper Methods

#### `start(options)`
Memulai progress baru.

**Parameters:**
- `processType` (string): Tipe proses (e.g., 'rekon_wt_harian', 'sync_data')
- `identifier` (string): Identifier unik untuk proses ini
- `totalSteps` (number): Total langkah/item yang akan diproses
- `title` (string): Judul proses
- `description` (string, optional): Deskripsi proses
- `metadata` (object, optional): Data tambahan

**Returns:** `string` - Progress ID

#### `updateStep(progressId, options)`
Update progress step.

**Parameters:**
- `progressId` (string): ID progress
- `currentStep` (number): Step saat ini
- `message` (string, optional): Pesan status
- `details` (object, optional): Detail tambahan

#### `updatePercentage(progressId, percentage, message, details)`
Update progress berdasarkan persentase.

**Parameters:**
- `progressId` (string): ID progress
- `percentage` (number): Persentase (0-100)
- `message` (string, optional): Pesan status
- `details` (object, optional): Detail tambahan

#### `complete(progressId, options)`
Menyelesaikan progress.

**Parameters:**
- `progressId` (string): ID progress
- `message` (string, optional): Pesan completion
- `summary` (object, optional): Ringkasan hasil

#### `fail(progressId, errorMessage, errorDetails)`
Menandai progress sebagai gagal.

**Parameters:**
- `progressId` (string): ID progress
- `errorMessage` (string): Pesan error
- `errorDetails` (object, optional): Detail error

#### `getProgress(progressId)`
Mendapatkan data progress berdasarkan ID.

**Returns:** `object|null` - Data progress atau null jika tidak ditemukan

#### `getLatestProgress(processType, identifier)`
Mendapatkan progress terbaru untuk tipe dan identifier tertentu.

**Returns:** `object|null` - Data progress terbaru atau null

#### `getActiveProcess(processType, identifier)`
Mendapatkan proses aktif untuk tipe dan identifier tertentu.

**Returns:** `object|null` - Data progress aktif atau null

#### `getAllActiveProcesses()`
Mendapatkan semua proses aktif di seluruh sistem tanpa memandang processType.

**Returns:** `array` - Array berisi semua progress yang sedang berjalan

#### `hasAnyActiveProcess()`
Memeriksa apakah ada proses aktif di seluruh sistem.

**Returns:** `object|null` - Progress aktif pertama yang ditemukan atau null jika tidak ada

## Frontend Integration

### SSE Endpoint

```
GET /api/progress/sse/:progressId
```

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `Accept: text/event-stream`

### Frontend JavaScript Example

```javascript
// Connect to SSE
const eventSource = new EventSource(
  `/api/progress/sse/${progressId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

// Listen for progress updates
eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  
  if (data.type === 'progress') {
    const progress = data.data;
    
    // Update progress bar
    updateProgressBar(progress.percentage);
    
    // Update status message
    updateStatusMessage(progress.message);
    
    // Handle completion
    if (progress.status === 'completed') {
      eventSource.close();
      showSuccessMessage('Process completed!');
    }
    
    // Handle error
    if (progress.status === 'failed') {
      eventSource.close();
      showErrorMessage(progress.message);
    }
  }
};

// Handle connection errors
eventSource.onerror = function(event) {
  console.error('SSE connection error:', event);
  eventSource.close();
};
```

## Data Structure

### Progress Object

```javascript
{
  progressId: "uuid-string",
  processType: "rekon_wt_harian",
  identifier: "A001_2024-01",
  status: "running", // 'pending', 'running', 'completed', 'failed'
  totalItems: 100,
  processedItems: 50,
  percentage: 50,
  message: "Processing data...",
  title: "Rekon WT Harian Process",
  description: "Processing rekon for branch A001",
  startTime: 1640995200000,
  createdAt: "2024-01-01T10:00:00.000Z",
  updatedAt: "2024-01-01T10:05:00.000Z",
  details: {
    cab: "A001",
    periode: "2024-01",
    currentStep: "validation"
  },
  metadata: {
    startedBy: "user123",
    priority: "high"
  }
}
```

## Migration Guide

### From Old Progress Service

#### Before (Old Way)

```javascript
// Old progress service
const progressId = progressService.initProgress({
  totalItems: 100,
  processedItems: 0,
  status: 'running',
  message: 'Starting process...',
  details: { cab: 'A001' }
});

progressService.updateProgress(progressId, {
  processedItems: 50,
  message: 'Processing...',
  details: { currentItem: 'item50' }
});

progressService.completeProgress(progressId, {
  message: 'Completed'
});
```

#### After (New Way)

```javascript
// New global progress
const progressId = ProgressHelper.start({
  processType: 'rekon_wt_harian',
  identifier: 'A001_2024-01',
  totalSteps: 100,
  title: 'Rekon Process',
  metadata: { cab: 'A001' }
});

ProgressHelper.updateStep(progressId, {
  currentStep: 50,
  message: 'Processing...',
  details: { currentItem: 'item50' }
});

ProgressHelper.complete(progressId, {
  message: 'Completed'
});
```

## Best Practices

### 1. Process Type Naming

```javascript
// Good: Descriptive and consistent
processType: 'rekon_wt_harian'
processType: 'sync_master_data'
processType: 'generate_report'

// Bad: Too generic or inconsistent
processType: 'process'
processType: 'RekonWTHarian'
processType: 'sync-data'
```

### 2. Identifier Format

```javascript
// Good: Unique and meaningful
identifier: 'A001_2024-01'        // cab_periode
identifier: 'user123_daily_sync'  // user_type
identifier: 'report_2024_Q1'      // report_period

// Bad: Not unique or meaningful
identifier: 'process1'
identifier: 'data'
```

### 3. Error Handling

```javascript
try {
  const progressId = ProgressHelper.start({...});
  
  // Process logic here
  await processData();
  
  ProgressHelper.complete(progressId, {
    message: 'Process completed successfully'
  });
} catch (error) {
  ProgressHelper.fail(progressId, error.message, {
    errorType: error.name,
    stack: error.stack
  });
  throw error; // Re-throw if needed
}
```

### 4. Concurrent Process Prevention

```javascript
// Check for specific process type and identifier
const activeProcess = ProgressHelper.getActiveProcess('rekon_wt_harian', 'A001_2024-01');
if (activeProcess) {
  throw new Error('Process already running for this branch and period');
}

// Check for any active process in the entire system
const anyActiveProcess = ProgressHelper.hasAnyActiveProcess();
if (anyActiveProcess) {
  throw new Error(`Another process is already running: ${anyActiveProcess.metadata.cab || 'Unknown'} - ${anyActiveProcess.metadata.period || 'Unknown'}`);
}

// Get all active processes for monitoring
const allActiveProcesses = ProgressHelper.getAllActiveProcesses();
console.log(`Currently running ${allActiveProcesses.length} processes`);

// Start new process
const progressId = ProgressHelper.start({...});
```

## Troubleshooting

### Common Issues

1. **SSE Connection Failed**
   - Check JWT token validity
   - Verify progress ID exists
   - Check network connectivity

2. **Progress Not Updating**
   - Ensure `updateStep()` is called with correct progress ID
   - Check if progress status is still 'running'
   - Verify SSE connection is active

3. **Memory Leaks**
   - Progress entries are auto-cleaned after 1 hour
   - Always close SSE connections on frontend
   - Use `complete()` or `fail()` to finish progress

### Debug Mode

```javascript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Check active progresses
console.log('Active progresses:', GlobalProgressService.getAllProgress());

// Check SSE clients
console.log('SSE clients:', GlobalProgressService.getClientCount());
```

## Examples

Lihat file `examples/progress-implementation.js` untuk contoh implementasi lengkap dalam module rekon_wt_harian.