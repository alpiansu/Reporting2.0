# Prep Closing Configuration Changes

## Overview
Pemisahan konfigurasi prep-closing dari `rekon_wt_harian` untuk meningkatkan maintainability dan separation of concerns. Konfigurasi baru ini khusus untuk modul prep-closing dengan queries dan parameter yang spesifik, termasuk dukungan untuk real-time progress tracking dan SSE implementation.

## Changes Made

### 1. Created New Config File
**File**: `src/config/prep_closing.config.js`
- ✅ Separated from `rekon_wt_harian.config.js`
- ✅ Contains specific queries for prep-closing operations
- ✅ Includes screening thresholds and parameters
- ✅ **NEW**: Added UNION ALL queries for comprehensive data retrieval
- ✅ **NEW**: Added store readiness queries
- ✅ **NEW**: Added progress tracking configuration

### 2. Updated Imports
**File**: `src/modules/prep-closing/prep_closing.service.js`
- ✅ Changed import from `rekon_wt_harian.config.js` to `prep_closing.config.js`
- ✅ Updated query usage to use new config structure
- ✅ **NEW**: Added support for multiple WRC data sources via UNION ALL

### 3. Enhanced Query Usage
- ✅ Uses `prepClosingConfig.queries.wrcData` with UNION ALL for comprehensive data
- ✅ Uses `prepClosingConfig.queries.storeReadiness` for store status checking
- ✅ **NEW**: Added wave processing configuration for large datasets
- ✅ **NEW**: Added progress tracking parameters

## Config Structure

### Enhanced Queries with UNION ALL
```javascript
const prepClosingConfig = {
  queries: {
    // Main WRC data query with comprehensive data sources
    wrcData: `
      SELECT KODE_TOKO, SALDO_AKH_BLN, RP_SLD_AKH_BLN, 
             MAX(CASE WHEN jenis = 'BLN_SLS' THEN nilai END) as bln_sls,
             MAX(CASE WHEN jenis = 'MAX_BLN_AKT' THEN nilai END) as terakhir_bln_akt
      FROM wrc_saldo_bulanan 
      WHERE PERIOD = ? AND CAB = ?
      GROUP BY KODE_TOKO
      
      UNION ALL
      
      SELECT KODE_TOKO, SALDO_AKH_BLN, RP_SLD_AKH_BLN, 
             bln_sls, terakhir_bln_akt
      FROM wrc_saldo_backup 
      WHERE PERIOD = ? AND CAB = ?
      
      UNION ALL
      
      SELECT KODE_TOKO, SALDO_AKH_BLN, RP_SLD_AKH_BLN, 
             bln_sls, terakhir_bln_akt
      FROM wrc_saldo_archive 
      WHERE PERIOD = ? AND CAB = ?
    `,
    
    // Store readiness checking
    storeReadiness: `
      SELECT kdtk, nama_toko, status_closing, last_update,
             CASE 
               WHEN status_closing = 'READY' THEN 'ready'
               WHEN status_closing = 'PENDING' THEN 'pending'
               ELSE 'not_ready'
             END as readiness_status
      FROM store_status 
      WHERE cab = ? AND periode = ?
    `,
    
    // Store details for comprehensive analysis
    storeDetails: `
      SELECT kdtk, nama_toko, alamat, status_operasional,
             last_transaction_date, closing_time
      FROM master_toko 
      WHERE cab = ? AND status_aktif = 'Y'
    `
  }
};
```

### Enhanced Screening Thresholds
```javascript
screeningThresholds: {
  minSaldo: 0,
  maxDaysOld: 30,
  requiredFields: ['KODE_TOKO', 'SALDO_AKH_BLN'],
  storeReadiness: {
    readyStatus: ['READY', 'COMPLETED'],
    warningStatus: ['PENDING', 'PROCESSING'],
    errorStatus: ['ERROR', 'FAILED', 'NOT_READY']
  },
  dataQuality: {
    minRecordsPerStore: 1,
    maxMissingDataPercentage: 5
  }
}
```

### Wave Processing Configuration
```javascript
waveProcessing: {
  maxWaves: 5,
  delayBetweenWaves: 1000,
  recordsPerWave: 1000,
  maxConcurrentWaves: 3
}
```

### Progress Tracking Configuration
```javascript
progressTracking: {
  updateInterval: 1000, // 1 second for SSE updates
  maxProgressAge: 3600000, // 1 hour
  cleanupInterval: 300000, // 5 minutes
  steps: {
    initialization: { weight: 10, message: 'Initializing screening process...' },
    dataRetrieval: { weight: 30, message: 'Retrieving WRC data...' },
    storeAnalysis: { weight: 40, message: 'Analyzing store readiness...' },
    resultCompilation: { weight: 15, message: 'Compiling results...' },
    completion: { weight: 5, message: 'Screening completed' }
  }
}
```

## Benefits

### Separation of Concerns
- ✅ Prep-closing memiliki konfigurasi sendiri yang tidak tergantung pada rekon_wt_harian
- ✅ Memudahkan maintenance dan update konfigurasi
- ✅ **NEW**: Dedicated progress tracking configuration

### Specific Queries
- ✅ Query yang dioptimalkan khusus untuk kebutuhan screening pra closing
- ✅ Tidak ada dependency pada query rekon_wt_harian yang mungkin berubah
- ✅ **NEW**: UNION ALL queries for comprehensive data coverage
- ✅ **NEW**: Enhanced store readiness queries

### Maintainability
- ✅ Perubahan pada rekon_wt_harian tidak mempengaruhi prep-closing
- ✅ Konfigurasi lebih mudah dipahami dan dimodifikasi
- ✅ **NEW**: Centralized progress tracking configuration
- ✅ **NEW**: Better error handling configuration

### Flexibility
- ✅ Dapat menambahkan parameter khusus prep-closing tanpa mempengaruhi modul lain
- ✅ Memungkinkan optimasi query yang spesifik
- ✅ **NEW**: Real-time progress tracking capabilities
- ✅ **NEW**: Configurable wave processing for large datasets

### Performance Improvements
- ✅ **NEW**: UNION ALL queries reduce database round trips
- ✅ **NEW**: Wave processing for handling large datasets efficiently
- ✅ **NEW**: Optimized progress tracking with minimal overhead

## Migration Notes

- ✅ **No Breaking Changes**: Existing functionality tetap berjalan
- ✅ **Backward Compatibility**: Tidak ada perubahan pada API endpoints
- ✅ **Configuration Only**: Hanya perubahan pada level konfigurasi internal
- ✅ **Enhanced Features**: Added SSE and progress tracking without breaking existing code
- ✅ **Database Optimization**: UNION ALL queries improve data coverage

## Implementation Status

### Core Configuration
- ✅ **Config File**: `src/config/prep_closing.config.js` created and implemented
- ✅ **Service Integration**: Updated imports and query usage
- ✅ **Controller Integration**: Using new config structure
- ✅ **Route Integration**: All endpoints using new configuration

### Enhanced Features (January 2025)
- ✅ **UNION ALL Queries**: Comprehensive data retrieval from multiple sources
- ✅ **Progress Tracking**: Real-time progress configuration
- ✅ **SSE Support**: Server-Sent Events configuration
- ✅ **Wave Processing**: Large dataset handling configuration
- ✅ **Error Handling**: Enhanced error management configuration

### Testing
- ✅ **Unit Tests**: Configuration validation tests
- ✅ **Integration Tests**: End-to-end testing with new config
- ✅ **Performance Tests**: Wave processing and UNION ALL query optimization
- ✅ **SSE Tests**: Real-time progress tracking validation

## Configuration Files

### Main Config
```
src/config/prep_closing.config.js
├── queries (UNION ALL WRC data, store readiness, store details)
├── screeningThresholds (enhanced validation rules)
├── waveProcessing (large dataset handling)
└── progressTracking (SSE and real-time updates)
```

### Dependencies
- No external dependencies added
- Uses existing database connection patterns
- Compatible with current authentication system
- Integrates with existing logging framework

---

**Configuration Created**: January 17, 2024  
**Last Updated**: January 17, 2025  
**Status**: ✅ Complete with Enhanced Features  
**Version**: 2.0 (with SSE and Progress Tracking)