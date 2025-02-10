// add-product.js
async function addProduct() {
    const productName = document.getElementById('product-name').value;
    const productPrice = parseFloat(document.getElementById('product-price').value);
    const productImage = document.getElementById('product-image').files[0];

    if (!productName || isNaN(productPrice) || !productImage) {
        alert('❌ Please enter all details correctly.');
        return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(productImage);
    reader.onloadend = async function () {
        const base64Image = reader.result;
        console.log("📤 Uploading Product:", { name: productName, price: productPrice });

        try {
            await db.collection('products').add({
                name: productName,
                price: productPrice,
                image: base64Image
            });

            alert('✅ Product added successfully!');
            window.location.href = 'record.html';
        } catch (error) {
            console.error("❌ Error adding product:", error);
            alert('Error adding product. Please try again.');
        }
    };
}
