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
            this.html5QrcodeScanner = new Html5Qrcode(containerId);
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };

            await this.html5QrcodeScanner.start(
                { facingMode: "environment" },
                config,
                async (decodedText) => {
                    await this.handleScan(decodedText, onProductFound);
                },
                (errorMessage) => {
                    // Handle scan error silently
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
            } catch (err) {
                console.error("Error stopping scanner:", err);
            }
        }
    }

    async handleScan(scannedCode, onProductFound) {
        try {
            // Search for product in Firestore
            const productsRef = collection(db, "products");
            const q = query(productsRef, where("barcode", "==", scannedCode));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const product = {
                    id: snapshot.docs[0].id,
                    ...snapshot.docs[0].data()
                };
                await this.stopScanner();
                onProductFound(product);
            } else {
                // Product not found
                showNotification("Product not found", "error");
            }
        } catch (err) {
            console.error("Error processing scan:", err);
            showNotification("Error processing scan", "error");
        }
    }
}

// QR Code generation functionality
export function generateQRCode(data, elementId) {
    try {
        const qr = new QRCode(document.getElementById(elementId), {
            text: JSON.stringify(data),
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
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

export const barcodeScanner = new BarcodeScanner(); 