// Scanner functionality for BeerZone
import { db } from "./firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class BarcodeScanner {
    constructor() {
        this.html5QrcodeScanner = null;
        this.isScanning = false;
        this.lastScannedCode = null; // Prevent duplicate scans
        this.scanCooldown = false; // Prevent rapid successive scans
    }

    async initializeScanner(containerId, onProductFound) {
        try {
            if (this.isScanning) {
                await this.stopScanner();
            }

            const readerElement = document.getElementById(containerId);
            if (!readerElement) {
                throw new Error(`Scanner element with ID "${containerId}" not found`);
            }

            // Clear the element to ensure clean initialization
            while (readerElement.firstChild) {
                readerElement.removeChild(readerElement.firstChild);
            }

            // Create scanner with mobile-optimized settings
            this.html5QrcodeScanner = new Html5Qrcode(containerId);

            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const config = {
                fps: isMobile ? 5 : 10, // Lower FPS on mobile for better performance
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.CODE_128
                ]
            };

            console.log(`Starting scanner on ${isMobile ? 'mobile' : 'desktop'} device...`);

            // Make onProductFound globally accessible for this scan session
            window._barcodeProductCallback = onProductFound;

            await this.html5QrcodeScanner.start(
                { facingMode: "environment" }, // Use back camera on mobile
                config,
                async (decodedText) => {
                    console.log("Scanned code:", decodedText);

                    // Prevent duplicate scans or too frequent scans
                    if (this.scanCooldown || decodedText === this.lastScannedCode) {
                        console.log("Ignoring duplicate or rapid scan");
                        return;
                    }

                    this.lastScannedCode = decodedText;
                    this.scanCooldown = true;

                    // Process the scan with global fallback
                    try {
                        await this.handleScan(decodedText, window._barcodeProductCallback || onProductFound);
                    } catch (err) {
                        console.error("Error in scan handler:", err);
                    }

                    // Reset cooldown after 1.5 seconds
                    setTimeout(() => {
                        this.scanCooldown = false;
                    }, 1500);
                },
                (errorMessage) => {
                    // Handle scan error silently
                    console.log("Scanner error (non-fatal):", errorMessage);
                }
            );

            this.isScanning = true;
            console.log("Scanner started successfully");
        } catch (err) {
            console.error("Error initializing scanner:", err);
            window.showNotification?.("Scanner error: " + (err.message || "Unknown error"), "error");
            throw err;
        }
    }

    async stopScanner() {
        if (this.html5QrcodeScanner && this.isScanning) {
            try {
                await this.html5QrcodeScanner.stop();
                this.isScanning = false;
                this.lastScannedCode = null;
                console.log("Scanner stopped");
            } catch (err) {
                console.error("Error stopping scanner:", err);
            }
        }
    }

    async handleScan(scannedCode, onProductFound) {
        try {
            console.log("Processing scanned code:", scannedCode);
            console.log("Callback type:", typeof onProductFound);

            if (!scannedCode || scannedCode.trim() === "") {
                console.error("Empty barcode scanned");
                window.showNotification?.("Empty or invalid barcode scanned", "error");
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
                    console.log("✅ PRODUCT FOUND:", product);
                    await this.stopScanner();

                    // Try multiple approaches to ensure the product is added to cart
                    if (typeof onProductFound === 'function') {
                        try {
                            // 1. Try the callback directly
                            onProductFound(product);
                            console.log("✅ Product callback executed successfully");
                        } catch (callbackError) {
                            console.error("❌ Error in product callback:", callbackError);

                            // 2. Try global handleScannedProduct as fallback
                            if (typeof window.handleScannedProduct === 'function') {
                                try {
                                    window.handleScannedProduct(product);
                                    console.log("✅ Product added via global handleScannedProduct");
                                } catch (globalError) {
                                    console.error("❌ Error in global handleScannedProduct:", globalError);

                                    // 3. Last resort - try direct cart addition
                                    if (typeof window.addToCart === 'function') {
                                        try {
                                            window.addToCart(product.id, product.name, product.price, null, 1);
                                            console.log("✅ Product added via direct addToCart");
                                        } catch (cartError) {
                                            console.error("❌ Error in direct addToCart:", cartError);
                                            window.showNotification?.("Error adding product to cart", "error");
                                        }
                                    } else {
                                        window.showNotification?.("Cannot add product to cart: addToCart not available", "error");
                                    }
                                }
                            } else {
                                window.showNotification?.("Cannot add product to cart: handler not available", "error");
                            }
                        }
                    } else {
                        console.error("❌ Product found but callback is not a function:", typeof onProductFound);

                        // Try global function as fallback
                        if (typeof window.handleScannedProduct === 'function') {
                            try {
                                window.handleScannedProduct(product);
                                console.log("✅ Product added via global handleScannedProduct as fallback");
                            } catch (error) {
                                console.error("❌ Error in fallback handleScannedProduct:", error);
                                window.showNotification?.("Error adding product to cart", "error");
                            }
                        } else {
                            window.showNotification?.("Internal error: Invalid callback", "error");
                        }
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

                // Show a dialog to ask if the user wants to add this product
                const shouldAddProduct = await this.showAddProductPrompt(normalizedCode);

                if (shouldAddProduct) {
                    console.log("User chose to add the product with barcode:", normalizedCode);
                    // Create a temporary product with the scanned barcode
                    const tempProduct = await this.createTempProduct(normalizedCode);
                    if (tempProduct) {
                        await this.stopScanner();
                        if (typeof onProductFound === 'function') {
                            onProductFound(tempProduct);
                        } else if (typeof window.handleScannedProduct === 'function') {
                            window.handleScannedProduct(tempProduct);
                        }
                        return;
                    }
                } else {
                    window.showNotification?.("Product not found for barcode: " + normalizedCode, "error");
                }
            } catch (searchError) {
                console.error("Error searching for product:", searchError);
                window.showNotification?.("Error searching for product: " + searchError.message, "error");
            }
        } catch (err) {
            console.error("Error processing scan:", err);
            window.showNotification?.("Error processing scan: " + err.message, "error");
        }
    }

    // Helper method to find products by barcode - IMPROVED VERSION
    async findProductByBarcode(barcode) {
        console.log("🔍 Searching for barcode:", barcode);

        if (!barcode || barcode.trim() === "") {
            console.error("Invalid barcode provided:", barcode);
            return null;
        }

        try {
            // Normalize barcode for consistent comparison - this is critical
            const normalizedInputBarcode = barcode.trim();
            console.log(`🔍 Normalized input barcode: "${normalizedInputBarcode}"`);

            // Log additional debugging info about the query we're about to make
            console.log(`🔍 Running Firestore query for barcode: "${normalizedInputBarcode}"`);

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

            // If no exact match, get all products and do more flexible matching
            console.log("⚠️ No exact match found, retrieving all products for manual comparison");
            const allProductsQuery = query(productsRef);
            snapshot = await getDocs(allProductsQuery);

            if (snapshot.empty) {
                console.log("❌ No products found in database at all");
                return null;
            }

            console.log(`📊 Retrieved ${snapshot.size} total products for manual comparison`);

            // Convert snapshots to array for easier processing
            const products = snapshot.docs.map(doc => {
                const data = doc.data();
                // Make sure barcode is always a string for consistent comparison
                if (data.barcode !== undefined && data.barcode !== null) {
                    data.barcode = String(data.barcode).trim();
                }
                return {
                    id: doc.id,
                    ...data
                };
            });

            // Log all product barcodes for debugging
            console.log("Available product barcodes:", products.map(p => p.barcode || "undefined"));

            // Try case-insensitive comparison
            console.log("🔍 Trying case-insensitive comparison");
            const lowerInputBarcode = normalizedInputBarcode.toLowerCase();
            let caseInsensitiveMatch = null;

            for (const product of products) {
                if (!product.barcode) continue;

                const productBarcode = String(product.barcode).trim().toLowerCase();
                console.log(`🔄 Comparing: "${productBarcode}" vs "${lowerInputBarcode}"`);

                if (productBarcode === lowerInputBarcode) {
                    caseInsensitiveMatch = product;
                    console.log("✅ Match found via case-insensitive comparison:", product);
                    break;
                }
            }

            if (caseInsensitiveMatch) {
                return caseInsensitiveMatch;
            }

            // Try more lenient comparison (removing spaces and special chars)
            console.log("⚠️ No case-insensitive match, trying more lenient comparison...");
            const cleanInputBarcode = lowerInputBarcode.replace(/[^a-z0-9]/gi, '');
            console.log(`🔍 Cleaned input barcode: "${cleanInputBarcode}"`);

            let lenientMatch = null;

            for (const product of products) {
                if (!product.barcode) continue;

                const cleanProductBarcode = String(product.barcode).trim().toLowerCase().replace(/[^a-z0-9]/gi, '');
                console.log(`🔄 Comparing clean: "${cleanProductBarcode}" vs "${cleanInputBarcode}"`);

                if (cleanProductBarcode === cleanInputBarcode) {
                    lenientMatch = product;
                    console.log("✅ Match found via cleaned comparison:", product);
                    break;
                }
            }

            if (lenientMatch) {
                return lenientMatch;
            }

            // If all else fails, try numeric comparison for numeric barcodes
            if (/^\d+$/.test(normalizedInputBarcode)) {
                console.log("⚠️ Trying numeric comparison for numeric barcode");
                const numericInputBarcode = parseInt(normalizedInputBarcode, 10);

                let numericMatch = null;

                for (const product of products) {
                    if (!product.barcode) continue;

                    const productBarcode = String(product.barcode).trim();
                    if (!/^\d+$/.test(productBarcode)) continue;

                    const numericProductBarcode = parseInt(productBarcode, 10);
                    console.log(`🔄 Comparing numeric: ${numericProductBarcode} vs ${numericInputBarcode}`);

                    if (numericProductBarcode === numericInputBarcode) {
                        numericMatch = product;
                        console.log("✅ Match found via numeric comparison:", product);
                        break;
                    }
                }

                if (numericMatch) {
                    return numericMatch;
                }

                // Try stripping leading zeros as sometimes scanners add them
                if (normalizedInputBarcode.startsWith('0')) {
                    const withoutLeadingZeros = normalizedInputBarcode.replace(/^0+/, '');
                    console.log(`🔍 Trying without leading zeros: "${withoutLeadingZeros}"`);

                    let noZerosMatch = null;

                    for (const product of products) {
                        if (!product.barcode) continue;

                        const productBarcodeNoZeros = String(product.barcode).trim().replace(/^0+/, '');
                        console.log(`🔄 Comparing no zeros: "${productBarcodeNoZeros}" vs "${withoutLeadingZeros}"`);

                        if (productBarcodeNoZeros === withoutLeadingZeros) {
                            noZerosMatch = product;
                            console.log("✅ Match found without leading zeros:", product);
                            break;
                        }
                    }

                    if (noZerosMatch) {
                        return noZerosMatch;
                    }
                }

                // Try partial match for numeric barcodes - some scanners might truncate or add digits
                console.log("⚠️ Trying partial match...");

                let bestPartialMatch = null;
                let bestMatchLength = 0;

                for (const product of products) {
                    if (!product.barcode) continue;

                    const productBarcode = String(product.barcode).trim();

                    // Check if one contains the other
                    if (productBarcode.includes(normalizedInputBarcode) ||
                        normalizedInputBarcode.includes(productBarcode)) {

                        const matchLength = Math.min(productBarcode.length, normalizedInputBarcode.length);

                        if (matchLength > bestMatchLength) {
                            bestPartialMatch = product;
                            bestMatchLength = matchLength;
                            console.log(`✅ Found partial match: ${productBarcode} with overlap of ${matchLength} digits`);
                        }
                    }
                }

                if (bestPartialMatch) {
                    console.log("✅ Using best partial match:", bestPartialMatch);
                    return bestPartialMatch;
                }
            }

            console.log("❌ No match found for barcode after all attempts");
            return null;
        } catch (error) {
            console.error("Error searching for product by barcode:", error);
            return null;
        }
    }

    // Helper method to prompt user to add a product that was not found
    async showAddProductPrompt(barcode) {
        return new Promise((resolve) => {
            // Check if we already have a prompt showing
            if (document.getElementById('barcode-prompt')) {
                document.getElementById('barcode-prompt').remove();
            }

            // Remove any existing backdrop
            if (document.getElementById('prompt-backdrop')) {
                document.getElementById('prompt-backdrop').remove();
            }

            // Create backdrop
            const backdrop = document.createElement('div');
            backdrop.id = 'prompt-backdrop';
            backdrop.className = 'prompt-backdrop';
            document.body.appendChild(backdrop);

            // Create prompt container
            const promptDiv = document.createElement('div');
            promptDiv.id = 'barcode-prompt';

            // Add content
            promptDiv.innerHTML = `
                <h3>Product Not Found</h3>
                <p>Barcode: <span class="barcode-value">${barcode}</span></p>
                <p>This product is not in your database. Would you like to add it?</p>
                <div class="prompt-buttons">
                    <button id="cancel-add-product" class="cancel-btn">Cancel</button>
                    <button id="confirm-add-product" class="confirm-btn">Add Product</button>
                </div>
            `;

            document.body.appendChild(promptDiv);

            // Add event listeners
            document.getElementById('cancel-add-product').addEventListener('click', () => {
                promptDiv.remove();
                backdrop.remove();
                resolve(false);
            });

            document.getElementById('confirm-add-product').addEventListener('click', () => {
                promptDiv.remove();
                // Don't remove backdrop, as we'll use it for the next prompt
                resolve(true);
            });
        });
    }

    // Helper method to create a temporary product with user input
    async createTempProduct(barcode) {
        return new Promise((resolve) => {
            // Check if we already have a form showing
            if (document.getElementById('temp-product-form')) {
                document.getElementById('temp-product-form').remove();
            }

            // Create backdrop if it doesn't exist
            let backdrop = document.getElementById('prompt-backdrop');
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.id = 'prompt-backdrop';
                backdrop.className = 'prompt-backdrop';
                document.body.appendChild(backdrop);
            }

            // Create form container
            const formDiv = document.createElement('div');
            formDiv.id = 'temp-product-form';

            // Add form fields
            formDiv.innerHTML = `
                <h3>Add New Product</h3>
                <p>Barcode: <span class="barcode-value">${barcode}</span></p>
                <form id="quick-product-form">
                    <div>
                        <label for="quick-product-name">Product Name:</label>
                        <input type="text" id="quick-product-name" placeholder="Enter product name" autocomplete="off" required>
                    </div>
                    <div>
                        <label for="quick-product-price">Price (₹):</label>
                        <input type="number" id="quick-product-price" placeholder="Enter price" min="1" step="any" required>
                    </div>
                    <div class="prompt-buttons">
                        <button type="button" id="cancel-quick-product" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Save Product</button>
                    </div>
                </form>
            `;

            document.body.appendChild(formDiv);

            // Focus the first input
            setTimeout(() => {
                document.getElementById('quick-product-name').focus();
            }, 100);

            // Add event listeners
            document.getElementById('cancel-quick-product').addEventListener('click', () => {
                formDiv.remove();
                backdrop.remove();
                resolve(null);
            });

            document.getElementById('quick-product-form').addEventListener('submit', async (e) => {
                e.preventDefault();

                const name = document.getElementById('quick-product-name').value;
                const price = parseFloat(document.getElementById('quick-product-price').value);

                if (!name || !price) {
                    window.showNotification?.("Please fill in all fields", "error");
                    return;
                }

                formDiv.remove();
                backdrop.remove();

                // Show saving notification
                window.showNotification?.("Saving product...", "info");

                // Add the new product to Firestore if possible
                const productId = await this.saveNewProduct(barcode, name, price);

                // Return a product object to add to cart
                resolve({
                    id: productId || `temp_${Date.now()}`,
                    name: name,
                    price: price,
                    barcode: barcode
                });
            });
        });
    }

    // Helper method to save a new product to Firestore
    async saveNewProduct(barcode, name, price) {
        try {
            if (!db) {
                console.error("Firestore not available");
                return null;
            }

            const productsRef = collection(db, "products");
            const newProduct = {
                name: name,
                price: price,
                barcode: barcode,
                createdAt: new Date().toISOString()
            };

            console.log("Adding new product to database:", newProduct);

            // Import the needed function
            const { addDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

            // Add to Firestore
            const docRef = await addDoc(productsRef, newProduct);
            console.log("✅ Product added with ID:", docRef.id);
            window.showNotification?.(`Product "${name}" added successfully`, "success");

            return docRef.id;
        } catch (error) {
            console.error("Error saving new product:", error);
            window.showNotification?.("Could not save product to database, but added to cart", "info");
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

// Notification helper - also expose globally for mobile access
function showNotification(message, type = 'info') {
    console.log(`Notification (${type}):`, message);

    // Make sure this function is available globally
    if (typeof window.showNotification !== 'function') {
        window.showNotification = showNotification;
    }

    // Remove any existing notifications with the same message
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
        if (notification.textContent === message) {
            notification.remove();
        }
    });

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Add different icons based on notification type
    let icon = '';
    switch (type) {
        case 'success':
            icon = '✅';
            break;
        case 'error':
            icon = '❌';
            break;
        case 'info':
            icon = 'ℹ️';
            break;
        case 'warning':
            icon = '⚠️';
            break;
    }

    if (icon) {
        notification.innerHTML = `<span class="notification-icon">${icon}</span> ${message}`;
    }

    document.body.appendChild(notification);

    // Add animation class after a brief delay
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.add('hiding');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Create a single instance and make it globally available for mobile
export const barcodeScanner = new BarcodeScanner();
window.barcodeScanner = barcodeScanner; // Make globally available

// Test function for manual barcode testing
export async function testBarcodeSearch(barcode) {
    console.log("🧪 Testing barcode search for:", barcode);
    if (!barcode) {
        console.error("No barcode provided for testing");
        return null;
    }

    try {
        // Normalize the barcode for consistent comparison
        const normalizedBarcode = barcode.toString().trim();
        console.log("🔍 Normalized barcode for search:", normalizedBarcode);

        // First try using the scanner's findProductByBarcode method
        const scanner = barcodeScanner;
        console.log("🔄 Using scanner.findProductByBarcode() method...");
        const product = await scanner.findProductByBarcode(normalizedBarcode);

        if (product) {
            console.log("✅ Found product via scanner method:", product);
            return product;
        }

        // If not found, try a direct Firestore query with exact match
        console.log("❌ No product found via scanner method, trying direct Firestore query...");
        const productsRef = collection(db, "products");

        // Log all products and their barcodes for debugging
        console.log("📋 Retrieving all products to check available barcodes:");
        const debugQuery = query(productsRef);
        const debugSnapshot = await getDocs(debugQuery);

        if (debugSnapshot.empty) {
            console.log("❌ No products found in database at all!");
            return null;
        }

        const allProducts = debugSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                barcode: data.barcode
            };
        });

        console.table(allProducts);

        // Continue with exact match query
        console.log("🔍 Trying exact match query with barcode:", normalizedBarcode);
        const exactQuery = query(productsRef, where("barcode", "==", normalizedBarcode));
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
        console.log("💡 Suggestion: Try adding a product with this exact barcode.");
        return null;
    } catch (error) {
        console.error("Error in test barcode search:", error);
        return null;
    }
}

// Make sure functions are globally available
window.testBarcodeSearch = testBarcodeSearch;
window.showNotification = showNotification;