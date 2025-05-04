// Import Firebase modules 
import { db, rtdb } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    ref,
    set,
    get,
    remove,
    push,
    onValue,
    query,
    orderByChild,
    child
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Global Variables
let allProducts = [];
let currentInventoryData = {};
let inventoryList;
let historyList;
let searchBar;
let currentFilter = 'all'; // Track the current active filter
const LOW_STOCK_THRESHOLD = 5;

// DOM Elements
const productSelect = document.getElementById('product-select');
const currentStockInput = document.getElementById('current-stock');
const stockQuantityInput = document.getElementById('stock-quantity');
const stockOperationSelect = document.getElementById('stock-operation');
const stockNotesInput = document.getElementById('stock-notes');
const saveInventoryBtn = document.getElementById('save-inventory');
const resetFormBtn = document.getElementById('reset-form');
const confirmModal = document.getElementById('confirm-modal');
const closeModalBtn = document.querySelector('.close-btn');
const modalMessage = document.getElementById('modal-message');
const modalConfirmBtn = document.getElementById('modal-confirm');
const modalCancelBtn = document.getElementById('modal-cancel');
const inventoryForm = document.getElementById('inventory-form');
const editIdInput = document.getElementById('edit-id');

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded, initializing inventory system...');
    initInventorySystem();
});

// Initialize the inventory system
async function initInventorySystem() {
    try {
        console.log('Initializing inventory system...');
        inventoryList = document.getElementById('inventory-list');
        historyList = document.getElementById('history-list');

        if (!inventoryList || !historyList) {
            throw new Error('Required DOM elements not found');
        }

        // Load products first
        await loadProducts();

        // Initialize inventory records for all products
        await initializeInventory();

        // Then load inventory data and history
        await loadInventoryData();
        await loadInventoryHistory();

        // Set up event listeners
        setupEventListeners();

        // Initialize the search component after data is loaded
        initSearchComponent();

        console.log('Inventory system initialized successfully');
    } catch (error) {
        console.error('Error initializing inventory system:', error);
        showNotification('Failed to initialize inventory system', 'error');
    }
}

// Load products from Firestore
async function loadProducts() {
    try {
        const productsRef = collection(db, "products");
        const snapshot = await getDocs(productsRef);

        if (snapshot.empty) {
            showNotification('No products found. Please add products first.', 'warning');
            return;
        }

        // Clear previous options except the default one
        while (productSelect.options.length > 1) {
            productSelect.remove(1);
        }

        allProducts = [];
        snapshot.forEach(doc => {
            const product = doc.data();
            product.id = doc.id;
            allProducts.push(product);

            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = product.name;
            productSelect.appendChild(option);
        });

        console.log(`✅ Loaded ${allProducts.length} products`);

    } catch (error) {
        console.error('Error loading products:', error);
        showNotification('Failed to load products', 'error');
    }
}

// Load inventory data from Realtime Database
async function loadInventoryData() {
    try {
        console.log('Creating reference to inventory in RTDB...');
        const inventoryRef = ref(rtdb, 'inventory');

        // Listen for real-time updates
        onValue(inventoryRef, (snapshot) => {
            console.log('Received inventory update from Firebase');
            const data = snapshot.val() || {};

            // Store a reference to the full inventory data for filtering
            currentInventoryData = data;

            // Render the inventory table with current filter
            renderInventoryTable(data);
        }, (error) => {
            console.error('Error in onValue listener:', error);
        });

    } catch (error) {
        console.error('Error loading inventory data:', error);
        showNotification('Failed to load inventory data', 'error');
    }
}

// Load inventory history from Realtime Database - Last 3 months only
async function loadInventoryHistory() {
    try {
        // Calculate date 3 months ago
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const threeMonthsAgoTimestamp = threeMonthsAgo.getTime();

        console.log(`Filtering inventory history since: ${threeMonthsAgo.toLocaleDateString()}`);

        // The database query still gets all data - we'll filter in the render function
        // since Firebase Realtime Database doesn't support server-side filtering by value comparison
        const historyRef = query(ref(rtdb, 'inventory_history'), orderByChild('timestamp'));

        // Listen for real-time updates
        onValue(historyRef, (snapshot) => {
            const data = snapshot.val() || {};
            renderHistoryTable(data, threeMonthsAgoTimestamp);
        }, (error) => {
            console.error('Error in history onValue listener:', error);
        });

    } catch (error) {
        console.error('Error loading inventory history:', error);
        showNotification('Failed to load inventory history', 'error');
    }
}

// Render inventory table with filtering
function renderInventoryTable(data) {
    // Clear loading message
    inventoryList.innerHTML = '';

    if (!data || Object.keys(data).length === 0) {
        inventoryList.innerHTML = `
            <tr>
                <td colspan="6" class="no-data">No inventory data available</td>
            </tr>
        `;

        // Update search data with empty array
        if (searchBar) {
            searchBar.setData([]);
        }

        return;
    }

    // Get inventory history data for each product
    get(ref(rtdb, 'inventory_history')).then(historySnapshot => {
        const historyData = historySnapshot.val() || {};

        // Process and render inventory items with history data
        renderInventoryWithHistory(data, historyData);
    }).catch(error => {
        console.error('Error getting inventory history:', error);

        // If we can't get history data, render without it
        renderInventoryWithHistory(data, {});
    });
}

// Helper function to render inventory with history data
function renderInventoryWithHistory(inventoryData, historyData) {
    // Convert to array of entries
    let filteredItems = Object.entries(inventoryData);

    // Prepare search data
    const searchData = [];

    // Process and filter items
    filteredItems.forEach(([productId, item]) => {
        const product = allProducts.find(p => p.id === productId) || { name: 'Unknown Product' };
        const lastUpdated = new Date(item.lastUpdated).toLocaleString();

        // Determine stock status
        let status = 'in-stock';
        let statusClass = 'status-in-stock';
        let statusText = 'In Stock';

        if (item.quantity <= 0) {
            status = 'out-of-stock';
            statusClass = 'status-out-of-stock';
            statusText = 'Out of Stock';
        } else if (item.quantity <= LOW_STOCK_THRESHOLD) {
            status = 'low-stock';
            statusClass = 'status-low-stock';
            statusText = 'Low Stock';
        }

        // Add to search data regardless of filter
        searchData.push({
            id: productId,
            name: product.name,
            quantity: item.quantity,
            status: status,
            lastUpdated: lastUpdated
        });
    });

    // Apply current filter (if not 'all')
    if (currentFilter !== 'all') {
        filteredItems = filteredItems.filter(([productId, item]) => {
            if (currentFilter === 'in-stock') {
                return item.quantity > LOW_STOCK_THRESHOLD;
            } else if (currentFilter === 'low-stock') {
                return item.quantity > 0 && item.quantity <= LOW_STOCK_THRESHOLD;
            } else if (currentFilter === 'out-of-stock') {
                return item.quantity <= 0;
            }
            return true;
        });
    }

    // Sort items by product name
    filteredItems.sort(([idA, itemA], [idB, itemB]) => {
        const productA = allProducts.find(p => p.id === idA) || { name: 'Unknown Product' };
        const productB = allProducts.find(p => p.id === idB) || { name: 'Unknown Product' };
        return productA.name.localeCompare(productB.name);
    });

    // Show message if no items match the filter
    if (filteredItems.length === 0) {
        inventoryList.innerHTML = `
            <tr>
                <td colspan="6" class="no-data">No ${currentFilter.replace('-', ' ')} items found</td>
            </tr>
        `;

        // Update search data to keep it complete for searching
        if (searchBar) {
            searchBar.setData(searchData);
        }

        return;
    }

    // Render each inventory item that matches the filter
    filteredItems.forEach(([productId, item]) => {
        const product = allProducts.find(p => p.id === productId) || { name: 'Unknown Product' };
        const lastUpdated = new Date(item.lastUpdated).toLocaleString();

        // Determine stock status
        let statusClass = 'status-in-stock';
        let statusText = 'In Stock';

        if (item.quantity <= 0) {
            statusClass = 'status-out-of-stock';
            statusText = 'Out of Stock';
        } else if (item.quantity <= LOW_STOCK_THRESHOLD) {
            statusClass = 'status-low-stock';
            statusText = 'Low Stock';
        }

        // Find the last operation for this product
        let lastOperation = { operation: 'None', quantity: 0, timestamp: 0 };

        // Convert history data to array and filter for this product
        const productHistory = Object.values(historyData)
            .filter(entry => entry.productId === productId)
            .sort((a, b) => b.timestamp - a.timestamp);

        if (productHistory.length > 0) {
            lastOperation = productHistory[0]; // Most recent history entry
        }

        // Format the last operation text
        let operationText = '-';
        if (lastOperation.operation) {
            const opDate = new Date(lastOperation.timestamp).toLocaleDateString();
            if (lastOperation.operation === 'add') {
                operationText = `<span style="color: green">Added ${lastOperation.quantity} on ${opDate}</span>`;
            } else if (lastOperation.operation === 'remove') {
                operationText = `<span style="color: red">Removed ${lastOperation.quantity} on ${opDate}</span>`;
            } else if (lastOperation.operation === 'delete') {
                operationText = `<span style="color: red">Deleted on ${opDate}</span>`;
            } else if (lastOperation.operation === 'create') {
                operationText = `<span style="color: blue">Created on ${opDate}</span>`;
            }
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.name}</td>
            <td>${item.quantity}</td>
            <td>${operationText}</td>
            <td>${lastUpdated}</td>
            <td><span class="status ${statusClass}">${statusText}</span></td>
            <td>
                <div class="row-actions">
                    <button class="edit-btn" data-id="${productId}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="delete-btn" data-id="${productId}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        `;

        inventoryList.appendChild(row);
    });

    // Update search component with all data (not just filtered)
    if (searchBar) {
        searchBar.setData(searchData);
    }

    // Add event listeners to the buttons
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', () => {
            const productId = button.getAttribute('data-id');
            editInventoryItem(productId);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', () => {
            const productId = button.getAttribute('data-id');
            confirmDeleteInventoryItem(productId);
        });
    });
}

// Render history table - Filtered for last 3 months
function renderHistoryTable(data, threeMonthsAgoTimestamp) {
    // Clear loading message
    historyList.innerHTML = '';

    if (!data) {
        historyList.innerHTML = `
            <tr>
                <td colspan="4" class="no-data">No history data available</td>
            </tr>
        `;
        return;
    }

    // Convert object to array
    let historyArray = Object.values(data);

    // Filter to include only entries from the last 3 months
    historyArray = historyArray.filter(entry => entry.timestamp >= threeMonthsAgoTimestamp);

    // Sort by timestamp (newest first)
    historyArray.sort((a, b) => b.timestamp - a.timestamp);

    if (historyArray.length === 0) {
        historyList.innerHTML = `
            <tr>
                <td colspan="4" class="no-data">No history data available for the last 3 months</td>
            </tr>
        `;
        return;
    }

    // Render each history entry
    historyArray.forEach(entry => {
        const product = allProducts.find(p => p.id === entry.productId) || { name: 'Unknown Product' };
        const dateTime = new Date(entry.timestamp).toLocaleString();

        // Format the change amount
        let changeText = '';
        if (entry.operation === 'add') {
            changeText = `<span style="color: green">+${entry.quantity}</span>`;
        } else if (entry.operation === 'remove') {
            changeText = `<span style="color: red">-${entry.quantity}</span>`;
        } else if (entry.operation === 'delete') {
            changeText = `<span style="color: red">Deleted</span>`;
        } else if (entry.operation === 'create') {
            changeText = `<span style="color: blue">Initial: ${entry.quantity}</span>`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${dateTime}</td>
            <td>${product.name}</td>
            <td>${changeText}</td>
            <td>${entry.notes || '-'}</td>
        `;

        historyList.appendChild(row);
    });
}

// Set up event listeners for the page
function setupEventListeners() {
    // Inventory form submission
    if (inventoryForm) {
        inventoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveInventoryUpdate();
        });
    }

    // Reset form button
    if (resetFormBtn) {
        resetFormBtn.addEventListener('click', resetForm);
    }

    // Product selection change
    if (productSelect) {
        productSelect.addEventListener('change', () => {
            const selectedProductId = productSelect.value;
            if (selectedProductId) {
                updateCurrentStockDisplay(selectedProductId);
            } else {
                currentStockInput.value = '';
            }
        });
    }

    // Modal close button
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }

    // Modal cancel button
    const cancelModalBtn = document.getElementById('modal-cancel');
    if (cancelModalBtn) {
        cancelModalBtn.addEventListener('click', closeModal);
    }

    // Quick filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');

    if (filterButtons.length > 0) {
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Update active button style
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Update current filter and re-render table
                currentFilter = button.getAttribute('data-filter');
                console.log(`Applied filter: ${currentFilter}`);

                // Re-render inventory with the new filter
                renderInventoryTable(currentInventoryData);
            });
        });
    }
}

// Update current stock display
function updateCurrentStockDisplay(productId) {
    const inventoryItem = currentInventoryData[productId];
    currentStockInput.value = inventoryItem ? inventoryItem.quantity : 0;
}

// Save inventory update
async function saveInventoryUpdate() {
    const productId = productSelect.value;
    const quantity = parseInt(stockQuantityInput.value);
    const operation = stockOperationSelect.value;
    const notes = stockNotesInput.value.trim();

    console.log(`Updating inventory for product ${productId}:`, {
        quantity,
        operation,
        notes
    });

    if (!productId) {
        showNotification('Please select a product', 'error');
        return;
    }

    if (isNaN(quantity) || quantity <= 0) {
        showNotification('Please enter a valid quantity', 'error');
        return;
    }

    try {
        // Get path to inventory item in Realtime Database
        const inventoryRef = ref(rtdb, `inventory/${productId}`);

        // Get current inventory data
        console.log(`Getting current inventory data for ${productId}...`);
        const snapshot = await get(inventoryRef);

        if (!snapshot.exists()) {
            console.log(`No inventory data found for ${productId}, creating new entry`);
        }

        const currentData = snapshot.val() || { quantity: 0, lastUpdated: Date.now() };
        console.log(`Current quantity: ${currentData.quantity}`);

        // Calculate new quantity
        let newQuantity = currentData.quantity;
        if (operation === 'add') {
            newQuantity += quantity;
            console.log(`Adding ${quantity}, new quantity will be: ${newQuantity}`);
        } else if (operation === 'remove') {
            newQuantity = Math.max(0, newQuantity - quantity);
            console.log(`Removing ${quantity}, new quantity will be: ${newQuantity}`);
        }

        // Update inventory
        console.log(`Setting new quantity to ${newQuantity}`);
        await set(inventoryRef, {
            quantity: newQuantity,
            lastUpdated: Date.now()
        });

        // Add to history
        const historyRef = ref(rtdb, 'inventory_history');
        const historyEntry = {
            productId,
            operation,
            quantity,
            notes,
            timestamp: Date.now()
        };

        console.log('Adding history entry:', historyEntry);
        await push(historyRef, historyEntry);

        showNotification(`Inventory updated successfully! New quantity: ${newQuantity}`, 'success');
        resetForm();

    } catch (error) {
        console.error('Error updating inventory:', error);
        showNotification(`Failed to update inventory: ${error.message}`, 'error');
    }
}

// Edit inventory item
function editInventoryItem(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        showNotification('Product not found', 'error');
        return;
    }

    // Set form fields
    productSelect.value = productId;
    updateCurrentStockDisplay(productId);
    stockQuantityInput.value = '';
    stockNotesInput.value = '';

    // Scroll to form
    inventoryForm.scrollIntoView({ behavior: 'smooth' });
}

// Confirm delete inventory item
function confirmDeleteInventoryItem(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        showNotification('Product not found', 'error');
        return;
    }

    modalMessage.textContent = `Are you sure you want to delete inventory for "${product.name}"?`;

    // Setup confirm action
    modalConfirmBtn.onclick = () => {
        deleteInventoryItem(productId);
        closeModal();
    };

    // Show modal
    confirmModal.classList.add('show');
}

// Delete inventory item
async function deleteInventoryItem(productId) {
    try {
        const inventoryRef = ref(rtdb, `inventory/${productId}`);
        const historyRef = ref(rtdb, 'inventory_history');

        // Get current inventory data for history
        const snapshot = await get(inventoryRef);
        const currentData = snapshot.val() || { quantity: 0 };

        // Add to history
        const historyEntry = {
            productId,
            operation: 'delete',
            quantity: currentData.quantity,
            notes: 'Inventory item deleted',
            timestamp: Date.now()
        };

        await push(historyRef, historyEntry);

        // Delete inventory entry
        await remove(inventoryRef);

        showNotification('Inventory item deleted successfully', 'success');

    } catch (error) {
        console.error('Error deleting inventory item:', error);
        showNotification('Failed to delete inventory item', 'error');
    }
}

// Reset form
function resetForm() {
    productSelect.value = '';
    currentStockInput.value = '';
    stockQuantityInput.value = '';
    stockOperationSelect.value = 'add';
    stockNotesInput.value = '';
    editIdInput.value = '';
}

// Close modal
function closeModal() {
    confirmModal.classList.remove('show');
}

// Show notification
function showNotification(message, type = 'info') {
    // For now just use alert, but you could enhance this with a toast notification system
    alert(message);
}

// Initialize inventory entries for all products
async function initializeInventory() {
    try {
        // Reference to the inventory path in Realtime Database
        const inventoryRef = ref(rtdb, 'inventory');

        // Get current inventory data
        const snapshot = await get(inventoryRef);
        const existingInventory = snapshot.val() || {};

        // Initialize inventory for products that don't have inventory records
        for (const product of allProducts) {
            if (!existingInventory[product.id]) {
                console.log(`Initializing inventory for ${product.name}`);

                // Create timestamp
                const now = new Date().toISOString();

                // Set inventory with default values
                await set(child(inventoryRef, product.id), {
                    quantity: 0,
                    lastUpdated: now
                });

                // Add to history log
                const historyRef = push(ref(rtdb, 'inventory_history'));
                await set(historyRef, {
                    productId: product.id,
                    quantity: 0,
                    operation: 'create',
                    notes: 'Initial inventory entry',
                    timestamp: Date.now()
                });
            }
        }

        console.log('Inventory initialization complete');
    } catch (error) {
        console.error('Error initializing inventory:', error);
        showNotification('Failed to initialize inventory', 'error');
    }
}

// Export functions for global access
window.editInventoryItem = editInventoryItem;
window.confirmDeleteInventoryItem = confirmDeleteInventoryItem;

// Initialize the search component
function initSearchComponent() {
    try {
        // Check if the search container exists
        const searchContainer = document.getElementById('inventory-search-container');
        if (!searchContainer) {
            console.warn('Search container not found in DOM');
            return;
        }

        // Create search bar instance
        searchBar = new SearchBar({
            container: searchContainer,
            placeholder: 'Search products by name or status...',
            options: [
                { label: 'Product Name', value: 'name', active: true },
                { label: 'Stock Status', value: 'status' }
            ],
            onSearch: function (query, filter, results) {
                console.log(`Search: '${query}' in ${filter}, found ${results.length} results`);

                // If a result is clicked, highlight it in the table
                return function (selectedItem) {
                    if (selectedItem && selectedItem.id) {
                        // If we have a filter active other than 'all', we need to temporarily
                        // switch to 'all' to ensure the selected item is visible
                        const needToResetFilter = currentFilter !== 'all';

                        if (needToResetFilter) {
                            // Set the filter to 'all' and update UI
                            currentFilter = 'all';
                            document.querySelectorAll('.filter-btn').forEach(btn => {
                                btn.classList.remove('active');
                                if (btn.getAttribute('data-filter') === 'all') {
                                    btn.classList.add('active');
                                }
                            });

                            // Re-render with all items
                            renderInventoryTable(currentInventoryData);
                        }

                        // Find and highlight the row
                        setTimeout(() => {
                            const rows = document.querySelectorAll('#inventory-list tr');
                            for (const row of rows) {
                                const editBtn = row.querySelector('.edit-btn');
                                if (editBtn && editBtn.getAttribute('data-id') === selectedItem.id) {
                                    // Remove highlight from any previously highlighted row
                                    document.querySelectorAll('.highlight-row').forEach(el => {
                                        el.classList.remove('highlight-row');
                                    });

                                    // Add highlight to this row and scroll to it
                                    row.classList.add('highlight-row');
                                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    break;
                                }
                            }
                        }, 100);
                    }
                };
            },
            getItemHTML: function (item) {
                // Return custom HTML for search result items
                let statusLabel = '';

                if (item.status === 'in-stock') {
                    statusLabel = '<span class="in-stock">In Stock</span>';
                } else if (item.status === 'low-stock') {
                    statusLabel = '<span class="low-stock">Low Stock</span>';
                } else if (item.status === 'out-of-stock') {
                    statusLabel = '<span class="out-of-stock">Out of Stock</span>';
                }

                return `
                    <h3>${item.name}</h3>
                    <div class="price">Quantity: ${item.quantity}</div>
                    <div class="result-status">${statusLabel}</div>
                `;
            }
        });

        console.log('Search component initialized successfully');
    } catch (error) {
        console.error('Error initializing search component:', error);
    }
} 