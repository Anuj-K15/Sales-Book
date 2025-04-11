// ✅ Import Firestore properly
import { db } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { barcodeScanner, generateQRCode } from "./scanner.js";

// ✅ Ensure Firebase is initialized
if (!db) {
    console.error("❌ Firestore is not initialized at the start!");
} else {
    console.log("✅ Firestore is initialized in add-product.js");
}

// Get form elements
const form = document.getElementById('product-form');
const nameInput = document.getElementById('product-name');
const priceInput = document.getElementById('product-price');
const imageInput = document.getElementById('product-image');
const barcodeInput = document.getElementById('product-barcode');
const scanButton = document.getElementById('scan-barcode');
const generateButton = document.getElementById('generate-barcode');
const closeScanner = document.getElementById('close-scanner');
const scannerContainer = document.getElementById('scanner-container');
const qrcodeContainer = document.getElementById('qrcode-container');
const downloadQRButton = document.getElementById('download-qr');

let currentQRCode = null;

// Initialize scanner functionality
scanButton.addEventListener('click', async () => {
    scannerContainer.style.display = 'block';
    try {
        await barcodeScanner.initializeScanner('reader', (result) => {
            barcodeInput.value = result;
            scannerContainer.style.display = 'none';
        });
    } catch (err) {
        console.error('Failed to start scanner:', err);
        scannerContainer.style.display = 'none';
    }
});

closeScanner.addEventListener('click', async () => {
    await barcodeScanner.stopScanner();
    scannerContainer.style.display = 'none';
});

// Generate QR code for product
generateButton.addEventListener('click', () => {
    const productData = {
        name: nameInput.value,
        price: parseFloat(priceInput.value) || 0,
        barcode: barcodeInput.value
    };

    if (!productData.name || !productData.price) {
        alert('Please fill in product name and price first');
        return;
    }

    // Clear previous QR code
    const qrcodeElement = document.getElementById('qrcode');
    qrcodeElement.innerHTML = '';

    // Generate new QR code
    currentQRCode = generateQRCode(productData, 'qrcode');
    qrcodeContainer.style.display = 'block';
    downloadQRButton.style.display = 'inline-flex';
});

// Download QR code
downloadQRButton.addEventListener('click', () => {
    const canvas = document.querySelector('#qrcode canvas');
    if (canvas) {
        const link = document.createElement('a');
        link.download = `qr-${barcodeInput.value || 'product'}.png`;
        link.href = canvas.toDataURL();
        link.click();
    }
});

// Handle form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        // Get form values
        const name = nameInput.value;
        const price = parseFloat(priceInput.value);
        const barcode = barcodeInput.value;
        const imageFile = imageInput.files[0];

        if (!name || !price || !imageFile) {
            alert('Please fill in all required fields');
            return;
        }

        // Convert image to base64
        const base64Image = await convertImageToBase64(imageFile);

        // Create product object
        const product = {
            name,
            price,
            barcode: barcode || generateRandomBarcode(),
            image: base64Image,
            createdAt: new Date().toISOString()
        };

        // Add to Firestore
        const docRef = await addDoc(collection(db, "products"), product);
        console.log("✅ Product added with ID:", docRef.id);

        // Reset form
        form.reset();
        qrcodeContainer.style.display = 'none';
        showNotification('Product added successfully!', 'success');

        // Redirect to inventory page after 2 seconds
        setTimeout(() => {
            window.location.href = 'inventory.html';
        }, 2000);

    } catch (error) {
        console.error("Error adding product:", error);
        showNotification('Error adding product. Please try again.', 'error');
    }
});

// Helper function to convert image to base64
function convertImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// Generate random barcode if none provided
function generateRandomBarcode() {
    return Math.floor(100000000 + Math.random() * 900000000).toString();
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}
