import * as XLSX from "xlsx";

/**
 * Export data to Excel file
 * @param {Array} data - Array of objects to export
 * @param {Array} columns - Array of column definitions [{field, header}]
 * @param {string} filename - Name of the exported file (without extension)
 * @param {string} sheetName - Name of the worksheet
 */
export const exportToExcel = (data, columns, filename, sheetName = "Sheet1") => {
  try {
    // Prepare data for export - map to object with readable column names
    const exportData = data.map(item => {
      const row = {};
      columns.forEach(col => {
        // Use header as column name, fallback to field name if no header
        const columnName = col.header || col.field;
        // Get value from item using field path (supports nested properties like 'user.name')
        const value = getNestedProperty(item, col.field);
        row[columnName] = value !== undefined ? value : "";
      });
      return row;
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Apply column widths based on header length
    const colWidths = columns.map(col => {
      const headerLength = (col.header || col.field).length;
      const dataLength = Math.max(...exportData.map(row => String(row[col.header || col.field]).length));
      return { wch: Math.max(headerLength, dataLength, 10) }; // Minimum width of 10
    });

    // Set column widths
    ws["!cols"] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Generate filename with timestamp if not provided
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const fullFilename = filename ? `${filename}_${timestamp}.xlsx` : `export_${timestamp}.xlsx`;

    // Write file
    XLSX.writeFile(wb, fullFilename);

    return {
      success: true,
      filename: fullFilename,
    };
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get nested property value from object using dot notation
 * @param {Object} obj - Source object
 * @param {string} path - Property path (e.g., 'user.profile.name')
 * @returns {*} Property value or undefined
 */
const getNestedProperty = (obj, path) => {
  if (!obj || !path) return undefined;

  return path.split(".").reduce((current, prop) => {
    return current && current[prop] !== undefined ? current[prop] : undefined;
  }, obj);
};

/**
 * Export adjustment history data to Excel
 * @param {Array} historyRecords - Array of adjustment history records
 * @param {string} filename - Name of the exported file
 */
export const exportAdjustmentHistory = (historyRecords, filename = "adjustment_history") => {
  // Define columns for adjustment history
  const columns = [
    { field: "kdtk", header: "Store" },
    { field: "prdcd", header: "Product" },
    { field: "qty_adj", header: "Qty" },
    { field: "keter", header: "Description" },
    { field: "status", header: "Status" },
    { field: "note", header: "Note" },
    { field: "updtime", header: "Time" },
    { field: "pic", header: "PIC" },
  ];

  return exportToExcel(historyRecords, columns, filename, "Adjustment History");
};
