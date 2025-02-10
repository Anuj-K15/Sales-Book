// Import Firestore database from Firebase config
import { db } from "./firebase-config.js";
import { 
    collection, getDocs, addDoc, doc, updateDoc, getDoc, runTransaction 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let cart = [];
let orderCounter = 0;

// Load products from Firebase Firestore
async function loadProducts() {
    const beerList = document.getElementById('beer-list');
    if (!beerList) return;

    try {
        const productsRef = collection(db, "products"); // ✅ Use Firestore collection
        const snapshot = await getDocs(productsRef);
        
        beerList.innerHTML = ''; // Clear existing products

        if (snapshot.empty) {
            beerList.innerHTML = '<div class="no-products">No products available</div>';
            return;
        }

        snapshot.forEach((doc) => {
            const product = doc.data();
            const beerCard = document.createElement('div');
            beerCard.className = 'beer-card';
            beerCard.setAttribute('data-name', product.name);
            beerCard.setAttribute('data-price', product.price);

            beerCard.innerHTML = `
                <img src="${product.image}" alt="${product.name}">
                <h3>${product.name}</h3>
                <p>₹${product.price}</p>
                <input type="number" min="1" value="1" class="quantity">
                <button onclick="addToCart('${product.name}', ${product.price})">Add to Cart</button>
            `;

            beerList.appendChild(beerCard);
        });
    } catch (error) {
        console.error("❌ Error loading products:", error);
        beerList.innerHTML = '<div class="error-message">Error loading products. Please refresh the page.</div>';
    }
}

// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    await loadProducts();
});

// Function to add products to the cart
window.addToCart = function(name, price) {
    const quantity = 1; // Default quantity

    const item = {
        name: name,
        price: price,
        quantity: quantity,
        totalPrice: price * quantity
    };

    cart.push(item);
    updateCart();
};

// Function to update the cart UI
function updateCart() {
    const cartItemsDiv = document.getElementById('cart-items');
    const totalPriceSpan = document.getElementById('total-price');

    cartItemsDiv.innerHTML = '';
    let total = 0;

    cart.forEach((item) => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('cart-item');
        itemDiv.innerHTML = `${item.name} x ${item.quantity} - ₹${item.totalPrice}`;
        cartItemsDiv.appendChild(itemDiv);
        total += item.totalPrice;
    });

    totalPriceSpan.textContent = total.toFixed(2);
}

// Function to record a sale
async function recordSale() {
    if (!db) {
        alert("Firestore (db) is not initialized. Please refresh the page.");
        return;
    }

    if (cart.length === 0) {
        alert('Cart is empty!');
        return;
    }

    try {
        const counterRef = doc(db, 'orderCounter', 'counter');

        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(counterRef);
            const newCounter = (docSnap.exists() ? docSnap.data().value : 0) + 1;
            transaction.update(counterRef, { value: newCounter });
            orderCounter = newCounter;
        });

        const paymentMethod = document.getElementById('payment').value;
        const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);
        const now = new Date();

        await addDoc(collection(db, 'sales'), {
            orderNo: `#${String(orderCounter).padStart(3, '0')}`,
            items: cart,
            paymentMethod: paymentMethod,
            totalAmount: totalAmount,
            timestamp: new Date(),
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString()
        });

        alert('✅ Sale Recorded Successfully!');
        cart = [];
        updateCart();
    } catch (error) {
        console.error("❌ Error recording sale:", error);
        alert('Error recording sale. Please try again.');
    }
}

// Make `recordSale` function globally available
window.recordSale = recordSale;
