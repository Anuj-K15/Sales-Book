// Import the latest Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ✅ Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC5nk9kTE8wbeR2cubnjJ0RPaTFYoZI8p0",
    authDomain: "salesbook-223b9.firebaseapp.com",
    databaseURL: "https://salesbook-223b9-default-rtdb.firebaseio.com",
    projectId: "salesbook-223b9",
    storageBucket: "salesbook-223b9.appspot.com",
    messagingSenderId: "216608906824",
    appId: "1:216608906824:web:6a6dbd90b1d8b5c07c027d",
    measurementId: "G-Q87LNQRXKL"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// ✅ Export db and rtdb
export { db, rtdb };

console.log("✅ Firebase initialized successfully.");
