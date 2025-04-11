// ✅ Define cart at the beginning to avoid "cart is not defined" error
let cart = [];
let orderCounter = 0;

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
    if (!beerList) return;

    try {
        beerList.innerHTML = "<div class='loading-message'>Loading products...</div>";

        const productsRef = collection(db, "products");
        const snapshot = await getDocs(productsRef);

        beerList.innerHTML = "";
        if (snapshot.empty) {
            beerList.innerHTML = "<div class='no-products'>No products available</div>";
            return;
        }

        // Initialize products array for inventory check
        const products = [];

        // First, get all products
        snapshot.forEach((doc) => {
            const product = doc.data();
            product.id = doc.id;
            products.push(product);
        });

        // Sort products alphabetically by name
        products.sort((a, b) => a.name.localeCompare(b.name));

        // Get inventory data for these products
        const inventoryData = await getInventoryData(products.map(p => p.id));

        // Create a document fragment for better performance
        const fragment = document.createDocumentFragment();

        // Now create the beer cards with inventory information
        products.forEach(product => {
            const inventory = inventoryData[product.id] || { quantity: 0 };
            const isOutOfStock = inventory.quantity <= 0;
            const isLowStock = !isOutOfStock && inventory.quantity <= 5;

            const beerCard = document.createElement("div");
            beerCard.className = "beer-card";
            beerCard.setAttribute("data-id", product.id);
            beerCard.setAttribute("data-name", product.name);
            beerCard.setAttribute("data-price", product.price);

            // Create image container
            const imageContainer = document.createElement("div");
            imageContainer.className = "product-image-container";

            const image = document.createElement("img");
            image.src = product.image || "assets/default-product.png";
            image.alt = product.name;
            image.loading = "lazy"; // Lazy load images for better performance

            imageContainer.appendChild(image);

            // Create product info container
            const infoContainer = document.createElement("div");
            infoContainer.className = "product-info";

            // Add product name
            const productName = document.createElement("h3");
            productName.textContent = product.name;

            // Add product price
            const productPrice = document.createElement("p");
            productPrice.textContent = `₹${product.price}`;

            infoContainer.appendChild(productName);
            infoContainer.appendChild(productPrice);

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
            quantityInput.value = "1";
            quantityInput.className = "quantity";
            if (isOutOfStock) quantityInput.disabled = true;

            // Create add to cart button
            const addButton = document.createElement("button");
            addButton.innerHTML = isOutOfStock ? 'Out of Stock' : 'Add to Cart';
            addButton.disabled = isOutOfStock;
            addButton.onclick = () => addToCart(product.id, product.name, product.price, addButton);

            // Append all elements to the card
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

        console.log(`✅ Loaded and displayed ${products.length} products`);

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

// ✅ Load Products on Page Load
document.addEventListener("DOMContentLoaded", loadProducts);

// ✅ Function to add products to the cart
window.addToCart = function (productId, name, price, buttonElement, scannedQuantity) {
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
            return;
        }
    }

    const item = {
        id: productId,
        name: name,
        price: price,
        quantity: quantity,
        totalPrice: price * quantity
    };

    // Add item to cart
    cart.push(item);

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
    }

    return true; // Successfully added
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
    cart.splice(index, 1); // ✅ Remove item at given index
    updateCart(); // ✅ Refresh cart UI
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
