document.addEventListener('DOMContentLoaded', loadSales);

async function loadSales() {
    if (!window.db) {
        console.error("❌ Firestore (db) is not initialized yet!");
        return;
    }

    const tableBody = document.querySelector('tbody');
    const todayTotalElement = document.querySelector('.summary-card:first-child p');
    const monthTotalElement = document.querySelector('.summary-card:last-child p');

    try {
        const salesRef = window.db.collection('sales'); // ✅ Use window.db
        const snapshot = await salesRef.orderBy('timestamp', 'desc').get();

        let todayTotal = 0;
        let monthTotal = 0;
        const today = new Date().toLocaleDateString();
        const currentMonth = new Date().getMonth();

        // Clear existing rows
        tableBody.innerHTML = '';

        snapshot.forEach((doc) => {
            const sale = doc.data();
            const saleDate = sale.timestamp?.toDate();

            // Calculate totals
            if (sale.date === today) {
                todayTotal += sale.totalAmount;
            }
            if (saleDate && saleDate.getMonth() === currentMonth) {
                monthTotal += sale.totalAmount;
            }

            // Create table row
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${sale.orderNo}</td>
                <td>${sale.items.map(item => `${item.name} x${item.quantity}`).join('<br>')}</td>
                <td>₹${sale.totalAmount.toFixed(2)}</td>
                <td>${sale.date}<br>${sale.time}</td>
                <td>${sale.paymentMethod}</td>
                <td><button class="delete-btn" onclick="deleteSale('${doc.id}')">Delete</button></td>
            `;

            tableBody.appendChild(tr);
        });

        // Update summary cards
        todayTotalElement.textContent = `₹${todayTotal.toFixed(2)}`;
        monthTotalElement.textContent = `₹${monthTotal.toFixed(2)}`;

    } catch (error) {
        console.error("❌ Error loading sales:", error);
        alert('Error loading sales data. Please try again.');
    }
}

async function deleteSale(saleId) {
    if (!window.db) {
        console.error("❌ Firestore (db) is not initialized yet!");
        return;
    }

    if (confirm('Are you sure you want to delete this sale?')) {
        try {
            await window.db.collection('sales').doc(saleId).delete();
            alert('Sale deleted successfully!');
            loadSales(); // ✅ Reload the table after deletion
        } catch (error) {
            console.error("❌ Error deleting sale:", error);
            alert('Error deleting sale. Please try again.');
        }
    }
}
