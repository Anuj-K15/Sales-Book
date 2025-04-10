// Excel Export Functionality for BeerZone Sales
import { db } from "./firebase-config.js";
import { collection, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Function to convert sales data to Excel and trigger download
export async function exportSalesToExcel(dateFilter = null, monthFilter = null) {
    try {
        const salesRef = collection(db, "sales");
        let salesQuery;
        let filename = "beerzone-sales";

        // Apply date or month filters if provided
        if (dateFilter) {
            // Filter by specific date
            salesQuery = query(salesRef, where("date", "==", dateFilter), orderBy("timestamp", "asc"));
            filename = `beerzone-sales-${dateFilter}`;
        } else if (monthFilter !== null) {
            // Filter by month (monthFilter should be in format YYYY-MM)
            const [year, month] = monthFilter.split('-');
            const startDate = `${year}-${month}-01`;

            // Calculate end date (last day of the month)
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;

            salesQuery = query(
                salesRef,
                where("date", ">=", startDate),
                where("date", "<=", endDate),
                orderBy("date", "asc"),
                orderBy("timestamp", "asc")
            );
            filename = `beerzone-sales-${year}-${month}`;
        } else {
            // No filter, get all sales
            salesQuery = query(salesRef, orderBy("date", "desc"), orderBy("timestamp", "desc"));
        }

        const snapshot = await getDocs(salesQuery);

        if (snapshot.empty) {
            alert("No sales data available for export");
            return;
        }

        // Format data for Excel
        const data = [];

        // Add header row
        data.push([
            "Order No.",
            "Date",
            "Time",
            "Items",
            "Quantities",
            "Unit Prices",
            "Total Amount",
            "Payment Method"
        ]);

        // Add data rows
        snapshot.forEach((doc) => {
            const sale = doc.data();

            // Format items data
            const items = sale.items.map(item => item.name).join(", ");
            const quantities = sale.items.map(item => item.quantity).join(", ");
            const unitPrices = sale.items.map(item => `₹${item.price}`).join(", ");

            data.push([
                sale.orderNo,
                sale.date,
                sale.time,
                items,
                quantities,
                unitPrices,
                `₹${sale.totalAmount.toFixed(2)}`,
                sale.paymentMethod
            ]);
        });

        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(data);

        // Set column widths
        const colWidths = [
            { wch: 10 },  // Order No
            { wch: 12 },  // Date
            { wch: 10 },  // Time
            { wch: 30 },  // Items
            { wch: 15 },  // Quantities
            { wch: 15 },  // Unit Prices
            { wch: 15 },  // Total Amount
            { wch: 15 }   // Payment Method
        ];
        ws['!cols'] = colWidths;

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sales Data");

        // Generate Excel file and trigger download
        XLSX.writeFile(wb, `${filename}.xlsx`);

        console.log(`✅ Excel file '${filename}.xlsx' exported successfully!`);
    } catch (error) {
        console.error("❌ Error exporting sales to Excel:", error);
        alert("Error exporting sales data. Please try again.");
    }
}

// Function to get current month and year for monthly export
export function getCurrentMonthYear() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

// Make export functions globally available
window.exportSalesToExcel = exportSalesToExcel;
window.getCurrentMonthYear = getCurrentMonthYear; 