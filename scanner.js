// Scanner functionality for BeerZone
import { db } from "./firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class BarcodeScanner {
    constructor() {
        this.html5QrcodeScanner = null;
        this.isScanning = false;
    }

    async initializeScanner(containerId, onProductFound) {
        try {
            if (this.isScanning) {
                await this.stopScanner();
            }
            
            this.html5QrcodeScanner = new Html5Qrcode(containerId);
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };

            console.log("Starting scanner...");
            await this.html5QrcodeScanner.start(
                { facingMode: "environment" },
                config,
                async (decodedText) => {
                    console.log("Scanned code:", decodedText);
                    await this.handleScan(decodedText, onProductFound);
                },
                (errorMessage) => {
                    // Handle scan error silently
                    console.log("Scanner error (non-fatal):", errorMessage);
                }
            );
            this.isScanning = true;
        } catch (err) {
            console.error("Error initializing scanner:", err);
            throw err;
        }
    }

    async stopScanner() {
        if (this.html5QrcodeScanner && this.isScanning) {
            try {
                await this.html5QrcodeScanner.stop();
                this.isScanning = false;
                console.log("Scanner stopped");
            } catch (err) {
                console.error("Error stopping scanner:", err);
            }
        }
    }

    async handleScan(scannedCode, onProductFound) {
        try {
            console.log("Processing scanned code:", scannedCode);
            
            // For add-product page, just return the code
            if (typeof onProductFound === 'function' && onProductFound.length === 1) {
                await this.stopScanner();
                onProductFound(scannedCode);
                return;
            }
            
            // For record page, search for the product
            const productsRef = collection(db, "products");
            const q = query(productsRef, where("barcode", "==", scannedCode));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const product = {
                    id: snapshot.docs[0].id,
                    ...snapshot.docs[0].data()
                };
                console.log("Product found:", product);
                await this.stopScanner();
                onProductFound(product);
            } else {
                // Product not found
                console.log("Product not found for barcode:", scannedCode);
                showNotification("Product not found for barcode: " + scannedCode, "error");
            }
        } catch (err) {
            console.error("Error processing scan:", err);
            showNotification("Error processing scan: " + err.message, "error");
        }
    }
}

// QR Code generation functionality
export function generateQRCode(data, elementId) {
    try {
        // Clear any existing QR code
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = '';
        }
        
        const qr = new QRCode(element, {
            text: typeof data === 'string' ? data : JSON.stringify(data),
            width: 128,
            height: 128,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
        return qr;
    } catch (err) {
        console.error("Error generating QR code:", err);
        throw err;
    }
}

// Notification helper
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

// Create a single instance
export const barcodeScanner = new BarcodeScanner(); 