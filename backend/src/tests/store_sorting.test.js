jest.mock('../config/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() },
}));

import StoreService from '../modules/store/store.service.js';

describe('Store Service - Dynamic Sorting & Pagination', () => {
  let storeService;

  beforeEach(() => {
    storeService = new StoreService();
    // Setup mock stores
    storeService.stores = [
      {
        id: 1,
        storeCode: 'TW06',
        station: '02',
        storeName: 'Toko Alfa Cempaka',
        branch: 'G001',
        dbHost: '192.168.1.10',
        notes: 'INDUK',
        updatedAt: '2026-02-01T10:00:00.000Z',
      },
      {
        id: 2,
        storeCode: 'A001',
        station: '01',
        storeName: 'Toko Beta Anggrek',
        branch: 'G002',
        dbHost: '192.168.1.11',
        notes: 'INDUK',
        updatedAt: '2026-02-03T10:00:00.000Z',
      },
      {
        id: 3,
        storeCode: 'TW10',
        station: '05',
        storeName: 'Toko Zebra Dahlia',
        branch: 'G001',
        dbHost: '192.168.1.12',
        notes: 'INDUK',
        updatedAt: '2026-02-02T10:00:00.000Z',
      },
    ];
    storeService.initialized = true;
  });

  test('should sort stores by storeCode ASC', async () => {
    const result = await storeService.getAllStores({
      sortBy: 'storeCode',
      sortOrder: 'asc',
      limit: 10,
    });

    const codes = result.stores.map(s => s.storeCode);
    expect(codes).toEqual(['A001', 'TW06', 'TW10']);
  });

  test('should sort stores by storeCode DESC', async () => {
    const result = await storeService.getAllStores({
      sortBy: 'storeCode',
      sortOrder: 'desc',
      limit: 10,
    });

    const codes = result.stores.map(s => s.storeCode);
    expect(codes).toEqual(['TW10', 'TW06', 'A001']);
  });

  test('should sort stores by station ASC', async () => {
    const result = await storeService.getAllStores({
      sortBy: 'station',
      sortOrder: 'asc',
      limit: 10,
    });

    const stations = result.stores.map(s => s.station);
    expect(stations).toEqual(['01', '02', '05']);
  });

  test('should sort stores by storeName ASC', async () => {
    const result = await storeService.getAllStores({
      sortBy: 'storeName',
      sortOrder: 'asc',
      limit: 10,
    });

    const names = result.stores.map(s => s.storeName);
    expect(names).toEqual(['Toko Alfa Cempaka', 'Toko Beta Anggrek', 'Toko Zebra Dahlia']);
  });

  test('should sort stores by updatedAt DESC by default or fallback', async () => {
    const result = await storeService.getAllStores({
      sortBy: 'invalid_column',
      sortOrder: 'desc',
      limit: 10,
    });

    const codes = result.stores.map(s => s.storeCode);
    // 2026-02-03 (A001) -> 2026-02-02 (TW10) -> 2026-02-01 (TW06)
    expect(codes).toEqual(['A001', 'TW10', 'TW06']);
  });

  test('should support pagination offset and limit correctly', async () => {
    const result = await storeService.getAllStores({
      sortBy: 'storeCode',
      sortOrder: 'asc',
      page: 2,
      limit: 2,
    });

    expect(result.currentPage).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.totalItems).toBe(3);
    expect(result.stores.length).toBe(1);
    expect(result.stores[0].storeCode).toBe('TW10');
  });
});
