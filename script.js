// ✅ Define cart at the beginning to avoid "cart is not defined" error
let cart = [];
let orderCounter = 0;
// Current filter for products
let currentFilter = 'all';
// Store product data for filtering
let allProductsData = [];
let productsInventory = {};

// ✅ Import Firestore database
import { db, rtdb } from "./firebase-config.js";
import { loadSales } from "./sales-page.js"; // ✅ Import loadSales
import { collection, getDocs, addDoc, doc, runTransaction, query, orderBy, getDoc }
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, get, set, update, child, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ✅ Dynamically import `loadSales` if on sales.html
if (window.location.pathname.includes("sales.html")) {
    import("./sales-page.js")
        .then((module) => {
            module.loadSales(); // ✅ Call loadSales after importing
        })
        .catch((error) => {
            console.error("❌ Error loading sales-page.js:", error);
        });
}

// ✅ Function to Load Products
// ✅ Function to load products
async function loadProducts() {
    const beerList = document.getElementById("beer-list");
    if (!beerList) {
        console.warn("Beer list element not found. Not on the record page?");
        return;
    }

    try {
        beerList.innerHTML = "<div class='loading-message'>Loading products...</div>"; // ✅ Show loading message

        // Only fetch from Firestore if we don't have cached data
        if (allProductsData.length === 0) {
            const productsRef = collection(db, "products");
            const snapshot = await getDocs(productsRef);

            allProductsData = [];
            snapshot.forEach((doc) => {
                allProductsData.push({ id: doc.id, ...doc.data() });
            });

            // Fetch inventory data
            const productIds = allProductsData.map(p => p.id);
            productsInventory = await getInventoryData(productIds);

            console.log(`✅ Fetched ${allProductsData.length} products and inventory data`);
        }

        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        beerList.innerHTML = ""; // ✅ Clear loading message

        // Sort products by name
        const products = [...allProductsData];
        products.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        // Filter products based on current filter
        const filteredProducts = products.filter(product => {
            const inventory = productsInventory[product.id] || { quantity: 0 };
            const isOutOfStock = inventory.quantity <= 0;
            const isLowStock = inventory.quantity > 0 && inventory.quantity <= 5;

            if (currentFilter === 'in-stock') {
                return inventory.quantity > 5; // More than low stock threshold
            } else if (currentFilter === 'low-stock') {
                return isLowStock;
            } else if (currentFilter === 'out-of-stock') {
                return isOutOfStock;
            }
            return true; // 'all' filter
        });

        // Show message if no products match the filter
        if (filteredProducts.length === 0) {
            beerList.innerHTML = `<div class='loading-message'>No ${currentFilter.replace('-', ' ')} products found.</div>`;
            return;
        }

        // Render filtered products
        filteredProducts.forEach(product => {
            const inventory = productsInventory[product.id] || { quantity: 0 };
            const isOutOfStock = inventory.quantity <= 0;
            const isLowStock = inventory.quantity > 0 && inventory.quantity <= 5;

            // Create a beer card for each product
            const beerCard = document.createElement("div");
            beerCard.className = "beer-card";
            beerCard.dataset.id = product.id;
            beerCard.dataset.stock = inventory.quantity;

            // Create image container
            const imageContainer = document.createElement("div");
            imageContainer.className = "product-image-container";

            // Create product image
            const img = document.createElement("img");
            img.src = product.image || product.imageUrl || "https://via.placeholder.com/150?text=No+Image";
            img.alt = product.name;
            img.loading = "lazy"; // Lazy load for better performance

            // Create product info container
            const infoContainer = document.createElement("div");
            infoContainer.className = "product-info";

            // Create product name heading
            const productName = document.createElement("h3");
            productName.textContent = product.name;

            // Create product price paragraph
            const productPrice = document.createElement("p");
            productPrice.innerHTML = `₹${product.price.toFixed(2)}`;

            // Create inventory status element
            const statusElement = document.createElement("div");
            statusElement.className = `inventory-status ${isOutOfStock ? 'out-of-stock' : isLowStock ? 'low-stock' : ''}`;

            statusElement.textContent = isOutOfStock ?
                "Out of Stock" :
                isLowStock ?
                    `Low Stock: ${inventory.quantity}` :
                    `Stock: ${inventory.quantity} units`;

            // Create quantity controls
            const quantityInput = document.createElement("input");
            quantityInput.type = "number";
            quantityInput.min = "1";
            quantityInput.max = inventory.quantity.toString(); // Set max to available inventory
            quantityInput.value = "1";
            quantityInput.className = "quantity";
            if (isOutOfStock) quantityInput.disabled = true;

            // Add change event to enforce max quantity
            quantityInput.addEventListener('change', () => {
                const currentValue = parseInt(quantityInput.value);
                if (isNaN(currentValue) || currentValue < 1) {
                    quantityInput.value = "1";
                } else if (currentValue > inventory.quantity) {
                    quantityInput.value = inventory.quantity.toString();
                    if (typeof window.showNotification === 'function') {
                        window.showNotification(`Maximum available quantity: ${inventory.quantity}`, 'info');
                    }
                }
            });

            // Create add to cart button
            const addButton = document.createElement("button");
            addButton.innerHTML = isOutOfStock ? 'Out of Stock' : 'Add to Cart';
            addButton.disabled = isOutOfStock;
            addButton.onclick = () => addToCart(product.id, product.name, product.price, addButton);

            // Append all elements to the card
            imageContainer.appendChild(img);
            infoContainer.appendChild(productName);
            infoContainer.appendChild(productPrice);

            beerCard.appendChild(imageContainer);
            beerCard.appendChild(infoContainer);
            beerCard.appendChild(statusElement);
            beerCard.appendChild(quantityInput);
            beerCard.appendChild(addButton);

            // Add to fragment
            fragment.appendChild(beerCard);
        });

        // Append all cards at once for better performance
        beerList.appendChild(fragment);

        console.log(`✅ Displayed ${filteredProducts.length} products (filtered by: ${currentFilter})`);

    } catch (error) {
        console.error("❌ Error loading products:", error);
        beerList.innerHTML = "<div class='error-message'>Error loading products. Please refresh the page.</div>";
    }
}

// Function to get inventory data for products
async function getInventoryData(productIds) {
    try {
        const inventoryData = {};

        // If we're not working with Realtime Database yet, return empty data
        if (!rtdb) return inventoryData;

        // Get inventory data for each product
        for (const productId of productIds) {
            const inventoryRef = ref(rtdb, `inventory/${productId}`);
            const snapshot = await get(inventoryRef);
            if (snapshot.exists()) {
                inventoryData[productId] = snapshot.val();
            } else {
                // Initialize with 0 if not found
                inventoryData[productId] = { quantity: 0, lastUpdated: Date.now() };
            }
        }

        return inventoryData;
    } catch (error) {
        console.error("❌ Error getting inventory data:", error);
        return {};
    }
}

// Set up filter buttons
function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    if (filterButtons.length === 0) return;

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active button style
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Update current filter and re-render products
            currentFilter = button.getAttribute('data-filter');
            console.log(`Applied filter: ${currentFilter}`);

            // Reload products with the new filter
            loadProducts();
        });
    });
}

// ✅ Load Products on Page Load
document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
    setupFilterButtons();
});

// ✅ Function to add products to the cart
window.addToCart = function (productId, name, price, buttonElement, scannedQuantity) {
    console.log("Adding to cart:", { productId, name, price, scannedQuantity, buttonType: buttonElement ? "Button Click" : "Scanner" });

    // First, check available inventory
    const inventoryRef = ref(rtdb, `inventory/${productId}`);
    get(inventoryRef).then((snapshot) => {
        // Get inventory data for this product
        const inventoryData = snapshot.exists() ? snapshot.val() : { quantity: 0 };
        const availableQuantity = inventoryData.quantity || 0;

        console.log(`Inventory check: ${name} has ${availableQuantity} available`);

        // If out of stock, inform user and return
        if (availableQuantity <= 0) {
            const message = `Sorry, ${name} is out of stock`;
            if (typeof showNotification === 'function') {
                showNotification(message, 'error');
            } else {
                alert(message);
            }
            return false;
        }

        let quantity = 1; // Default quantity

        if (scannedQuantity) {
            // For scanned product, use provided quantity
            quantity = scannedQuantity;
            console.log(`Using scanned quantity: ${quantity} for product: ${name}`);
        } else if (buttonElement) {
            // For button click, get quantity from the input field
            const beerCard = buttonElement.closest(".beer-card");
            const quantityInput = beerCard.querySelector(".quantity");
            quantity = parseInt(quantityInput.value);

            if (isNaN(quantity) || quantity <= 0) {
                alert("❌ Please enter a valid quantity!");
                return false;
            }
        }

        // Check if the product is already in the cart
        const existingItemIndex = cart.findIndex(item => item.id === productId);
        let totalRequestedQuantity = quantity;

        if (existingItemIndex !== -1) {
            // If product already in cart, add the new quantity to existing quantity
            totalRequestedQuantity += cart[existingItemIndex].quantity;
        }

        // Check if requested quantity exceeds available inventory
        if (totalRequestedQuantity > availableQuantity) {
            const message = `Sorry, only ${availableQuantity} units of ${name} are available. You already have ${existingItemIndex !== -1 ? cart[existingItemIndex].quantity : 0} in your cart.`;

            if (typeof showNotification === 'function') {
                showNotification(message, 'warning');
            } else {
                alert(message);
            }

            // Optionally set quantity to maximum available
            if (buttonElement) {
                const beerCard = buttonElement.closest(".beer-card");
                const quantityInput = beerCard.querySelector(".quantity");

                // Calculate max additional quantity user can add
                const maxAdditionalQuantity = availableQuantity - (existingItemIndex !== -1 ? cart[existingItemIndex].quantity : 0);
                quantityInput.value = Math.max(1, maxAdditionalQuantity);

                // Also show max available in the error message
                if (typeof showNotification === 'function') {
                    showNotification(`Maximum available quantity set: ${maxAdditionalQuantity}`, 'info');
                }
            }

            return false;
        }

        // If we pass all checks, add to cart
        if (existingItemIndex !== -1) {
            // Product exists in cart, increment quantity
            cart[existingItemIndex].quantity += quantity;
            cart[existingItemIndex].totalPrice = cart[existingItemIndex].price * cart[existingItemIndex].quantity;
            console.log(`✅ Updated quantity for ${name} to ${cart[existingItemIndex].quantity}`);
        } else {
            // Product does not exist in cart, add new item
            const item = {
                id: productId,
                name: name,
                price: price,
                quantity: quantity,
                totalPrice: price * quantity
            };
            cart.push(item);
            console.log("✅ Added new item to cart:", item);
        }

        // Update the cart UI
        updateCart();

        // Visual feedback for the user
        if (buttonElement) {
            buttonElement.textContent = "Added!";
            buttonElement.style.backgroundColor = "#4CAF50";

            // Reset button text after a brief delay
            setTimeout(() => {
                buttonElement.textContent = "Add to Cart";
                buttonElement.style.backgroundColor = "";
            }, 1000);
        } else {
            // For scanned items, show a notification
            if (typeof showNotification === 'function') {
                // Show different messages for new vs. updated items
                if (existingItemIndex !== -1) {
                    showNotification(`Updated ${name} quantity to ${cart[existingItemIndex].quantity}`, 'success');
                } else {
                    showNotification(`Added ${name} to cart (${quantity})`, 'success');
                }
            }
        }

        return true; // Successfully added
    }).catch(error => {
        console.error("Error checking inventory:", error);
        if (typeof showNotification === 'function') {
            showNotification(`Error adding to cart: ${error.message}`, 'error');
        } else {
            alert(`Error adding to cart: ${error.message}`);
        }
        return false;
    });
};


// ✅ Function to update the cart UI
// ✅ Function to update the cart UI
function updateCart() {
    const cartItemsDiv = document.getElementById("cart-items");
    const totalPriceSpan = document.getElementById("total-price");

    cartItemsDiv.innerHTML = "";
    let total = 0;

    cart.forEach((item, index) => {
        const itemDiv = document.createElement("div");
        itemDiv.classList.add("cart-item");

        itemDiv.innerHTML = `
            <span>${item.name} x ${item.quantity} - ₹${item.totalPrice}</span>
            <button class="remove-btn" onclick="removeFromCart(${index})">
                <i class="fa-solid fa-circle-minus"></i>
            </button>
        `;

        cartItemsDiv.appendChild(itemDiv);
        total += item.totalPrice;
    });

    totalPriceSpan.textContent = total.toFixed(2);
}

// ✅ Function to remove an item from the cart
window.removeFromCart = function (index) {
    // Check if the item exists at this index
    if (index >= 0 && index < cart.length) {
        // If quantity is greater than 1, just decrement
        if (cart[index].quantity > 1) {
            cart[index].quantity -= 1;
            cart[index].totalPrice = cart[index].price * cart[index].quantity;
            console.log(`Decreased quantity of ${cart[index].name} to ${cart[index].quantity}`);

            // Optional: Show notification
            if (typeof showNotification === 'function') {
                showNotification(`Removed one ${cart[index].name} from cart`, 'info');
            }
        } else {
            // Quantity is 1, remove the item completely
            const removedItem = cart[index];
            cart.splice(index, 1);
            console.log(`Removed ${removedItem.name} from cart`);

            // Optional: Show notification
            if (typeof showNotification === 'function') {
                showNotification(`Removed ${removedItem.name} from cart`, 'info');
            }
        }

        // Update the cart UI
        updateCart();
    } else {
        console.error(`Invalid cart index: ${index}`);
    }
};

// ✅ Function to get current date and time in IST
function getFormattedDateTime() {
    // Create date object in IST timezone
    const now = new Date();
    const istOptions = {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };

    const istDateTime = now.toLocaleString('en-GB', istOptions);
    const [date, time] = istDateTime.split(', ');
    const [day, month, year] = date.split('/');

    return {
        date: `${year}-${month}-${day}`, // YYYY-MM-DD format
        time: time // HH:MM:SS format
    };
}

// Function to update inventory after a sale
async function updateInventoryAfterSale(items) {
    try {
        if (!rtdb) return;

        // Process each item in the cart
        for (const item of items) {
            const inventoryRef = ref(rtdb, `inventory/${item.id}`);
            const historyRef = ref(rtdb, 'inventory_history');

            // Get current inventory
            const snapshot = await get(inventoryRef);
            const currentData = snapshot.val() || { quantity: 0, lastUpdated: Date.now() };

            // Calculate new quantity
            const newQuantity = Math.max(0, currentData.quantity - item.quantity);

            // Update inventory
            await set(inventoryRef, {
                quantity: newQuantity,
                lastUpdated: Date.now()
            });

            // Add to history
            const historyEntry = {
                productId: item.id,
                operation: 'remove',
                quantity: item.quantity,
                notes: 'Removed due to sale',
                timestamp: Date.now()
            };

            // Use Firebase push to add a new entry with unique ID
            const historyEntryRef = ref(rtdb, 'inventory_history');
            const newEntryRef = child(historyEntryRef, push().key);
            await set(newEntryRef, historyEntry);
        }

        console.log("✅ Inventory updated successfully after sale");
    } catch (error) {
        console.error("❌ Error updating inventory after sale:", error);
    }
}

// ✅ Make recordSale function globally available
window.recordSale = async function () {
    if (!db) {
        alert("Firestore (db) is not initialized. Please refresh the page.");
        return;
    }

    if (cart.length === 0) {
        alert("Cart is empty!");
        return;
    }

    try {
        const salesRef = collection(db, "sales");
        const salesQuery = query(salesRef, orderBy("timestamp", "desc"));
        const snapshot = await getDocs(salesQuery);

        let nextOrderNumber = 1;
        const { date, time } = getFormattedDateTime(); // Get current IST date and time

        if (!snapshot.empty) {
            const lastSale = snapshot.docs[0].data();
            // Only increment the order number if it's the same date
            if (lastSale.date === date) {
                const lastOrderNum = parseInt(lastSale.orderNo.replace("#", ""), 10);
                nextOrderNumber = lastOrderNum + 1;
            } else {
                // If it's a new date, start from 1
                nextOrderNumber = 1;
            }
        }

        const paymentMethod = document.getElementById("payment").value;
        const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);

        // Record the sale
        await addDoc(salesRef, {
            orderNo: `#${String(nextOrderNumber).padStart(3, "0")}`,
            items: cart,
            paymentMethod: paymentMethod,
            totalAmount: totalAmount,
            timestamp: new Date(),
            date: date,
            time: time
        });

        // Update inventory for sold items
        await updateInventoryAfterSale(cart);

        alert(`✅ Sale Recorded Successfully as Order #${nextOrderNumber}`);
        cart = [];
        updateCart();

        // Reload products to update the stock display
        loadProducts();

        if (typeof loadSales === 'function') {
            loadSales();
        }

    } catch (error) {
        console.error("❌ Error recording sale:", error);
        alert("Error recording sale. Please try again.");
    }
};

// Global function for showing notifications
window.showNotification = function (message, type = 'info') {
    console.log(`Notification (${type}):`, message);

    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
};
