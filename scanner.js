// Scanner functionality for BeerZone
import { db } from "./firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class BarcodeScanner {
    constructor() {
        this.html5QrcodeScanner = null;
        this.isScanning = false;
        this.consecutiveFails = 0;
        this.maxConsecutiveFails = 3;
    }

    async initializeScanner(containerId, onProductFound, cameraConfig = {}) {
        try {
            if (this.isScanning) {
                await this.stopScanner();
            }

            this.html5QrcodeScanner = new Html5Qrcode(containerId);

            // Build scanner config with default values that can be overridden
            const facingMode = cameraConfig.facingMode || "environment";

            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                videoConstraints: {
                    facingMode: facingMode
                }
            };

            // Check camera permissions first
            try {
                await navigator.mediaDevices.getUserMedia({ video: true });
            } catch (error) {
                console.error("Camera permission denied:", error);
                this.showNotification("Camera access denied. Please allow camera access in your browser settings.", "error");
                throw new Error("Camera permission denied");
            }

            await this.html5QrcodeScanner.start(
                { facingMode: facingMode },
                config,
                async (decodedText) => {
                    await this.handleScan(decodedText, onProductFound);
                },
                (errorMessage) => {
                    console.log(`QR Code scanning error: ${errorMessage}`);
                    this.consecutiveFails++;
                    if (this.consecutiveFails >= this.maxConsecutiveFails) {
                        this.showNotification("Multiple scanning errors occurred. Please try again.", "error");
                        this.consecutiveFails = 0; // Reset counter
                    }
                }
            );

            this.isScanning = true;
            console.log(`Scanner started successfully with ${facingMode} camera`);
            this.showNotification(`Scanner started. Using ${facingMode === 'environment' ? 'back' : 'front'} camera.`, "info");
        } catch (error) {
            console.error("Error starting scanner:", error);
            this.showNotification("Could not start camera: " + error.message, "error");
            throw error;
        }
    }

    async handleScan(scannedCode, onProductFound) {
        console.log("🔍 Scanned code:", scannedCode, "Type:", typeof scannedCode);

        try {
            // Reset consecutive fails counter on successful scan
            this.consecutiveFails = 0;

            // Try to parse the scanned code as JSON (it might be a QR code with product data)
            let productData = null;
            try {
                productData = JSON.parse(scannedCode);
                console.log("📊 Parsed QR code data:", productData);

                if (productData && productData.id) {
                    // This is a product QR code with complete data
                    if (typeof onProductFound === 'function') {
                        onProductFound(productData);
                        this.showNotification(`Found: ${productData.name}`, "success");
                        return;
                    }
                }
            } catch (e) {
                // Not a JSON string, proceed with barcode handling
                console.log("Not a JSON QR code, treating as barcode");
            }

            // Check if we're on the add product page
            const isAddProductPage = window.location.href.includes('add-product') ||
                document.getElementById('product-form') !== null;

            if (isAddProductPage) {
                console.log("📝 Add product page detected, returning barcode to form");
                if (typeof onProductFound === 'function') {
                    onProductFound(scannedCode);
                    this.showNotification(`Barcode scanned: ${scannedCode}`, "success");
                }
                return;
            }

            console.log("🛒 Record page detected, searching for product with barcode:", scannedCode);

            // Get all products from Firestore for debugging
            const productsRef = collection(db, "products");
            const productsSnapshot = await getDocs(productsRef);

            console.log("📊 All products in database:");
            const allProducts = [];
            productsSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                allProducts.push(product);
                console.log(`Product: ${product.name}, Barcode: ${product.barcode} (${typeof product.barcode})`);
            });

            // First attempt: Use Firestore query with exact match
            console.log("🔍 Attempting direct Firestore query with barcode:", scannedCode);
            const q = query(collection(db, "products"), where("barcode", "==", scannedCode));
            const querySnapshot = await getDocs(q);

            // Check if we found any products
            if (!querySnapshot.empty) {
                const productDoc = querySnapshot.docs[0];
                const product = { id: productDoc.id, ...productDoc.data() };
                console.log("✅ Product found with direct query:", product);

                if (typeof onProductFound === 'function') {
                    onProductFound(product);
                    this.showNotification(`Found: ${product.name}`, "success");
                }
                return;
            }

            // Second attempt: Manual comparison to handle type mismatches
            console.log("🔄 No direct match, trying string comparison...");
            let foundProduct = null;

            // Try string comparison
            for (const product of allProducts) {
                // Convert both to strings for comparison
                const productBarcodeStr = String(product.barcode).trim();
                const scannedCodeStr = String(scannedCode).trim();

                console.log(`Comparing: "${productBarcodeStr}" with "${scannedCodeStr}"`);

                if (productBarcodeStr === scannedCodeStr) {
                    foundProduct = product;
                    console.log("✅ Product found with string comparison:", foundProduct);
                    break;
                }
            }

            if (foundProduct) {
                if (typeof onProductFound === 'function') {
                    onProductFound(foundProduct);
                    this.showNotification(`Found: ${foundProduct.name}`, "success");
                }
            } else {
                console.log("❌ Product not found for barcode:", scannedCode);
                this.showNotification(`Product not found for barcode: ${scannedCode}`, "error");

                // Don't stop scanner - allow another attempt
                return;
            }
        } catch (error) {
            console.error("Error handling scan:", error);
            this.showNotification("Error scanning product: " + error.message, "error");
        }
    }

    async stopScanner() {
        if (this.html5QrcodeScanner && this.isScanning) {
            try {
                await this.html5QrcodeScanner.stop();
                console.log("Scanner stopped");
                this.isScanning = false;
                this.showNotification("Scanner stopped", "info");
                return true;
            } catch (error) {
                console.error("Error stopping scanner:", error);
                return false;
            }
        }
        return true; // Already stopped
    }

    showNotification(message, type = "info") {
        // Check if notifications container exists, if not create it
        let notificationsContainer = document.getElementById("notifications-container");
        if (!notificationsContainer) {
            notificationsContainer = document.createElement("div");
            notificationsContainer.id = "notifications-container";
            document.body.appendChild(notificationsContainer);
        }

        // Create notification element
        const notification = document.createElement("div");
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button class="close-btn">&times;</button>
            </div>
        `;

        // Add to container
        notificationsContainer.appendChild(notification);

        // Add event listener to close button
        const closeBtn = notification.querySelector(".close-btn");
        closeBtn.addEventListener("click", () => {
            notification.remove();
        });

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.classList.add("fade-out");
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 5000);
    }
}

// Generate QR Code function
function generateQRCode(data, elementId) {
    try {
        // Check if data is an object or string
        const qrText = typeof data === 'object' ? JSON.stringify(data) : String(data);
        console.log("Generating QR code for:", qrText);

        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`Element with ID ${elementId} not found`);
            return false;
        }

        // Clear previous QR code
        element.innerHTML = '';

        // Create new QR code
        new QRCode(element, {
            text: qrText,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        return true;
    } catch (error) {
        console.error("Error generating QR code:", error);
        return false;
    }
}

// Generate a random barcode for new products
function generateRandomBarcode() {
    const prefix = "890"; // Example: Country code for India
    const randomPart = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    return prefix + randomPart;
}

// Create a singleton instance
const barcodeScanner = new BarcodeScanner();

export { barcodeScanner, generateQRCode, generateRandomBarcode }; 