const firebaseConfig = {
    apiKey: "AIzaSyC5nk9kTE8wbeR2cubnjJ0RPaTFYoZI8p0",
    authDomain: "salesbook-223b9.firebaseapp.com",
    databaseURL: "https://salesbook-223b9-default-rtdb.firebaseio.com",
    projectId: "salesbook-223b9",
    storageBucket: "salesbook-223b9.firebasestorage.app",
    messagingSenderId: "216608906824",
    appId: "1:216608906824:web:6a6dbd90b1d8b5c07c027d",
    measurementId: "G-Q87LNQRXKL"
};

// Initialize Firebase
try {
    if (typeof firebase !== "undefined") {
        firebase.initializeApp(firebaseConfig);
        window.db = firebase.firestore();
        window.auth = firebase.auth();
        console.log("✅ Firebase initialized successfully");
        
        // Test database connection
        window.db.collection('products').limit(1).get()
            .then(() => console.log("✅ Firestore connection test successful"))
            .catch(error => console.error("❌ Firestore connection test failed:", error));
    } else {
        console.error("❌ Firebase SDK not loaded");
    }
} catch (error) {
    console.error("❌ Firebase initialization error:", error);
}

console.log("Firestore Initialized:", db);
console.log("Auth Initialized:", auth);