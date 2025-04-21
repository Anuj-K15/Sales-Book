/**
 * Inventory Export Functions
 * Uses SheetJS library to export inventory data to Excel
 */

// Function to export inventory overview to Excel
function exportInventoryToExcel() {
    // Get the table element
    const table = document.getElementById('inventory-table');

    if (!table) {
        alert('Inventory table not found!');
        return;
    }

    // Create a new workbook
    const wb = XLSX.utils.book_new();

    // Convert the table to a worksheet
    const ws = XLSX.utils.table_to_sheet(table);

    // Set column widths for better readability
    const inventoryColumnWidths = [
        { wch: 30 },  // Product (column A)
        { wch: 15 },  // Current Stock (column B)
        { wch: 20 },  // Last Updated (column C)
        { wch: 15 },  // Status (column D)
        { wch: 15 }   // Actions (column E)
    ];
    ws['!cols'] = inventoryColumnWidths;

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory Overview');

    // Generate Excel file and trigger download
    XLSX.writeFile(wb, 'inventory_overview.xlsx');

    console.log('✅ Inventory overview exported successfully with adjusted column widths');
}

// Function to export inventory history to Excel (last 3 months only)
function exportInventoryHistoryToExcel() {
    // Get the table element
    const table = document.getElementById('history-table');

    if (!table) {
        alert('History table not found!');
        return;
    }

    // Create a new workbook
    const wb = XLSX.utils.book_new();

    // Convert the table to a worksheet
    const ws = XLSX.utils.table_to_sheet(table);

    // Set column widths for better readability
    const historyColumnWidths = [
        { wch: 25 },  // Date & Time (column A)
        { wch: 30 },  // Product (column B)
        { wch: 15 },  // Change (column C)
        { wch: 40 }   // Notes (column D) - wider for longer text
    ];
    ws['!cols'] = historyColumnWidths;

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory History (3 Months)');

    // Get current date for filename
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    // Generate Excel file and trigger download with date in filename
    XLSX.writeFile(wb, `inventory_history_3_months_${dateStr}.xlsx`);

    console.log('✅ Inventory history (last 3 months) exported successfully');
}

// Make the functions globally accessible
window.exportInventoryToExcel = exportInventoryToExcel;
window.exportInventoryHistoryToExcel = exportInventoryHistoryToExcel; 