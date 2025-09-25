/**
 * Contoh penggunaan endpoint getDailyShopSummary
 * Endpoint: GET /api/rekon-wt-harian/:periode/:cab/daily-summary
 */

// Example 1: Basic usage - mendapatkan rekap semua toko untuk periode dan cabang tertentu
const example1 = async () => {
  const response = await fetch('/api/rekon-wt-harian/2412/01/daily-summary', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + localStorage.getItem('token'),
      'Content-Type': 'application/json'
    }
  });
  
  const result = await response.json();
  console.log('Basic Summary:', result);
};

// Example 2: Dengan pagination dan sorting
const example2 = async () => {
  const params = new URLSearchParams({
    page: '1',
    limit: '20',
    sortColumn: 'sum_sel_gross',
    sortOrder: 'desc'
  });
  
  const response = await fetch(`/api/rekon-wt-harian/2412/01/daily-summary?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + localStorage.getItem('token'),
      'Content-Type': 'application/json'
    }
  });
  
  const result = await response.json();
  console.log('Sorted by highest selisih gross:', result);
};

// Example 3: Filter berdasarkan toko tertentu
const example3 = async () => {
  const params = new URLSearchParams({
    toko: 'S001',
    sortColumn: 'tanggal',
    sortOrder: 'asc'
  });
  
  const response = await fetch(`/api/rekon-wt-harian/2412/01/daily-summary?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + localStorage.getItem('token'),
      'Content-Type': 'application/json'
    }
  });
  
  const result = await response.json();
  console.log('Summary for specific shop:', result);
};

// Example 4: Filter berdasarkan tanggal tertentu
const example4 = async () => {
  const params = new URLSearchParams({
    tgl1: '2024-12-15',
    sortColumn: 'shop',
    sortOrder: 'asc'
  });
  
  const response = await fetch(`/api/rekon-wt-harian/2412/01/daily-summary?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + localStorage.getItem('token'),
      'Content-Type': 'application/json'
    }
  });
  
  const result = await response.json();
  console.log('Summary for specific date:', result);
};

// Example 5: Pencarian global
const example5 = async () => {
  const params = new URLSearchParams({
    searchQuery: 'S001',
    page: '1',
    limit: '10'
  });
  
  const response = await fetch(`/api/rekon-wt-harian/2412/SEMUA CABANG/daily-summary?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + localStorage.getItem('token'),
      'Content-Type': 'application/json'
    }
  });
  
  const result = await response.json();
  console.log('Search results:', result);
};

// Example 6: Untuk semua cabang dengan filter kompleks
const example6 = async () => {
  const params = new URLSearchParams({
    page: '1',
    limit: '50',
    tgl1: '2024-12-15',
    sortColumn: 'sum_sel_gross',
    sortOrder: 'desc'
  });
  
  const response = await fetch(`/api/rekon-wt-harian/2412/SEMUA CABANG/daily-summary?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + localStorage.getItem('token'),
      'Content-Type': 'application/json'
    }
  });
  
  const result = await response.json();
  console.log('All branches summary for specific date:', result);
};

// Example 7: Menggunakan axios (jika tersedia)
const example7 = async () => {
  try {
    const response = await axios.get('/api/rekon-wt-harian/2412/01/daily-summary', {
      params: {
        page: 1,
        limit: 25,
        sortColumn: 'tanggal',
        sortOrder: 'desc'
      },
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      }
    });
    
    console.log('Axios response:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
};

// Example 8: Menampilkan data dalam tabel HTML
const displayInTable = async () => {
  try {
    const response = await fetch('/api/rekon-wt-harian/2412/01/daily-summary?limit=100', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token'),
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      const tableBody = document.getElementById('summaryTableBody');
      tableBody.innerHTML = '';
      
      result.data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${item.cab}</td>
          <td>${item.tanggal}</td>
          <td>${item.shop}</td>
          <td class="text-right">${item.sum_sel_gross.toLocaleString()}</td>
          <td class="text-right">${item.sum_sel_ppn.toLocaleString()}</td>
          <td class="text-right">${item.sum_sel_gross_idm.toLocaleString()}</td>
          <td class="text-right">${item.sum_sel_ppn_idm.toLocaleString()}</td>
          <td class="text-center">${item.record_count}</td>
          <td>${item.updtime}</td>
        `;
        tableBody.appendChild(row);
      });
      
      // Update pagination info
      const paginationInfo = document.getElementById('paginationInfo');
      paginationInfo.textContent = `Page ${result.pagination.currentPage} of ${result.pagination.totalPages} (${result.pagination.totalRecords} total records)`;
    }
  } catch (error) {
    console.error('Error displaying data:', error);
  }
};

// Example 9: Export ke CSV
const exportToCSV = async () => {
  try {
    const response = await fetch('/api/rekon-wt-harian/2412/01/daily-summary?limit=10000', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token'),
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      const headers = ['Cab', 'Tanggal', 'Shop', 'Sum Sel Gross', 'Sum Sel PPN', 'Sum Sel Gross IDM', 'Sum Sel PPN IDM', 'Record Count', 'Update Time'];
      const csvContent = [
        headers.join(','),
        ...result.data.map(item => [
          item.cab,
          item.tanggal,
          item.shop,
          item.sum_sel_gross,
          item.sum_sel_ppn,
          item.sum_sel_gross_idm,
          item.sum_sel_ppn_idm,
          item.record_count,
          item.updtime
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily_shop_summary_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error exporting CSV:', error);
  }
};

// Example 10: Real-time update dengan polling
const startRealTimeUpdate = () => {
  const updateInterval = setInterval(async () => {
    try {
      const response = await fetch('/api/rekon-wt-harian/2412/01/daily-summary?page=1&limit=10', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('token'),
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('Updated data:', result.data);
        // Update UI dengan data terbaru
        updateDashboard(result);
      }
    } catch (error) {
      console.error('Error in real-time update:', error);
    }
  }, 30000); // Update setiap 30 detik
  
  // Stop polling setelah 5 menit
  setTimeout(() => {
    clearInterval(updateInterval);
    console.log('Real-time update stopped');
  }, 300000);
};

const updateDashboard = (result) => {
  // Update summary cards
  document.getElementById('totalGross').textContent = result.summary.total_sum_sel_gross.toLocaleString();
  document.getElementById('totalPPN').textContent = result.summary.total_sum_sel_ppn.toLocaleString();
  document.getElementById('totalRecords').textContent = result.summary.total_summary_records.toLocaleString();
};

// Export functions untuk digunakan di file lain
export {
  example1,
  example2,
  example3,
  example4,
  example5,
  example6,
  example7,
  displayInTable,
  exportToCSV,
  startRealTimeUpdate
};