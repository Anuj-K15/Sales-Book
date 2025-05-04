// Reports.js - BeerZone Sales Reports
import { db } from "./firebase-config.js";
import { collection, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
let dailyReportContainer, monthlyReportContainer, yearlyReportContainer;
let dailyDatePicker, monthlyDatePicker, yearlyDatePicker;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    console.log("DOM loaded, initializing reports page");
    initReports();
});

// Main initialization function
function initReports() {
    // Get DOM elements
    dailyReportContainer = document.querySelector('#daily-report .reports-container');
    monthlyReportContainer = document.querySelector('#monthly-report .reports-container');
    yearlyReportContainer = document.querySelector('#yearly-report .reports-container');

    dailyDatePicker = document.getElementById('daily-date-picker');
    monthlyDatePicker = document.getElementById('monthly-date-picker');
    yearlyDatePicker = document.getElementById('yearly-date-picker');

    // Debug logging
    console.log("Daily report section:", document.getElementById('daily-report'));
    console.log("Monthly report section:", document.getElementById('monthly-report'));
    console.log("Yearly report section:", document.getElementById('yearly-report'));
    console.log("Time buttons:", document.querySelectorAll('.time-btn'));

    // Initialize date pickers
    initDatePickers();

    // Setup time period tabs
    setupTimeButtons();

    // Load daily reports by default
    loadDailyReports();
}

// Initialize date pickers
function initDatePickers() {
    // Initialize all date pickers with their specific formats
    initializeDailyDatePicker();
    initializeMonthlyDatePicker();
    initializeYearlyDatePicker();

    // Handle button clicks
    document.getElementById('daily-date-search').addEventListener('click', () => {
        const selectedDate = dailyDatePicker.value;
        if (selectedDate) {
            loadDailyReportsByDate(selectedDate);
        }
    });

    document.getElementById('monthly-date-search').addEventListener('click', () => {
        const selectedMonth = monthlyDatePicker.value;
        if (selectedMonth) {
            loadMonthlyReportsByMonth(selectedMonth);
        }
    });

    document.getElementById('yearly-date-search').addEventListener('click', () => {
        const selectedYear = yearlyDatePicker.value;
        if (selectedYear) {
            loadYearlyReportsByYear(selectedYear);
        }
    });

    // Export all buttons
    document.getElementById('export-daily-all').addEventListener('click', exportAllDailyReports);
    document.getElementById('export-monthly-all').addEventListener('click', exportAllMonthlyReports);
    document.getElementById('export-yearly-all').addEventListener('click', exportAllYearlyReports);
}

// Initialize daily date picker
function initializeDailyDatePicker() {
    // Destroy previous instance if exists
    if (dailyDatePicker._flatpickr) {
        dailyDatePicker._flatpickr.destroy();
    }

    // Daily date picker (specific date)
    flatpickr(dailyDatePicker, {
        dateFormat: "Y-m-d",
        maxDate: "today",
        defaultDate: "today",
        disableMobile: "true", // Ensure desktop experience on mobile
        static: true,
        theme: "light",
        showMonths: 1,
        onChange: function (selectedDates, dateStr) {
            console.log("Selected date:", dateStr);
        }
    });
}

// Initialize monthly date picker
function initializeMonthlyDatePicker() {
    // Destroy previous instance if exists
    if (monthlyDatePicker._flatpickr) {
        monthlyDatePicker._flatpickr.destroy();
    }

    // Monthly date picker (month and year only, no days)
    flatpickr(monthlyDatePicker, {
        plugins: [
            new monthSelectPlugin({
                shorthand: true,
                dateFormat: "Y-m",
                altFormat: "F Y",
                theme: "light"
            })
        ],
        disableMobile: "true", // Ensure desktop experience on mobile
        static: true,
        onChange: function (selectedDates, dateStr) {
            console.log("Selected month:", dateStr);
        }
    });
}

// Initialize yearly date picker
function initializeYearlyDatePicker() {
    // Destroy previous instance if exists
    if (yearlyDatePicker._flatpickr) {
        yearlyDatePicker._flatpickr.destroy();
    }

    // Yearly date picker (year only)
    flatpickr(yearlyDatePicker, {
        plugins: [
            new monthSelectPlugin({
                shorthand: true,
                dateFormat: "Y",
                altFormat: "Y",
                theme: "light",
                monthsPerRow: 4
            })
        ],
        disableMobile: "true", // Ensure desktop experience on mobile
        static: true,
        // Override how dates are shown to display years only
        formatDate: function (date, format) {
            return date.getFullYear().toString();
        },
        onChange: function (selectedDates, dateStr) {
            console.log("Selected year:", dateStr);
        }
    });
}

// Setup time period buttons
function setupTimeButtons() {
    const timeButtons = document.querySelectorAll('.time-btn');
    const reportSections = document.querySelectorAll('.report-section');

    if (!timeButtons || timeButtons.length === 0) {
        console.error("Time buttons not found");
        return;
    }

    timeButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Get the target section
            const targetId = button.dataset.target;
            const targetSection = document.getElementById(targetId);

            if (!targetSection) {
                console.error(`Target section ${targetId} not found`);
                return;
            }

            // Update active button
            timeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Show corresponding section
            reportSections.forEach(section => {
                if (section) {
                    section.classList.remove('active');
                }
            });
            targetSection.classList.add('active');

            // Reinitialize the appropriate date picker based on the selected section and open it
            if (targetId === 'daily-report') {
                initializeDailyDatePicker();
                loadDailyReports();

                // Give the datepicker time to initialize before opening
                setTimeout(() => {
                    if (dailyDatePicker._flatpickr) {
                        dailyDatePicker._flatpickr.open();
                    }
                }, 200);

            } else if (targetId === 'monthly-report') {
                initializeMonthlyDatePicker();
                loadMonthlyReports();

                // Give the datepicker time to initialize before opening
                setTimeout(() => {
                    if (monthlyDatePicker._flatpickr) {
                        monthlyDatePicker._flatpickr.open();
                    }
                }, 200);

            } else if (targetId === 'yearly-report') {
                initializeYearlyDatePicker();
                loadYearlyReports();

                // Give the datepicker time to initialize before opening
                setTimeout(() => {
                    if (yearlyDatePicker._flatpickr) {
                        yearlyDatePicker._flatpickr.open();
                    }
                }, 200);
            }
        });
    });
}

// Format currency
function formatCurrency(amount) {
    return `₹${parseFloat(amount).toFixed(2)}`;
}

// Format date for display
function formatDateForDisplay(dateStr) {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

// Format month for display
function formatMonthForDisplay(monthStr) {
    if (!monthStr) return "";
    const [year, month] = monthStr.split('-');
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
}

// Load daily sales reports
async function loadDailyReports() {
    if (!dailyReportContainer) {
        console.error("Daily report container not found");
        return;
    }

    try {
        // Show loading state
        dailyReportContainer.innerHTML = `
            <div class="loading-message">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading daily reports...</span>
            </div>
        `;

        // Query Firestore for all sales
        const salesRef = collection(db, "sales");
        const salesQuery = query(salesRef, orderBy("date", "desc"));
        const snapshot = await getDocs(salesQuery);

        if (snapshot.empty) {
            dailyReportContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chart-area"></i>
                    <p>No sales data available yet</p>
                </div>
            `;
            return;
        }

        // Group sales by date
        const salesByDate = {};

        snapshot.forEach(doc => {
            const sale = doc.data();
            const dateKey = sale.date;

            if (!salesByDate[dateKey]) {
                salesByDate[dateKey] = {
                    totalAmount: 0,
                    orderCount: 0,
                    averageOrder: 0,
                    items: {}
                };
            }

            const dayData = salesByDate[dateKey];

            // Update totals
            dayData.totalAmount += sale.totalAmount;
            dayData.orderCount++;

            // Update items sold
            sale.items.forEach(item => {
                if (!dayData.items[item.name]) {
                    dayData.items[item.name] = {
                        quantity: 0,
                        total: 0
                    };
                }

                dayData.items[item.name].quantity += item.quantity;
                dayData.items[item.name].total += item.price * item.quantity;
            });
        });

        // Calculate average order values
        for (const dateKey in salesByDate) {
            salesByDate[dateKey].averageOrder = salesByDate[dateKey].totalAmount / salesByDate[dateKey].orderCount;
        }

        // Display the reports
        displayDailyReports(salesByDate);

    } catch (error) {
        console.error("Error loading daily reports:", error);
        dailyReportContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading reports: ${error.message}</p>
            </div>
        `;
    }
}

// Load daily reports for a specific date
async function loadDailyReportsByDate(dateStr) {
    if (!dailyReportContainer) {
        console.error("Daily report container not found");
        return;
    }

    try {
        // Show loading state
        dailyReportContainer.innerHTML = `
            <div class="loading-message">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading reports for ${formatDateForDisplay(dateStr)}...</span>
            </div>
        `;

        // Query Firestore for sales on the specific date
        const salesRef = collection(db, "sales");
        const salesQuery = query(salesRef, where("date", "==", dateStr), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(salesQuery);

        if (snapshot.empty) {
            dailyReportContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <p>No sales found for ${formatDateForDisplay(dateStr)}</p>
                </div>
            `;
            return;
        }

        // Group sales by date (should be only one date)
        const salesByDate = {};

        snapshot.forEach(doc => {
            const sale = doc.data();
            const dateKey = sale.date;

            if (!salesByDate[dateKey]) {
                salesByDate[dateKey] = {
                    totalAmount: 0,
                    orderCount: 0,
                    averageOrder: 0,
                    items: {}
                };
            }

            const dayData = salesByDate[dateKey];

            // Update totals
            dayData.totalAmount += sale.totalAmount;
            dayData.orderCount++;

            // Update items sold
            sale.items.forEach(item => {
                if (!dayData.items[item.name]) {
                    dayData.items[item.name] = {
                        quantity: 0,
                        total: 0
                    };
                }

                dayData.items[item.name].quantity += item.quantity;
                dayData.items[item.name].total += item.price * item.quantity;
            });
        });

        // Calculate average order values
        for (const dateKey in salesByDate) {
            salesByDate[dateKey].averageOrder = salesByDate[dateKey].totalAmount / salesByDate[dateKey].orderCount;
        }

        // Display the reports
        displayDailyReports(salesByDate);

    } catch (error) {
        console.error("Error loading daily reports for date:", error);
        dailyReportContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading reports: ${error.message}</p>
            </div>
        `;
    }
}

// Display daily reports UI
function displayDailyReports(salesByDate) {
    if (!dailyReportContainer) {
        console.error("Daily report container not found");
        return;
    }

    if (Object.keys(salesByDate).length === 0) {
        dailyReportContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-area"></i>
                <p>No sales data available yet</p>
            </div>
        `;
        return;
    }

    // Sort dates in descending order
    const sortedDates = Object.keys(salesByDate).sort((a, b) => {
        return new Date(b) - new Date(a);
    });

    let html = '';

    sortedDates.forEach(dateKey => {
        const data = salesByDate[dateKey];

        // Sort items by quantity sold to get top items
        const sortedItems = Object.entries(data.items)
            .sort((a, b) => b[1].quantity - a[1].quantity)
            .slice(0, 3); // Top 3 items

        const topItemsHtml = sortedItems.map(([name, info]) => {
            return `<li>${name} x${info.quantity} (${formatCurrency(info.total)})</li>`;
        }).join('');

        html += `
            <div class="report-card">
                <h3 class="report-date">${formatDateForDisplay(dateKey)}</h3>
                <div class="report-stats">
                    <div class="stat-item">
                        <div class="stat-label">Total Sales</div>
                        <div class="stat-value">${formatCurrency(data.totalAmount)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Orders</div>
                        <div class="stat-value">${data.orderCount}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Avg. Order</div>
                        <div class="stat-value">${formatCurrency(data.averageOrder)}</div>
                    </div>
                </div>
                <div class="top-items">
                    <h4><i class="fas fa-star"></i> Top Items</h4>
                    <ul>
                        ${topItemsHtml || '<li>No items sold</li>'}
                    </ul>
                </div>
                <div class="report-actions">
                    <button class="export-btn" onclick="exportDailyReport('${dateKey}')">
                        <i class="fas fa-file-export"></i> Export
                    </button>
                    <button class="view-details-btn" onclick="viewDailyDetails('${dateKey}')">
                        <i class="fas fa-search"></i> View Details
                    </button>
                </div>
            </div>
        `;
    });

    dailyReportContainer.innerHTML = html;
}

// Load monthly sales reports
async function loadMonthlyReports() {
    if (!monthlyReportContainer) {
        console.error("Monthly report container not found");
        return;
    }

    try {
        // Show loading state
        monthlyReportContainer.innerHTML = `
            <div class="loading-message">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading monthly reports...</span>
            </div>
        `;

        // Query Firestore for all sales
        const salesRef = collection(db, "sales");
        const salesQuery = query(salesRef, orderBy("date", "desc"));
        const snapshot = await getDocs(salesQuery);

        if (snapshot.empty) {
            monthlyReportContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chart-area"></i>
                    <p>No sales data available yet</p>
                </div>
            `;
            return;
        }

        // Group sales by month
        const salesByMonth = {};

        snapshot.forEach(doc => {
            const sale = doc.data();
            const monthKey = sale.date.substring(0, 7); // YYYY-MM

            if (!salesByMonth[monthKey]) {
                salesByMonth[monthKey] = {
                    totalAmount: 0,
                    orderCount: 0,
                    averageOrder: 0,
                    items: {},
                    days: new Set()
                };
            }

            const monthData = salesByMonth[monthKey];

            // Update totals
            monthData.totalAmount += sale.totalAmount;
            monthData.orderCount++;
            monthData.days.add(sale.date);

            // Update items sold
            sale.items.forEach(item => {
                if (!monthData.items[item.name]) {
                    monthData.items[item.name] = {
                        quantity: 0,
                        total: 0
                    };
                }

                monthData.items[item.name].quantity += item.quantity;
                monthData.items[item.name].total += item.price * item.quantity;
            });
        });

        // Calculate average order values
        for (const monthKey in salesByMonth) {
            salesByMonth[monthKey].averageOrder = salesByMonth[monthKey].totalAmount / salesByMonth[monthKey].orderCount;
        }

        // Display the reports
        displayMonthlyReports(salesByMonth);

    } catch (error) {
        console.error("Error loading monthly reports:", error);
        monthlyReportContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading reports: ${error.message}</p>
            </div>
        `;
    }
}

// Display monthly reports UI
function displayMonthlyReports(salesByMonth) {
    if (!monthlyReportContainer) {
        console.error("Monthly report container not found");
        return;
    }

    if (Object.keys(salesByMonth).length === 0) {
        monthlyReportContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-area"></i>
                <p>No sales data available yet</p>
            </div>
        `;
        return;
    }

    // Sort months in descending order
    const sortedMonths = Object.keys(salesByMonth).sort((a, b) => {
        return new Date(b) - new Date(a);
    });

    let html = '';

    sortedMonths.forEach(monthKey => {
        const data = salesByMonth[monthKey];

        // Sort items by quantity sold to get top items
        const sortedItems = Object.entries(data.items)
            .sort((a, b) => b[1].quantity - a[1].quantity)
            .slice(0, 3); // Top 3 items

        const topItemsHtml = sortedItems.map(([name, info]) => {
            return `<li>${name} x${info.quantity} (${formatCurrency(info.total)})</li>`;
        }).join('');

        html += `
            <div class="report-card">
                <h3 class="report-date">${formatMonthForDisplay(monthKey)}</h3>
                <div class="report-stats">
                    <div class="stat-item">
                        <div class="stat-label">Total Sales</div>
                        <div class="stat-value">${formatCurrency(data.totalAmount)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Orders</div>
                        <div class="stat-value">${data.orderCount}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Days with Sales</div>
                        <div class="stat-value">${data.days.size}</div>
                    </div>
                </div>
                <div class="top-items">
                    <h4><i class="fas fa-star"></i> Top Items</h4>
                    <ul>
                        ${topItemsHtml || '<li>No items sold</li>'}
                    </ul>
                </div>
                <div class="report-actions">
                    <button class="export-btn" onclick="exportMonthlyReport('${monthKey}')">
                        <i class="fas fa-file-export"></i> Export
                    </button>
                    <button class="view-details-btn" onclick="viewMonthlyDetails('${monthKey}')">
                        <i class="fas fa-search"></i> View Details
                    </button>
                </div>
            </div>
        `;
    });

    monthlyReportContainer.innerHTML = html;
}

// Load yearly sales reports
async function loadYearlyReports() {
    if (!yearlyReportContainer) {
        console.error("Yearly report container not found");
        return;
    }

    try {
        // Show loading state
        yearlyReportContainer.innerHTML = `
            <div class="loading-message">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading yearly reports...</span>
            </div>
        `;

        // Query Firestore for all sales
        const salesRef = collection(db, "sales");
        const salesQuery = query(salesRef, orderBy("date", "desc"));
        const snapshot = await getDocs(salesQuery);

        if (snapshot.empty) {
            yearlyReportContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chart-area"></i>
                    <p>No sales data available yet</p>
                </div>
            `;
            return;
        }

        // Group sales by year
        const salesByYear = {};

        snapshot.forEach(doc => {
            const sale = doc.data();
            const yearKey = sale.date.substring(0, 4); // YYYY

            if (!salesByYear[yearKey]) {
                salesByYear[yearKey] = {
                    totalAmount: 0,
                    orderCount: 0,
                    averageOrder: 0,
                    items: {},
                    months: new Set()
                };
            }

            const yearData = salesByYear[yearKey];

            // Update totals
            yearData.totalAmount += sale.totalAmount;
            yearData.orderCount++;
            yearData.months.add(sale.date.substring(0, 7)); // Add month (YYYY-MM)

            // Update items sold
            sale.items.forEach(item => {
                if (!yearData.items[item.name]) {
                    yearData.items[item.name] = {
                        quantity: 0,
                        total: 0
                    };
                }

                yearData.items[item.name].quantity += item.quantity;
                yearData.items[item.name].total += item.price * item.quantity;
            });
        });

        // Calculate average order values
        for (const yearKey in salesByYear) {
            salesByYear[yearKey].averageOrder = salesByYear[yearKey].totalAmount / salesByYear[yearKey].orderCount;
        }

        // Display the reports
        displayYearlyReports(salesByYear);

    } catch (error) {
        console.error("Error loading yearly reports:", error);
        yearlyReportContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading reports: ${error.message}</p>
            </div>
        `;
    }
}

// Display yearly reports UI
function displayYearlyReports(salesByYear) {
    if (!yearlyReportContainer) {
        console.error("Yearly report container not found");
        return;
    }

    if (Object.keys(salesByYear).length === 0) {
        yearlyReportContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-area"></i>
                <p>No sales data available yet</p>
            </div>
        `;
        return;
    }

    // Sort years in descending order
    const sortedYears = Object.keys(salesByYear).sort((a, b) => b - a);

    let html = '';

    sortedYears.forEach(yearKey => {
        const data = salesByYear[yearKey];

        // Sort items by quantity sold to get top items
        const sortedItems = Object.entries(data.items)
            .sort((a, b) => b[1].quantity - a[1].quantity)
            .slice(0, 3); // Top 3 items

        const topItemsHtml = sortedItems.map(([name, info]) => {
            return `<li>${name} x${info.quantity} (${formatCurrency(info.total)})</li>`;
        }).join('');

        html += `
            <div class="report-card">
                <h3 class="report-date">${yearKey}</h3>
                <div class="report-stats">
                    <div class="stat-item">
                        <div class="stat-label">Total Sales</div>
                        <div class="stat-value">${formatCurrency(data.totalAmount)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Orders</div>
                        <div class="stat-value">${data.orderCount}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Active Months</div>
                        <div class="stat-value">${data.months.size}</div>
                    </div>
                </div>
                <div class="top-items">
                    <h4><i class="fas fa-star"></i> Top Items</h4>
                    <ul>
                        ${topItemsHtml || '<li>No items sold</li>'}
                    </ul>
                </div>
                <div class="report-actions">
                    <button class="export-btn" onclick="exportYearlyReport('${yearKey}')">
                        <i class="fas fa-file-export"></i> Export
                    </button>
                    <button class="view-details-btn" onclick="viewYearlyDetails('${yearKey}')">
                        <i class="fas fa-search"></i> View Details
                    </button>
                </div>
            </div>
        `;
    });

    yearlyReportContainer.innerHTML = html;
}

// Functions to filter monthly and yearly reports
async function loadMonthlyReportsByMonth(monthYear) {
    console.log(`Loading reports for month: ${monthYear}`);

    if (!monthlyReportContainer) {
        console.error("Monthly report container not found");
        return;
    }

    try {
        // Show loading state
        monthlyReportContainer.innerHTML = `
            <div class="loading-message">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading monthly report for ${formatMonthForDisplay(monthYear)}...</span>
            </div>
        `;

        // Extract year and month
        const [year, month] = monthYear.split('-');

        // Calculate start and end dates for the month
        const startDate = `${monthYear}-01`;

        // Last day of month: Create a date for the first day of the next month, then subtract one day
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${monthYear}-${lastDay}`;

        // Query Firestore for sales in this month
        const salesRef = collection(db, "sales");
        const salesQuery = query(
            salesRef,
            where("date", ">=", startDate),
            where("date", "<=", endDate),
            orderBy("date", "desc")
        );

        const snapshot = await getDocs(salesQuery);

        if (snapshot.empty) {
            monthlyReportContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chart-area"></i>
                    <p>No sales data available for ${formatMonthForDisplay(monthYear)}</p>
                </div>
            `;
            return;
        }

        // Group sales by month
        const salesByMonth = {};
        salesByMonth[monthYear] = {
            totalAmount: 0,
            orderCount: 0,
            averageOrder: 0,
            items: {},
            days: new Set()
        };

        snapshot.forEach(doc => {
            const sale = doc.data();
            const monthData = salesByMonth[monthYear];

            // Extract day from the date to count unique days
            const day = sale.date.split('-')[2];
            monthData.days.add(day);

            // Update totals
            monthData.totalAmount += sale.totalAmount;
            monthData.orderCount++;

            // Update items sold
            sale.items.forEach(item => {
                if (!monthData.items[item.name]) {
                    monthData.items[item.name] = {
                        quantity: 0,
                        total: 0
                    };
                }

                monthData.items[item.name].quantity += item.quantity;
                monthData.items[item.name].total += item.price * item.quantity;
            });
        });

        // Calculate average order value
        salesByMonth[monthYear].averageOrder = salesByMonth[monthYear].totalAmount / salesByMonth[monthYear].orderCount;

        // Display the filtered report
        displayMonthlyReports(salesByMonth);

    } catch (error) {
        console.error("Error loading monthly report:", error);
        monthlyReportContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load monthly report: ${error.message}</p>
            </div>
        `;
    }
}

async function loadYearlyReportsByYear(year) {
    console.log(`Loading reports for year: ${year}`);

    if (!yearlyReportContainer) {
        console.error("Yearly report container not found");
        return;
    }

    try {
        // Show loading state
        yearlyReportContainer.innerHTML = `
            <div class="loading-message">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading yearly report for ${year}...</span>
            </div>
        `;

        // Start and end dates for the year
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        // Query Firestore for sales in this year
        const salesRef = collection(db, "sales");
        const salesQuery = query(
            salesRef,
            where("date", ">=", startDate),
            where("date", "<=", endDate),
            orderBy("date", "desc")
        );

        const snapshot = await getDocs(salesQuery);

        if (snapshot.empty) {
            yearlyReportContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chart-area"></i>
                    <p>No sales data available for ${year}</p>
                </div>
            `;
            return;
        }

        // Group sales by year
        const salesByYear = {};
        salesByYear[year] = {
            totalAmount: 0,
            orderCount: 0,
            averageOrder: 0,
            items: {},
            months: new Set()
        };

        snapshot.forEach(doc => {
            const sale = doc.data();
            const yearData = salesByYear[year];

            // Extract month from the date to count unique months
            const month = sale.date.split('-')[1];
            yearData.months.add(month);

            // Update totals
            yearData.totalAmount += sale.totalAmount;
            yearData.orderCount++;

            // Update items sold
            sale.items.forEach(item => {
                if (!yearData.items[item.name]) {
                    yearData.items[item.name] = {
                        quantity: 0,
                        total: 0
                    };
                }

                yearData.items[item.name].quantity += item.quantity;
                yearData.items[item.name].total += item.price * item.quantity;
            });
        });

        // Calculate average order value
        salesByYear[year].averageOrder = salesByYear[year].totalAmount / salesByYear[year].orderCount;

        // Display the filtered report
        displayYearlyReports(salesByYear);

    } catch (error) {
        console.error("Error loading yearly report:", error);
        yearlyReportContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load yearly report: ${error.message}</p>
            </div>
        `;
    }
}

// Export functions
function exportDailyReport(dateKey) {
    console.log(`Exporting daily report for ${dateKey}`);
    // Use the simplified export functionality without product details
    if (window.exportTotalsSalesReport) {
        window.exportTotalsSalesReport(dateKey, dateKey, 'day');
    } else {
        alert("Export functionality not available");
    }
}

function exportMonthlyReport(monthKey) {
    console.log(`Exporting monthly report for ${monthKey}`);
    if (window.exportTotalsSalesReport) {
        // Extract year and month
        const [year, month] = monthKey.split('-');

        // Calculate start and end dates for the month
        const startDate = `${monthKey}-01`;

        // Last day of month: Create a date for the first day of the next month, then subtract one day
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${monthKey}-${lastDay}`;

        // Call simplified export function with date range
        window.exportTotalsSalesReport(startDate, endDate, 'month');
    } else {
        alert("Export functionality not available");
    }
}

function exportYearlyReport(yearKey) {
    console.log(`Exporting yearly report for ${yearKey}`);
    if (window.exportTotalsSalesReport) {
        const startDate = `${yearKey}-01-01`;
        const endDate = `${yearKey}-12-31`;
        window.exportTotalsSalesReport(startDate, endDate, 'year');
    } else {
        alert("Export functionality not available");
    }
}

// Export all reports
function exportAllDailyReports() {
    console.log("Exporting all daily reports (Last 30 days)");
    if (window.exportTotalsSalesReport) {
        // Calculate dates for last 30 days
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        const startDate = formatDateYYYYMMDD(thirtyDaysAgo);
        const endDate = formatDateYYYYMMDD(today);

        // Export last 30 days as a summary
        window.exportTotalsSalesReport(startDate, endDate, 'last-30-days');
    } else {
        alert("Export functionality not available");
    }
}

function exportAllMonthlyReports() {
    console.log("Exporting all monthly reports (Last 12 months)");
    if (window.exportTotalsSalesReport) {
        // Calculate dates for last 12 months
        const today = new Date();
        const twelveMonthsAgo = new Date(today);
        twelveMonthsAgo.setMonth(today.getMonth() - 12);

        const startDate = formatDateYYYYMMDD(twelveMonthsAgo);
        const endDate = formatDateYYYYMMDD(today);

        // Export last 12 months as a summary
        window.exportTotalsSalesReport(startDate, endDate, 'last-12-months');
    } else {
        alert("Export functionality not available");
    }
}

function exportAllYearlyReports() {
    console.log("Exporting all yearly reports (Last 5 years)");
    if (window.exportTotalsSalesReport) {
        // Calculate dates for last 5 years
        const today = new Date();
        const fiveYearsAgo = new Date(today);
        fiveYearsAgo.setFullYear(today.getFullYear() - 5);

        const startDate = formatDateYYYYMMDD(fiveYearsAgo);
        const endDate = formatDateYYYYMMDD(today);

        // Export last 5 years as a summary
        window.exportTotalsSalesReport(startDate, endDate, 'last-5-years');
    } else {
        alert("Export functionality not available");
    }
}

// Helper function to format date as YYYY-MM-DD
function formatDateYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// View details functions
function viewDailyDetails(dateKey) {
    window.location.href = `sales.html?date=${dateKey}`;
}

function viewMonthlyDetails(monthKey) {
    window.location.href = `sales.html?month=${monthKey}`;
}

function viewYearlyDetails(yearKey) {
    window.location.href = `sales.html?year=${yearKey}`;
}

// Make export and view functions globally available
window.exportDailyReport = exportDailyReport;
window.exportMonthlyReport = exportMonthlyReport;
window.exportYearlyReport = exportYearlyReport;
window.exportAllDailyReports = exportAllDailyReports;
window.exportAllMonthlyReports = exportAllMonthlyReports;
window.exportAllYearlyReports = exportAllYearlyReports;
window.viewDailyDetails = viewDailyDetails;
window.viewMonthlyDetails = viewMonthlyDetails;
window.viewYearlyDetails = viewYearlyDetails; 