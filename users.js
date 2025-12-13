// ==========================================
// USERS.JS - Users List Management
// ==========================================

import { getFirestore, collection, onSnapshot, query, orderBy } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Get Firestore instance from login.js
let db = null;
let currentUser = null;
let usersUnsubscribe = null;

// UI Elements
const usersLoading = document.getElementById('users-loading');
const usersEmpty = document.getElementById('users-empty');
const usersList = document.getElementById('users-list');

/**
 * Initialize users module
 */
function initUsers() {
    // Wait for Firebase to be initialized
    const checkFirebase = setInterval(() => {
        if (window.firebaseDb && window.firebaseAuth) {
            clearInterval(checkFirebase);
            db = window.firebaseDb;

            // Listen for auth state changes
            window.firebaseAuth.onAuthStateChanged((user) => {
                currentUser = user;
                if (user) {
                    startUsersListener();
                } else {
                    if (usersUnsubscribe) {
                        usersUnsubscribe();
                        usersUnsubscribe = null;
                    }
                }
            });
        }
    }, 100);
}

/**
 * Start listening to users collection
 */
function startUsersListener() {
    if (usersUnsubscribe) {
        usersUnsubscribe();
    }

    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('lastActive', 'desc'));

    usersUnsubscribe = onSnapshot(q, (snapshot) => {
        const users = [];
        snapshot.forEach((doc) => {
            users.push(doc.data());
        });

        // Store all users globally for search
        window.allUsersData = users;
        renderUsersList(users);

        // Setup search after first render
        setupSearch();
    }, (error) => {
        console.error('Error fetching users:', error);
        showEmptyState();
    });
}

/**
 * Setup search input listener
 */
function setupSearch() {
    const searchInput = document.getElementById('users-search-input');

    // If input doesn't exist yet (navigation.js hasn't rendered it), retry
    if (!searchInput) {
        setTimeout(setupSearch, 100);
        return;
    }

    if (searchInput.dataset.listenerAttached) return;

    searchInput.dataset.listenerAttached = 'true';

    console.log('Users search initialized');

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();

        if (!window.allUsersData) return;

        if (searchTerm === '') {
            // Show all users
            renderUsersList(window.allUsersData);
        } else {
            // Filter users by name or email
            const filtered = window.allUsersData.filter(user => {
                const name = (user.displayName || '').toLowerCase();
                const email = (user.email || '').toLowerCase();
                return name.includes(searchTerm) || email.includes(searchTerm);
            });
            renderUsersList(filtered);
        }
    });
}

// Expose setupSearch globally so navigation.js can call it when view opens
window.setupUsersSearch = setupSearch;

/**
 * Show empty state
 */
function showEmptyState() {
    usersLoading.classList.add('hidden');
    usersList.classList.add('hidden');
    usersEmpty.classList.remove('hidden');
    usersEmpty.classList.add('flex');
}

/**
 * Create user card element
 */
function createUserCard(user) {
    const card = document.createElement('article');
    card.className = 'chat-chat-item';

    // Check if user is online (active within last 5 minutes)
    const isOnline = isUserOnline(user);

    // Avatar with online indicator
    const safeName = escapeHtml(user.displayName || 'Користувач');
    const avatarHtml = createAvatarHtml(user.displayName, user.photoURL);

    // Online status dot (only if online)
    const statusDot = isOnline
        ? '<span class="chat-status-dot chat-online"></span>'
        : '';

    card.innerHTML = `
        <div class="chat-avatar-container">
            ${avatarHtml}
            ${statusDot}
        </div>
        <div class="chat-chat-body">
            <div class="chat-chat-row">
                <span class="chat-chat-title">${safeName}</span>
            </div>
            <div class="chat-chat-preview-row">
                <p class="chat-chat-preview">${escapeHtml(user.email || '')}</p>
            </div>
        </div>
    `;

    // Add click handler (for future chat functionality)
    card.addEventListener('click', () => {
        handleUserClick(user);
    });

    return card;
}

/**
 * Create avatar HTML
 */
function createAvatarHtml(title, photoURL) {
    const letter = (title || '?').substring(0, 1).toUpperCase();
    const fallbackHtml = `<div class="chat-avatar-fallback" style="width: 100%; height: 100%; font-size: 18px; position: absolute; top: 0; left: 0; z-index: 1;">${letter}</div>`;
    const wrapperStyle = 'position: relative; width: 52px; height: 52px; display: inline-block;';

    if (photoURL) {
        return `
        <div style="${wrapperStyle}">
            ${fallbackHtml}
            <img class="chat-avatar" 
                 style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; z-index: 2;" 
                 src="${photoURL}" 
                 onerror="this.style.display='none'">
        </div>`;
    } else {
        return `<div style="${wrapperStyle}">${fallbackHtml}</div>`;
    }
}

/**
 * Check if user is online (active within last 5 minutes)
 */
function isUserOnline(user) {
    if (!user || !user.lastActive) return false;

    const now = Date.now();
    const lastActive = user.lastActive.toMillis ? user.lastActive.toMillis() : user.lastActive;
    const fiveMinutes = 5 * 60 * 1000;

    return (now - lastActive) < fiveMinutes;
}

/**
 * Format last seen time
 */
function formatLastSeen(timestamp) {
    if (!timestamp) return 'Давно не з\'являвся';

    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        date = new Date(timestamp);
    }

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Щойно';
    if (diffMins < 60) return `${diffMins} хв тому`;
    if (diffHours < 24) return `${diffHours} год тому`;
    if (diffDays === 1) return 'Вчора';
    if (diffDays < 7) return `${diffDays} дн тому`;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${date.getFullYear()}`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Handle user card click
 */
function handleUserClick(user) {
    console.log('User clicked:', user);

    // Open individual chat
    if (window.openIndividualChat) {
        window.openIndividualChat(user);
    } else {
        console.error('openIndividualChat function not available');
    }
}


// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUsers);
} else {
    initUsers();
}

console.log('Users.js initialized');

// ==========================================
// ALPHABET SORTING AND MODAL LOGIC
// ==========================================

let isAlphabetSortEnabled = false;

/**
 * Toggle users sort modal
 */
window.toggleUsersSortMenu = function () {
    const modal = document.getElementById('users-sort-modal');
    if (modal) {
        modal.classList.toggle('hidden');
    }
};

/**
 * Toggle alphabet sorting
 */
window.toggleAlphabetSort = function (enabled) {
    isAlphabetSortEnabled = enabled;
    console.log('Alphabet sort:', enabled ? 'enabled' : 'disabled');

    // Update toggle visual state (FIX BUG)
    const toggle = document.getElementById('sort-alphabet-toggle');
    if (toggle) {
        toggle.checked = enabled;
    }

    // Re-render the list with current data
    if (window.allUsersData) {
        renderUsersList(window.allUsersData);
    }
};

/**
 * Get first letter of name (Cyrillic support)
 */
function getFirstLetter(name) {
    if (!name) return '#';
    const first = name.trim().charAt(0).toUpperCase();
    // Check if it's a Cyrillic letter
    if (/[А-ЯІЇЄҐ]/.test(first)) {
        return first;
    }
    // Check if it's a Latin letter
    if (/[A-Z]/.test(first)) {
        return first;
    }
    // Everything else goes to #
    return '#';
}

/**
 * Scroll to letter section
 */
function scrollToLetter(letter) {
    const header = document.querySelector(`[data-letter="${letter}"]`);
    if (header) {
        header.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Expose globally for onclick handlers
window.scrollToLetter = scrollToLetter;

/**
 * Render alphabet index
 */
function renderAlphabetIndex(letters) {
    const alphabetIndex = document.getElementById('alphabet-index');
    if (!alphabetIndex) return;

    alphabetIndex.innerHTML = letters.map(letter => `
        <button 
            class="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-brand-cyan/60 hover:text-brand-cyan hover:scale-125 transition-all active:scale-95"
            onclick="scrollToLetter('${letter}')"
        >
            ${letter}
        </button>
    `).join('');
}

/**
 * Render users list with optional alphabet grouping
 */
function renderUsersList(users) {
    // Hide loading
    usersLoading.classList.add('hidden');

    if (users.length === 0) {
        showEmptyState();
        return;
    }

    // Hide empty state and show list
    usersEmpty.classList.add('hidden');
    usersEmpty.classList.remove('flex');
    usersList.classList.remove('hidden');

    // Clear existing list
    usersList.innerHTML = '';

    if (isAlphabetSortEnabled) {
        // Sort alphabetically and group by letter
        const sortedUsers = [...users].sort((a, b) => {
            const nameA = (a.displayName || '').toLowerCase();
            const nameB = (b.displayName || '').toLowerCase();
            return nameA.localeCompare(nameB, 'uk-UA');
        });

        // Group by first letter
        const grouped = {};
        sortedUsers.forEach(user => {
            const letter = getFirstLetter(user.displayName);
            if (!grouped[letter]) {
                grouped[letter] = [];
            }
            grouped[letter].push(user);
        });

        // Get sorted letters
        const letters = Object.keys(grouped).sort((a, b) => {
            if (a === '#') return 1;
            if (b === '#') return -1;
            return a.localeCompare(b, 'uk-UA');
        });

        // Hide alphabet index as it's not used with sticky letters
        const alphabetIndex = document.getElementById('alphabet-index');
        if (alphabetIndex) {
            alphabetIndex.classList.add('hidden');
        }

        // Render groups with letters OUTSIDE cards (iOS style)
        letters.forEach((letter, index) => {
            // Create group wrapper with letter on the left
            const groupWrapper = document.createElement('div');
            groupWrapper.className = 'flex items-start gap-3'; // Increased gap slightly

            // Create sticky letter label (OUTSIDE cards)
            const letterLabel = document.createElement('div');
            // Stylish glassmorphic design
            letterLabel.className = 'sticky flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/10 shadow-lg text-white font-display font-bold text-lg z-10 mt-6 select-none';

            // Add subtle glow based on theme (using brand-cyan as default)
            letterLabel.style.top = '5.5rem'; // Stick below navigation with some spacing
            letterLabel.style.boxShadow = '0 0 10px rgba(0, 242, 234, 0.1)';
            letterLabel.innerHTML = letter;

            // Create container for users in this group
            const usersContainer = document.createElement('div');
            usersContainer.className = 'flex-1 flex flex-col gap-2';

            // Render users in this group
            grouped[letter].forEach((user, userIndex) => {
                const userCard = createUserCard(user);
                usersContainer.appendChild(userCard);
            });

            // Assemble: letter on left, users on right
            groupWrapper.appendChild(letterLabel);
            groupWrapper.appendChild(usersContainer);
            usersList.appendChild(groupWrapper);
        });
    } else {
        // Hide alphabet index
        const alphabetIndex = document.getElementById('alphabet-index');
        if (alphabetIndex) {
            alphabetIndex.classList.add('hidden');
        }

        // Normal rendering (sorted by lastActive)
        users.forEach(user => {
            const userCard = createUserCard(user);
            usersList.appendChild(userCard);
        });
    }
}
