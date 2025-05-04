/**
 * Inventory Export Functions
 * Uses SheetJS library to export inventory data to Excel
 */

// Function to export inventory to Excel
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
    const columnWidths = [
        { wch: 30 },  // Product Name (column A)
        { wch: 15 },  // Current Stock (column B)
        { wch: 30 },  // Previous Operation (column C)
        { wch: 25 },  // Last Updated (column D)
        { wch: 15 },  // Status (column E)
        { wch: 25 }   // Actions (column F) - might be hidden in Excel
    ];
    ws['!cols'] = columnWidths;

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');

    // Get current date for filename
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const timeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;

    // Generate Excel file and trigger download with date in filename
    XLSX.writeFile(wb, `BeerZone_Inventory_${dateStr}_${timeStr}.xlsx`);

    console.log('✅ Inventory exported successfully');
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
    const timeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;

    // Format the date range for the filename (3 months ago to today)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const fromDate = `${threeMonthsAgo.getFullYear()}-${(threeMonthsAgo.getMonth() + 1).toString().padStart(2, '0')}-${threeMonthsAgo.getDate().toString().padStart(2, '0')}`;

    // Generate Excel file and trigger download with date in filename
    XLSX.writeFile(wb, `BeerZone_Inventory_History_${fromDate}_to_${dateStr}_${timeStr}.xlsx`);

    console.log('✅ Inventory history (last 3 months) exported successfully');
}

// Make the functions globally accessible
window.exportInventoryToExcel = exportInventoryToExcel;
window.exportInventoryHistoryToExcel = exportInventoryHistoryToExcel; 