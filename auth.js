// Import Firebase modules
import { auth, db } from "./firebase-config.js";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Handle Login
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log("✅ Logged in successfully:", userCredential.user);
            window.location.href = "record.html"; // Redirect to main page after login
        } catch (error) {
            console.error("❌ Login error:", error);
            alert(error.message);
        }
    });
}

// Handle Registration
const registerForm = document.getElementById("registerForm");
if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const fullName = document.getElementById("fullName").value;
        const businessName = document.getElementById("businessName").value;
        const email = document.getElementById("email").value;
        const mobile = document.getElementById("mobile").value;
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

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
            const userDocRef = doc(db, "users", userCredential.user.uid);
            await setDoc(userDocRef, {
                fullName,
                businessName,
                email,
                mobile,
                createdAt: serverTimestamp()
            });

            console.log("✅ Registration successful:", userCredential.user);
            window.location.href = "login.html"; // Redirect to login page after registration
        } catch (error) {
            console.error("❌ Registration error:", error);
            alert(error.message);
        }
    });
}

onAuthStateChanged(auth, async (user) => {
    console.log("🔄 Checking auth state...");

    if (!user) {
        console.log("❌ User is signed out");

        // ✅ Ensure the user stays on the register page after logout
        if (window.location.pathname !== "/index.html") {
            window.location.href = "index.html";
        }
        return; // ✅ Stop execution here
    }

    // ✅ If the user is logged in, proceed with normal redirection
    console.log("✅ User is signed in:", user);

    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const businessName = userData.businessName;

        // ✅ Update Business Name in record.html
        const heading = document.getElementById("businessNameHeading");
        if (heading) {
            heading.textContent = businessName;
        }
    } else {
        console.log("❌ User document not found in Firestore.");
    }

    // ✅ Only redirect if necessary
    if (window.location.pathname.includes("index.html")) {
        window.location.href = "login.html";
    } else if (window.location.pathname.includes("login.html")) {
        window.location.href = "record.html";
    }
});


export async function handleSignOut() {
    try {
        await signOut(auth);
        console.log("✅ Signed out successfully");

        // ✅ Clear all stored authentication data
        localStorage.clear();
        sessionStorage.clear();

        // ✅ Delay before redirecting to ensure session is cleared
        setTimeout(() => {
            window.location.replace("index.html"); // Hard redirect prevents back navigation
        }, 500); // Short delay to ensure logout completes
    } catch (error) {
        console.error("❌ Sign out error:", error);
        alert(error.message);
    }
}

// ✅ Make signOut function available globally
window.handleSignOut = handleSignOut;
