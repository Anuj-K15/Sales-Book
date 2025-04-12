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
            console.log("Creating Html5Qrcode instance for container:", containerId);

            // First, add a loading indicator
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'scanner-loading';
            loadingDiv.innerHTML = '<div>Activating camera...</div>';
            readerElement.appendChild(loadingDiv);

            // Create new scanner instance
            this.html5QrcodeScanner = new Html5Qrcode(containerId);

            // Check if we're on a mobile device
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            console.log("Device detection:", isMobile ? "Mobile device" : "Desktop device");

            // Configure camera options - use back camera on mobile
            const cameraConfig = {
                facingMode: "environment"
            };

            // Scanner configuration
            const config = {
                fps: isMobile ? 10 : 15,
                qrbox: isMobile ? { width: 200, height: 200 } : { width: 300, height: 300 },
                aspectRatio: 1.0,
                disableFlip: false,
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.CODE_128
                ]
            };

            console.log(`Starting scanner with config:`, config);
            console.log(`Camera options:`, cameraConfig);

            // Make onProductFound globally accessible for this scan session
            window._barcodeProductCallback = onProductFound;

            // Request camera permission explicitly on mobile
            if (isMobile) {
                try {
                    console.log("Requesting camera permission on mobile...");
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: "environment" }
                    });

                    // Stop the stream immediately, just checking for permission
                    stream.getTracks().forEach(track => track.stop());
                    console.log("✅ Camera permission granted");
                } catch (permError) {
                    console.error("❌ Camera permission denied:", permError);
                    window.showNotification?.("Camera permission required for scanning", "error");
                    throw new Error("Camera permission denied");
                }
            }

            // Start the scanner with a small delay to ensure DOM is updated
            await new Promise(resolve => setTimeout(resolve, 300));

            // Remove loading indicator
            if (loadingDiv.parentNode) {
                loadingDiv.parentNode.removeChild(loadingDiv);
            }

            console.log("Starting scanner now...");

            await this.html5QrcodeScanner.start(
                cameraConfig,
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

                    // Show scanning notification
                    window.showNotification?.("Code detected! Processing...", "info");

                    // Process the scan with global fallback
                    try {
                        await this.handleScan(decodedText, window._barcodeProductCallback || onProductFound);
                    } catch (err) {
                        console.error("Error in scan handler:", err);
                        window.showNotification?.("Error processing scan: " + err.message, "error");
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
            console.log("✅ Scanner started successfully");
        } catch (err) {
            console.error("❌ Error initializing scanner:", err);
            window.showNotification?.("Scanner error: " + (err.message || "Unknown error"), "error");
            throw err;
        }
    }

    async stopScanner() {
        if (this.html5QrcodeScanner) {
            try {
                console.log("Stopping scanner...");
                if (this.isScanning) {
                    await this.html5QrcodeScanner.stop();
                    console.log("Scanner stopped successfully");
                }

                // Clean up scanner state regardless of previous state
                this.isScanning = false;
                this.lastScannedCode = null;
                this.scanCooldown = false;

                // Give time for the camera to fully release
                await new Promise(resolve => setTimeout(resolve, 300));

                return true;
            } catch (err) {
                console.error("Error stopping scanner:", err);
                // Continue with cleanup even if stop fails
                this.isScanning = false;
                this.lastScannedCode = null;
                return false;
            }
        }
        return true;
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

                // Try stripping leading zeros as sometimes scanners add them
                if (normalizedInputBarcode.startsWith('0')) {
                    const withoutLeadingZeros = normalizedInputBarcode.replace(/^0+/, '');
                    console.log(`🔍 Trying without leading zeros: "${withoutLeadingZeros}"`);

                    const noZerosMatch = products.find(product => {
                        if (!product.barcode) return false;
                        const productBarcodeNoZeros = product.barcode.toString().trim().replace(/^0+/, '');
                        const matches = productBarcodeNoZeros === withoutLeadingZeros;
                        console.log(`🔄 Comparing no zeros: "${productBarcodeNoZeros}" vs "${withoutLeadingZeros}" = ${matches}`);
                        return matches;
                    });

                    if (noZerosMatch) {
                        console.log("✅ Match found without leading zeros:", noZerosMatch);
                        return noZerosMatch;
                    }
                }

                // Special handling for EAN-13 format
                if (normalizedInputBarcode.length === 13) {
                    console.log("🔍 Detected EAN-13 format, trying different variations");

                    // Try without check digit (last digit)
                    const withoutCheckDigit = normalizedInputBarcode.substring(0, 12);
                    console.log(`🔍 Trying without check digit: "${withoutCheckDigit}"`);

                    const noCheckDigitMatch = products.find(product => {
                        if (!product.barcode) return false;
                        return product.barcode.toString().trim().includes(withoutCheckDigit);
                    });

                    if (noCheckDigitMatch) {
                        console.log("✅ Match found without check digit:", noCheckDigitMatch);
                        return noCheckDigitMatch;
                    }

                    // Try with just the first 8 digits (sometimes used as product code)
                    const firstEightDigits = normalizedInputBarcode.substring(0, 8);
                    console.log(`🔍 Trying first 8 digits: "${firstEightDigits}"`);

                    const firstEightMatch = products.find(product => {
                        if (!product.barcode) return false;
                        return product.barcode.toString().trim().includes(firstEightDigits);
                    });

                    if (firstEightMatch) {
                        console.log("✅ Match found with first 8 digits:", firstEightMatch);
                        return firstEightMatch;
                    }
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

            // Create prompt container
            const promptDiv = document.createElement('div');
            promptDiv.id = 'barcode-prompt';
            promptDiv.style.position = 'fixed';
            promptDiv.style.top = '50%';
            promptDiv.style.left = '50%';
            promptDiv.style.transform = 'translate(-50%, -50%)';
            promptDiv.style.backgroundColor = 'white';
            promptDiv.style.padding = '20px';
            promptDiv.style.borderRadius = '10px';
            promptDiv.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
            promptDiv.style.zIndex = '2000';
            promptDiv.style.width = '90%';
            promptDiv.style.maxWidth = '350px';
            promptDiv.style.textAlign = 'center';

            // Add content
            promptDiv.innerHTML = `
                <h3 style="margin-top:0;color:#333;">Product Not Found</h3>
                <p>Barcode: <strong>${barcode}</strong></p>
                <p>This product is not in your database. Would you like to add it?</p>
                <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">
                    <button id="cancel-add-product" style="padding:10px 15px;background:#f44336;color:white;border:none;border-radius:5px;cursor:pointer;">Cancel</button>
                    <button id="confirm-add-product" style="padding:10px 15px;background:#4CAF50;color:white;border:none;border-radius:5px;cursor:pointer;">Add Product</button>
                </div>
            `;

            document.body.appendChild(promptDiv);

            // Add event listeners
            document.getElementById('cancel-add-product').addEventListener('click', () => {
                promptDiv.remove();
                resolve(false);
            });

            document.getElementById('confirm-add-product').addEventListener('click', () => {
                promptDiv.remove();
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

            // Create form container
            const formDiv = document.createElement('div');
            formDiv.id = 'temp-product-form';
            formDiv.style.position = 'fixed';
            formDiv.style.top = '50%';
            formDiv.style.left = '50%';
            formDiv.style.transform = 'translate(-50%, -50%)';
            formDiv.style.backgroundColor = 'white';
            formDiv.style.padding = '20px';
            formDiv.style.borderRadius = '10px';
            formDiv.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
            formDiv.style.zIndex = '2000';
            formDiv.style.width = '90%';
            formDiv.style.maxWidth = '350px';

            // Add form fields
            formDiv.innerHTML = `
                <h3 style="margin-top:0;color:#333;text-align:center;">Add New Product</h3>
                <p style="text-align:center;">Barcode: <strong>${barcode}</strong></p>
                <form id="quick-product-form">
                    <div style="margin-bottom:15px;">
                        <label for="quick-product-name" style="display:block;margin-bottom:5px;font-weight:bold;">Product Name:</label>
                        <input type="text" id="quick-product-name" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;" required>
                    </div>
                    <div style="margin-bottom:15px;">
                        <label for="quick-product-price" style="display:block;margin-bottom:5px;font-weight:bold;">Price (₹):</label>
                        <input type="number" id="quick-product-price" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;" min="1" required>
                    </div>
                    <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">
                        <button type="button" id="cancel-quick-product" style="padding:10px 15px;background:#f44336;color:white;border:none;border-radius:5px;cursor:pointer;">Cancel</button>
                        <button type="submit" style="padding:10px 15px;background:#4CAF50;color:white;border:none;border-radius:5px;cursor:pointer;">Save Product</button>
                    </div>
                </form>
            `;

            document.body.appendChild(formDiv);

            // Add event listeners
            document.getElementById('cancel-quick-product').addEventListener('click', () => {
                formDiv.remove();
                resolve(null);
            });

            document.getElementById('quick-product-form').addEventListener('submit', (e) => {
                e.preventDefault();

                const name = document.getElementById('quick-product-name').value;
                const price = parseFloat(document.getElementById('quick-product-price').value);

                if (!name || !price) {
                    window.showNotification?.("Please fill in all fields", "error");
                    return;
                }

                formDiv.remove();

                // Add the new product to Firestore if possible
                this.saveNewProduct(barcode, name, price);

                // Return a temporary product to add to cart
                resolve({
                    id: `temp_${Date.now()}`,
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
                return;
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
            window.showNotification?.(`Added new product: ${name}`, "success");

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

// Make sure functions are globally available
window.testBarcodeSearch = testBarcodeSearch;
window.showNotification = showNotification; 