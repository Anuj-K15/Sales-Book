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
    orderByChild
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Global Variables
let allProducts = [];
let currentInventoryData = {};
const LOW_STOCK_THRESHOLD = 5;

// DOM Elements
const productSelect = document.getElementById('product-select');
const currentStockInput = document.getElementById('current-stock');
const stockQuantityInput = document.getElementById('stock-quantity');
const stockOperationSelect = document.getElementById('stock-operation');
const stockNotesInput = document.getElementById('stock-notes');
const saveInventoryBtn = document.getElementById('save-inventory');
const resetFormBtn = document.getElementById('reset-form');
const inventoryList = document.getElementById('inventory-list');
const historyList = document.getElementById('history-list');
const confirmModal = document.getElementById('confirm-modal');
const closeModalBtn = document.querySelector('.close-btn');
const modalMessage = document.getElementById('modal-message');
const modalConfirmBtn = document.getElementById('modal-confirm');
const modalCancelBtn = document.getElementById('modal-cancel');
const inventoryForm = document.getElementById('inventory-form');
const editIdInput = document.getElementById('edit-id');

// Search bar component instance
let searchBar;

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded, initializing inventory system...');
    initInventorySystem();
    setupEventListeners();
});

// Initialize the inventory system
async function initInventorySystem() {
    try {
        console.log('Loading products...');
        await loadProducts();
        console.log('Loading inventory data...');
        await loadInventoryData();
        console.log('Loading inventory history...');
        await loadInventoryHistory();
        console.log('Initializing search component...');
        await initializeInventory(); // Make sure inventory exists for all products
        initSearchComponent();
    } catch (error) {
        console.error('Error initializing inventory system:', error);
        showNotification('An error occurred while initializing the inventory system', 'error');
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
            currentInventoryData = data;
            renderInventoryTable(data);
        }, (error) => {
            console.error('Error in onValue listener:', error);
        });

    } catch (error) {
        console.error('Error loading inventory data:', error);
        showNotification('Failed to load inventory data', 'error');
    }
}

// Load inventory history from Realtime Database
async function loadInventoryHistory() {
    try {
        const historyRef = query(ref(rtdb, 'inventory_history'), orderByChild('timestamp'));

        // Listen for real-time updates
        onValue(historyRef, (snapshot) => {
            const data = snapshot.val() || {};
            renderHistoryTable(data);
        }, (error) => {
            console.error('Error in history onValue listener:', error);
        });

    } catch (error) {
        console.error('Error loading inventory history:', error);
        showNotification('Failed to load inventory history', 'error');
    }
}

// Render inventory table
function renderInventoryTable(data) {
    // Clear loading message
    inventoryList.innerHTML = '';

    if (Object.keys(data).length === 0) {
        inventoryList.innerHTML = `
            <tr>
                <td colspan="5" class="no-data">No inventory data available</td>
            </tr>
        `;

        // Update search data with empty array
        if (searchBar) {
            searchBar.setData([]);
        }

        return;
    }

    // We're now using the search bar component instead of separate inputs
    // Get search term and filter from search bar if it exists
    let searchTerm = '';
    let statusFilter = 'all';

    let filteredItems = Object.entries(data);

    // Prepare new search data
    const searchData = [];

    if (filteredItems.length === 0) {
        inventoryList.innerHTML = `
            <tr>
                <td colspan="5" class="no-data">No matching inventory items found</td>
            </tr>
        `;

        // Update search data with empty array
        if (searchBar) {
            searchBar.setData([]);
        }

        return;
    }

    // Sort items by product name
    filteredItems.sort(([idA, itemA], [idB, itemB]) => {
        const productA = allProducts.find(p => p.id === idA) || { name: 'Unknown Product' };
        const productB = allProducts.find(p => p.id === idB) || { name: 'Unknown Product' };
        return productA.name.localeCompare(productB.name);
    });

    // Render each inventory item
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

        // Add to search data
        searchData.push({
            id: productId,
            name: product.name,
            quantity: item.quantity,
            status: item.quantity <= 0 ? 'out-of-stock' : (item.quantity <= LOW_STOCK_THRESHOLD ? 'low-stock' : 'in-stock'),
            lastUpdated: lastUpdated
        });

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.name}</td>
            <td>${item.quantity}</td>
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

    // Update search component with new data if it exists
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

// Render history table
function renderHistoryTable(data) {
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

    // Convert object to array and sort by timestamp (newest first)
    const historyArray = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);

    if (historyArray.length === 0) {
        historyList.innerHTML = `
            <tr>
                <td colspan="4" class="no-data">No history data available</td>
            </tr>
        `;
        return;
    }

    // Take only the latest 20 entries
    const recentHistory = historyArray.slice(0, 20);

    // Render each history entry
    recentHistory.forEach(entry => {
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

// Setup event listeners
function setupEventListeners() {
    // Product selection change
    productSelect.addEventListener('change', () => {
        const productId = productSelect.value;
        if (productId) {
            updateCurrentStockDisplay(productId);
        } else {
            currentStockInput.value = '';
        }
    });

    // Form submission
    inventoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveInventoryUpdate();
    });

    // Form reset
    resetFormBtn.addEventListener('click', resetForm);

    // Modal events
    closeModalBtn.addEventListener('click', closeModal);
    modalCancelBtn.addEventListener('click', closeModal);

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            closeModal();
        }
    });
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

// Initialize any inventory item that doesn't exist
async function initializeInventory() {
    try {
        console.log('Initializing inventory for all products...');
        // For each product, ensure an inventory entry exists
        for (const product of allProducts) {
            const inventoryRef = ref(rtdb, `inventory/${product.id}`);
            const snapshot = await get(inventoryRef);

            // If no inventory entry exists, create one
            if (!snapshot.exists()) {
                console.log(`Creating initial inventory entry for ${product.name} (${product.id})`);
                await set(inventoryRef, {
                    quantity: 0,
                    lastUpdated: Date.now()
                });

                // Add to history
                const historyRef = ref(rtdb, 'inventory_history');
                await push(historyRef, {
                    productId: product.id,
                    operation: 'create',
                    quantity: 0,
                    notes: 'Initial inventory entry',
                    timestamp: Date.now()
                });
            }
        }
        console.log('✅ Inventory initialization complete');
    } catch (error) {
        console.error('Error initializing inventory:', error);
    }
}

// Export functions for global access
window.editInventoryItem = editInventoryItem;
window.confirmDeleteInventoryItem = confirmDeleteInventoryItem;

// New function to initialize the search component
function initSearchComponent() {
    try {
        // Format data for search component
        const searchData = [];

        // Process inventory data for search
        for (const [productId, item] of Object.entries(currentInventoryData)) {
            const product = allProducts.find(p => p.id === productId) || { name: 'Unknown Product' };

            searchData.push({
                id: productId,
                name: product.name,
                quantity: item.quantity,
                status: item.quantity <= 0 ? 'out-of-stock' : (item.quantity <= LOW_STOCK_THRESHOLD ? 'low-stock' : 'in-stock'),
                lastUpdated: new Date(item.lastUpdated).toLocaleString()
            });
        }

        // Initialize search component
        searchBar = new SearchBar({
            containerId: 'inventory-search-container',
            data: searchData,
            searchFields: ['name'],
            placeholder: 'Search inventory...',
            filterOptions: [
                { label: 'All', value: 'all' },
                { label: 'In Stock', value: 'in-stock' },
                { label: 'Low Stock', value: 'low-stock' },
                { label: 'Out of Stock', value: 'out-of-stock' }
            ],
            debounceTime: 250, // Slightly faster response for inventory search
            minChars: 2, // Start searching after 2 characters
            onResultClick: (item) => {
                // Highlight the row in the inventory table
                const rows = document.querySelectorAll('tr');
                for (const row of rows) {
                    if (row.textContent.includes(item.name)) {
                        row.scrollIntoView({ behavior: 'smooth' });
                        row.classList.add('highlight-row');
                        setTimeout(() => {
                            row.classList.remove('highlight-row');
                        }, 2000);

                        // Set the product in the form for editing
                        productSelect.value = item.id;
                        updateCurrentStockDisplay(item.id);
                        break;
                    }
                }
            }
        });

        console.log('Search component initialized successfully');
    } catch (error) {
        console.error('Error initializing search component:', error);
    }
} 