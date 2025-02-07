// script.js
let cart = [];
let orderCounter = 0;

// Initialize Firebase products collection reference
const productsRef = db.collection('products');

// Initialize order counter function
async function initializeOrderCounter() {
    try {
        const snapshot = await db.collection('orderCounter').doc('counter').get();
        if (snapshot.exists) {
            orderCounter = snapshot.data().value;
        } else {
            // Initialize counter document if it doesn't exist
            await db.collection('orderCounter').doc('counter').set({ value: 0 });
        }
    } catch (error) {
        console.error("Error initializing order counter:", error);
    }
}

// Load products from Firebase
async function loadProducts() {
    const beerList = document.getElementById('beer-list');
    if (!beerList) return;
    
    try {
        const snapshot = await productsRef.get();
        beerList.innerHTML = ''; // Clear existing products
        
        if (snapshot.empty) {
            beerList.innerHTML = '<div class="no-products">No products available</div>';
            return;
        }
        
        snapshot.forEach(doc => {
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
                <button onclick="addToCart(this)">Add to Cart</button>
            `;
            
            beerList.appendChild(beerCard);
        });
    } catch (error) {
        console.error("Error loading products:", error);
        beerList.innerHTML = '<div class="error-message">Error loading products. Please refresh the page.</div>';
    }
}

function addToCart(button) {
    const beerCard = button.closest('.beer-card');
    const name = beerCard.getAttribute('data-name');
    const price = parseFloat(beerCard.getAttribute('data-price'));
    const quantity = parseInt(beerCard.querySelector('.quantity').value);

    const item = {
        name: name,
        price: price,
        quantity: quantity,
        totalPrice: price * quantity
    };

    cart.push(item);
    updateCart();
}

function updateCart() {
    const cartItemsDiv = document.getElementById('cart-items');
    const totalPriceSpan = document.getElementById('total-price');
    
    cartItemsDiv.innerHTML = '';

    let total = 0;
    cart.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('cart-item');
        itemDiv.innerHTML = `${item.name} x ${item.quantity} - ₹${item.totalPrice}`;
        cartItemsDiv.appendChild(itemDiv);
        total += item.totalPrice;
    });

    totalPriceSpan.textContent = total.toFixed(2);
}

async function recordSale() {
    if (!window.db) {
        alert("Firestore (db) is not initialized. Please refresh the page.");
        return;
    }

    if (cart.length === 0) {
        alert('Cart is empty!');
        return;
    }

    try {
        const counterRef = window.db.collection('orderCounter').doc('counter');

        await window.db.runTransaction(async (transaction) => {
            const doc = await transaction.get(counterRef);
            const newCounter = (doc.exists ? doc.data().value : 0) + 1;
            transaction.update(counterRef, { value: newCounter });
            orderCounter = newCounter;
        });

        const paymentMethod = document.getElementById('payment').value;
        const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);
        const now = new Date();

        await window.db.collection('sales').add({
            orderNo: `#${String(orderCounter).padStart(3, '0')}`,
            items: cart,
            paymentMethod: paymentMethod,
            totalAmount: totalAmount,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
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

// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    if (window.db) {
        await initializeOrderCounter();
        await loadProducts();
    } else {
        console.error("Firebase is not initialized!");
        const beerList = document.getElementById('beer-list');
        if (beerList) {
            beerList.innerHTML = '<div class="error-message">Error: Database not connected. Please refresh the page.</div>';
        }
    }
});