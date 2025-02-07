// delete-product.js
async function loadDeleteProducts() {
    const productList = document.getElementById('product-list');
    if (!productList) return;
    
    try {
        const snapshot = await db.collection('products').get();
        
        if (snapshot.empty) {
            productList.innerHTML = '<div class="no-products">No custom products found</div>';
            return;
        }
        
        productList.innerHTML = '';
        
        snapshot.forEach(doc => {
            const product = doc.data();
            const productCard = document.createElement('div');
            productCard.className = 'delete-product-card';
            productCard.innerHTML = `
                <img src="${product.image}" alt="${product.name}">
                <div class="product-details">
                    <h3>${product.name}</h3>
                    <p>₹${product.price}</p>
                </div>
                <button onclick="deleteProduct('${doc.id}')" class="delete-btn">
                    <i class="fas fa-trash"></i> Delete
                </button>
            `;
            productList.appendChild(productCard);
        });
    } catch (error) {
        console.error("Error loading products:", error);
        alert('Error loading products. Please try again.');
    }
}

async function deleteProduct(productId) {
    if (confirm('Are you sure you want to delete this product?')) {
        try {
            await db.collection('products').doc(productId).delete();
            alert('Product deleted successfully!');
            loadDeleteProducts();
        } catch (error) {
            console.error("Error deleting product:", error);
            alert('Error deleting product. Please try again.');
        }
    }
}

// Load products when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (window.db) {
        loadDeleteProducts();
    } else {
        console.error("Firebase is not initialized!");
    }
});