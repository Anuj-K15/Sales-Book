// Import Firebase modules
import { db, rtdb } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { ref, get } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { getTodayIST } from './sales-page.js';

// Global variables
let currentPeriod = 'day';
let salesData = [];
let inventoryData = [];
let revenueChart = null;
let productsChart = null;

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await loadDashboardData();
});

// Set up event listeners
function setupEventListeners() {
    // Time period selector buttons
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            // Update active button
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update current period
            currentPeriod = btn.dataset.period;

            // Update period labels
            updatePeriodLabels(currentPeriod);

            // Load data for the selected period
            await loadDashboardData();
        });
    });
}

// Update period labels based on selected time period
function updatePeriodLabels(period) {
    const labels = document.querySelectorAll('.metric-label');

    let periodText = '';
    switch (period) {
        case 'day': periodText = 'Today'; break;
        case 'week': periodText = 'This Week'; break;
        case 'month': periodText = 'This Month'; break;
        case 'year': periodText = 'This Year'; break;
    }

    labels.forEach(label => {
        if (!label.closest('.inventory-alert')) {
            label.textContent = periodText;
        }
    });
}

// Main function to load all dashboard data
async function loadDashboardData() {
    try {
        // Show loading state
        showLoadingState();

        // Fetch sales data based on selected period
        await fetchSalesData();

        // Fetch inventory data
        await fetchInventoryData();

        // Update metrics
        updateSalesMetrics();

        // Update charts
        updateCharts();

        // Update recent transactions
        updateRecentTransactions();

        // Update low stock alerts
        updateLowStockAlerts();

        console.log('✅ Dashboard data loaded successfully');
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showErrorState('Failed to load dashboard data. Please refresh the page.');
    }
}

// Show loading state for dashboard elements
function showLoadingState() {
    // Reset metrics to loading state
    document.getElementById('total-sales-value').textContent = '...';
    document.getElementById('orders-count').textContent = '...';
    document.getElementById('average-order').textContent = '...';
    document.getElementById('low-stock-count').textContent = '...';

    // Reset tables to loading state
    document.getElementById('recent-transactions-body').innerHTML = `
        <tr class="loading-row">
            <td colspan="5">Loading recent transactions...</td>
        </tr>
    `;

    document.getElementById('low-stock-body').innerHTML = `
        <tr class="loading-row">
            <td colspan="4">Loading inventory data...</td>
        </tr>
    `;
}

// Show error state
function showErrorState(errorMessage) {
    // Display error message in metrics
    document.getElementById('total-sales-value').textContent = 'Error';
    document.getElementById('orders-count').textContent = 'Error';
    document.getElementById('average-order').textContent = 'Error';

    // Display error in tables
    document.getElementById('recent-transactions-body').innerHTML = `
        <tr class="loading-row">
            <td colspan="5">${errorMessage}</td>
        </tr>
    `;

    document.getElementById('low-stock-body').innerHTML = `
        <tr class="loading-row">
            <td colspan="4">${errorMessage}</td>
        </tr>
    `;
}

// Fetch sales data from Firestore
async function fetchSalesData() {
    const salesRef = collection(db, 'sales');
    let salesQuery;

    // Create query based on selected time period
    const today = getTodayIST();
    const currentDate = new Date();

    switch (currentPeriod) {
        case 'day':
            // Get today's sales
            salesQuery = query(
                salesRef,
                where('date', '==', today),
                orderBy('timestamp', 'desc')
            );
            break;

        case 'week':
            // Get last 7 days sales
            const weekStartDate = new Date(currentDate);
            weekStartDate.setDate(currentDate.getDate() - 7);
            const weekStart = formatDateForFirestore(weekStartDate);

            salesQuery = query(
                salesRef,
                where('date', '>=', weekStart),
                where('date', '<=', today),
                orderBy('date', 'desc'),
                orderBy('timestamp', 'desc')
            );
            break;

        case 'month':
            // Get current month sales
            const monthStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const monthStart = formatDateForFirestore(monthStartDate);

            salesQuery = query(
                salesRef,
                where('date', '>=', monthStart),
                where('date', '<=', today),
                orderBy('date', 'desc'),
                orderBy('timestamp', 'desc')
            );
            break;

        case 'year':
            // Get current year sales
            const yearStartDate = new Date(currentDate.getFullYear(), 0, 1);
            const yearStart = formatDateForFirestore(yearStartDate);

            salesQuery = query(
                salesRef,
                where('date', '>=', yearStart),
                where('date', '<=', today),
                orderBy('date', 'desc'),
                orderBy('timestamp', 'desc')
            );
            break;

        default:
            // Fallback to today's sales
            salesQuery = query(
                salesRef,
                where('date', '==', today),
                orderBy('timestamp', 'desc')
            );
    }

    const snapshot = await getDocs(salesQuery);
    salesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

// Fetch inventory data from Realtime Database
async function fetchInventoryData() {
    if (!rtdb) {
        console.error('Realtime Database not initialized');
        return;
    }

    try {
        // Fetch products from Firestore
        const productsRef = collection(db, 'products');
        const productsSnapshot = await getDocs(productsRef);
        const products = productsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Fetch inventory data from Realtime Database
        const inventoryRef = ref(rtdb, 'inventory');
        const inventorySnapshot = await get(inventoryRef);

        if (inventorySnapshot.exists()) {
            const inventoryEntries = inventorySnapshot.val();

            // Combine product and inventory data
            inventoryData = products.map(product => {
                const inventoryEntry = inventoryEntries[product.id] || { quantity: 0, lastUpdated: Date.now() };
                return {
                    ...product,
                    stockQuantity: inventoryEntry.quantity,
                    lastUpdated: inventoryEntry.lastUpdated,
                    status: getStockStatus(inventoryEntry.quantity)
                };
            });
        } else {
            inventoryData = products.map(product => ({
                ...product,
                stockQuantity: 0,
                lastUpdated: Date.now(),
                status: 'out-of-stock'
            }));
        }
    } catch (error) {
        console.error('Error fetching inventory data:', error);
        inventoryData = [];
    }
}

// Determine stock status based on quantity
function getStockStatus(quantity) {
    if (quantity <= 0) return 'out-of-stock';
    if (quantity <= 5) return 'low-stock';
    return 'in-stock';
}

// Format date for Firestore queries (YYYY-MM-DD)
function formatDateForFirestore(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Update sales metrics on dashboard
function updateSalesMetrics() {
    if (salesData.length === 0) {
        // No sales for the selected period
        document.getElementById('total-sales-value').textContent = '₹0';
        document.getElementById('orders-count').textContent = '0';
        document.getElementById('average-order').textContent = '₹0';
    } else {
        // Calculate total sales amount
        const totalSales = salesData.reduce((sum, sale) => sum + sale.totalAmount, 0);

        // Calculate average order value
        const averageOrder = totalSales / salesData.length;

        // Update DOM elements
        document.getElementById('total-sales-value').textContent = `₹${totalSales.toFixed(2)}`;
        document.getElementById('orders-count').textContent = salesData.length;
        document.getElementById('average-order').textContent = `₹${averageOrder.toFixed(2)}`;
    }

    // Update low stock count
    const lowStockItems = inventoryData.filter(item =>
        item.status === 'low-stock' || item.status === 'out-of-stock'
    );
    document.getElementById('low-stock-count').textContent = lowStockItems.length;
}

// Update charts with sales data
function updateCharts() {
    updateRevenueChart();
    updateProductsChart();
}

// Helper function to truncate product names if they're too long
function truncateText(text, maxLength = 15) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Update revenue chart
function updateRevenueChart() {
    // Prepare data for revenue chart
    let chartLabels = [];
    let chartData = [];

    // Group sales by date
    const salesByDate = {};

    if (salesData.length > 0) {
        // Sort sales by date (oldest first)
        const sortedSales = [...salesData].sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
        });

        // Group sales by date
        sortedSales.forEach(sale => {
            if (!salesByDate[sale.date]) {
                salesByDate[sale.date] = 0;
            }
            salesByDate[sale.date] += sale.totalAmount;
        });

        // Create arrays for chart
        chartLabels = Object.keys(salesByDate);
        chartData = Object.values(salesByDate);

        // Limit to last 7 dates if we have more than 7 points
        if (chartLabels.length > 7) {
            chartLabels = chartLabels.slice(-7);
            chartData = chartData.slice(-7);
        }

        // Format date labels for better readability
        chartLabels = chartLabels.map(date => {
            // Convert YYYY-MM-DD to DD/MM
            const parts = date.split('-');
            return `${parts[2]}/${parts[1]}`;
        });
    }

    // Get chart context
    const chartCanvas = document.getElementById('revenue-chart');

    // Destroy existing chart if it exists
    if (revenueChart) {
        revenueChart.destroy();
    }

    // Create new chart
    revenueChart = new Chart(chartCanvas, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Revenue',
                data: chartData,
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                borderColor: '#4CAF50',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#4CAF50',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return '₹' + value;
                        }
                    },
                    grid: {
                        drawBorder: false,
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return '₹' + context.parsed.y;
                        }
                    }
                },
                legend: {
                    display: false
                }
            },
            animation: {
                duration: 1000
            },
            layout: {
                padding: {
                    left: 10,
                    right: 10,
                    top: 20,
                    bottom: 10
                }
            }
        }
    });
}

// Update top products chart
function updateProductsChart() {
    // Prepare data for products chart
    let productNames = [];
    let productSales = [];

    if (salesData.length > 0) {
        // Count product sales
        const productCounts = {};

        // Count occurrences of each product
        salesData.forEach(sale => {
            sale.items.forEach(item => {
                if (!productCounts[item.name]) {
                    productCounts[item.name] = 0;
                }
                productCounts[item.name] += item.quantity;
            });
        });

        // Sort products by sales count
        const sortedProducts = Object.entries(productCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Get top 5 products

        // Create arrays for chart
        productNames = sortedProducts.map(product => truncateText(product[0]));
        productSales = sortedProducts.map(product => product[1]);
    }

    // Get chart context
    const chartCanvas = document.getElementById('products-chart');

    // Destroy existing chart if it exists
    if (productsChart) {
        productsChart.destroy();
    }

    // Create new chart
    productsChart = new Chart(chartCanvas, {
        type: 'bar',
        data: {
            labels: productNames,
            datasets: [{
                label: 'Units Sold',
                data: productSales,
                backgroundColor: [
                    '#4CAF50',
                    '#2196F3',
                    '#FF9800',
                    '#9C27B0',
                    '#F44336'
                ],
                borderWidth: 0,
                maxBarThickness: 35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        precision: 0
                    },
                    grid: {
                        drawBorder: false,
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    displayColors: false,
                    callbacks: {
                        title: function (context) {
                            return context[0].label;
                        },
                        label: function (context) {
                            return 'Units Sold: ' + context.raw;
                        }
                    }
                }
            },
            animation: {
                duration: 1000
            },
            layout: {
                padding: {
                    left: 10,
                    right: 10,
                    top: 20,
                    bottom: 10
                }
            }
        }
    });
}

// Update recent transactions table
function updateRecentTransactions() {
    const transactionsContainer = document.getElementById('recent-transactions-body');

    if (salesData.length === 0) {
        transactionsContainer.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center;">No transactions found</td>
            </tr>
        `;
        return;
    }

    // Get the 5 most recent transactions
    const recentTransactions = salesData.slice(0, 5);

    let html = '';
    recentTransactions.forEach(transaction => {
        html += `
            <tr>
                <td>${transaction.orderNo}</td>
                <td>${transaction.date} ${transaction.time}</td>
                <td>${transaction.items.map(item => `${item.name} x${item.quantity}`).join(', ')}</td>
                <td>₹${transaction.totalAmount.toFixed(2)}</td>
                <td>${transaction.paymentMethod}</td>
            </tr>
        `;
    });

    transactionsContainer.innerHTML = html;
}

// Update low stock alerts table
function updateLowStockAlerts() {
    const lowStockContainer = document.getElementById('low-stock-body');

    // Filter items with low or out of stock
    const lowStockItems = inventoryData.filter(item =>
        item.status === 'low-stock' || item.status === 'out-of-stock'
    );

    if (lowStockItems.length === 0) {
        lowStockContainer.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center;">No low stock items</td>
            </tr>
        `;
        return;
    }

    let html = '';
    lowStockItems.forEach(item => {
        const statusClass =
            item.status === 'out-of-stock' ? 'status-out-of-stock' :
                item.status === 'low-stock' ? 'status-low-stock' : 'status-in-stock';

        const statusText =
            item.status === 'out-of-stock' ? 'Out of Stock' :
                item.status === 'low-stock' ? 'Low Stock' : 'In Stock';

        html += `
            <tr>
                <td>${item.name}</td>
                <td>${item.stockQuantity}</td>
                <td><span class="status ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="action-btn" onclick="window.location.href='inventory.html'">
                        Update
                    </button>
                </td>
            </tr>
        `;
    });

    lowStockContainer.innerHTML = html;
}

// Helper function to format date
function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

// Make some functions globally available
window.loadDashboardData = loadDashboardData; 