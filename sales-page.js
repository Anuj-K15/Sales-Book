// ✅ Import Firestore database
import { db } from "./firebase-config.js";
import { collection, getDocs, doc, deleteDoc, query, orderBy, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDatabase, ref, get, set, child, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Initialize Realtime Database reference
const rtdb = getDatabase();

// ✅ Check if we are on `sales.html`
if (window.location.pathname.includes("sales.html")) {
    console.log("📄 Detected sales.html, initializing sales...");

    // ✅ Run `loadSales()` when DOM is ready
    document.addEventListener("DOMContentLoaded", () => {
        console.log("🌐 DOM fully loaded, initializing sales...");
        setTimeout(loadSales, 500);
    });
} else {
    console.log("⚠ Not on sales.html. Skipping sales loading.");
}

// ✅ Function to check if required elements exist
function elementsExist() {
    return document.querySelector("tbody") &&
        document.querySelector(".summary-card:first-child p") &&
        document.querySelector(".summary-card:last-child p");
}

// ✅ Function to get today's date in IST
export function getTodayIST() {
    const now = new Date();
    const istOptions = {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };

    const [day, month, year] = now.toLocaleString('en-GB', istOptions).split('/');
    return `${year}-${month}-${day}`; // YYYY-MM-DD format
}

// Function to get date from n days ago in YYYY-MM-DD format
function getDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

// ✅ Function to get current month in IST
function getCurrentMonthIST() {
    return new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', month: 'numeric' }) - 1;
}


// ✅ Function to load sales
export async function loadSales() {
    console.log("🔄 Loading sales...");

    if (!window.location.pathname.includes("sales.html")) {
        console.log("⚠ Not on sales.html. Skipping sales loading.");
        return;
    }

    const tableBody = document.querySelector("tbody");
    const todayTotalElement = document.querySelector(".summary-card:first-child p");
    const monthTotalElement = document.querySelector(".summary-card:last-child p");

    if (!tableBody || !todayTotalElement || !monthTotalElement) {
        console.warn("⚠ Elements not found! Waiting for DOM changes...");
        waitForElements(loadSales);
        return;
    }

    try {
        const salesRef = collection(db, "sales");
        const salesQuery = query(salesRef, orderBy("timestamp", "desc"));
        const snapshot = await getDocs(salesQuery);

        let todayTotal = 0;
        let monthTotal = 0;
        let lastDate = null;
        const today = getTodayIST();
        const currentMonth = getCurrentMonthIST();

        // Get dates for the last 3 days
        const threeDaysAgo = getDateDaysAgo(3);

        tableBody.innerHTML = "";

        if (snapshot.empty) {
            tableBody.innerHTML = "<tr><td colspan='6' style='text-align: center;'>No sales data available</td></tr>";
            return;
        }

        // ✅ First pass: Calculate daily totals for last 3 days only
        const dailyTotals = {};
        const validSales = [];

        snapshot.forEach((docSnap) => {
            const sale = docSnap.data();
            const saleDate = sale.date;

            // Only include sales from the last 3 days
            if (saleDate >= threeDaysAgo) {
                validSales.push({
                    id: docSnap.id,
                    ...sale
                });

                if (!dailyTotals[saleDate]) {
                    dailyTotals[saleDate] = 0;
                }
                dailyTotals[saleDate] += sale.totalAmount;

                if (saleDate === today) todayTotal += sale.totalAmount;
                if (new Date(saleDate).getMonth() === currentMonth) monthTotal += sale.totalAmount;
            }
        });

        if (validSales.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='6' style='text-align: center;'>No sales data available for the last 3 days</td></tr>";
            todayTotalElement.textContent = `₹0.00`;
            monthTotalElement.textContent = `₹${monthTotal.toFixed(2)}`;
            return;
        }

        // ✅ Second pass: Create table rows with pre-calculated totals for last 3 days
        validSales.forEach((sale) => {
            const saleDate = sale.date;
            const formattedTime = sale.time;

            // ✅ Insert Date Separator with Pre-calculated Total
            if (saleDate !== lastDate) {
                const dateRow = document.createElement("tr");
                dateRow.className = "date-separator";
                dateRow.innerHTML = `
                    <td colspan="6" style="text-align:center; font-weight:bold; background:#f3545a; color:white; padding:10px; border-top: 2px solid black;">
                        <div class="date-header">
                            <span>📅 ${saleDate} - Total Sale: ₹${dailyTotals[saleDate].toFixed(2)}</span>
                            
                        </div>
                    </td>
                `;
                tableBody.appendChild(dateRow);
                lastDate = saleDate;
            }

            // ✅ Insert Sale Data
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${sale.orderNo}</td>
                <td>${sale.items.map(item => `${item.name} x${item.quantity}`).join("<br>")}</td>
                <td>₹${sale.totalAmount.toFixed(2)}</td>
                <td>${saleDate} ${formattedTime}</td>
                <td>${sale.paymentMethod}</td>
                <td><button class="delete-btn" data-id="${sale.id}">Delete</button></td>
            `;
            tableBody.appendChild(tr);
        });

        todayTotalElement.textContent = `₹${todayTotal.toFixed(2)}`;
        monthTotalElement.textContent = `₹${monthTotal.toFixed(2)}`;

        document.querySelectorAll(".delete-btn").forEach(button => {
            button.addEventListener("click", () => deleteSale(button.dataset.id));
        });

        console.log("✅ Sales loaded successfully (showing only last 3 days).");
    } catch (error) {
        console.error("❌ Error loading sales:", error);
    }
}

// Rest of the code remains unchanged...

// ✅ Function to wait for elements in the DOM
function waitForElements(callback) {
    const observer = new MutationObserver((mutations, obs) => {
        if (document.querySelector("tbody")) {
            console.log("✅ Required elements found. Running loadSales...");
            obs.disconnect();
            callback();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// ✅ Function to renumber sales after deletion
async function renumberSales() {
    try {
        const salesRef = collection(db, "sales");
        const salesQuery = query(salesRef, orderBy("timestamp", "asc")); // Fetch sales in order
        const snapshot = await getDocs(salesQuery);

        // Group sales by date
        const salesByDate = {};
        snapshot.docs.forEach(docSnap => {
            const sale = docSnap.data();
            if (!salesByDate[sale.date]) {
                salesByDate[sale.date] = [];
            }
            salesByDate[sale.date].push({
                id: docSnap.id,
                ...sale
            });
        });

        const batchUpdates = [];

        // Renumber each date's sales separately
        for (const date in salesByDate) {
            let orderNumber = 1;
            for (const sale of salesByDate[date]) {
                const newOrderNo = `#${String(orderNumber).padStart(3, "0")}`;
                if (sale.orderNo !== newOrderNo) {
                    const saleRef = doc(db, "sales", sale.id);
                    batchUpdates.push(updateDoc(saleRef, { orderNo: newOrderNo }));
                }
                orderNumber++;
            }
        }

        // Apply updates in parallel
        await Promise.all(batchUpdates);
        console.log("✅ Sales renumbered successfully!");

    } catch (error) {
        console.error("❌ Error renumbering sales:", error);
    }
}

// ✅ Function to delete a sale and renumber the remaining ones
async function deleteSale(saleId) {
    if (!saleId) {
        console.error("❌ Invalid sale ID!");
        return;
    }

    if (confirm("Are you sure you want to delete this sale? The inventory quantities will be restored.")) {
        try {
            // First get the sale data to restore inventory
            const saleRef = doc(db, "sales", saleId);
            const saleSnapshot = await getDoc(saleRef);

            if (!saleSnapshot.exists()) {
                console.error("❌ Sale not found!");
                return;
            }

            const saleData = saleSnapshot.data();

            // Restore inventory for each item in the sale
            await restoreInventoryAfterSaleDelete(saleData.items);

            // ✅ Delete the sale from Firestore
            await deleteDoc(saleRef);
            console.log(`✅ Sale ${saleId} deleted successfully!`);

            // ✅ Renumber remaining sales
            await renumberSales();

            // ✅ Reload the updated sales list
            loadSales();

        } catch (error) {
            console.error("❌ Error deleting sale:", error);
            alert("Error deleting sale. Please try again.");
        }
    }
}

// Function to restore inventory when a sale is deleted
async function restoreInventoryAfterSaleDelete(items) {
    try {
        if (!rtdb) {
            console.error("RTDB not initialized");
            return;
        }

        console.log("Restoring inventory for deleted sale items:", items);

        // Process each item in the deleted sale
        for (const item of items) {
            const inventoryRef = ref(rtdb, `inventory/${item.id}`);
            const historyRef = ref(rtdb, 'inventory_history');

            // Get current inventory
            const snapshot = await get(inventoryRef);
            const currentData = snapshot.val() || { quantity: 0, lastUpdated: Date.now() };

            // Calculate new quantity (add back the sold quantity)
            const newQuantity = currentData.quantity + item.quantity;
            console.log(`Restoring ${item.quantity} units of ${item.name} (ID: ${item.id}). Current: ${currentData.quantity}, New: ${newQuantity}`);

            // Update inventory
            await set(inventoryRef, {
                quantity: newQuantity,
                lastUpdated: Date.now()
            });

            // Add to history
            const historyEntry = {
                productId: item.id,
                operation: 'add',
                quantity: item.quantity,
                notes: 'Restored due to sale deletion',
                timestamp: Date.now()
            };

            // Use Firebase push to add a new entry with unique ID
            const historyEntryRef = ref(rtdb, 'inventory_history');
            const newEntryRef = child(historyEntryRef, push().key);
            await set(newEntryRef, historyEntry);
        }

        console.log("✅ Inventory restored successfully after sale deletion");
    } catch (error) {
        console.error("❌ Error restoring inventory:", error);
    }
}

// Make functions globally available
window.deleteSale = deleteSale;
window.renumberSales = renumberSales;
window.getTodayIST = getTodayIST;