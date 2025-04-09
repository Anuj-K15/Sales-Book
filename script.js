// ✅ Define cart at the beginning to avoid "cart is not defined" error
let cart = [];
let orderCounter = 0;

// ✅ Import Firestore database
import { db } from "./firebase-config.js";
import { loadSales } from "./sales-page.js"; // ✅ Import loadSales
import { collection, getDocs, addDoc, doc, runTransaction, query, orderBy }
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
        const productsRef = collection(db, "products");
        const snapshot = await getDocs(productsRef);

        beerList.innerHTML = "";
        if (snapshot.empty) {
            beerList.innerHTML = "<div class='no-products'>No products available</div>";
            return;
        }

        snapshot.forEach((doc) => {
            const product = doc.data();
            const beerCard = document.createElement("div");
            beerCard.className = "beer-card";
            beerCard.setAttribute("data-name", product.name);
            beerCard.setAttribute("data-price", product.price);

            beerCard.innerHTML = `
                <img src="${product.image}" alt="${product.name}">
                <h3>${product.name}</h3>
                <p>₹${product.price}</p>
                <input type="number" min="1" value="1" class="quantity">
                <button onclick="addToCart('${product.name}', ${product.price}, this)">Add to Cart</button>
            `;

            beerList.appendChild(beerCard);
        });
    } catch (error) {
        console.error("❌ Error loading products:", error);
        beerList.innerHTML = "<div class='error-message'>Error loading products. Please refresh the page.</div>";
    }
}

// ✅ Load Products on Page Load
document.addEventListener("DOMContentLoaded", loadProducts);

// ✅ Function to add products to the cart
window.addToCart = function (name, price, buttonElement) {
    const beerCard = buttonElement.closest(".beer-card"); // ✅ Get parent card
    const quantityInput = beerCard.querySelector(".quantity"); // ✅ Find the input field
    const quantity = parseInt(quantityInput.value); // ✅ Get selected quantity

    if (isNaN(quantity) || quantity <= 0) {
        alert("❌ Please enter a valid quantity!");
        return;
    }

    const item = {
        name: name,
        price: price,
        quantity: quantity,
        totalPrice: price * quantity
    };

    cart.push(item);
    updateCart();
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

        await addDoc(salesRef, {
            orderNo: `#${String(nextOrderNumber).padStart(3, "0")}`,
            items: cart,
            paymentMethod: paymentMethod,
            totalAmount: totalAmount,
            timestamp: new Date(),
            date: date,
            time: time
        });

        alert(`✅ Sale Recorded Successfully as Order #${nextOrderNumber}`);
        cart = [];
        updateCart();
        if (typeof loadSales === 'function') {
            loadSales();
        }

    } catch (error) {
        console.error("❌ Error recording sale:", error);
        alert("Error recording sale. Please try again.");
    }
};
