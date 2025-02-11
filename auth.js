// Import Firebase authentication
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

// ✅ Handle Login
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

// ✅ Handle Registration
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

        if (password !== confirmPassword) {
            alert("Passwords don't match!");
            return;
        }

        if (mobile.length !== 10 || !/^\d+$/.test(mobile)) {
            alert("Please enter a valid 10-digit mobile number!");
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);

            // ✅ Store additional user data in Firestore
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

// ✅ Firebase Auth State Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("✅ User is signed in:", user);

        // ✅ Fetch Business Name from Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            console.log("🏢 Business Name:", userData.businessName);

            // ✅ Update Business Name in record.html
            const heading = document.getElementById("businessNameHeading");
            if (heading) {
                heading.textContent = userData.businessName;
            }
        }
    }
});

export async function handleSignOut() {
    try {
        await signOut(auth);
        console.log("✅ Signed out successfully");

        // ✅ Clear storage to remove session data
        localStorage.clear();
        sessionStorage.clear();

        // ✅ Delay redirection to ensure logout is fully processed
        setTimeout(() => {
            window.location.replace("index.html");
        }, 500); // 500ms delay prevents race conditions
    } catch (error) {
        console.error("❌ Sign out error:", error);
        alert(error.message);
    }
}

// ✅ Make signOut function globally available
window.handleSignOut = handleSignOut;
