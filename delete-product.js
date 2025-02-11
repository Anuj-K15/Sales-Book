// Import Firestore database
import { db } from "./firebase-config.js";
import { collection, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ✅ Ensure Firebase is initialized
if (!db) {
    console.error("❌ Firebase is not initialized at the start!");
} else {
    console.log("✅ Firebase is initialized in delete-product.js");
}

// ✅ Function to Load Products for Deletion
async function loadProducts() {
    console.log("🔄 Loading products...");

    if (!db) {
        console.error("❌ Firebase is not initialized! Cannot load products.");
        alert("❌ Firebase is not initialized. Please refresh the page.");
        return;
    }

    const productList = document.getElementById("product-list");
    if (!productList) return;

    try {
        const productsRef = collection(db, "products"); // ✅ Firestore Collection Reference
        const snapshot = await getDocs(productsRef);

        productList.innerHTML = ""; // Clear existing list

        if (snapshot.empty) {
            console.log("❌ No products found.");
            productList.innerHTML = "<div class='no-products'>No products available</div>";
            return;
        }

        console.log(`✅ Loaded ${snapshot.size} products`);

        snapshot.forEach((docSnap) => {
            const product = docSnap.data();
            const productId = docSnap.id;
            const imageUrl = product.image || "default-image.jpg"; // ✅ Use default image if missing

            const productItem = document.createElement("div");
            productItem.className = "product-item";

            productItem.innerHTML = `
                <img src="${imageUrl}" alt="${product.name}" class="product-image">
                <p>${product.name} - ₹${product.price}</p>
                <button onclick="deleteProduct('${productId}')">Delete</button>
            `;

            productList.appendChild(productItem);
        });
    } catch (error) {
        console.error("❌ Error loading products:", error);
        alert("Error loading products. Please refresh the page.");
    }
}
// ✅ Function to Delete a Product
window.deleteProduct = async function (productId) {
    console.log("🗑 Attempting to delete product:", productId);

    // ✅ Ensure Firebase is initialized before proceeding
    if (!db) {
        console.error("❌ Firebase is not initialized! Cannot delete product.");
        alert("❌ Firebase is not initialized. Please refresh the page.");
        return;
    }

    try {
        await deleteDoc(doc(db, "products", productId));
        alert("✅ Product deleted successfully!");
        console.log(`✅ Deleted product ID: ${productId}`);

        loadProducts(); // ✅ Reload products after deletion
    } catch (error) {
        console.error("❌ Error deleting product:", error);
        alert("Error deleting product. Please try again.");
    }
};

// ✅ Load Products on Page Load
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(loadProducts, 1000); // ✅ Ensure Firebase is fully initialized before loading
});
