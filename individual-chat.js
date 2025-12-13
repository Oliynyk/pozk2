// ==========================================
// INDIVIDUAL-CHAT.JS - 1-on-1 Chat Management
// ==========================================

import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc, getDoc, orderBy, query, serverTimestamp, Timestamp, increment } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Get Firebase instances from login.js
let db = null;
let auth = null;
let currentUser = null;
let currentPeer = null; // The user we're chatting with
let messagesUnsubscribe = null;

// UI Elements
const chatView = document.getElementById('individual-chat-view');
const chatEmptyState = document.getElementById('chat-empty-state');
const chatMessagesContainer = document.getElementById('chat-messages-container');
const chatMessageInput = document.getElementById('chat-message-input');
const chatSendBtn = document.getElementById('chat-send-btn');

/**
 * Initialize module
 */
function initIndividualChat() {
    // Wait for Firebase to be initialized
    const checkFirebase = setInterval(() => {
        if (window.firebaseDb && window.firebaseAuth) {
            clearInterval(checkFirebase);
            db = window.firebaseDb;
            auth = window.firebaseAuth;

            // Listen for auth state
            auth.onAuthStateChanged((user) => {
                currentUser = user;
            });

            // Setup input listeners
            setupInputListeners();
        }
    }, 100);
}

/**
 * Setup input event listeners
 */
function setupInputListeners() {
    const mediaButtons = document.getElementById('chat-media-buttons');

    // Toggle buttons based on input
    chatMessageInput.addEventListener('input', (e) => {
        const text = e.target.value.trim();

        if (text.length > 0) {
            // Show send button, hide media buttons
            chatSendBtn.classList.remove('hidden');
            chatSendBtn.classList.add('flex');
            mediaButtons.classList.add('hidden');
            chatSendBtn.disabled = false;
        } else {
            // Show media buttons, hide send button
            chatSendBtn.classList.add('hidden');
            chatSendBtn.classList.remove('flex');
            mediaButtons.classList.remove('hidden');
            chatSendBtn.disabled = true;
        }

        // Save draft
        if (currentPeer) {
            saveDraft(currentPeer.uid, e.target.value);
        }
    });

    // Send on Enter key
    chatMessageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !chatSendBtn.disabled) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Send button click
    chatSendBtn.addEventListener('click', () => {
        if (!chatSendBtn.disabled) {
            sendMessage();
        }
    });
}

/**
 * Open individual chat with a user
 */
window.openIndividualChat = function (user) {
    if (!user || !currentUser) {
        console.error('Cannot open chat: missing user data');
        return;
    }

    currentPeer = user;
    console.log('Opening chat with:', user.displayName);

    // Update navigation header
    updateChatHeader(user);

    // Load draft if exists
    const draft = loadDraft(user.uid);
    chatMessageInput.value = draft;
    chatSendBtn.disabled = draft.length === 0;

    // Clear messages
    chatMessagesContainer.innerHTML = '';

    // Check if conversation exists and start listener
    checkAndLoadConversation(user.uid);

    // Open view
    window.openView('individual-chat-view');

    // Show global input island
    const inputIsland = document.getElementById('chat-input-island');
    if (inputIsland) {
        inputIsland.classList.remove('hidden');
    }

    // Focus input
    setTimeout(() => chatMessageInput.focus(), 300);

    // Update navigation header (must come after openView)
    setTimeout(() => updateChatHeader(user), 50);
};

/**
 * Close individual chat
 */
window.closeIndividualChat = function () {
    // Hide global input island
    const inputIsland = document.getElementById('chat-input-island');
    if (inputIsland) {
        inputIsland.classList.add('hidden');
    }

    // Unsubscribe from messages
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribe = null;
    }

    // Clear draft if empty
    if (currentPeer && chatMessageInput.value.trim() === '') {
        clearDraft(currentPeer.uid);
    }

    // Reset state
    currentPeer = null;
    chatMessageInput.value = '';
    chatSendBtn.disabled = true;

    // Go back to chat list
    window.openView('chat');
};

/**
 * Update navigation header with user info
 */
function updateChatHeader(user) {
    const avatarImg = document.getElementById('chat-header-avatar');
    const avatarInitials = document.getElementById('chat-header-initials');
    const nameEl = document.getElementById('chat-header-name');
    const statusEl = document.getElementById('chat-header-status');

    if (!nameEl) return;

    // Set Name
    nameEl.textContent = user.displayName || 'Користувач';

    // Set Avatar/Initials
    if (user.photoURL) {
        avatarImg.src = user.photoURL;
        avatarImg.classList.remove('hidden');
        avatarInitials.classList.add('hidden');
    } else {
        avatarImg.classList.add('hidden');
        avatarInitials.classList.remove('hidden');
        avatarInitials.textContent = getInitials(user.displayName);
    }

    // Check online status
    const isOnline = isUserOnline(user);
    if (isOnline) {
        statusEl.textContent = 'У мережі';
        statusEl.className = 'text-[10px] text-brand-cyan font-medium';
    } else {
        statusEl.textContent = formatLastSeen(user.lastActive);
        statusEl.className = 'text-[10px] text-white/40 font-medium';
    }
}

function getInitials(name) {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

/**
 * Check if user is online (within 5 minutes)
 */
function isUserOnline(user) {
    if (!user || !user.lastActive) return false;
    const now = Date.now();
    const lastActive = user.lastActive.toMillis ? user.lastActive.toMillis() : user.lastActive;
    const fiveMinutes = 5 * 60 * 1000;
    return (now - lastActive) < fiveMinutes;
}

/**
 * Format last seen timestamp
 */
function formatLastSeen(timestamp) {
    if (!timestamp) return 'offline';

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

    if (diffMins < 1) return 'щойно';
    if (diffMins < 60) return `був(ла) ${diffMins} хв. тому`;
    if (diffMins < 1) return 'щойно';
    if (diffMins < 60) return `був(ла) ${diffMins} хв. тому`;
    if (diffHours < 24) return `був(ла) ${diffHours} год. тому`;

    return 'не в мережі';
}

/**
 * Check if conversation exists and load messages
 */
async function checkAndLoadConversation(peerId) {
    try {
        const conversationId = getConversationId(currentUser.uid, peerId);
        // Start messages listener - it will handle empty state automatically
        startMessagesListener(conversationId);
    } catch (error) {
        console.error('Error checking conversation:', error);
        showEmptyState();
    }
}

/**
 * Generate conversation ID (alphabetically sorted UIDs)
 */
function getConversationId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
}

/**
 * Show empty state
 */
function showEmptyState() {
    chatEmptyState.classList.remove('hidden');
    chatMessagesContainer.classList.add('hidden');
}

/**
 * Hide empty state
 */
function hideEmptyState() {
    chatEmptyState.classList.add('hidden');
    chatMessagesContainer.classList.remove('hidden');
}

/**
 * Start listening to messages
 */
function startMessagesListener(conversationId) {
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
    }

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            showEmptyState();
            return;
        }

        hideEmptyState();

        // Use docChanges to handle updates granularly and prevent flickering
        const changes = snapshot.docChanges();

        // If it's a large initial batch, we might want to perform a fragment update
        // But prepending one by one works fine for the reversed layout logic
        changes.forEach((change) => {
            const msg = { id: change.doc.id, ...change.doc.data() };

            if (change.type === "added") {
                // With flex-col-reverse (Newest at Bottom), the First Child is at Bottom
                // Incoming stream is Oldest -> Newest.
                // Prepending sequentially results in: [Newest, ..., Oldest] in DOM
                // Which renders as:
                // Newest (Bottom)
                // ...
                // Oldest (Top)
                prependMessageToUI(msg);
            }
            if (change.type === "modified") {
                updateMessageInUI(msg);
            }
            if (change.type === "removed") {
                removeMessageFromUI(msg.id);
            }
        });

        // Scroll to bottom to show interactions (only needed for new messages really)
        if (changes.some(c => c.type === 'added')) {
            scrollToBottom();
        }
    });
}

/**
 * Prepend message to UI (for flex-col-reverse)
 */
function prependMessageToUI(msg) {
    const isSent = msg.senderId === currentUser.uid;
    const messageEl = createMessageBubble(msg, isSent);

    // Insert as first child (which is visually the bottom-most element)
    if (chatMessagesContainer.firstChild) {
        chatMessagesContainer.insertBefore(messageEl, chatMessagesContainer.firstChild);
    } else {
        chatMessagesContainer.appendChild(messageEl);
    }
}

/**
 * Update message in UI
 */
function updateMessageInUI(msg) {
    const existingEl = document.getElementById(`msg-${msg.id}`);
    if (existingEl) {
        const isSent = msg.senderId === currentUser.uid;
        const newEl = createMessageBubble(msg, isSent);
        chatMessagesContainer.replaceChild(newEl, existingEl);
    }
}

/**
 * Remove message from UI
 */
function removeMessageFromUI(msgId) {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
        el.remove();
    }
}

/**
 * Create message bubble element
 */
function createMessageBubble(msg, isSent) {
    const wrapper = document.createElement('div');
    wrapper.id = `msg-${msg.id}`; // Add ID for updates
    wrapper.className = `flex ${isSent ? 'justify-end' : 'justify-start'} mb-2 message-bubble-animate`;

    const bubble = document.createElement('div');
    bubble.className = `max-w-[80%] px-4 py-3 rounded-2xl backdrop-blur-md transition-all border ${isSent
        ? 'bg-brand-cyan/10 border-brand-cyan/20 shadow-[0_0_15px_-5px_theme("colors.brand-cyan")] text-white rounded-br-sm'
        : 'bg-white/5 border-white/10 text-white/90 rounded-bl-sm hover:bg-white/10'
        }`;

    const text = document.createElement('p');
    text.className = 'text-[15px] leading-relaxed break-words whitespace-pre-wrap font-light tracking-wide';
    text.textContent = msg.text;

    const time = document.createElement('span');
    time.className = `text-[10px] mt-2 block ${isSent ? 'text-brand-cyan/60' : 'text-white/30'} flex justify-end font-medium tracking-wider`;
    time.textContent = formatMessageTime(msg.createdAt);

    bubble.appendChild(text);
    bubble.appendChild(time);
    wrapper.appendChild(bubble);

    return wrapper;
}

/**
 * Format message timestamp
 */
function formatMessageTime(timestamp) {
    if (!timestamp) return '';

    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        date = new Date(timestamp);
    }

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Scroll to bottom of messages (with flex-col-reverse, scroll to top)
 */
function scrollToBottom() {
    setTimeout(() => {
        chatMessagesContainer.scrollTop = 0;
    }, 100);
}

/**
 * Send message
 */
async function sendMessage() {
    const text = chatMessageInput.value.trim();
    if (!text || !currentPeer || !currentUser) return;

    // Disable input
    chatMessageInput.disabled = true;
    chatSendBtn.disabled = true;

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const conversationId = getConversationId(currentUser.uid, currentPeer.uid);
    const now = Timestamp.now();

    try {
        // Add message to conversation
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'conversations', conversationId, 'messages'), {
            text: text,
            senderId: currentUser.uid,
            createdAt: now
        });

        // Update my chat document
        const myChatRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'chats', currentPeer.uid);
        await setDoc(myChatRef, {
            id: currentPeer.uid,
            title: currentPeer.displayName || 'User',
            avatar: currentPeer.photoURL || '',
            isGroup: false,
            preview: 'You: ' + text,
            lastUpdated: now,
            unreadCount: 0,
            pinned: false,
            muted: false
        }, { merge: true });

        // Update peer's chat document
        const peerChatRef = doc(db, 'artifacts', appId, 'users', currentPeer.uid, 'chats', currentUser.uid);
        const peerChatSnap = await getDoc(peerChatRef);

        if (peerChatSnap.exists()) {
            await setDoc(peerChatRef, {
                preview: text,
                lastUpdated: now,
                unreadCount: increment(1)
            }, { merge: true });
        } else {
            await setDoc(peerChatRef, {
                id: currentUser.uid,
                title: currentUser.displayName || 'User',
                avatar: currentUser.photoURL || '',
                isGroup: false,
                preview: text,
                lastUpdated: now,
                unreadCount: 1,
                pinned: false,
                muted: false
            });
        }

        // Clear input and draft
        chatMessageInput.value = '';
        clearDraft(currentPeer.uid);

        // Reset button states
        const mediaButtons = document.getElementById('chat-media-buttons');
        chatSendBtn.classList.add('hidden');
        chatSendBtn.classList.remove('flex');
        mediaButtons.classList.remove('hidden');

        // Start listener if not already started
        if (!messagesUnsubscribe) {
            startMessagesListener(conversationId);
        }

    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    } finally {
        // Re-enable input
        chatMessageInput.disabled = false;
        chatSendBtn.disabled = true;
        chatMessageInput.focus();
    }
}

/**
 * Save draft to localStorage
 */
function saveDraft(peerId, text) {
    localStorage.setItem(`chat_draft_${peerId}`, text);
}

/**
 * Load draft from localStorage
 */
function loadDraft(peerId) {
    return localStorage.getItem(`chat_draft_${peerId}`) || '';
}

/**
 * Clear draft from localStorage
 */
function clearDraft(peerId) {
    localStorage.removeItem(`chat_draft_${peerId}`);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIndividualChat);
} else {
    initIndividualChat();
}

console.log('Individual-chat.js initialized');
