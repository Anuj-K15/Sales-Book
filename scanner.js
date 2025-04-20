// Scanner functionality for BeerZone
import { db } from "./firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, get, child, push, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb } from "./firebase-config.js";

class BarcodeScanner {
    constructor() {
        this.html5QrcodeScanner = null;
        this.isScanning = false;
        this.lastScannedCode = null; // Prevent duplicate scans
        this.scanCooldown = false; // Prevent rapid successive scans
        this.torchEnabled = false;
    }

    async initializeScanner(containerId, onProductFound) {
        if (this.isScanning) {
            console.log("Scanner is already running");
            return;
        }

        try {
            console.log("Initializing scanner in container:", containerId);
            const readerElement = document.getElementById(containerId);

            if (!readerElement) {
                throw new Error(`Scanner container element with ID "${containerId}" not found.`);
            }

            // Clear any existing content in the reader element
            while (readerElement.firstChild) {
                readerElement.removeChild(readerElement.firstChild);
            }

            // Log more information about the environment
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            console.log(`📱 Device: ${isMobile ? 'Mobile' : 'Desktop'}, UserAgent: ${navigator.userAgent}`);

            // Add a loading spinner
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'scanner-loading';
            loadingDiv.innerHTML = 'Initializing camera...';
            readerElement.appendChild(loadingDiv);

            // Add a manual torch/flashlight toggle button
            const torchButton = document.createElement('button');
            torchButton.className = 'torch-toggle';
            torchButton.innerHTML = '<i class="fas fa-bolt"></i>';
            torchButton.title = 'Toggle Flashlight';
            torchButton.setAttribute('id', 'torch-toggle-btn');

            // Insert the torch button into the scanner container's parent, not the reader element
            const scannerContainer = readerElement.closest('.scanner-container');
            if (scannerContainer) {
                scannerContainer.appendChild(torchButton);
            } else {
                readerElement.parentElement.appendChild(torchButton);
            }

            // Add torch toggle functionality
            torchButton.addEventListener('click', async () => {
                try {
                    if (!this.html5QrcodeScanner) return;

                    // Toggle the torch state
                    this.torchEnabled = !this.torchEnabled;

                    console.log(`Toggling torch to: ${this.torchEnabled ? 'ON' : 'OFF'}`);

                    // Try multiple methods to toggle torch
                    try {
                        // Method 1: Direct torch method
                        await this.html5QrcodeScanner.torch(this.torchEnabled);
                        console.log(`Torch ${this.torchEnabled ? 'enabled' : 'disabled'} via torch method`);
                        return;
                    } catch (e) {
                        console.log("Direct torch toggle failed, trying alternatives:", e);
                    }

                    // Method 2: Using video constraints
                    try {
                        await this.html5QrcodeScanner.applyVideoConstraints({
                            advanced: [{ torch: this.torchEnabled }]
                        });
                        console.log(`Torch ${this.torchEnabled ? 'enabled' : 'disabled'} via video constraints`);
                        return;
                    } catch (e) {
                        console.log("Video constraints torch toggle failed:", e);
                    }

                    // Method 3: If scanner has underlying instance
                    if (this.html5QrcodeScanner._scanner) {
                        try {
                            await this.html5QrcodeScanner._scanner.torch(this.torchEnabled);
                            console.log(`Torch ${this.torchEnabled ? 'enabled' : 'disabled'} via underlying scanner`);
                            return;
                        } catch (e) {
                            console.log("Underlying scanner torch toggle failed:", e);
                        }
                    }

                    console.log("⚠️ Could not toggle flashlight through any method");
                    showNotification?.("Flashlight control not supported on this device", "warning");
                } catch (err) {
                    console.error("Error toggling torch:", err);
                }
            });

            // Give the browser a moment to render the container
            await new Promise(resolve => setTimeout(resolve, 300));

            // Create scanner with better mobile-optimized settings
            this.html5QrcodeScanner = new Html5Qrcode(containerId);

            // Check and log available camera devices
            try {
                const devices = await Html5Qrcode.getCameras();
                console.log(`📷 Available cameras: ${devices.length}`, devices);
            } catch (cameraError) {
                console.warn("Could not enumerate cameras", cameraError);
            }

            // Define better scanning configuration for mobile
            const config = {
                fps: isMobile ? 10 : 10, // Higher FPS for better scanning
                qrbox: isMobile ? { width: 250, height: 250 } : { width: 300, height: 300 },
                aspectRatio: 1.0,
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.CODE_93,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.ITF,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E
                ],
                disableFlip: false,
                rememberLastUsedCamera: true
            };

            console.log(`Starting scanner on ${isMobile ? 'mobile' : 'desktop'} device with config:`, config);

            // Make onProductFound globally accessible for this scan session
            window._barcodeProductCallback = onProductFound;

            // For mobile, create a more reliable camera config with torch enabled
            const cameraConfig = {
                facingMode: "environment", // Use back camera on mobile
                // Explicitly request torch/flashlight capability
                advanced: [{
                    torch: true,
                    focusMode: "continuous"
                }]
            };

            // Start the scanner with improved error handling
            await this.html5QrcodeScanner.start(
                cameraConfig,
                config,
                async (decodedText) => {
                    console.log("✅ Scanned code:", decodedText);

                    // Show feedback to user
                    window.showNotification?.(`Barcode detected: ${decodedText}`, "info");

                    // Prevent duplicate scans or too frequent scans
                    if (this.scanCooldown || decodedText === this.lastScannedCode) {
                        console.log("Ignoring duplicate or rapid scan");
                        return;
                    }

                    this.lastScannedCode = decodedText;
                    this.scanCooldown = true;

                    // Remove loading indicator if it exists
                    const loadingElement = readerElement.querySelector('.scanner-loading');
                    if (loadingElement) {
                        loadingElement.remove();
                    }

                    // Process the scan with global fallback
                    try {
                        // Add visual feedback
                        window.showNotification?.("Searching for product...", "info");

                        // Handle the scan with global callback fallback
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
                    // Only log non-fatal errors, don't show to user
                    console.log("Scanner message:", errorMessage);
                }
            ).catch(err => {
                console.error("Failed to start scanner:", err);
                window.showNotification?.("Failed to start scanner: " + err.message, "error");

                // Remove loading spinner
                const loadingElement = readerElement.querySelector('.scanner-loading');
                if (loadingElement) {
                    loadingElement.remove();
                }

                throw err;
            });

            // Try to turn on the flashlight automatically after camera starts
            try {
                console.log("Attempting to automatically turn on flashlight...");
                // Wait a short delay to ensure camera is fully initialized
                setTimeout(async () => {
                    try {
                        // Try multiple approaches to turn on the flashlight

                        // Approach 1: Direct torch method
                        try {
                            await this.html5QrcodeScanner.torch(true);
                            console.log("✅ Flashlight turned on via torch method");
                            return; // Exit if successful
                        } catch (e) {
                            console.log("Torch method failed, trying alternatives:", e);
                        }

                        // Approach 2: Use applyVideoConstraints with torch constraint
                        try {
                            await this.html5QrcodeScanner.applyVideoConstraints({
                                advanced: [{ torch: true }]
                            });
                            console.log("✅ Flashlight turned on via video constraints");
                            return; // Exit if successful
                        } catch (e) {
                            console.log("Video constraints method failed:", e);
                        }

                        // Approach 3: If the scanner has an underlying instance, try accessing that
                        if (this.html5QrcodeScanner._scanner) {
                            try {
                                await this.html5QrcodeScanner._scanner.torch(true);
                                console.log("✅ Flashlight turned on via underlying scanner");
                                return; // Exit if successful
                            } catch (e) {
                                console.log("Underlying scanner torch method failed:", e);
                            }
                        }

                        console.log("⚠️ Could not turn on flashlight through any method");
                    } catch (torchError) {
                        console.warn("Could not turn on flashlight:", torchError);
                        // Don't show an error to the user - this is an enhancement, not critical functionality
                    }
                }, 2000); // Longer delay to ensure camera is fully initialized
            } catch (error) {
                console.warn("Error with torch functionality:", error);
                // Don't show error to user - if torch fails, scanning still works
            }

            // Remove loading spinner after successful start
            const loadingElement = readerElement.querySelector('.scanner-loading');
            if (loadingElement) {
                loadingElement.remove();
            }

            this.isScanning = true;
            console.log("✅ Scanner started successfully");
        } catch (err) {
            console.error("❌ Error initializing scanner:", err);
            window.showNotification?.("Scanner error: " + (err.message || "Unknown error"), "error");
            throw err;
        }
    }

    async stopScanner() {
        if (this.html5QrcodeScanner && this.isScanning) {
            try {
                // Turn off torch if it was on
                if (this.torchEnabled) {
                    try {
                        await this.html5QrcodeScanner.torch(false);
                    } catch (torchErr) {
                        console.warn("Error turning off torch:", torchErr);
                    }
                    this.torchEnabled = false;
                }
                
                // Stop the scanner
                await this.html5QrcodeScanner.stop();
                this.isScanning = false;
                this.lastScannedCode = null;
                console.log("Scanner stopped");
                
                // Remove the torch toggle button if it exists
                const torchButton = document.getElementById('torch-toggle-btn');
                if (torchButton) {
                    torchButton.remove();
                }
            } catch (err) {
                console.error("Error stopping scanner:", err);
            }
        }
    }

    async handleScan(scannedCode, onProductFound) {
        try {
            console.log("🔍 Processing scanned code:", scannedCode);
            console.log("Callback type:", typeof onProductFound);

            if (!scannedCode || scannedCode.trim() === "") {
                console.error("❌ Empty barcode scanned");
                window.showNotification?.("Empty or invalid barcode scanned", "error");
                return;
            }

            // Normalize the scanned code (trim whitespace and make consistent)
            const normalizedCode = scannedCode.trim();

            // Detect if we're on the add-product page by checking the URL or callback type
            const isAddProductPage = window.location.pathname.includes('add-product') ||
                (typeof onProductFound === 'function' && onProductFound.name === 'setScannedBarcode');

            if (isAddProductPage) {
                console.log("Add product page detected, returning barcode directly");
                await this.stopScanner();
                onProductFound(normalizedCode);
                return;
            }

            // For record page, search for the product
            console.log("📝 Record page detected, searching for product with barcode:", normalizedCode);

            try {
                // Use our enhanced findProductByBarcode method
                const product = await this.findProductByBarcode(normalizedCode);

                // If product found, stop scanner and return it
                if (product) {
                    console.log("✅ PRODUCT FOUND:", product);
                    window.showNotification?.(`Found product: ${product.name}`, "success");

                    // Stop the scanner
                    await this.stopScanner();

                    // Make sure the product object has all required fields
                    const validatedProduct = {
                        id: product.id || `temp_${Date.now()}`,
                        name: product.name || "Unknown Product",
                        price: product.price || 0,
                        barcode: product.barcode || normalizedCode
                    };
                    console.log("Validated product for cart:", validatedProduct);

                    // Try multiple approaches to ensure the product is added to cart
                    if (typeof window.handleScannedProduct === 'function') {
                        try {
                            console.log("Calling global handleScannedProduct function");
                            window.handleScannedProduct(validatedProduct);
                            console.log("✅ Product added via global handleScannedProduct");
                            return;
                        } catch (globalError) {
                            console.error("❌ Error in global handleScannedProduct:", globalError);
                        }
                    }

                    // If we get here, try the provided callback directly
                    if (typeof onProductFound === 'function') {
                        try {
                            console.log("Calling provided callback function directly");
                            onProductFound(validatedProduct);
                            console.log("✅ Product callback executed successfully");
                            return;
                        } catch (callbackError) {
                            console.error("❌ Error in product callback:", callbackError);
                        }
                    }

                    // Last resort - try direct cart addition
                    if (typeof window.addToCart === 'function') {
                        try {
                            console.log("Using direct addToCart function");

                            // Check inventory availability first
                            const inventoryRef = ref(rtdb, `inventory/${validatedProduct.id}`);
                            const snapshot = await get(inventoryRef);
                            const inventoryData = snapshot.exists() ? snapshot.val() : { quantity: 0 };
                            const availableQuantity = inventoryData.quantity || 0;

                            if (availableQuantity <= 0) {
                                window.showNotification?.(`${validatedProduct.name} is out of stock`, "error");
                                return;
                            }

                            // Find if product is already in cart
                            let existingQuantity = 0;
                            if (window.cart) {
                                const existingItem = window.cart.find(item => item.id === validatedProduct.id);
                                if (existingItem) {
                                    existingQuantity = existingItem.quantity;
                                }
                            }

                            // Default quantity to add is 1
                            const quantityToAdd = 1;

                            // Check if adding would exceed inventory
                            if (existingQuantity + quantityToAdd > availableQuantity) {
                                window.showNotification?.(`Can't add more ${validatedProduct.name}. Only ${availableQuantity} available and you already have ${existingQuantity} in cart.`, "warning");
                                return;
                            }

                            // If inventory allows, add to cart
                            window.addToCart(validatedProduct.id, validatedProduct.name, validatedProduct.price, null, quantityToAdd);
                            console.log("✅ Product added via direct addToCart");
                            return;
                        } catch (cartError) {
                            console.error("❌ Error in direct addToCart:", cartError);
                            window.showNotification?.("Error adding product to cart: " + cartError.message, "error");
                        }
                    } else {
                        console.error("❌ No method available to add product to cart");
                        window.showNotification?.("Cannot add product to cart: addToCart not available", "error");
                    }

                    return;
                }

                // If we get here, no product was found
                console.log("❌ Product not found for barcode:", normalizedCode);

                // Show a dialog to ask if the user wants to add this product
                const shouldAddProduct = confirm(`No product found with barcode ${normalizedCode}. Would you like to add it?`);

                if (shouldAddProduct) {
                    console.log("User chose to add the product with barcode:", normalizedCode);
                    // Create a temporary product with the scanned barcode
                    const tempProduct = await this.createTempProduct(normalizedCode);
                    if (tempProduct) {
                        await this.stopScanner();
                        // Use the same multi-level fallback approach
                        if (typeof window.handleScannedProduct === 'function') {
                            try {
                                window.handleScannedProduct(tempProduct);
                                return;
                            } catch (error) {
                                console.error("Error in callback with temp product:", error);
                            }
                        }

                        if (typeof onProductFound === 'function') {
                            try {
                                onProductFound(tempProduct);
                                return;
                            } catch (error) {
                                console.error("Error in callback with temp product:", error);
                            }
                        }

                        if (typeof window.addToCart === 'function') {
                            window.addToCart(tempProduct.id, tempProduct.name, tempProduct.price, null, 1);
                        }
                        return;
                    }
                }
            } catch (err) {
                console.error("Error in scan handler:", err);
                window.showNotification?.("Error processing scan: " + err.message, "error");
            }
        } catch (err) {
            console.error("❌ Error initializing scanner:", err);
            window.showNotification?.("Scanner error: " + (err.message || "Unknown error"), "error");
            throw err;
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

            // First try direct query with exact match
            console.log("Trying direct query with exact match");
            const productsRef = collection(db, "products");
            const exactQuery = query(productsRef, where("barcode", "==", normalizedInputBarcode));
            let snapshot = await getDocs(exactQuery);

            console.log(`📊 Direct query returned ${snapshot.size} results`);

            // If direct query found results, return the first match
            if (!snapshot.empty) {
                const product = {
                    id: snapshot.docs[0].id,
                    ...snapshot.docs[0].data()
                };
                console.log("✅ Found product via direct query:", product);
                return product;
            }

            // Get all products to ensure we have the full dataset to work with
            console.log("No exact match found, fetching all products for comparison");
            const allProductsQuery = query(productsRef);
            snapshot = await getDocs(allProductsQuery);

            console.log(`📊 Retrieved ${snapshot.size} total products for comparison`);

            if (snapshot.empty) {
                console.log("❌ No products in the database");
                return null;
            }

            // Convert snapshots to array for easier processing
            const products = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`Products retrieved: ${products.length}`);

            // Try case-insensitive comparison
            console.log("🔍 Trying case-insensitive comparison");
            const lowerInputBarcode = normalizedInputBarcode.toLowerCase();
            const caseInsensitiveMatch = products.find(product => {
                if (!product.barcode) return false;
                const productBarcode = String(product.barcode).trim().toLowerCase();
                const matches = productBarcode === lowerInputBarcode;
                console.log(`🔄 Case-insensitive comparing: "${productBarcode}" vs "${lowerInputBarcode}" = ${matches}`);
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
                const cleanProductBarcode = String(product.barcode).trim().toLowerCase().replace(/[^a-z0-9]/gi, '');
                const matches = cleanProductBarcode === cleanInputBarcode;
                console.log(`🔄 Comparing clean: "${cleanProductBarcode}" vs "${cleanInputBarcode}" = ${matches}`);
                return matches;
            });

            if (lenientMatch) {
                console.log("✅ Match found via cleaned comparison:", lenientMatch);
                return lenientMatch;
            }

            // Try partial matching (barcode contains or is contained within)
            console.log("⚠️ Trying partial matching...");
            const partialMatch = products.find(product => {
                if (!product.barcode) return false;
                const productBarcode = String(product.barcode).trim();
                // Check if either contains the other
                const matchesContains = productBarcode.includes(normalizedInputBarcode) ||
                    normalizedInputBarcode.includes(productBarcode);
                console.log(`🔄 Partial comparing: "${productBarcode}" vs "${normalizedInputBarcode}" = ${matchesContains}`);
                return matchesContains && productBarcode.length > 3 && normalizedInputBarcode.length > 3;
            });

            if (partialMatch) {
                console.log("✅ Match found via partial comparison:", partialMatch);
                return partialMatch;
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

// Initialize the core scanning functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("✅ Scanner module loaded");
});

// Make test function available globally
window.testBarcodeSearch = testBarcodeSearch; 