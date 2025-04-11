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

            // Normalize the scanned code (trim whitespace and make consistent)
            const normalizedCode = scannedCode.trim();

            // Detect if we're on the add-product page by checking the URL or callback type
            const isAddProductPage = window.location.pathname.includes('add-product') ||
                (typeof onProductFound === 'function' && onProductFound.length === 1);

            if (isAddProductPage) {
                console.log("Add product page detected, returning barcode directly");
                await this.stopScanner();
                onProductFound(normalizedCode);
                return;
            }

            // For record page, search for the product
            console.log("Record page detected, searching for product with barcode:", normalizedCode);

            try {
                // First try exact match
                let product = await this.findProductByBarcode(normalizedCode);

                // If not found and the code contains JSON data (for QR codes with product info)
                if (!product && normalizedCode.includes('{') && normalizedCode.includes('}')) {
                    try {
                        const productData = JSON.parse(normalizedCode);
                        if (productData.barcode) {
                            product = await this.findProductByBarcode(productData.barcode);
                        }
                        // If we have a name and price but no product found, create a temporary one
                        if (!product && productData.name && productData.price) {
                            console.log("Creating temporary product from QR data:", productData);
                            product = {
                                id: `temp_${Date.now()}`,
                                name: productData.name,
                                price: productData.price,
                                barcode: productData.barcode || normalizedCode
                            };
                        }
                    } catch (jsonError) {
                        console.error("Error parsing QR JSON data:", jsonError);
                    }
                }

                if (product) {
                    console.log("Product found:", product);
                    await this.stopScanner();
                    onProductFound(product);
                } else {
                    // Product not found
                    console.log("Product not found for barcode:", normalizedCode);
                    showNotification("Product not found for barcode: " + normalizedCode, "error");
                }
            } catch (searchError) {
                console.error("Error searching for product:", searchError);
                showNotification("Error searching for product: " + searchError.message, "error");
            }
        } catch (err) {
            console.error("Error processing scan:", err);
            showNotification("Error processing scan: " + err.message, "error");
        }
    }

    // Helper method to find products by barcode
    async findProductByBarcode(barcode) {
        console.log("Searching for barcode:", barcode);

        // Try to match the exact barcode
        const productsRef = collection(db, "products");
        const exactQuery = query(productsRef, where("barcode", "==", barcode));
        let snapshot = await getDocs(exactQuery);

        if (!snapshot.empty) {
            return {
                id: snapshot.docs[0].id,
                ...snapshot.docs[0].data()
            };
        }

        // If no exact match, get all products and do a manual comparison
        // This handles case-insensitive matching and potential format differences
        const allProductsQuery = query(productsRef);
        snapshot = await getDocs(allProductsQuery);

        const normalizedBarcode = barcode.toLowerCase().trim();

        let matchedProduct = null;
        snapshot.forEach((doc) => {
            const product = doc.data();
            const productBarcode = (product.barcode || "").toLowerCase().trim();

            if (productBarcode === normalizedBarcode) {
                matchedProduct = {
                    id: doc.id,
                    ...product
                };
                return true; // Break the loop
            }
        });

        return matchedProduct;
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