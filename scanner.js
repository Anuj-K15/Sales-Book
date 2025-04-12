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

            if (!scannedCode || scannedCode.trim() === "") {
                console.error("Empty barcode scanned");
                showNotification("Empty or invalid barcode scanned", "error");
                return;
            }

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
                // Use our enhanced findProductByBarcode method
                const product = await this.findProductByBarcode(normalizedCode);

                // If product found, stop scanner and return it
                if (product) {
                    console.log("✅ PRODUCT FOUND - ADDING TO CART:", product);
                    await this.stopScanner();

                    // Make sure the callback is called with the product
                    if (typeof onProductFound === 'function') {
                        try {
                            onProductFound(product);
                            console.log("✅ Product callback executed successfully");
                        } catch (callbackError) {
                            console.error("❌ Error in product callback:", callbackError);
                            showNotification("Error adding product to cart: " + callbackError.message, "error");
                        }
                    } else {
                        console.error("❌ Product found but callback is not a function:", typeof onProductFound);
                        showNotification("Internal error: Invalid callback", "error");
                    }
                    return;
                }

                // If no product found but code looks like JSON, try to parse it
                if (normalizedCode.includes('{') && normalizedCode.includes('}')) {
                    try {
                        console.log("Attempting to parse QR code as JSON data");
                        const productData = JSON.parse(normalizedCode);

                        // If JSON has a barcode field, try to find product by that barcode
                        if (productData.barcode) {
                            const productByJsonBarcode = await this.findProductByBarcode(productData.barcode);
                            if (productByJsonBarcode) {
                                console.log("Product found via embedded barcode:", productByJsonBarcode);
                                await this.stopScanner();
                                onProductFound(productByJsonBarcode);
                                return;
                            }
                        }

                        // If we have a name and price but no product found, create a temporary one
                        if (productData.name && productData.price) {
                            console.log("Creating temporary product from QR data:", productData);
                            const tempProduct = {
                                id: `temp_${Date.now()}`,
                                name: productData.name,
                                price: productData.price,
                                barcode: productData.barcode || normalizedCode
                            };
                            await this.stopScanner();
                            onProductFound(tempProduct);
                            return;
                        }
                    } catch (jsonError) {
                        console.error("Error parsing QR JSON data:", jsonError);
                    }
                }

                // If we get here, no product was found
                console.log("❌ Product not found for barcode:", normalizedCode);
                showNotification("Product not found for barcode: " + normalizedCode, "error");
            } catch (searchError) {
                console.error("Error searching for product:", searchError);
                showNotification("Error searching for product: " + searchError.message, "error");
            }
        } catch (err) {
            console.error("Error processing scan:", err);
            showNotification("Error processing scan: " + err.message, "error");
        }
    }

    // Helper method to find products by barcode - FIXED VERSION
    async findProductByBarcode(barcode) {
        console.log("🔍 Searching for barcode:", barcode);

        if (!barcode || barcode.trim() === "") {
            console.error("Invalid barcode provided:", barcode);
            return null;
        }

        try {
            // Normalize barcode for consistent comparison
            const normalizedInputBarcode = barcode.trim();
            console.log(`🔍 Normalized input barcode: "${normalizedInputBarcode}"`);

            // Try to match the exact barcode
            const productsRef = collection(db, "products");
            const exactQuery = query(productsRef, where("barcode", "==", normalizedInputBarcode));
            let snapshot = await getDocs(exactQuery);

            console.log(`📊 Exact match query returned ${snapshot.size} results`);

            if (!snapshot.empty) {
                const product = {
                    id: snapshot.docs[0].id,
                    ...snapshot.docs[0].data()
                };
                console.log("✅ Exact match found:", product);
                return product;
            }

            // If no exact match, get all products and do manual comparison
            console.log("⚠️ No exact match found, trying manual comparison...");
            const allProductsQuery = query(productsRef);
            snapshot = await getDocs(allProductsQuery);

            console.log(`📊 Retrieved ${snapshot.size} total products for manual comparison`);

            // Convert snapshots to array for easier processing
            const products = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Log all product barcodes for diagnosis
            console.log("📋 All product barcodes:");
            products.forEach(product => {
                const productBarcode = product.barcode ? product.barcode.toString().trim() : "";
                console.log(`- Product: ${product.name}, Barcode: "${productBarcode}", Type: ${typeof productBarcode}`);
            });

            // Try case-insensitive comparison
            console.log("🔍 Trying case-insensitive comparison");
            const lowerInputBarcode = normalizedInputBarcode.toLowerCase();
            const caseInsensitiveMatch = products.find(product => {
                if (!product.barcode) return false;
                const productBarcode = product.barcode.toString().trim().toLowerCase();
                const matches = productBarcode === lowerInputBarcode;
                console.log(`🔄 Comparing: "${productBarcode}" vs "${lowerInputBarcode}" = ${matches}`);
                return matches;
            });

            if (caseInsensitiveMatch) {
                console.log("✅ Match found via case-insensitive comparison:", caseInsensitiveMatch);
                return caseInsensitiveMatch;
            }

            // Try more lenient comparison (removing spaces and special chars)
            console.log("⚠️ No case-insensitive match, trying more lenient comparison...");
            const cleanInputBarcode = lowerInputBarcode.replace(/[^a-z0-9]/gi, '');
            console.log(`🔍 Cleaned input barcode: "${cleanInputBarcode}"`);

            const lenientMatch = products.find(product => {
                if (!product.barcode) return false;
                const cleanProductBarcode = product.barcode.toString().trim().toLowerCase().replace(/[^a-z0-9]/gi, '');
                const matches = cleanProductBarcode === cleanInputBarcode;
                console.log(`🔄 Comparing clean: "${cleanProductBarcode}" vs "${cleanInputBarcode}" = ${matches}`);
                return matches;
            });

            if (lenientMatch) {
                console.log("✅ Match found via cleaned comparison:", lenientMatch);
                return lenientMatch;
            }

            // If all else fails, try numeric comparison for numeric barcodes
            if (/^\d+$/.test(normalizedInputBarcode)) {
                console.log("⚠️ Trying numeric comparison for numeric barcode");
                const numericInputBarcode = parseInt(normalizedInputBarcode, 10);

                const numericMatch = products.find(product => {
                    if (!product.barcode) return false;
                    const productBarcode = product.barcode.toString().trim();
                    if (!/^\d+$/.test(productBarcode)) return false;

                    const numericProductBarcode = parseInt(productBarcode, 10);
                    const matches = numericProductBarcode === numericInputBarcode;
                    console.log(`🔄 Comparing numeric: ${numericProductBarcode} vs ${numericInputBarcode} = ${matches}`);
                    return matches;
                });

                if (numericMatch) {
                    console.log("✅ Match found via numeric comparison:", numericMatch);
                    return numericMatch;
                }
            }

            console.log("❌ No match found for barcode after all attempts");
            return null;
        } catch (error) {
            console.error("Error searching for product by barcode:", error);
            return null;
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

// Test function for manual barcode testing
export async function testBarcodeSearch(barcode) {
    console.log("🧪 Testing barcode search for:", barcode);
    if (!barcode) {
        console.error("No barcode provided for testing");
        return null;
    }

    try {
        // First try using the scanner's findProductByBarcode method
        const scanner = barcodeScanner;
        const product = await scanner.findProductByBarcode(barcode);

        if (product) {
            console.log("✅ Found product via scanner method:", product);
            return product;
        }

        // If not found, try a direct Firestore query with exact match
        console.log("🔍 Trying direct Firestore query...");
        const productsRef = collection(db, "products");
        const exactQuery = query(productsRef, where("barcode", "==", barcode));
        const snapshot = await getDocs(exactQuery);

        if (!snapshot.empty) {
            const directProduct = {
                id: snapshot.docs[0].id,
                ...snapshot.docs[0].data()
            };
            console.log("✅ Found product via direct query:", directProduct);
            return directProduct;
        }

        console.log("❌ No product found for barcode:", barcode);
        return null;
    } catch (error) {
        console.error("Error in test barcode search:", error);
        return null;
    }
} 