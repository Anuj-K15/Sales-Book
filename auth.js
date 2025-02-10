// auth.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { 
    getAuth, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

// Your Firebase configuration
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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Handle Login
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('Logged in successfully:', userCredential.user);
            window.location.href = 'record.html'; // Redirect to main page after login
        } catch (error) {
            console.error('Login error:', error);
            alert(error.message);
        }
    });
}

// Handle Registration
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fullName = document.getElementById('fullName').value;
        const businessName = document.getElementById('businessName').value;
        const email = document.getElementById('email').value;
        const mobile = document.getElementById('mobile').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation
        if (password !== confirmPassword) {
            alert("Passwords don't match!");
            return;
        }

        if (mobile.length !== 10 || !/^\d+$/.test(mobile)) {
            alert("Please enter a valid 10-digit mobile number!");
            return;
        }

        try {
            // Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            
            // Store additional user data in Firestore
            const userDocRef = doc(db, 'users', userCredential.user.uid);
            await setDoc(userDocRef, {
                fullName,
                businessName,
                email,
                mobile,
                createdAt: serverTimestamp()
            });

            console.log('Registration successful:', userCredential.user);
            window.location.href = 'index.html'; // Redirect to main page after registration
        } catch (error) {
            console.error('Registration error:', error);
            alert(error.message);
        }
    });
}

// Auth state observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        console.log('User is signed in:', user);
        
        // If on login/register page, redirect to main page
        if (window.location.pathname.includes('index.html') || 
            window.location.pathname.includes('index.html')) {
            window.location.href = 'record.html';
        }
    } else {
        // User is signed out
        console.log('User is signed out');
        
        // If on protected pages, redirect to login
        if (!window.location.pathname.includes('index.html') && 
            !window.location.pathname.includes('index.html')) {
            window.location.href = 'index.html';
        }
    }
});

// Function to sign out
export async function handleSignOut() {
    try {
        await signOut(auth);
        console.log('Signed out successfully');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Sign out error:', error);
        alert(error.message);
    }
}

// Make signOut function available globally
window.handleSignOut = handleSignOut;