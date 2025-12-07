// ==========================================
// LOGIN.JS - Firebase Google Authentication
// ==========================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyB4dqGe4xYUzzoljDb4_HDMc6FM9PKBMPc",
    authDomain: "github-chat-pwa.firebaseapp.com",
    projectId: "github-chat-pwa",
    storageBucket: "github-chat-pwa.firebasestorage.app",
    messagingSenderId: "603999718572",
    appId: "1:603999718572:web:ddab34bdde92cfd58fa309"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// UI Elements
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const googleSignInBtn = document.getElementById('google-signin-btn');

/**
 * Sign in with Google using Firebase
 */
window.signInWithGoogle = async function () {
    const btn = googleSignInBtn;
    const btnContent = btn.querySelector('.login-google-btn-content');
    const originalHTML = btnContent.innerHTML;

    // Show loading state
    btnContent.innerHTML = `
        <div class="login-loading-spinner"></div>
        <span class="login-google-text">Підключення...</span>
    `;
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.style.cursor = 'wait';

    try {
        // Firebase Google Sign-In
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Success state
        btnContent.innerHTML = `
            <i class="fa-solid fa-check" style="color: #34d399; font-size: 20px;"></i>
            <span class="login-google-text" style="color: #34d399;">Успішний вхід!</span>
        `;

        // Log user info
        console.log('User signed in:', {
            name: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            uid: user.uid
        });

        // Smooth transition to dashboard after short delay
        setTimeout(() => {
            transitToDashboard();
        }, 600);

    } catch (error) {
        // Handle errors
        console.error('Sign-in error:', error);

        let errorMessage = 'Помилка входу';
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Вхід скасовано';
        } else if (error.code === 'auth/popup-blocked') {
            errorMessage = 'Спливаюче вікно заблоковано';
        } else if (error.code === 'auth/cancelled-popup-request') {
            errorMessage = 'Запит скасовано';
        }

        // Show error state
        btnContent.innerHTML = `
            <i class="fa-solid fa-exclamation-circle" style="color: #ef4444; font-size: 20px;"></i>
            <span class="login-google-text" style="color: #ef4444;">${errorMessage}</span>
        `;

        // Reset button after delay
        setTimeout(() => {
            btn.disabled = false;
            btn.style.opacity = '';
            btn.style.cursor = '';
            btnContent.innerHTML = originalHTML;
        }, 2500);
    }
};

/**
 * Smooth transition from login to dashboard
 */
function transitToDashboard() {
    // Fade out login view
    loginView.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    loginView.style.opacity = '0';
    loginView.style.transform = 'scale(0.95)';

    setTimeout(() => {
        // Switch views
        loginView.classList.remove('active-view');

        // Use global navigation if available
        if (window.openView) {
            window.openView('dashboard-view');
        } else {
            dashboardView.classList.add('active-view');
        }

        // Hide orbs
        const orbs = document.querySelector('.login-orbs-container');
        if (orbs) {
            orbs.style.transition = 'opacity 0.5s ease';
            orbs.style.opacity = '0';
            setTimeout(() => orbs.style.display = 'none', 500);
        }

        // Reset login view for potential future use
        setTimeout(() => {
            loginView.style.opacity = '';
            loginView.style.transform = '';

            // Reset button
            if (googleSignInBtn) {
                const btnContent = googleSignInBtn.querySelector('.login-google-btn-content');
                googleSignInBtn.disabled = false;
                googleSignInBtn.style.opacity = '';
                googleSignInBtn.style.cursor = '';
                if (btnContent) {
                    btnContent.innerHTML = `
                        <div class="login-google-icon">
                            <svg viewBox="0 0 24 24" width="22" height="22">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                        </div>
                        <span class="login-google-text">Продовжити з Google</span>
                    `;
                }
            }
        }, 500);
    }, 400);
}

/**
 * Update UI with user profile data
 */
function updateUserProfile(user) {
    if (!user) return;

    // Dashboard header elements
    const dashUserName = document.getElementById('dash-user-name');
    const dashUserAvatar = document.getElementById('dash-user-avatar');

    // Menu profile section elements
    const profileSection = document.getElementById('logged-in-view');
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const mainAvatar = document.getElementById('main-avatar');

    // Extract first name or use full display name
    const displayName = user.displayName || 'Користувач';
    const firstName = displayName.split(' ')[0];

    // Update dashboard header
    if (dashUserName) {
        dashUserName.textContent = firstName;
    }
    if (dashUserAvatar && user.photoURL) {
        dashUserAvatar.src = user.photoURL;
    }

    // Update menu profile section
    if (userName) {
        userName.textContent = displayName;
    }
    if (userEmail) {
        userEmail.textContent = user.email || '';
    }
    if (mainAvatar && user.photoURL) {
        mainAvatar.src = user.photoURL;
    }
    if (profileSection) {
        profileSection.classList.remove('hidden');
    }

    console.log('User profile updated:', displayName, user.email);
}

/**
 * Show dashboard view
 */
function showDashboard() {
    if (window.openView) {
        window.openView('dashboard-view');
    } else {
        const loginView = document.getElementById('login-view');
        const dashboardView = document.getElementById('dashboard-view');
        if (loginView) loginView.classList.remove('active-view');
        if (dashboardView) dashboardView.classList.add('active-view');
    }

    // Hide orbs
    const orbs = document.querySelector('.login-orbs-container');
    if (orbs) {
        orbs.style.display = 'none';
    }
}

/**
 * Show login view
 */
function showLogin() {
    if (window.openView) {
        window.openView('login-view');
    } else {
        const loginView = document.getElementById('login-view');
        const dashboardView = document.getElementById('dashboard-view');
        if (dashboardView) dashboardView.classList.remove('active-view');
        if (loginView) loginView.classList.add('active-view');
    }

    // Show orbs
    const orbs = document.querySelector('.login-orbs-container');
    if (orbs) {
        orbs.style.display = '';
        orbs.style.opacity = '1';
    }
}

/**
 * Sign out user
 */
window.signOutUser = async function () {
    try {
        await signOut(auth);
        console.log('User signed out');

        // Clear profile section
        const profileSection = document.getElementById('logged-in-view');
        if (profileSection) {
            profileSection.classList.add('hidden');
        }

        // Show login view
        showLogin();
    } catch (error) {
        console.error('Sign-out error:', error);
        alert('Помилка при виході: ' + error.message);
    }
};

// Global logout function for HTML onclick
window.logout = window.signOutUser;

/**
 * Listen to authentication state changes
 */
onAuthStateChanged(auth, (user) => {
    // Remove loading state
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
        appContainer.classList.remove('auth-loading');
    }

    if (user) {
        console.log('User is signed in:', user.email);

        // Update UI with user data
        updateUserProfile(user);

        // Check current view - only auto-navigate if on login screen or no view is active
        const loginView = document.getElementById('login-view');
        const hasActiveView = document.querySelector('.app-view.active-view');

        if (!hasActiveView || (loginView && loginView.classList.contains('active-view'))) {
            // User just logged in or page loaded with session - show dashboard
            showDashboard();
        }
    } else {
        console.log('User is signed out');

        // Show login if no active view or we need to switch
        const hasActiveView = document.querySelector('.app-view.active-view');

        if (!hasActiveView) {
            showLogin();
        }
    }
});

// Export auth and db for use in other modules
window.firebaseAuth = auth;
window.firebaseDb = db;

console.log('Login.js initialized with Firebase Auth + Firestore');
