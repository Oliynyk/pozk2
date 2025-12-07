// ==========================================
// CHAT-FOLDERS.JS - Telegram-style Chat Folders
// Firebase Firestore Integration
// ==========================================

import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// State
let currentFolderId = null;
let currentFolderChats = [];
let foldersUnsubscribe = null;
let availableChats = []; // Mock or from different source

// ==========================================
// FOLDER LIST SCREEN
// ==========================================

function openFoldersView() {
    if (typeof openView === 'function') {
        openView('folders-view');
    }
    loadFolders();
}

async function loadFolders() {
    const db = window.firebaseDb;
    const auth = window.firebaseAuth;

    if (!db || !auth?.currentUser) {
        console.warn('Firebase not ready');
        return;
    }

    const userId = auth.currentUser.uid;
    const foldersRef = collection(db, 'users', userId, 'folders');
    const container = document.getElementById('folders-list');

    if (!container) return;

    try {
        // Real-time listener
        if (foldersUnsubscribe) foldersUnsubscribe();

        foldersUnsubscribe = onSnapshot(
            query(foldersRef, orderBy('createdAt', 'desc')),
            (snapshot) => {
                if (snapshot.empty) {
                    container.innerHTML = `
                        <div class="text-center text-gray-500 py-10">
                            <i class="fa-regular fa-folder-open text-4xl mb-3 text-gray-600"></i>
                            <p>Папок поки немає</p>
                        </div>
                    `;
                    return;
                }

                container.innerHTML = snapshot.docs.map(doc => {
                    const folder = doc.data();
                    const chatCount = folder.chatIds?.length || 0;
                    return `
                        <div onclick="openFolderEdit('${doc.id}')" 
                            class="glass-panel p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors group">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-brand-cyan/15 flex items-center justify-center">
                                    <i class="fa-solid fa-folder text-brand-cyan"></i>
                                </div>
                                <div>
                                    <h3 class="text-white font-medium">${folder.name || 'Без назви'}</h3>
                                    <p class="text-xs text-gray-500">${chatCount} ${getChatLabel(chatCount)}</p>
                                </div>
                            </div>
                            <i class="fa-solid fa-chevron-right text-gray-600 group-hover:text-white transition-colors"></i>
                        </div>
                    `;
                }).join('');
            }
        );
    } catch (err) {
        console.error('Error loading folders:', err);
        container.innerHTML = `<p class="text-red-400 text-center">Помилка завантаження</p>`;
    }
}

function getChatLabel(count) {
    if (count === 0) return 'чатів';
    if (count === 1) return 'чат';
    if (count >= 2 && count <= 4) return 'чати';
    return 'чатів';
}

// ==========================================
// FOLDER EDIT SCREEN
// ==========================================

async function openFolderEdit(folderId = null) {
    currentFolderId = folderId;
    currentFolderChats = [];

    if (typeof openView === 'function') {
        openView('folder-edit-view');
    }

    const titleEl = document.getElementById('folder-edit-title');
    const nameInput = document.getElementById('folder-name-input');
    const deleteBtn = document.getElementById('delete-folder-btn');
    const chatsContainer = document.getElementById('folder-chats-list');

    if (folderId) {
        // Edit existing folder
        if (titleEl) titleEl.textContent = 'Редагувати папку';
        if (deleteBtn) deleteBtn.classList.remove('hidden');

        // Load folder data
        const db = window.firebaseDb;
        const auth = window.firebaseAuth;
        if (db && auth?.currentUser) {
            const folderDoc = await getDocs(
                collection(db, 'users', auth.currentUser.uid, 'folders')
            );
            const folder = folderDoc.docs.find(d => d.id === folderId)?.data();
            if (folder) {
                if (nameInput) nameInput.value = folder.name || '';
                currentFolderChats = folder.chatIds || [];
            }
        }
    } else {
        // New folder
        if (titleEl) titleEl.textContent = 'Нова папка';
        if (deleteBtn) deleteBtn.classList.add('hidden');
        if (nameInput) nameInput.value = '';
        currentFolderChats = [];

        // Create new folder in Firestore
        await createNewFolder();
    }

    renderFolderChats();
    setupAutoSave();
}

async function createNewFolder() {
    const db = window.firebaseDb;
    const auth = window.firebaseAuth;

    if (!db || !auth?.currentUser) return;

    const foldersRef = collection(db, 'users', auth.currentUser.uid, 'folders');
    const docRef = await addDoc(foldersRef, {
        name: '',
        chatIds: [],
        createdAt: new Date()
    });

    currentFolderId = docRef.id;
    console.log('Created new folder:', currentFolderId);
}

function setupAutoSave() {
    const nameInput = document.getElementById('folder-name-input');
    if (!nameInput) return;

    // Debounced auto-save
    let saveTimeout;
    nameInput.oninput = () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => saveFolderName(nameInput.value), 500);
    };
}

async function saveFolderName(name) {
    if (!currentFolderId) return;

    const db = window.firebaseDb;
    const auth = window.firebaseAuth;

    if (!db || !auth?.currentUser) return;

    const folderRef = doc(db, 'users', auth.currentUser.uid, 'folders', currentFolderId);
    await updateDoc(folderRef, { name });
    console.log('Saved folder name:', name);
}

function renderFolderChats() {
    const container = document.getElementById('folder-chats-list');
    if (!container) return;

    if (currentFolderChats.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-6 bg-white/5 rounded-xl border border-dashed border-white/10">
                <i class="fa-regular fa-message text-2xl mb-2 text-gray-600"></i>
                <p class="text-sm">Чатів не додано</p>
            </div>
        `;
        return;
    }

    container.innerHTML = currentFolderChats.map(chatId => `
        <div class="flex items-center justify-between p-3 bg-white/5 rounded-xl">
            <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-gray-600 flex items-center justify-center text-xs text-white font-bold">
                    ${chatId.substring(0, 2).toUpperCase()}
                </div>
                <span class="text-white text-sm">${chatId}</span>
            </div>
            <button onclick="removeChatFromFolder('${chatId}')" class="text-red-400 hover:text-red-300 p-2">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');
}

async function removeChatFromFolder(chatId) {
    currentFolderChats = currentFolderChats.filter(id => id !== chatId);
    renderFolderChats();
    await saveFolderChats();
}

async function saveFolderChats() {
    if (!currentFolderId) return;

    const db = window.firebaseDb;
    const auth = window.firebaseAuth;

    if (!db || !auth?.currentUser) return;

    const folderRef = doc(db, 'users', auth.currentUser.uid, 'folders', currentFolderId);
    await updateDoc(folderRef, { chatIds: currentFolderChats });
    console.log('Saved folder chats:', currentFolderChats);
}

async function deleteCurrentFolder() {
    if (!currentFolderId) return;

    if (!confirm('Видалити папку?')) return;

    const db = window.firebaseDb;
    const auth = window.firebaseAuth;

    if (!db || !auth?.currentUser) return;

    const folderRef = doc(db, 'users', auth.currentUser.uid, 'folders', currentFolderId);
    await deleteDoc(folderRef);

    currentFolderId = null;
    currentFolderChats = [];

    if (typeof openView === 'function') {
        openView('folders-view');
    }

    if (typeof showToast === 'function') {
        showToast('Папку видалено', 'success');
    }
}

// ==========================================
// CHAT SELECTION SCREEN
// ==========================================

function openChatSelection() {
    if (typeof openView === 'function') {
        openView('folder-add-chats-view');
    }
    loadAvailableChats();
}

async function loadAvailableChats() {
    const container = document.getElementById('available-chats-list');
    if (!container) return;

    // Mock chats - replace with actual chat loading logic
    availableChats = [
        { id: 'chat_1', name: 'Проєктна група', avatar: 'UX' },
        { id: 'chat_2', name: 'Анна Бойко', avatar: 'АБ' },
        { id: 'chat_3', name: 'Робочий чат', avatar: 'РЧ' },
        { id: 'chat_4', name: 'Друзі', avatar: 'ДР' },
        { id: 'chat_5', name: 'Сім\'я', avatar: 'СМ' }
    ];

    container.innerHTML = availableChats.map(chat => {
        const isAdded = currentFolderChats.includes(chat.id);
        return `
            <div class="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-brand-cyan/20 flex items-center justify-center text-xs text-brand-cyan font-bold">
                        ${chat.avatar}
                    </div>
                    <span class="text-white">${chat.name}</span>
                </div>
                ${isAdded
                ? `<span class="text-green-400 text-sm"><i class="fa-solid fa-check mr-1"></i> Додано</span>`
                : `<button onclick="addChatToFolder('${chat.id}')" class="px-3 py-1.5 bg-brand-cyan/15 text-brand-cyan rounded-full text-sm font-medium hover:bg-brand-cyan/25 transition-colors">
                        <i class="fa-solid fa-plus mr-1"></i> Додати
                       </button>`
            }
            </div>
        `;
    }).join('');
}

async function addChatToFolder(chatId) {
    if (currentFolderChats.includes(chatId)) return;

    currentFolderChats.push(chatId);
    await saveFolderChats();
    loadAvailableChats(); // Re-render to show "Added" status

    if (typeof showToast === 'function') {
        showToast('Чат додано до папки', 'success');
    }
}

// ==========================================
// CHAT HEADER FOLDER TABS
// ==========================================

let selectedFolderTab = 'all';
let tabsFoldersUnsubscribe = null;

async function renderChatFolderTabs() {
    const container = document.getElementById('chat-folder-tabs');
    if (!container) return;

    const db = window.firebaseDb;
    const auth = window.firebaseAuth;

    if (!db || !auth?.currentUser) {
        // Only show "Всі чати" if not logged in
        return;
    }

    const userId = auth.currentUser.uid;
    const foldersRef = collection(db, 'users', userId, 'folders');

    try {
        // Real-time listener for tabs
        if (tabsFoldersUnsubscribe) tabsFoldersUnsubscribe();

        tabsFoldersUnsubscribe = onSnapshot(
            query(foldersRef, orderBy('createdAt', 'asc')),
            (snapshot) => {
                // Build tabs HTML: "Всі чати" + dynamic folders
                const allChatsTab = `
                    <button class="folder-tab ${selectedFolderTab === 'all' ? 'active' : ''} flex-1 min-w-max px-4 py-2 rounded-full ${selectedFolderTab === 'all' ? 'bg-white/10 text-white font-semibold shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5 font-medium'} text-[13px] whitespace-nowrap active:scale-95 transition-all" 
                        data-folder="all" onclick="selectFolderTab('all')">Всі чати</button>
                `;

                const folderTabs = snapshot.docs.map(doc => {
                    const folder = doc.data();
                    const isActive = selectedFolderTab === doc.id;
                    return `
                        <button class="folder-tab ${isActive ? 'active' : ''} flex-1 min-w-max px-4 py-2 rounded-full ${isActive ? 'bg-white/10 text-white font-semibold shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5 font-medium'} text-[13px] whitespace-nowrap active:scale-95 transition-all" 
                            data-folder="${doc.id}" onclick="selectFolderTab('${doc.id}')">${folder.name || 'Без назви'}</button>
                    `;
                }).join('');

                container.innerHTML = allChatsTab + folderTabs;
            }
        );
    } catch (err) {
        console.error('Error loading folder tabs:', err);
    }
}

function selectFolderTab(folderId) {
    selectedFolderTab = folderId;

    // Update tab styles
    document.querySelectorAll('.folder-tab').forEach(tab => {
        const isActive = tab.dataset.folder === folderId;
        tab.className = `folder-tab ${isActive ? 'active' : ''} flex-1 min-w-max px-4 py-2 rounded-full ${isActive ? 'bg-white/10 text-white font-semibold shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5 font-medium'} text-[13px] whitespace-nowrap active:scale-95 transition-all`;
    });

    // TODO: Filter chats by folder
    console.log('Selected folder:', folderId);
}

// Listen for view changes
const originalOpenView = window.openView;
window.openView = function (viewId, addToHistory = true) {
    originalOpenView(viewId, addToHistory);

    // Render folder tabs when chat opens
    if (viewId === 'chat') {
        setTimeout(renderChatFolderTabs, 100);
    }

    // Re-render folder chats when returning to folder-edit-view
    if (viewId === 'folder-edit-view') {
        setTimeout(renderFolderChats, 50);
    }
};

// ==========================================
// EXPORTS
// ==========================================

window.openFoldersView = openFoldersView;
window.openFolderEdit = openFolderEdit;
window.openChatSelection = openChatSelection;
window.addChatToFolder = addChatToFolder;
window.removeChatFromFolder = removeChatFromFolder;
window.deleteCurrentFolder = deleteCurrentFolder;
window.renderChatFolderTabs = renderChatFolderTabs;
window.selectFolderTab = selectFolderTab;

console.log('Chat-Folders.js initialized');
