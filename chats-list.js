// ==========================================
// CHATS-LIST.JS - Chats List Management
// ==========================================

import { getFirestore, collection, onSnapshot, query, doc, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Get Firebase instances from login.js
let db = null;
let auth = null;
let currentUser = null;
let chatsUnsubscribe = null;
let allChatsData = [];

// UI Elements
const chatsListContainer = document.getElementById('chats-list-container');

/**
 * Initialize chats list module
 */
function initChatsList() {
    // Wait for Firebase to be initialized
    const checkFirebase = setInterval(() => {
        if (window.firebaseDb && window.firebaseAuth) {
            clearInterval(checkFirebase);
            db = window.firebaseDb;
            auth = window.firebaseAuth;

            // Listen for auth state
            auth.onAuthStateChanged((user) => {
                if (user) {
                    currentUser = user;
                    startChatsListener(user.uid);
                } else {
                    currentUser = null;
                    if (chatsUnsubscribe) {
                        chatsUnsubscribe();
                        chatsUnsubscribe = null;
                    }
                    renderEmptyState();
                }
            });
        }
    }, 100);
}

/**
 * Start listening to user's chats
 */
function startChatsListener(userId) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const chatsRef = collection(db, 'artifacts', appId, 'users', userId, 'chats');

    if (chatsUnsubscribe) {
        chatsUnsubscribe();
    }

    chatsListContainer.innerHTML = '<div class="text-white/40 text-center py-8">Loading chats...</div>';

    chatsUnsubscribe = onSnapshot(query(chatsRef), (snapshot) => {
        const chats = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            chats.push({ id: docSnap.id, ...data });
        });

        allChatsData = chats;
        renderChatsList(chats);
    }, (error) => {
        console.error('Error fetching chats:', error);
        chatsListContainer.innerHTML = '<div class="text-red-400 text-center py-8">Error loading chats</div>';
    });
}

/**
 * Render chats list
 */
function renderChatsList(chats) {
    chatsListContainer.innerHTML = '';

    if (chats.length === 0) {
        renderEmptyState();
        return;
    }

    // Sort chats: pinned first, then by lastUpdated
    chats.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        const timeA = a.lastUpdated ? a.lastUpdated.toMillis() : 0;
        const timeB = b.lastUpdated ? b.lastUpdated.toMillis() : 0;
        return timeB - timeA;
    });

    chats.forEach(chat => {
        const chatElement = createChatItem(chat);
        chatsListContainer.appendChild(chatElement);
    });
}

/**
 * Create chat item element
 */
function createChatItem(data) {
    const el = document.createElement('div');
    el.className = 'flex items-center gap-4 p-4 -mx-4 rounded-3xl hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer group border border-transparent hover:border-white/5';

    // Avatar
    const avatarHtml = createAvatarHtml(data);

    // Time formatting
    const timeStr = formatTime(data.lastUpdated);

    // Preview text
    const previewText = data.preview || 'No messages yet';

    // Unread badge
    const unreadBadge = data.unreadCount > 0
        ? `<div class="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-brand-cyan text-black text-[11px] font-bold flex items-center justify-center shadow-lg">${data.unreadCount > 99 ? '99+' : data.unreadCount}</div>`
        : '';

    el.innerHTML = `
        <div class="relative w-[54px] h-[54px] shrink-0">
            ${avatarHtml}
            ${unreadBadge}
        </div>
        <div class="flex-1 min-w-0 border-b border-white/5 pb-4 group-last:border-0 h-full flex flex-col justify-center">
            <div class="flex justify-between items-center mb-1">
                <h3 class="text-[16px] font-bold text-white tracking-wide truncate">${escapeHtml(data.title || 'Unknown')}</h3>
                <span class="text-[11px] text-gray-500">${timeStr}</span>
            </div>
            <p class="text-[14px] text-gray-400 truncate">${escapeHtml(previewText)}</p>
        </div>
    `;

    // Click handler
    el.addEventListener('click', () => {
        if (window.openIndividualChat) {
            // For 1-on-1 chats, need to get full user data
            if (!data.isGroup && window.allUsersData) {
                const user = window.allUsersData.find(u => u.uid === data.id);
                if (user) {
                    window.openIndividualChat(user);
                } else {
                    // Fallback: create user object from chat data
                    window.openIndividualChat({
                        uid: data.id,
                        displayName: data.title,
                        photoURL: data.avatar || ''
                    });
                }
            } else {
                // For groups (future implementation)
                console.log('Group chat:', data);
            }
        }
    });

    return el;
}

/**
 * Create avatar HTML
 */
function createAvatarHtml(data) {
    if (data.isGroup) {
        // Group emoji avatar
        const emoji = data.emoji || '👥';
        return `
            <div class="w-full h-full rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-3xl shadow-lg">
                ${emoji}
            </div>
        `;
    } else {
        // User photo avatar
        if (data.avatar) {
            return `
                <img src="${data.avatar}" 
                     class="w-full h-full rounded-full bg-gray-800 object-cover"
                     onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'w-full h-full rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white text-xl font-bold\\'>${(data.title || '?')[0].toUpperCase()}</div>'">
            `;
        } else {
            // Fallback to initial
            const initial = (data.title || '?')[0].toUpperCase();
            return `
                <div class="w-full h-full rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                    ${initial}
                </div>
            `;
        }
    }
}

/**
 * Format timestamp
 */
function formatTime(timestamp) {
    if (!timestamp) return '';

    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        date = new Date(timestamp);
    }

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now - 86400000).toDateString() === date.toDateString();

    if (isToday) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    } else if (isYesterday) {
        return 'Вчора';
    } else {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}.${month}`;
    }
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Render empty state
 */
function renderEmptyState() {
    chatsListContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 text-center">
            <div class="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <i class="material-icons-round text-white/40 text-5xl">chat_bubble_outline</i>
            </div>
            <h3 class="text-white text-lg font-semibold mb-2">No chats yet</h3>
            <p class="text-white/40 text-sm">Start a conversation from the Users tab</p>
        </div>
    `;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatsList);
} else {
    initChatsList();
}

/**
 * Filter chats by list of IDs
 * @param {string[]|'all'} chatIds - List of chat IDs to show, or 'all'
 */
function filterChatsList(chatIds) {
    if (!allChatsData) return;

    if (chatIds === 'all') {
        renderChatsList(allChatsData);
        return;
    }

    const filteredChats = allChatsData.filter(chat => chatIds.includes(chat.id));
    renderChatsList(filteredChats);
}

// Export filtering function for chat-folders.js
window.filterChatsList = filterChatsList;

console.log('Chats-list.js initialized');
