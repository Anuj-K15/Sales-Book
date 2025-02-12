// ✅ Import Firestore database
import { db } from "./firebase-config.js";
import { collection, getDocs, doc, deleteDoc, query, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// ✅ Function to load sales
// ✅ Ensure `loadSales` is exported correctly
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
        let dailyTotal = 0;
        let dateRow = null;
        const today = new Date().toISOString().split("T")[0];
        const currentMonth = new Date().getMonth();

        tableBody.innerHTML = "";

        if (snapshot.empty) {
            tableBody.innerHTML = "<tr><td colspan='6' style='text-align: center;'>No sales data available</td></tr>";
            return;
        }

        snapshot.forEach((docSnap, index) => {
            const sale = docSnap.data();
            const saleDate = sale.date;
            const formattedTime = sale.time;

            if (saleDate === today) todayTotal += sale.totalAmount;
            if (new Date(saleDate).getMonth() === currentMonth) monthTotal += sale.totalAmount;

            // ✅ Insert Date Separator with Total Sales
            if (saleDate !== lastDate) {
                if (dateRow !== null) {
                    // ✅ Update the last date row with total sales before inserting the next date
                    dateRow.innerHTML = `
                        <td colspan="6" style="text-align:center; font-weight:bold; background:#f3545a; color:white; padding:10px; border-top: 2px solid black;">
                            📅 ${lastDate} - Total Sale: ₹${dailyTotal.toFixed(2)}
                        </td>
                    `;
                }

                // ✅ Reset daily total and create a new date separator row
                dailyTotal = 0;
                dateRow = document.createElement("tr");
                dateRow.className = "date-separator";
                dateRow.innerHTML = `
                    <td colspan="6" style="text-align:center; font-weight:bold; background:#f3545a; color:white; padding:10px; border-top: 2px solid black;">
                        📅 ${saleDate} - Total Sale: Calculating...
                    </td>
                `;
                tableBody.appendChild(dateRow);
                lastDate = saleDate;
            }

            // ✅ Accumulate daily total
            dailyTotal += sale.totalAmount;

            // ✅ Insert Sale Data
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${sale.orderNo}</td>
                <td>${sale.items.map(item => `${item.name} x${item.quantity}`).join("<br>")}</td>
                <td>₹${sale.totalAmount.toFixed(2)}</td>
                <td>${saleDate} ${formattedTime}</td>
                <td>${sale.paymentMethod}</td>
                <td><button class="delete-btn" data-id="${docSnap.id}">Delete</button></td>
            `;
            tableBody.appendChild(tr);

            // ✅ Update the last date row total when at the last entry
            if (index === snapshot.docs.length - 1 && dateRow !== null) {
                dateRow.innerHTML = `
                    <td colspan="6" style="text-align:center; font-weight:bold; background:#f3545a; color:white; padding:10px; border-top: 2px solid black;">
                        📅 ${lastDate} - Total Sale: ₹${dailyTotal.toFixed(2)}
                    </td>
                `;
            }
        });

        todayTotalElement.textContent = `₹${todayTotal.toFixed(2)}`;
        monthTotalElement.textContent = `₹${monthTotal.toFixed(2)}`;

        document.querySelectorAll(".delete-btn").forEach(button => {
            button.addEventListener("click", () => deleteSale(button.dataset.id));
        });

        console.log("✅ Sales loaded successfully.");
    } catch (error) {
        console.error("❌ Error loading sales:", error);
    }
}

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


// ✅ Function to delete a sale and renumber the remaining ones
async function deleteSale(saleId) {
    if (!saleId) {
        console.error("❌ Invalid sale ID!");
        return;
    }

    if (confirm("Are you sure you want to delete this sale?")) {
        try {
            // ✅ Delete the sale from Firestore
            await deleteDoc(doc(db, "sales", saleId));
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

// ✅ Function to renumber sales after deletion
async function renumberSales() {
    try {
        const salesRef = collection(db, "sales");
        const salesQuery = query(salesRef, orderBy("timestamp", "asc")); // Fetch sales in order
        const snapshot = await getDocs(salesQuery);

        let newOrderNumber = 1; // Start renumbering from #1
        const batchUpdates = [];

        for (const docSnap of snapshot.docs) {
            const saleRef = doc(db, "sales", docSnap.id);
            const newOrderNo = `#${String(newOrderNumber).padStart(3, "0")}`;
            
            // ✅ Only update if the number is different
            if (docSnap.data().orderNo !== newOrderNo) {
                batchUpdates.push(updateDoc(saleRef, { orderNo: newOrderNo }));
            }

            newOrderNumber++;
        }

        // ✅ Apply updates in parallel
        await Promise.all(batchUpdates);
        console.log("✅ Sales renumbered successfully!");

    } catch (error) {
        console.error("❌ Error renumbering sales:", error);
    }
}
