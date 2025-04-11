// ✅ Import Firestore properly
import { db } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { barcodeScanner, generateQRCode, generateRandomBarcode } from "./scanner.js";
import { ref, set, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb } from "./firebase-config.js";

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
const initialStockInput = document.getElementById('initial-stock');
const scanButton = document.getElementById('scan-barcode');
const generateButton = document.getElementById('generate-barcode');
const closeScanner = document.getElementById('close-scanner');
const switchCameraBtn = document.getElementById('switch-camera');
const scannerContainer = document.getElementById('scanner-container');
const qrcodeContainer = document.getElementById('qrcode-container');
const downloadQRButton = document.getElementById('download-qr');

let currentQRCode = null;
let scanAttempts = 0;
const maxScanAttempts = 3;
let currentCamera = 'environment'; // Default to rear camera

// Initialize scanner functionality
scanButton.addEventListener('click', async (e) => {
    e.preventDefault(); // Prevent form submission
    console.log("Scan button clicked");
    scannerContainer.style.display = 'block';

    try {
        await barcodeScanner.initializeScanner('reader', (scannedBarcode) => {
            console.log("Barcode scanned:", scannedBarcode);
            barcodeInput.value = scannedBarcode;
            scannerContainer.style.display = 'none';
            showNotification("Barcode scanned successfully!", "success");
            scanAttempts = 0; // Reset scan attempts on success
        });
    } catch (err) {
        console.error('Failed to start scanner:', err);
        scannerContainer.style.display = 'none';
        showNotification("Failed to start scanner: " + (err.message || "Unknown error"), "error");

        scanAttempts++;
        if (scanAttempts >= maxScanAttempts) {
            showNotification("Multiple scanner failures. Please check your camera permissions.", "error");
            scanAttempts = 0; // Reset after notification
        }
    }
});

// Switch camera functionality
if (switchCameraBtn) {
    switchCameraBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            // Stop current scanner
            await barcodeScanner.stopScanner();

            // Toggle camera
            currentCamera = currentCamera === 'environment' ? 'user' : 'environment';

            // Restart scanner with new camera
            await barcodeScanner.initializeScanner('reader', (scannedBarcode) => {
                console.log("Barcode scanned:", scannedBarcode);
                barcodeInput.value = scannedBarcode;
                scannerContainer.style.display = 'none';
                showNotification("Barcode scanned successfully!", "success");
            }, {
                facingMode: currentCamera
            });

            // Update button text
            switchCameraBtn.innerHTML = `<i class="fas fa-sync"></i> ${currentCamera === 'environment' ? 'Front Camera' : 'Back Camera'}`;
        } catch (err) {
            console.error('Failed to switch camera:', err);
            showNotification('Failed to switch camera: ' + err.message, 'error');
        }
    });
}

closeScanner.addEventListener('click', async (e) => {
    e.preventDefault(); // Prevent form submission
    await barcodeScanner.stopScanner();
    scannerContainer.style.display = 'none';
});

// Generate QR code for product
generateButton.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent form submission

    const productName = nameInput.value.trim();
    const productPrice = parseFloat(priceInput.value) || 0;
    const initialStock = parseInt(initialStockInput?.value) || 0;

    if (!productName) {
        showNotification('Please enter a product name', 'error');
        return;
    }

    if (productPrice <= 0) {
        showNotification('Please enter a valid price', 'error');
        return;
    }

    // Generate random barcode if not provided
    if (!barcodeInput.value) {
        barcodeInput.value = generateRandomBarcode();
    }

    // Create product data object including all relevant product info
    const productData = {
        name: productName,
        price: productPrice,
        barcode: barcodeInput.value,
        stock: initialStock,
        timestamp: new Date().toISOString()
    };

    // Generate new QR code with all product data
    try {
        console.log("Generating QR code for:", productData);
        currentQRCode = generateQRCode(productData, 'qrcode');
        qrcodeContainer.style.display = 'block';
        downloadQRButton.style.display = 'inline-block';
        showNotification('QR code generated successfully!', 'success');
    } catch (error) {
        console.error("Error generating QR code:", error);
        showNotification('Error generating QR code: ' + error.message, 'error');
    }
});

// Download QR code
downloadQRButton.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent form submission

    const canvas = document.querySelector('#qrcode canvas');
    if (canvas) {
        const link = document.createElement('a');
        link.download = `qrcode-${nameInput.value.replace(/\s+/g, '-')}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('QR code downloaded!', 'success');
    } else {
        showNotification('No QR code to download', 'error');
    }
});

// Handle form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        // Get form values
        const name = nameInput.value.trim();
        const price = parseFloat(priceInput.value);
        const barcode = barcodeInput.value.trim();
        const initialStock = parseInt(initialStockInput?.value) || 0;
        const imageFile = imageInput.files[0];

        if (!name) {
            showNotification('Please enter a product name', 'error');
            return;
        }

        if (!price || price <= 0) {
            showNotification('Please enter a valid price', 'error');
            return;
        }

        if (!imageFile) {
            showNotification('Please select a product image', 'error');
            return;
        }

        // Show loading indicator
        showNotification('Adding product, please wait...', 'info');

        // Ensure the barcode is properly formatted as a string
        const formattedBarcode = barcode || generateRandomBarcode();
        console.log("Adding product with barcode:", formattedBarcode, "Type:", typeof formattedBarcode);

        // Convert image to base64
        const base64Image = await convertImageToBase64(imageFile);

        // Create product object
        const product = {
            name,
            price,
            barcode: formattedBarcode,
            image: base64Image,
            createdAt: new Date().toISOString()
        };

        // Log product data before adding to Firestore
        console.log("Product object to be added:", {
            name: product.name,
            price: product.price,
            barcode: product.barcode,
            barcodeType: typeof product.barcode,
            imageSize: product.image.length,
            createdAt: product.createdAt
        });

        // Add to Firestore
        const docRef = await addDoc(collection(db, "products"), product);
        console.log("✅ Product added with ID:", docRef.id);

        // Add initial inventory if set and greater than 0
        if (initialStock > 0) {
            try {
                if (!rtdb) {
                    throw new Error("Realtime Database not initialized");
                }

                const inventoryRef = ref(rtdb, `inventory/${docRef.id}`);
                await set(inventoryRef, {
                    quantity: initialStock,
                    lastUpdated: Date.now()
                });

                // Add to inventory history
                const historyEntry = {
                    productId: docRef.id,
                    productName: name,
                    operation: 'add',
                    quantity: initialStock,
                    notes: 'Initial stock on product creation',
                    timestamp: Date.now()
                };

                const historyEntryRef = ref(rtdb, 'inventory_history');
                const newEntryRef = push(historyEntryRef);
                await set(newEntryRef, historyEntry);

                console.log("✅ Initial inventory set:", initialStock);
            } catch (err) {
                console.error("Error setting initial inventory:", err);
                // Continue despite inventory error
                showNotification("Product added but failed to set initial inventory: " + err.message, "warning");
            }
        }

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
        showNotification('Error adding product: ' + error.message, 'error');
    }
});

// Helper function to convert image to base64
function convertImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // Create canvas for image compression
                const canvas = document.createElement('canvas');

                // Calculate new dimensions (max 800px width/height while maintaining aspect ratio)
                let width = img.width;
                let height = img.height;
                const maxSize = 800;

                if (width > height && width > maxSize) {
                    height = Math.round((height * maxSize) / width);
                    width = maxSize;
                } else if (height > maxSize) {
                    width = Math.round((width * maxSize) / height);
                    height = maxSize;
                }

                // Resize image
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Get compressed image as base64 (0.8 quality)
                const compressedImage = canvas.toDataURL('image/jpeg', 0.8);

                console.log("Original size (bytes):", event.target.result.length);
                console.log("Compressed size (bytes):", compressedImage.length);

                resolve(compressedImage);
            };
            img.onerror = (error) => reject(error);
            img.src = event.target.result;
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// Show notification
function showNotification(message, type = 'info') {
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
}
