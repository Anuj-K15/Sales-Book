// Excel Export Functionality for BeerZone Sales
import { db } from "./firebase-config.js";
import { collection, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Function to get current timestamp string for filenames
function getTimestampStr() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
}

// Function to convert sales data to Excel and trigger download
export async function exportSalesToExcel(dateFilter = null, monthFilter = null) {
    try {
        const salesRef = collection(db, "sales");
        let salesQuery;
        let filename = "BeerZone_Sales_All";
        const timeStr = getTimestampStr();

        // Apply date or month filters if provided
        if (dateFilter) {
            // Filter by specific date
            salesQuery = query(salesRef, where("date", "==", dateFilter), orderBy("timestamp", "asc"));
            filename = `BeerZone_Sales_Daily_${dateFilter}_${timeStr}`;
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

            // Month name for better readability
            const monthNames = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];
            const monthName = monthNames[parseInt(month) - 1];

            filename = `BeerZone_Sales_Monthly_${monthName}_${year}_${timeStr}`;
        } else {
            // No filter, get all sales
            salesQuery = query(salesRef, orderBy("date", "desc"), orderBy("timestamp", "desc"));
            filename = `BeerZone_Sales_Complete_${new Date().toISOString().split('T')[0]}_${timeStr}`;
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

// Function to export sales data for a specific date range
export async function exportDateRangeSales(startDate, endDate, periodType = 'custom') {
    try {
        const salesRef = collection(db, "sales");
        let salesQuery;
        let filename = "BeerZone_Sales";
        const timeStr = getTimestampStr();

        // Generate appropriate filename based on period type
        if (periodType === 'month') {
            // Get month name for display in filename
            const [year, month] = startDate.split('-');
            const monthNames = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];
            const monthName = monthNames[parseInt(month) - 1];
            filename = `BeerZone_Sales_Monthly_${monthName}_${year}_${timeStr}`;
        } else if (periodType === 'year') {
            const year = startDate.split('-')[0];
            filename = `BeerZone_Sales_Annual_${year}_${timeStr}`;
        } else if (periodType === 'week') {
            // Format dates for better readability in filename
            const formattedStartDate = startDate.replace(/-/g, '');
            const formattedEndDate = endDate.replace(/-/g, '');
            filename = `BeerZone_Sales_Weekly_${formattedStartDate}_to_${formattedEndDate}_${timeStr}`;
        } else {
            // Default to custom date range format
            const formattedStartDate = startDate.replace(/-/g, '');
            const formattedEndDate = endDate.replace(/-/g, '');
            filename = `BeerZone_Sales_Custom_${formattedStartDate}_to_${formattedEndDate}_${timeStr}`;
        }

        // Create query based on date range
        if (startDate && endDate) {
            salesQuery = query(
                salesRef,
                where("date", ">=", startDate),
                where("date", "<=", endDate),
                orderBy("date", "asc"),
                orderBy("timestamp", "asc")
            );
        } else if (startDate) {
            // Only start date specified
            salesQuery = query(
                salesRef,
                where("date", ">=", startDate),
                orderBy("date", "asc"),
                orderBy("timestamp", "asc")
            );
        } else {
            // No dates specified, get all sales
            salesQuery = query(salesRef, orderBy("date", "desc"), orderBy("timestamp", "desc"));
        }

        const snapshot = await getDocs(salesQuery);

        if (snapshot.empty) {
            alert("No sales data available for the selected period");
            return;
        }

        // Format data for Excel
        const data = [];
        let totalSales = 0;
        let totalItems = 0;
        let uniqueDates = new Set();

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

        // Process sales data
        snapshot.forEach((doc) => {
            const sale = doc.data();

            // Track stats
            totalSales += sale.totalAmount;
            sale.items.forEach(item => totalItems += item.quantity);
            uniqueDates.add(sale.date);

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

        // Add summary data
        data.push([]);  // Empty row
        data.push(["SUMMARY STATISTICS"]);
        data.push(["Total Sales", `₹${totalSales.toFixed(2)}`]);
        data.push(["Total Orders", snapshot.size]);
        data.push(["Total Items Sold", totalItems]);
        data.push(["Unique Dates", uniqueDates.size]);
        data.push(["Average Order Value", `₹${(totalSales / snapshot.size).toFixed(2)}`]);

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

        // Add some styling
        const merge = { s: { r: data.length - 6, c: 0 }, e: { r: data.length - 6, c: 7 } };
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push(merge);

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sales Data");

        // Generate Excel file and trigger download
        XLSX.writeFile(wb, `${filename}.xlsx`);

        console.log(`✅ Excel file '${filename}.xlsx' exported successfully!`);
        return true;
    } catch (error) {
        console.error("❌ Error exporting sales for date range:", error);
        alert(`Error exporting sales data: ${error.message}`);
        return false;
    }
}

// Function to export sales totals only (no product details) for all report types
export async function exportTotalsSalesReport(startDate = null, endDate = null, periodType = 'all') {
    try {
        const salesRef = collection(db, "sales");
        let salesQuery;
        let filename = "BeerZone_Sales_Summary";
        const timeStr = getTimestampStr();

        // Generate query and filename based on period type
        if (startDate && endDate) {
            // Date range specified
            salesQuery = query(
                salesRef,
                where("date", ">=", startDate),
                where("date", "<=", endDate),
                orderBy("date", "asc")
            );

            // Set appropriate filename based on period type
            if (periodType === 'day') {
                filename = `BeerZone_Sales_Daily_${startDate}_Summary_${timeStr}`;
            } else if (periodType === 'month') {
                const [year, month] = startDate.split('-');
                const monthNames = [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                ];
                const monthName = monthNames[parseInt(month) - 1];
                filename = `BeerZone_Sales_Monthly_${monthName}_${year}_Summary_${timeStr}`;
            } else if (periodType === 'year') {
                const year = startDate.split('-')[0];
                filename = `BeerZone_Sales_Annual_${year}_Summary_${timeStr}`;
            } else if (periodType === 'last-30-days') {
                filename = `BeerZone_Sales_Last30Days_Summary_${timeStr}`;
            } else if (periodType === 'last-12-months') {
                filename = `BeerZone_Sales_Last12Months_Summary_${timeStr}`;
            } else if (periodType === 'last-5-years') {
                filename = `BeerZone_Sales_Last5Years_Summary_${timeStr}`;
            } else {
                // Custom date range
                const formattedStartDate = startDate.replace(/-/g, '');
                const formattedEndDate = endDate.replace(/-/g, '');
                filename = `BeerZone_Sales_${formattedStartDate}_to_${formattedEndDate}_Summary_${timeStr}`;
            }
        } else if (startDate) {
            // Only start date specified (single day)
            salesQuery = query(
                salesRef,
                where("date", "==", startDate),
                orderBy("timestamp", "asc")
            );
            filename = `BeerZone_Sales_Daily_${startDate}_Summary_${timeStr}`;
        } else {
            // No dates specified, get all sales
            salesQuery = query(salesRef, orderBy("date", "asc"));
            filename = `BeerZone_Sales_Complete_Summary_${timeStr}`;
        }

        const snapshot = await getDocs(salesQuery);

        if (snapshot.empty) {
            alert("No sales data available for the selected period");
            return false;
        }

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Handle different period types
        if (periodType === 'last-30-days') {
            createDailyReport(wb, snapshot, startDate, endDate);
        } else if (periodType === 'last-12-months') {
            createMonthlyReport(wb, snapshot);
        } else if (periodType === 'last-5-years') {
            createYearlyReport(wb, snapshot);
        } else {
            // Default handling for other period types
            createDefaultReport(wb, snapshot, periodType);
        }

        // Generate Excel file and trigger download
        XLSX.writeFile(wb, `${filename}.xlsx`);

        console.log(`✅ Excel file '${filename}.xlsx' exported successfully!`);
        return true;
    } catch (error) {
        console.error("❌ Error exporting sales summary:", error);
        alert(`Error exporting sales summary: ${error.message}`);
        return false;
    }
}

// Helper function to create a daily sales report (last 30 days)
function createDailyReport(workbook, snapshot, startDate, endDate) {
    // Group sales by date
    const salesByDate = {};
    let totalSalesAmount = 0;
    let totalOrderCount = 0;

    // Process sales data for summary (group by date)
    snapshot.forEach((doc) => {
        const sale = doc.data();
        const { date, totalAmount } = sale;

        if (!salesByDate[date]) {
            salesByDate[date] = {
                totalAmount: 0,
                orderCount: 0
            };
        }

        salesByDate[date].totalAmount += totalAmount;
        salesByDate[date].orderCount += 1;
        totalSalesAmount += totalAmount;
        totalOrderCount += 1;
    });

    // Format data for Excel - daily summary
    const data = [];

    // Add report title
    data.push(["BeerZone Sales Summary - Last 30 Days"]);
    data.push([`Period: ${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)}`]);
    data.push([`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`]);
    data.push([]);  // Empty row

    // Add daily summary table
    data.push(["Date", "Number of Orders", "Total Sales Amount", "% of Total"]);

    // Sort dates chronologically
    const sortedDates = Object.keys(salesByDate).sort();

    sortedDates.forEach(date => {
        const { totalAmount, orderCount } = salesByDate[date];
        const formattedDate = date.split('-').reverse().join('/'); // Convert YYYY-MM-DD to DD/MM/YYYY
        const percentOfTotal = ((totalAmount / totalSalesAmount) * 100).toFixed(2);

        data.push([
            formattedDate,
            orderCount,
            `₹${totalAmount.toFixed(2)}`,
            `${percentOfTotal}%`
        ]);
    });

    // Add empty row before summary
    data.push([]);

    // Add overall summary
    data.push(["OVERALL SUMMARY"]);
    data.push(["Total Sales", `₹${totalSalesAmount.toFixed(2)}`]);
    data.push(["Total Orders", totalOrderCount]);
    data.push(["Total Days", sortedDates.length]);

    // Add daily averages if we have data
    if (sortedDates.length > 0) {
        data.push(["Average Daily Sales", `₹${(totalSalesAmount / sortedDates.length).toFixed(2)}`]);
    }

    if (totalOrderCount > 0) {
        data.push(["Average Order Value", `₹${(totalSalesAmount / totalOrderCount).toFixed(2)}`]);
    }

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    const colWidths = [
        { wch: 15 },  // Date
        { wch: 20 },  // Number of Orders 
        { wch: 20 },  // Total Sales Amount
        { wch: 15 }   // % of Total
    ];
    ws['!cols'] = colWidths;

    // Add some styling - merge title cells
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // Title row
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }, // Period row
        { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } }, // Generated date row
        { s: { r: data.length - 6, c: 0 }, e: { r: data.length - 6, c: 3 } } // OVERALL SUMMARY row
    ];

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, ws, "Daily Sales (30 Days)");
}

// Helper function to create a monthly sales report (last 12 months)
function createMonthlyReport(workbook, snapshot) {
    // Group sales by month
    const salesByMonth = {};
    let totalSalesAmount = 0;
    let totalOrderCount = 0;

    // Process sales data for summary (group by month)
    snapshot.forEach((doc) => {
        const sale = doc.data();
        const { date, totalAmount } = sale;

        // Extract year and month from date (YYYY-MM-DD)
        const monthKey = date.substring(0, 7); // YYYY-MM

        if (!salesByMonth[monthKey]) {
            salesByMonth[monthKey] = {
                totalAmount: 0,
                orderCount: 0,
                days: new Set()
            };
        }

        salesByMonth[monthKey].totalAmount += totalAmount;
        salesByMonth[monthKey].orderCount += 1;
        salesByMonth[monthKey].days.add(date); // Add unique day
        totalSalesAmount += totalAmount;
        totalOrderCount += 1;
    });

    // Format data for Excel - monthly summary
    const data = [];

    // Add report title
    data.push(["BeerZone Sales Summary - Last 12 Months"]);
    data.push([`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`]);
    data.push([]);  // Empty row

    // Add monthly summary table
    data.push(["Month", "Number of Orders", "Total Sales Amount", "Days with Sales", "% of Total"]);

    // Sort months chronologically
    const sortedMonths = Object.keys(salesByMonth).sort();

    sortedMonths.forEach(monthKey => {
        const { totalAmount, orderCount, days } = salesByMonth[monthKey];
        const monthDisplay = formatMonthYearDisplay(monthKey); // Format as "Month YYYY"
        const percentOfTotal = ((totalAmount / totalSalesAmount) * 100).toFixed(2);

        data.push([
            monthDisplay,
            orderCount,
            `₹${totalAmount.toFixed(2)}`,
            days.size,
            `${percentOfTotal}%`
        ]);
    });

    // Add empty row before summary
    data.push([]);

    // Add overall summary
    data.push(["OVERALL SUMMARY"]);
    data.push(["Total Sales", `₹${totalSalesAmount.toFixed(2)}`]);
    data.push(["Total Orders", totalOrderCount]);
    data.push(["Total Months", sortedMonths.length]);

    // Add monthly averages if we have data
    if (sortedMonths.length > 0) {
        data.push(["Average Monthly Sales", `₹${(totalSalesAmount / sortedMonths.length).toFixed(2)}`]);
    }

    if (totalOrderCount > 0) {
        data.push(["Average Order Value", `₹${(totalSalesAmount / totalOrderCount).toFixed(2)}`]);
    }

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    const colWidths = [
        { wch: 15 },  // Month
        { wch: 20 },  // Number of Orders 
        { wch: 20 },  // Total Sales Amount
        { wch: 15 },  // Days with Sales
        { wch: 15 }   // % of Total
    ];
    ws['!cols'] = colWidths;

    // Add some styling - merge title cells
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // Title row
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, // Generated date row
        { s: { r: data.length - 6, c: 0 }, e: { r: data.length - 6, c: 4 } } // OVERALL SUMMARY row
    ];

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, ws, "Monthly Sales (12 Months)");
}

// Helper function to create a yearly sales report (last 5 years)
function createYearlyReport(workbook, snapshot) {
    // Group sales by year
    const salesByYear = {};
    let totalSalesAmount = 0;
    let totalOrderCount = 0;

    // Process sales data for summary (group by year)
    snapshot.forEach((doc) => {
        const sale = doc.data();
        const { date, totalAmount } = sale;

        // Extract year from date (YYYY-MM-DD)
        const yearKey = date.substring(0, 4); // YYYY

        if (!salesByYear[yearKey]) {
            salesByYear[yearKey] = {
                totalAmount: 0,
                orderCount: 0,
                months: new Set(),
                days: new Set()
            };
        }

        salesByYear[yearKey].totalAmount += totalAmount;
        salesByYear[yearKey].orderCount += 1;
        salesByYear[yearKey].days.add(date); // Add unique day
        salesByYear[yearKey].months.add(date.substring(0, 7)); // Add unique month (YYYY-MM)
        totalSalesAmount += totalAmount;
        totalOrderCount += 1;
    });

    // Format data for Excel - yearly summary
    const data = [];

    // Add report title
    data.push(["BeerZone Sales Summary - Last 5 Years"]);
    data.push([`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`]);
    data.push([]);  // Empty row

    // Add yearly summary table
    data.push(["Year", "Number of Orders", "Total Sales Amount", "Months with Sales", "Days with Sales", "% of Total"]);

    // Sort years chronologically
    const sortedYears = Object.keys(salesByYear).sort();

    sortedYears.forEach(yearKey => {
        const { totalAmount, orderCount, months, days } = salesByYear[yearKey];
        const percentOfTotal = ((totalAmount / totalSalesAmount) * 100).toFixed(2);

        data.push([
            yearKey,
            orderCount,
            `₹${totalAmount.toFixed(2)}`,
            months.size,
            days.size,
            `${percentOfTotal}%`
        ]);
    });

    // Add empty row before summary
    data.push([]);

    // Add overall summary
    data.push(["OVERALL SUMMARY"]);
    data.push(["Total Sales", `₹${totalSalesAmount.toFixed(2)}`]);
    data.push(["Total Orders", totalOrderCount]);
    data.push(["Total Years", sortedYears.length]);

    // Add yearly averages if we have data
    if (sortedYears.length > 0) {
        data.push(["Average Yearly Sales", `₹${(totalSalesAmount / sortedYears.length).toFixed(2)}`]);
    }

    if (totalOrderCount > 0) {
        data.push(["Average Order Value", `₹${(totalSalesAmount / totalOrderCount).toFixed(2)}`]);
    }

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    const colWidths = [
        { wch: 10 },  // Year
        { wch: 20 },  // Number of Orders 
        { wch: 20 },  // Total Sales Amount
        { wch: 20 },  // Months with Sales
        { wch: 15 },  // Days with Sales
        { wch: 15 }   // % of Total
    ];
    ws['!cols'] = colWidths;

    // Add some styling - merge title cells
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Title row
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Generated date row
        { s: { r: data.length - 6, c: 0 }, e: { r: data.length - 6, c: 5 } } // OVERALL SUMMARY row
    ];

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, ws, "Yearly Sales (5 Years)");
}

// Helper function for default report format (used for day, month, year, or custom periods)
function createDefaultReport(workbook, snapshot, periodType) {
    // Group sales by date for summary
    const salesByDate = {};
    let totalSalesAmount = 0;
    let totalOrderCount = 0;

    // Process sales data for summary (group by date)
    snapshot.forEach((doc) => {
        const sale = doc.data();
        const { date, totalAmount } = sale;

        if (!salesByDate[date]) {
            salesByDate[date] = {
                totalAmount: 0,
                orderCount: 0
            };
        }

        salesByDate[date].totalAmount += totalAmount;
        salesByDate[date].orderCount += 1;
        totalSalesAmount += totalAmount;
        totalOrderCount += 1;
    });

    // Format data for Excel - summary only, no product details
    const data = [];

    // Add report title
    const periodTitle = periodType.charAt(0).toUpperCase() + periodType.slice(1);
    data.push([`BeerZone Sales Summary Report - ${periodTitle}`]);
    data.push([`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`]);
    data.push([]);  // Empty row

    // Add daily summary table
    data.push(["Date", "Number of Orders", "Total Sales Amount"]);

    // Sort dates chronologically
    const sortedDates = Object.keys(salesByDate).sort();

    sortedDates.forEach(date => {
        const { totalAmount, orderCount } = salesByDate[date];
        const formattedDate = date.split('-').reverse().join('/'); // Convert YYYY-MM-DD to DD/MM/YYYY

        data.push([
            formattedDate,
            orderCount,
            `₹${totalAmount.toFixed(2)}`
        ]);
    });

    // Add empty row before summary
    data.push([]);

    // Add overall summary
    data.push(["OVERALL SUMMARY"]);
    data.push(["Total Sales", `₹${totalSalesAmount.toFixed(2)}`]);
    data.push(["Total Orders", totalOrderCount]);
    data.push(["Unique Dates", sortedDates.length]);

    if (sortedDates.length > 0) {
        data.push(["Average Daily Sales", `₹${(totalSalesAmount / sortedDates.length).toFixed(2)}`]);
    }

    if (totalOrderCount > 0) {
        data.push(["Average Order Value", `₹${(totalSalesAmount / totalOrderCount).toFixed(2)}`]);
    }

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    const colWidths = [
        { wch: 15 },  // Date
        { wch: 20 },  // Number of Orders 
        { wch: 20 }   // Total Sales Amount
    ];
    ws['!cols'] = colWidths;

    // Add some styling - merge title cells
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, // Title row
        { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }, // Generated date row
        { s: { r: data.length - 6, c: 0 }, e: { r: data.length - 6, c: 2 } } // OVERALL SUMMARY row
    ];

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, ws, "Sales Summary");
}

// Helper function to format date DD/MM/YYYY
function formatDisplayDate(dateStr) {
    return dateStr.split('-').reverse().join('/');
}

// Helper function to format month and year for display
function formatMonthYearDisplay(monthYearStr) {
    const [year, month] = monthYearStr.split('-');
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
}

// Function to get current month and year for monthly export
export function getCurrentMonthYear() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

// Function to get today's date in YYYY-MM-DD format
export function getTodayIST() {
    const now = new Date();
    const istOptions = {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };

    const [day, month, year] = now.toLocaleString('en-GB', istOptions).split('/');
    return `${year}-${month}-${day}`; // YYYY-MM-DD format
}

// Make export functions globally available
window.exportSalesToExcel = exportSalesToExcel;
window.exportDateRangeSales = exportDateRangeSales;
window.exportTotalsSalesReport = exportTotalsSalesReport;
window.getCurrentMonthYear = getCurrentMonthYear;
window.getTodayIST = getTodayIST; 