// ✅ Import Firestore properly
import { db } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ✅ Ensure Firebase is initialized
if (!db) {
    console.error("❌ Firestore is not initialized at the start!");
} else {
    console.log("✅ Firestore is initialized in add-product.js");
}

// ✅ Function to Handle Image Compression
async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL("image/jpeg", 0.7));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ✅ Function to Add Product to Firestore
async function addProduct(e) {
    e.preventDefault();

    const productName = document.getElementById("product-name").value;
    const productPrice = parseFloat(document.getElementById("product-price").value);
    const productImageFile = document.getElementById("product-image").files[0];

    if (!productName || isNaN(productPrice) || !productImageFile) {
        alert("❌ Please enter all details correctly.");
        return;
    }

    try {
        const compressedImage = await compressImage(productImageFile);

        console.log("📤 Uploading Product:", { name: productName, price: productPrice });

        await addDoc(collection(db, "products"), {
            name: productName,
            price: productPrice,
            image: compressedImage,
            timestamp: serverTimestamp(),
        });

        alert("✅ Product added successfully!");
        document.getElementById("product-form").reset();
        window.location.href = "record.html";
    } catch (error) {
        console.error("❌ Error adding product:", error);
        alert("Error adding product. Please try again.");
    }
}

// ✅ Attach Event Listener on Form Submission
document.getElementById("product-form").addEventListener("submit", addProduct);
