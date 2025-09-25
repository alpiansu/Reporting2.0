# Web Reporting 2.0 - Backend API

This is the backend API for the Web Reporting 2.0 application, a comprehensive reporting and store screening tool.

## Features

- User authentication and authorization
- Store management
- Database screening and analysis
- Report generation
- Real-time screening progress tracking

## Tech Stack

- Node.js
- Express.js
- MySQL (via Sequelize ORM)
- JWT Authentication
- Winston Logger

## Project Structure

```
src/
├── config/         # Configuration files
├── controllers/    # Request controllers
├── middlewares/    # Express middlewares
├── models/         # Sequelize models
├── routes/         # API routes
├── services/       # Business logic
├── utils/          # Utility functions
├── database/       # Database migrations and seeders
├── app.js          # Express app setup
└── server.js       # Server entry point
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MySQL (v8 or higher)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```
   # Server
   PORT=3001
   NODE_ENV=development

   # JWT
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRATION=24h

   # Database
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=web_reporting

   # Logging
   LOG_LEVEL=info
   ```

4. Start the development server:
   ```
   npm run dev
   ```

## API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/refresh-token` - Refresh JWT token

### Stores

- `GET /api/stores` - Get all stores
- `GET /api/stores/:id` - Get store by ID
- `POST /api/stores` - Create a new store
- `PUT /api/stores/:id` - Update store
- `DELETE /api/stores/:id` - Delete store
- `POST /api/stores/test-connection` - Test store database connection

### Screenings

- `GET /api/screenings` - Get all screenings
- `GET /api/screenings/:id` - Get screening by ID
- `POST /api/screenings` - Start a new screening
- `GET /api/screenings/:id/progress` - Get screening progress
- `POST /api/screenings/:id/cancel` - Cancel a screening
- `GET /api/screenings/statistics` - Get screening statistics

## Progress Bar Implementation Template

Aplikasi ini menggunakan sistem progress bar real-time yang dapat digunakan sebagai template untuk module lain. Berikut adalah panduan lengkap implementasinya:

### 🚀 Quick Start untuk Module Baru

#### 1. Backend Implementation

**Import ProgressHelper di Service:**
```javascript
import ProgressHelper from '../services/progress/ProgressHelper.js';
```

**Implementasi di Service Method:**
```javascript
async processData(cab, period, data) {
  // 1. Start progress
  const progressId = ProgressHelper.start({
    cab: cab,
    period: period,
    message: 'Memulai proses...',
    details: {
      totalStores: data.length,
      processType: 'your_module_name'
    }
  });

  try {
    // 2. Process data dengan progress update
    for (let i = 0; i < data.length; i++) {
      await this.processItem(data[i]);
      
      // Update progress setiap item
      ProgressHelper.updateStep(progressId, {
        currentStep: i + 1,
        message: `Memproses item ${i + 1} dari ${data.length}`,
        details: {
          currentItem: data[i].name,
          percentage: Math.round(((i + 1) / data.length) * 100)
        }
      });
    }

    // 3. Complete progress
    ProgressHelper.complete(progressId, 'Proses berhasil diselesaikan', {
      totalProcessed: data.length,
      completedAt: new Date().toISOString()
    });

    return { success: true, progressId };

  } catch (error) {
    // 4. Handle error
    ProgressHelper.fail(progressId, error.message, {
      errorType: error.name,
      failedAt: new Date().toISOString()
    });
    throw error;
  }
}
```

**Implementasi di Controller:**
```javascript
export const startProcess = async (req, res, next) => {
  try {
    const { cab, period } = req.body;
    
    // Check for active process
    const activeProcess = ProgressHelper.getActiveProcess(cab, period);
    if (activeProcess) {
      return res.status(409).json({
        success: false,
        message: 'Proses sudah berjalan',
        progressId: activeProcess.id
      });
    }

    // Start process
    const result = await yourService.processData(cab, period, data);
    
    res.status(200).json({
      success: true,
      message: 'Proses berhasil dimulai',
      progressId: result.progressId
    });

  } catch (error) {
    next(error);
  }
};
```

#### 2. Frontend Implementation

**Service untuk SSE Connection:**
```javascript
// services/yourModule.service.js
import { EventSourcePolyfill } from 'event-source-polyfill';

class YourModuleService {
  connectToProgressStream(progressId, onMessage, onError, onOpen) {
    const apiUrl = import.meta.env.VITE_API_URL;
    const token = localStorage.getItem("token");
    
    const eventSource = new EventSourcePolyfill(`${apiUrl}/progress/sse/${progressId}`, {
      headers: { Authorization: `Bearer ${token}` },
      heartbeatTimeout: 60000
    });

    eventSource.onopen = onOpen;
    eventSource.onerror = onError;
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    return eventSource;
  }
}
```

**Vue Component Implementation:**
```vue
<template>
  <div>
    <!-- Progress Bar -->
    <div v-if="showProgressBar" class="progress-container">
      <div class="progress-header">
        <h4>{{ progressMessage }}</h4>
        <span>{{ processedItems }}/{{ totalItems }}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
      </div>
      <div class="progress-details">
        <span>{{ Math.round(progressPercentage) }}%</span>
        <span v-if="currentWave">Wave {{ currentWave }}/{{ maxWaves }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue';
import yourModuleService from '@/services/yourModule.service.js';

// Progress tracking
const showProgressBar = ref(false);
const progressId = ref('');
const progressStatus = ref('idle');
const progressMessage = ref('');
const processedItems = ref(0);
const totalItems = ref(0);
const currentWave = ref(0);
const maxWaves = ref(0);
const eventSource = ref(null);

// Computed
const progressPercentage = computed(() => {
  return totalItems.value > 0 ? (processedItems.value / totalItems.value) * 100 : 0;
});

// Start process
const startProcess = async () => {
  try {
    const response = await yourModuleService.startProcess(formData);
    progressId.value = response.data.progressId;
    showProgressBar.value = true;
    connectToSSE();
  } catch (error) {
    console.error('Error starting process:', error);
  }
};

// SSE Connection
const connectToSSE = () => {
  if (eventSource.value) eventSource.value.close();
  
  eventSource.value = yourModuleService.connectToProgressStream(
    progressId.value,
    handleSSEMessage,
    handleSSEError,
    handleSSEOpen
  );
};

const handleSSEMessage = (data) => {
  if (data.type === 'progress') {
    const progress = data.data;
    processedItems.value = progress.processed || 0;
    totalItems.value = progress.total || totalItems.value;
    progressMessage.value = progress.message || '';
    progressStatus.value = progress.status || 'running';
    
    if (progress.status === 'completed') {
      showProgressBar.value = false;
      eventSource.value?.close();
    }
  }
};

const handleSSEError = (error) => {
  console.error('SSE error:', error);
};

const handleSSEOpen = () => {
  console.log('SSE connection opened');
};

// Cleanup
onUnmounted(() => {
  if (eventSource.value) {
    eventSource.value.close();
  }
});
</script>
```

### 📋 Available Progress Methods

#### ProgressHelper Methods:
- `ProgressHelper.start(config)` - Memulai progress baru
- `ProgressHelper.updateStep(progressId, update)` - Update step saat ini
- `ProgressHelper.updatePercentage(progressId, percentage, message)` - Update berdasarkan persentase
- `ProgressHelper.complete(progressId, message, data)` - Menyelesaikan progress
- `ProgressHelper.fail(progressId, error, data)` - Menandai progress gagal
- `ProgressHelper.getProgress(progressId)` - Mendapatkan data progress
- `ProgressHelper.getActiveProcess(cab, period)` - Cek proses aktif

### 🔗 SSE Endpoints

#### Global Progress Routes:
- `GET /api/progress/sse/:progressId` - SSE stream untuk progress updates
- `GET /api/progress/:progressId` - Get progress data
- `GET /api/progress/latest/:processType/:identifier` - Get latest progress

### 🎯 Best Practices

#### 1. Error Handling:
```javascript
try {
  // Process logic
  ProgressHelper.complete(progressId, 'Success');
} catch (error) {
  ProgressHelper.fail(progressId, error.message, {
    errorType: error.name,
    stack: error.stack
  });
  throw error;
}
```

#### 2. Concurrent Process Prevention:
```javascript
const activeProcess = ProgressHelper.getActiveProcess(cab, period);
if (activeProcess) {
  return res.status(409).json({
    success: false,
    message: 'Proses sudah berjalan',
    progressId: activeProcess.id
  });
}
```

#### 3. Wave Processing untuk Data Besar:
```javascript
// Process dalam gelombang untuk performa optimal
const batchSize = 10;
const waves = Math.ceil(data.length / batchSize);

for (let wave = 0; wave < waves; wave++) {
  const start = wave * batchSize;
  const end = Math.min(start + batchSize, data.length);
  const batch = data.slice(start, end);
  
  ProgressHelper.updateStep(progressId, {
    currentStep: end,
    message: `Memproses wave ${wave + 1}/${waves}`,
    details: {
      currentWave: wave + 1,
      maxWaves: waves
    }
  });
  
  await processBatch(batch);
}
```

### 🔧 Troubleshooting

#### Common Issues:

1. **SSE Connection Lost:**
   - Implementasikan reconnection logic
   - Check network connectivity
   - Verify JWT token validity

2. **Progress Not Updating:**
   - Pastikan progressId valid
   - Check ProgressHelper.updateStep() calls
   - Verify SSE endpoint accessibility

3. **Multiple Process Conflict:**
   - Gunakan `getActiveProcess()` untuk check
   - Return 409 status untuk conflict
   - Provide option untuk view existing process

### 📁 File Structure untuk Module Baru:

```
src/modules/your_module/
├── your_module.service.js     # Business logic + ProgressHelper
├── your_module.controller.js  # API endpoints + progress handling
├── your_module.routes.js      # Route definitions
└── your_module.validation.js  # Input validation

frontend/src/
├── services/yourModule.service.js  # API calls + SSE connection
├── components/YourModule/
│   ├── YourModuleForm.vue         # Main component with progress bar
│   └── ProgressBar.vue            # Reusable progress component
└── views/YourModuleView.vue       # Page view
```

## 📁 Template Files untuk Module Baru

Untuk memudahkan development module baru dengan progress bar, gunakan template files berikut:

### Backend Templates
- `templates/module_template.service.js` - Service template dengan progress tracking
- `templates/module_template.controller.js` - Controller template dengan SSE support
- `templates/module_template.routes.js` - Routes template dengan progress endpoints
- `templates/module_template.validation.js` - Validation template untuk progress requests

### Frontend Templates
- `templates/frontend_template.service.js` - Frontend service untuk API calls dan SSE
- `templates/YourModuleForm.vue` - Vue component template dengan progress bar
- `templates/progress-bar.css` - CSS styles untuk progress bar

### Documentation & Guidelines
- `templates/PROGRESS_BAR_GUIDE.md` - Comprehensive guide untuk best practices, troubleshooting, dan optimization

### Cara Menggunakan Templates

1. **Copy template files** ke lokasi yang sesuai di project Anda
2. **Rename files** sesuai dengan nama module Anda
3. **Replace placeholder text**:
   - `YourModule` → nama module Anda
   - `your-module` → endpoint path module Anda
   - `processData` → nama method processing Anda
4. **Customize validation rules** sesuai kebutuhan module
5. **Update routes** di main router file
6. **Baca PROGRESS_BAR_GUIDE.md** untuk best practices dan troubleshooting
7. **Test implementation** menggunakan guidelines di bawah

### 🎨 CSS untuk Progress Bar:

```css
.progress-container {
  margin: 20px 0;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #f9f9f9;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background: #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #45a049);
  transition: width 0.3s ease;
}
```

Untuk implementasi lengkap, lihat contoh di module `rekon_wt_harian` dan `prep-closing`.

## License

ISC