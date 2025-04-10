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

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory Overview');

    // Generate Excel file and trigger download
    XLSX.writeFile(wb, 'inventory_overview.xlsx');
}

// Function to export inventory history to Excel
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

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory History');

    // Generate Excel file and trigger download
    XLSX.writeFile(wb, 'inventory_history.xlsx');
}

// Make the functions globally accessible
window.exportInventoryToExcel = exportInventoryToExcel;
window.exportInventoryHistoryToExcel = exportInventoryHistoryToExcel; 