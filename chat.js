import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
    import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, signInWithCustomToken, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
    import { getFirestore, collection, query, onSnapshot, addDoc, doc, setDoc, getDocs, orderBy, serverTimestamp, updateDoc, getDoc, increment, deleteDoc, where, Timestamp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
    
    const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{"apiKey":"AIzaSyB4dqGe4xYUzzoljDb4_HDMc6FM9PKBMPc","authDomain":"github-chat-pwa.firebaseapp.com","projectId":"github-chat-pwa","storageBucket":"github-chat-pwa.firebasestorage.app","messagingSenderId":"603999718572","appId":"1:603999718572:web:ddab34bdde92cfd58fa309"}');

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    // --- SOUND NOTIFICATION ---
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let lastSoundTime = 0;
    const SOUND_COOLDOWN = 3000; 

    function playNotificationSound() {
        const now = Date.now();
        if (now - lastSoundTime < SOUND_COOLDOWN) {
            return; 
        }
        lastSoundTime = now;

        try {
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(500, audioCtx.currentTime); 
            oscillator.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.4);
        } catch (e) {
            console.log("Audio error", e);
        }
    }

    function escapeHtml(text) {
        if (!text) return text;
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatLastSeen(timestamp) {
        if (!timestamp) return 'Offline';
        let date;
        if (timestamp.toDate) date = timestamp.toDate();
        else if (timestamp instanceof Date) date = timestamp;
        else date = new Date(timestamp);

        const now = new Date();
        const isToday = date.getDate() === now.getDate() &&
                        date.getMonth() === now.getMonth() &&
                        date.getFullYear() === now.getFullYear();
        
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;

        if (isToday) {
            return `Був(ла) сьогодні о ${timeStr}`;
        } else {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            return `Був(ла) ${day}.${month} о ${timeStr}`;
        }
    }

    let currentUser = null;
    let currentChatPeerId = null; 
    let currentChatId = null;     
    let isCurrentChatPinned = false;
    let isCurrentChatMuted = false;
    let messagesUnsubscribe = null;
    let chatsUnsubscribe = null;
    let foldersUnsubscribe = null;
    let allUsers = []; 
    let originalGroupMembers = [];
    
    let allChatsData = [];
    let userFolders = [];
    let currentFilter = 'all';
    
    let configMode = 'folder'; 
    let editingFolder = null;
    let newGroupData = { 
        id: null,
        name: '', 
        members: [], 
        emoji: '👥',
        isGroup: true,
        createdBy: null
    };
    
    const randomEmojis = ['😀', '🥳', '🚀', '💡', '🌟', '🛠️', '💻', '🍕', '🎮', '🏀', '⚽', '🐶', '🐱', '🐉', '🔥', '💎', '🎨', '📚'];
    const pickerEmojis = [
        '😀', '😂', '😍', '😎', '🥳', '🤔', '😴', '😭', '🤯', '🥶',
        '👋', '👍', '👎', '🤝', '🙏', '💪', '👀', '🧠', '💀', '👻',
        '🐶', '🐱', '🦊', '🐻', '🦁', '🐸', '🦄', '🐝', '🦋', '🦕',
        '💐', '🌹', '🌵', '🌲', '🍎', '🍕', '🍔', '🍟', '🍻', '🥂',
        '⚽', '🏀', '🏈', '🎾', '🎮', '🎲', '🎸', '🎨', '🎬', '🎤',
        '🚗', '✈️', '🚀', '🛸', '⚓', '🏝️', '🏔️', '🏠', '🏢', '🏥',
        '⌚', '📱', '💻', '📷', '💡', '🔦', '💰', '💎', '🔑', '🎁',
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '💯', '🔥'
    ];

    const views = {
        login: document.getElementById('chat-view-login'),
        chats: document.getElementById('chat-view-chats'),
        contacts: document.getElementById('chat-view-contacts'),
        room: document.getElementById('chat-view-chat-room'),
        config: document.getElementById('chat-view-config')
    };

    const chatMenuBtn = document.getElementById('chat-chat-menu-btn');
    const chatDropdown = document.getElementById('chat-chat-dropdown');
    const btnPinChat = document.getElementById('chat-btn-pin-chat');
    const btnMuteChat = document.getElementById('chat-btn-mute-chat');
    const chatsListMenuBtn = document.getElementById('chat-chats-list-menu-btn');
    const chatsListDropdown = document.getElementById('chat-chats-list-dropdown');
    const chatFiltersNav = document.getElementById('chat-chat-filters');
    const configTitle = document.getElementById('chat-config-title');
    const configBody = document.getElementById('chat-config-body');
    const configFooter = document.getElementById('chat-config-footer');
    const emojiPickerModal = document.getElementById('chat-emoji-picker-modal');
    const emojiGrid = document.getElementById('chat-emoji-grid');
    const closeEmojiPickerBtn = document.getElementById('chat-close-emoji-picker');
    
    const btnDeleteChat = document.getElementById('chat-btn-delete-chat');
    
    const fabMain = document.getElementById('chat-fab-main');
    const fabMenu = document.getElementById('chat-fab-menu');
    const fabIconEdit = fabMain.querySelector('.chat-fab-icon-edit');
    const fabIconClose = fabMain.querySelector('.chat-fab-icon-close');
    const fabCreateChat = document.getElementById('chat-fab-create-chat');
    const fabCreateGroup = document.getElementById('chat-fab-create-group');

    const btnBackContacts = document.getElementById('chat-btn-back-contacts');
    const btnOpenSearch = document.getElementById('chat-btn-open-search');
    const btnCloseSearch = document.getElementById('chat-btn-close-search');
    const contactsHeaderNormal = document.getElementById('chat-contacts-header-normal');
    const contactsHeaderSearch = document.getElementById('chat-contacts-header-search');
    const contactSearchInput = document.getElementById('chat-contact-search');

    async function initializeAuth() {
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';
        if (initialAuthToken) {
            try { await signInWithCustomToken(auth, initialAuthToken); } 
            catch (e) { await signInAnonymously(auth); }
        } else { await signInAnonymously(auth); }
    }
    
    fabMain.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFabMenu();
    });
    
    function toggleFabMenu() {
        const isOpen = fabMenu.classList.contains('chat-show');
        if (isOpen) {
            fabMenu.classList.remove('chat-show');
            fabMain.classList.remove('chat-active');
            fabIconEdit.style.display = 'block';
            fabIconClose.style.display = 'none';
        } else {
            fabMenu.classList.add('chat-show');
            fabMain.classList.add('chat-active');
            fabIconEdit.style.display = 'none';
            fabIconClose.style.display = 'block';
        }
    }
    
    fabCreateChat.addEventListener('click', () => {
        toggleFabMenu();
        showView('contacts');
        if (allUsers.length > 0) {
            renderContacts(allUsers.filter(u => u.uid !== currentUser.uid));
        }
    });
    
    fabCreateGroup.addEventListener('click', () => {
        toggleFabMenu();
        configMode = 'group_new';
        newGroupData = { 
            id: null,
            name: '', 
            members: [currentUser.uid], 
            emoji: randomEmojis[Math.floor(Math.random() * randomEmojis.length)],
            isGroup: true,
            createdBy: currentUser.uid
        };
        openConfigView('new_group');
    });

    btnBackContacts.addEventListener('click', () => showView('chats'));
    
    btnOpenSearch.addEventListener('click', () => {
        contactsHeaderNormal.style.display = 'none';
        contactsHeaderSearch.style.display = 'flex';
        contactSearchInput.focus();
    });
    
    btnCloseSearch.addEventListener('click', () => {
        contactsHeaderSearch.style.display = 'none';
        contactsHeaderNormal.style.display = 'flex';
        contactSearchInput.value = '';
        contactSearchInput.dispatchEvent(new Event('input'));
    });

    document.getElementById('chat-nav-chats-btn').addEventListener('click', () => showView('chats'));
    
    document.getElementById('chat-btn-back-chat').addEventListener('click', () => {
        if (messagesUnsubscribe) messagesUnsubscribe();
        showView('chats');
    });
    
    document.getElementById('chat-btn-logout').addEventListener('click', () => signOut(auth));
    document.getElementById('chat-btn-google').addEventListener('click', async () => {
        const provider = new GoogleAuthProvider();
        try { await signInWithPopup(auth, provider); } catch (error) { console.error(error.message); }
    });

    chatMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); chatDropdown.classList.toggle('chat-show'); });
    chatsListMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); chatsListDropdown.classList.toggle('chat-show'); });
    document.addEventListener('click', (e) => {
        if (!chatDropdown.contains(e.target) && e.target !== chatMenuBtn) { chatDropdown.classList.remove('chat-show'); }
        if (!chatsListDropdown.contains(e.target) && e.target !== chatsListMenuBtn) { chatsListDropdown.classList.remove('chat-show'); }
        if (fabMenu.classList.contains('chat-show') && !fabMenu.contains(e.target) && e.target !== fabMain) {
            toggleFabMenu();
        }
        if (e.target === emojiPickerModal) closeEmojiPicker();
    });

    document.getElementById('chat-btn-open-folder-config').addEventListener('click', () => {
        chatsListDropdown.classList.remove('chat-show');
        configMode = 'folder';
        openConfigView('list');
    });
    
    document.getElementById('chat-btn-back-config').addEventListener('click', () => {
        if (configMode === 'folder') {
            if (configTitle.textContent === 'Select Chats') {
                openConfigView('edit', editingFolder);
            } else if (editingFolder) {
                editingFolder = null;
                openConfigView('list');
            } else {
                showView('chats');
            }
        } else if (configMode.startsWith('group')) {
            if (configTitle.textContent === 'Add Members') {
                 openConfigView(configMode === 'group_new' ? 'new_group' : 'edit_group');
            } else if (configMode === 'group_new') {
                showView('chats'); 
            } else {
                showView('room');
            }
        }
    });
    
    closeEmojiPickerBtn.addEventListener('click', closeEmojiPicker);
    
    function openEmojiPicker(isReadOnly) {
        if (isReadOnly) return; 
        if (emojiGrid.children.length === 0) {
            pickerEmojis.forEach(emoji => {
                const btn = document.createElement('button');
                btn.className = 'chat-emoji-btn';
                btn.textContent = emoji;
                btn.addEventListener('click', () => handleEmojiSelect(emoji));
                emojiGrid.appendChild(btn);
            });
        }
        emojiPickerModal.classList.add('chat-show');
    }
    
    function closeEmojiPicker() { emojiPickerModal.classList.remove('chat-show'); }
    
    function handleEmojiSelect(emoji) {
        newGroupData.emoji = emoji;
        const preview = document.getElementById('chat-group-emoji-preview');
        if (preview) preview.textContent = emoji;
        closeEmojiPicker();
    }

    btnPinChat.addEventListener('click', async () => {
        if (!currentChatId || !currentUser) return;
        const newStatus = !isCurrentChatPinned;
        try {
            const myChatDocId = currentChatPeerId ? currentChatPeerId : currentChatId;
            const myChatRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'chats', myChatDocId);
            await updateDoc(myChatRef, { pinned: newStatus });
            isCurrentChatPinned = newStatus;
            updateChatMenuUI();
            chatDropdown.classList.remove('chat-show');
        } catch (e) { console.error("Error pinning chat:", e); }
    });

    btnMuteChat.addEventListener('click', async () => {
        if (!currentChatId || !currentUser) return;
        const newStatus = !isCurrentChatMuted;
        try {
            const myChatDocId = currentChatPeerId ? currentChatPeerId : currentChatId;
            const myChatRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'chats', myChatDocId);
            await updateDoc(myChatRef, { muted: newStatus });
            isCurrentChatMuted = newStatus;
            updateChatMenuUI();
            chatDropdown.classList.remove('chat-show');
        } catch (e) { console.error("Error muting chat:", e); }
    });

    btnDeleteChat.addEventListener('click', async () => {
        if (!currentChatId || !currentUser) return;
        
        const isGroup = !currentChatPeerId;
        const confirmMsg = isGroup 
            ? "Вийти з групи та видалити чат?" 
            : "Видалити цей чат? (Історія повідомлень залишиться у співрозмовника)";

        if (!confirm(confirmMsg)) return;

        chatDropdown.classList.remove('chat-show');
        
        try {
            const myChatDocId = currentChatPeerId ? currentChatPeerId : currentChatId;
            await deleteDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'chats', myChatDocId));

            if (isGroup) {
                const groupRef = doc(db, 'artifacts', appId, 'public', 'data', 'groups', currentChatId);
                const groupSnap = await getDoc(groupRef);
                if (groupSnap.exists()) {
                    const currentMembers = groupSnap.data().members || [];
                    const updatedMembers = currentMembers.filter(uid => uid !== currentUser.uid);
                    if (updatedMembers.length === 0) {
                         await deleteDoc(groupRef);
                    } else {
                         await updateDoc(groupRef, { members: updatedMembers });
                    }
                }
            }
            showView('chats');
        } catch (e) {
            console.error("Error deleting chat:", e);
            alert("Помилка при видаленні чату");
        }
    });

    function updateChatMenuUI() {
        const pinSpan = btnPinChat.querySelector('span');
        pinSpan.textContent = isCurrentChatPinned ? "Unpin Chat" : "Pin Chat";
        
        const muteSpan = btnMuteChat.querySelector('span');
        muteSpan.textContent = isCurrentChatMuted ? "Unmute Chat" : "Mute Chat";
        
        const muteIconPath = btnMuteChat.querySelector('path');
        
        // Toggle visibility of the header mute icon
        const headerMuteIcon = document.getElementById('chat-header-mute-icon');
        if (headerMuteIcon) {
            headerMuteIcon.style.display = isCurrentChatMuted ? 'block' : 'none';
        }

        if (isCurrentChatMuted) {
            // Show volume up icon for unmute
             muteIconPath.setAttribute('d', "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z");
        } else {
            // Show mute icon for mute
             muteIconPath.setAttribute('d', "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z");
        }
    }

    function showView(viewName) {
        Object.values(views).forEach(el => el.classList.remove('chat-active'));
        views[viewName].classList.add('chat-active');
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await saveUserToPublic(user);
            startUsersListener(); 
            showView('chats');
            startChatsListener(user.uid);
            startFoldersListener(user.uid);
            document.body.addEventListener('click', () => {
                if (audioCtx.state === 'suspended') audioCtx.resume();
            }, { once: true });
        } else {
            currentUser = null;
            if (chatsUnsubscribe) chatsUnsubscribe();
            if (foldersUnsubscribe) foldersUnsubscribe();
            showView('login');
        }
    });

    setInterval(() => { if (currentUser) saveUserToPublic(currentUser); }, 60000);

    initializeAuth();

    async function saveUserToPublic(user) {
        try {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
                uid: user.uid,
                displayName: user.displayName || user.email || 'Anonymous',
                photoURL: user.photoURL || '',
                email: user.email,
                lastActive: serverTimestamp()
            }, { merge: true });
        } catch (e) { console.error("Error saving user data:", e); }
    }

    function startUsersListener() {
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
        onSnapshot(q, (snapshot) => {
            allUsers = snapshot.docs.map(doc => doc.data());
            if (views.contacts.classList.contains('chat-active')) renderContacts(allUsers.filter(u => u.uid !== currentUser.uid));
            if (views.chats.classList.contains('chat-active')) renderChatList();
            if (views.room.classList.contains('chat-active') && currentChatPeerId) updateChatHeaderStatus();
        });
    }

    function isUserOnline(user) {
        if (!user || !user.lastActive) return false;
        const now = Date.now();
        const lastActive = user.lastActive.toMillis ? user.lastActive.toMillis() : 0;
        return (now - lastActive) < 5 * 60 * 1000; 
    }

    function updateChatHeaderStatus() {
        const statusEl = document.getElementById('chat-chat-room-status');
        if (!currentChatPeerId) {
            const chat = allChatsData.find(c => c.id === currentChatId);
            if (chat && chat.members) {
                 statusEl.textContent = `${chat.members.length} members`;
                 statusEl.className = 'chat-header-status';
            }
            return;
        }
        const user = allUsers.find(u => u.uid === currentChatPeerId);
        if (user) {
            const online = isUserOnline(user);
            statusEl.textContent = online ? 'Online' : formatLastSeen(user.lastActive);
            statusEl.className = `chat-header-status ${online ? 'chat-online' : ''}`;
        } else { statusEl.textContent = ''; }
    }
    
    function startFoldersListener(userId) {
        if (foldersUnsubscribe) foldersUnsubscribe();
        const foldersRef = collection(db, 'artifacts', appId, 'users', userId, 'folders');
        foldersUnsubscribe = onSnapshot(query(foldersRef), (snapshot) => {
            userFolders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderFilterTabs();
            renderChatList();
            if (views.config.classList.contains('chat-active') && configMode === 'folder' && !editingFolder) {
                renderFolderListState();
            }
        }, (error) => console.error("Error fetching folders:", error));
    }

    function renderFilterTabs() {
        chatFiltersNav.innerHTML = '';
        
        // 1. Count total unread
        const allUnread = allChatsData.reduce((acc, chat) => acc + (chat.unreadCount || 0), 0);
        
        // --- BADGE LOGIC ---
        const bottomBadge = document.getElementById('chat-bottom-nav-badge');
        if (bottomBadge) {
            if (allUnread > 0) {
                bottomBadge.textContent = allUnread > 99 ? '99+' : allUnread;
                bottomBadge.classList.add('chat-show');
            } else {
                bottomBadge.classList.remove('chat-show');
            }
        }

        const mandatoryTabs = [
            { id: 'all', title: 'All Chats', badge: 0 }, 
            { id: 'unread', title: 'Unread', badge: allUnread }
        ];
        
        const allTabs = [...mandatoryTabs, ...userFolders.map(f => ({ 
            id: f.id, 
            title: f.name, 
            badge: allChatsData.filter(chat => f.chatIds.includes(chat.id)).reduce((acc, chat) => acc + (chat.unreadCount || 0), 0)
        }))];

        allTabs.forEach(tabData => {
            const button = document.createElement('button');
            button.className = `chat-tab ${tabData.id === currentFilter ? 'chat-active' : ''}`;
            button.setAttribute('role', 'tab');
            let badgeHtml = tabData.badge > 0 ? `<span class="chat-tab-badge">${tabData.badge}</span>` : '';
            button.innerHTML = `${tabData.title} ${badgeHtml}`;
            button.addEventListener('click', () => handleFilterTabClick(tabData.id));
            chatFiltersNav.appendChild(button);
        });
    }

    function handleFilterTabClick(filterId) {
        document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('chat-active'));
        currentFilter = filterId;
        renderFilterTabs();
        renderChatList();
    }

    function startChatsListener(userId) {
        const chatsRef = collection(db, 'artifacts', appId, 'users', userId, 'chats');
        const container = document.getElementById('chat-chats-list-container');
        container.innerHTML = '<div class="chat-loading-placeholder">Loading chats...</div>';

        if (chatsUnsubscribe) chatsUnsubscribe();
        
        let isInitialLoad = true;

        chatsUnsubscribe = onSnapshot(query(chatsRef), (snapshot) => {
            // --- SOUND NOTIFICATION LOGIC ---
            if (!isInitialLoad) {
                let shouldPlaySound = false;
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'modified' || change.type === 'added') {
                        const newData = change.doc.data();
                        
                        // Determine if we are viewing THIS SPECIFIC chat
                        const chatDocId = change.doc.id;
                        const isViewingThisChat = views.room.classList.contains('chat-active') && 
                            (
                                (newData.isGroup && newData.id === currentChatId) || 
                                (!newData.isGroup && chatDocId === currentChatPeerId)
                            );

                        // Play sound ONLY if:
                        // 1. Unread count > 0
                        // 2. Chat is NOT muted
                        // 3. User is NOT currently viewing this chat
                        if (newData.unreadCount > 0 && !newData.muted && !isViewingThisChat) {
                            shouldPlaySound = true;
                        }
                    }
                });
                
                if (shouldPlaySound) {
                    playNotificationSound();
                }
            }
            isInitialLoad = false;
            // --------------------------------

            const chats = [];
            snapshot.forEach(docSnap => { 
                const data = docSnap.data();
                const chatDocId = docSnap.id;

                const isViewingThisChat = views.room.classList.contains('chat-active') && 
                    (
                        (data.isGroup && data.id === currentChatId) || 
                        (!data.isGroup && chatDocId === currentChatPeerId)
                    );

                if (isViewingThisChat && data.unreadCount > 0) {
                    setDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'chats', chatDocId), 
                        { unreadCount: 0 }, { merge: true });
                    data.unreadCount = 0;
                }

                chats.push({ id: chatDocId, ...data });
            });
            allChatsData = chats;
            
            if (views.room.classList.contains('chat-active') && currentChatId) {
                const lookupId = currentChatPeerId ? currentChatPeerId : currentChatId;
                const currentChatStillExists = chats.some(c => c.id === lookupId);
                if (!currentChatStillExists && !currentChatPeerId) {
                    showView('chats');
                }
            }

            renderFilterTabs(); 
            renderChatList();
        });
    }

    function renderChatList() {
        const container = document.getElementById('chat-chats-list-container');
        container.innerHTML = '';

        let filteredChats = [];
        if (currentFilter === 'all') filteredChats = allChatsData;
        else if (currentFilter === 'unread') filteredChats = allChatsData.filter(chat => (chat.unreadCount || 0) > 0);
        else {
            const folder = userFolders.find(f => f.id === currentFilter);
            if (folder) filteredChats = allChatsData.filter(chat => folder.chatIds.includes(chat.id));
            else filteredChats = allChatsData; 
        }

        if (filteredChats.length === 0) {
            container.innerHTML = '<div class="chat-loading-placeholder">No chats found.</div>';
            return;
        }

        filteredChats.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            const timeA = a.lastUpdated ? a.lastUpdated.toMillis() : Date.now();
            const timeB = b.lastUpdated ? b.lastUpdated.toMillis() : Date.now();
            return timeB - timeA;
        });

        filteredChats.forEach(chatData => { container.appendChild(createChatItem(chatData)); });
    }

    function createChatItem(data) {
        const el = document.createElement('article');
        const unreadCount = data.unreadCount || 0;
        el.className = `chat-chat-item ${unreadCount > 0 ? 'chat-unread' : ''} ${data.pinned ? 'chat-pinned' : ''}`;
        
        // 1. Avatar
        let avatarHtml = '';
        const safeTitle = escapeHtml(data.title || '?');
        const safeEmoji = data.emoji || '👥';

        if (data.isGroup) {
            avatarHtml = `<div class="chat-avatar-emoji">${safeEmoji}</div>`;
        } else {
             avatarHtml = data.avatar ? 
                `<img class="chat-avatar" src="${data.avatar}" onerror="this.onerror=null;this.src='https://placehold.co/52x52/2b2d31/8b939a?text=${safeTitle.substring(0,1).toUpperCase()}'">` : 
                `<div class="chat-avatar-fallback">${safeTitle.substring(0,1).toUpperCase()}</div>`;
        }

        // 2. Status Dot
        let onlineDot = '';
        if (!data.isGroup) {
            const user = allUsers.find(u => u.uid === data.id);
            if (user && isUserOnline(user)) {
                onlineDot = `<span class="chat-status-dot chat-online"></span>`;
            }
        }

        // 3. Time
        let timeStr = '';
        if (data.lastUpdated) {
            const d = data.lastUpdated.toDate();
            timeStr = `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
        }

        const pinIcon = data.pinned ? `<svg class="chat-pin-icon" viewBox="0 0 24 24"><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"></path></svg>` : '';
        
        // NEW: Mute Icon
        const muteIcon = data.muted ? `<svg class="chat-mute-icon" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"></path></svg>` : '';

        // Read Status Icons
        let statusIcon = '';
        if (!data.isGroup && data.preview && data.preview.startsWith('You:')) {
            statusIcon = data.status === 'read' ? 
                `<svg class="chat-verified-icon" viewBox="0 0 24 24"><path d="M2.305,11.235a1,1,0,0,1,1.414.024l3.206,3.319L14.3,7.289A1,1,0,0,1,15.7,8.711l-8.091,8a1,1,0,0,1-.7.289H6.9a1,1,0,0,1-.708-.3L2.281,12.649A1,1,0,0,1,2.305,11.235ZM20.3,7.289l-7.372,7.289-.263-.273a1,1,0,1,0-1.438,1.39l.966,1a1,1,0,0,0,.708.3h.011a1,1,0,0,0,.7-.289l8.091-8A1,1,0,0,0,20.3,7.289Z"/></svg>` : 
                `<svg class="chat-verified-icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
        }

        // 4. Build HTML
        el.innerHTML = `
            <div class="chat-avatar-container">
                ${avatarHtml}
                ${onlineDot}
            </div>
            <div class="chat-chat-body">
                <div class="chat-chat-row">
                    <div class="chat-chat-title-wrapper">
                        <span class="chat-chat-title">${safeTitle}</span>
                        ${muteIcon}
                        </div>
                    <time class="chat-chat-time">${timeStr}</time>
                </div>
                <div class="chat-chat-preview-row">
                    <p class="chat-chat-preview">${escapeHtml(data.preview) || 'Draft'}</p>
                    <div class="chat-chat-meta">${pinIcon}${statusIcon}${unreadCount > 0 ? `<span class="chat-chat-badge">${unreadCount}</span>` : ''}</div>
                </div>
            </div>
        `;
        el.addEventListener('click', () => openChat(data));
        return el;
    }

    function openConfigView(state, data = null) {
        showView('config');
        if (configMode === 'folder') {
            if (state === 'list') renderFolderListState();
            else if (state === 'edit') { editingFolder = { ...data }; renderFolderEditState(); }
            else if (state === 'new') { editingFolder = { name: '', chatIds: [] }; renderFolderEditState(); }
            else if (state === 'add_chats') renderAddChatsState();
        } else if (configMode.startsWith('group')) {
            if (state === 'new_group') renderNewGroupFormState(false);
            else if (state === 'edit_group') renderNewGroupFormState(false);
            else if (state === 'view_group') renderNewGroupFormState(true); 
            else if (state === 'add_members') renderAddMembersState();
        }
    }

    function renderFolderListState() {
        configTitle.textContent = 'Folders';
        configFooter.innerHTML = ''; 
        let listHtml = '';
        if (userFolders.length > 0) {
            userFolders.forEach(folder => {
                listHtml += `
                    <button class="chat-folder-list-item" data-folder-id="${folder.id}">
                        <div class="chat-folder-info">
                            <div class="chat-folder-icon-bg"><svg class="chat-folder-icon" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"></path></svg></div>
                            <div class="chat-folder-text-col"><span class="chat-folder-title">${escapeHtml(folder.name)}</span><span class="chat-folder-count">${folder.chatIds.length} chats</span></div>
                        </div>
                        <svg class="chat-chevron-icon" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                    </button>
                `;
            });
        } else { listHtml = '<div class="chat-empty-state">No folders created yet.</div>'; }
        listHtml += `<button class="chat-fab-add" id="chat-btn-create-new-folder"><svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button>`;
        configBody.innerHTML = listHtml;
        
        const btnCreate = document.getElementById('chat-btn-create-new-folder');
        if (btnCreate) btnCreate.onclick = () => openConfigView('new');
        
        document.querySelectorAll('.chat-folder-list-item').forEach(btn => {
            btn.onclick = (e) => {
                const folder = userFolders.find(f => f.id === e.currentTarget.getAttribute('data-folder-id'));
                if (folder) openConfigView('edit', folder);
            };
        });
    }

    function renderFolderEditState() {
        configTitle.textContent = editingFolder.id ? 'Edit Folder' : 'New Folder';
        const chatsInFolder = allChatsData.filter(chat => editingFolder.chatIds.includes(chat.id));
        let chatsListHtml = '';
        if (chatsInFolder.length > 0) {
            chatsInFolder.forEach(chat => {
                chatsListHtml += `
                    <div class="chat-item-to-add" data-chat-id="${chat.id}">
                        <div class="chat-item-to-add-info">${createAvatarHtml(chat.title, chat.avatar, chat.isGroup, chat.emoji, '36px', '14px')}<span class="chat-item-to-add-title">${escapeHtml(chat.title)}</span></div>
                        <button class="chat-icon-btn chat-btn-remove-item"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
                    </div>
                `;
            });
        } else { chatsListHtml = '<div class="chat-empty-state" style="padding: 20px;">Folder is empty.</div>'; }

        configBody.innerHTML = `
            <div class="chat-config-section">
                <div class="chat-form-input-group">
                    <label for="chat-folder-name">Folder Name</label>
                    <input type="text" id="chat-folder-name" value="${escapeHtml(editingFolder.name)}" placeholder="e.g. Work, Family" autocomplete="off">
                </div>
            </div>
            <div class="chat-section-header">Included Chats (${chatsInFolder.length})</div>
            <div id="chat-chats-in-folder-list">${chatsListHtml}</div>
            <div class="chat-config-section" style="border-bottom: none;">
                <button class="chat-btn-block chat-btn-surface" id="chat-btn-open-add-chats" style="border: 1px dashed var(--text-muted); color: var(--accent);">+ Add Chats</button>
            </div>
        `;
        configFooter.innerHTML = '';
        if (editingFolder.id) {
            configFooter.innerHTML = `<button class="chat-btn-block chat-btn-danger" id="chat-btn-delete-folder">Delete Folder</button>`;
            document.getElementById('chat-btn-delete-folder').onclick = handleDeleteFolder;
        }
        
        document.getElementById('chat-folder-name').oninput = handleFolderNameChange;
        document.getElementById('chat-btn-open-add-chats').onclick = () => openConfigView('add_chats');
        document.querySelectorAll('.chat-btn-remove-item').forEach(btn => { btn.onclick = handleRemoveChatFromFolder; });
    }

    function renderAddChatsState() {
        configTitle.textContent = 'Select Chats';
        configFooter.innerHTML = '';
        const existingChatIds = editingFolder.chatIds;
        const availableChats = allChatsData.filter(chat => !existingChatIds.includes(chat.id));
        let listHtml = '';
        if (availableChats.length > 0) {
            availableChats.forEach(chat => {
                listHtml += `
                    <div class="chat-item-to-add" data-chat-id="${chat.id}">
                        <div class="chat-item-to-add-info">${createAvatarHtml(chat.title, chat.avatar, chat.isGroup, chat.emoji, '36px', '14px')}<span class="chat-item-to-add-title">${escapeHtml(chat.title)}</span></div>
                        <button class="chat-btn-add-item">Add</button>
                    </div>
                `;
            });
        } else { listHtml = '<div class="chat-empty-state">All active chats are already in this folder.</div>'; }
        configBody.innerHTML = `<div>${listHtml}</div>`;
        document.querySelectorAll('.chat-btn-add-item').forEach(btn => { btn.onclick = handleAddChatToFolder; });
    }

    function renderNewGroupFormState(isReadOnly) {
        configTitle.textContent = configMode === 'group_new' ? 'New Group' : (isReadOnly ? 'Group Info' : 'Edit Group');
        const membersList = allUsers.filter(u => newGroupData.members.includes(u.uid));
        const creator = allUsers.find(u => u.uid === currentUser.uid) || { uid: currentUser.uid, displayName: 'You', photoURL: currentUser.photoURL };
        let membersHtml = '';
        if (newGroupData.members.includes(currentUser.uid)) {
             membersHtml += `<div class="chat-item-to-add" data-user-id="${currentUser.uid}">
                <div class="chat-item-to-add-info">${createAvatarHtml(creator.displayName, creator.photoURL, false, '', '36px', '14px')}<span class="chat-item-to-add-title">${creator.displayName === 'You' ? 'You' : escapeHtml(creator.displayName) + ' (You)'}</span></div>
                ${!isReadOnly && configMode !== 'group_new' ? '<span style="font-size:12px;color:var(--muted);margin-right:4px;">(Admin)</span>' : ''}
            </div>`;
        }
        membersList.forEach(user => {
            if (user.uid !== currentUser.uid) {
                 membersHtml += `
                    <div class="chat-item-to-add" data-user-id="${user.uid}">
                        <div class="chat-item-to-add-info">${createAvatarHtml(user.displayName, user.photoURL, false, '', '36px', '14px')}<span class="chat-item-to-add-title">${escapeHtml(user.displayName)}</span></div>
                        ${!isReadOnly ? `<button class="chat-icon-btn chat-btn-remove-item" data-user-id="${user.uid}"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>` : ''}
                    </div>
                `;
            }
        });
        const readonlyClass = isReadOnly ? 'chat-readonly' : '';
        const disabledAttr = isReadOnly ? 'disabled' : '';

        configBody.innerHTML = `
            <div class="chat-config-section" style="padding-top: 20px; border-bottom: none;">
                <div class="chat-group-avatar-picker">
                    <div class="chat-group-avatar-preview ${readonlyClass}" id="chat-group-emoji-preview">${newGroupData.emoji}</div>
                </div>
                <div class="chat-form-input-group">
                    <label for="chat-group-name">Group Name</label>
                    <input type="text" id="chat-group-name" value="${escapeHtml(newGroupData.name)}" placeholder="e.g. Project Team" autocomplete="off" ${disabledAttr}>
                </div>
            </div>
            <div class="chat-section-header">Members (${newGroupData.members.length})</div>
            <div id="chat-group-members-list">${membersHtml}</div>
            ${!isReadOnly ? `<div class="chat-config-section"><button class="chat-btn-block chat-btn-surface" id="chat-btn-open-add-members" style="border: 1px dashed var(--text-muted); color: var(--accent);">+ Add Members</button></div>` : ''}
        `;
        
        if (configMode === 'group_new') {
            configFooter.innerHTML = `<button class="chat-btn-block chat-btn-accent" id="chat-btn-create-group" ${newGroupData.members.length < 2 || !newGroupData.name.trim() ? 'disabled' : ''}>Create Group</button>`;
            const btn = document.getElementById('chat-btn-create-group');
            if(btn) btn.onclick = handleCreateGroup;
        } else if (!isReadOnly) {
            configFooter.innerHTML = `<button class="chat-btn-block chat-btn-accent" id="chat-btn-save-group">Save Changes</button>`;
            const btn = document.getElementById('chat-btn-save-group');
            if(btn) btn.onclick = handleSaveGroupChanges;
        } else { configFooter.innerHTML = ''; }

        if (!isReadOnly) {
            document.getElementById('chat-group-emoji-preview').onclick = () => openEmojiPicker(isReadOnly);
            document.getElementById('chat-group-name').oninput = handleGroupNameChange;
            document.getElementById('chat-btn-open-add-members').onclick = () => openConfigView('add_members');
            document.querySelectorAll('.chat-btn-remove-item').forEach(btn => { btn.onclick = handleRemoveMemberFromGroup; });
        }
    }
    
    function renderAddMembersState() {
        configTitle.textContent = 'Add Members';
        configFooter.innerHTML = '';
        const availableUsers = allUsers.filter(u => !newGroupData.members.includes(u.uid) && u.uid !== currentUser.uid);
        let listHtml = '';
        if (availableUsers.length > 0) {
            availableUsers.forEach(user => {
                listHtml += `
                    <div class="chat-item-to-add" data-user-id="${user.uid}">
                        <div class="chat-item-to-add-info">${createAvatarHtml(user.displayName, user.photoURL, false, '', '36px', '14px')}<span class="chat-item-to-add-title">${escapeHtml(user.displayName)}</span></div>
                        <button class="chat-btn-add-item">Add</button>
                    </div>
                `;
            });
        } else { listHtml = '<div class="chat-empty-state">No other users available to add.</div>'; }
        configBody.innerHTML = `<div>${listHtml}</div>`;
        document.querySelectorAll('.chat-btn-add-item').forEach(btn => { btn.onclick = handleAddMemberToGroup; });
    }

    function createAvatarHtml(title, photoURL, isGroup, emoji, size = '52px', fontSize = '18px') {
        const letter = (title || '?').substring(0,1).toUpperCase();
        const fallbackHtml = `<div class="chat-avatar-fallback" style="width: 100%; height: 100%; font-size: ${fontSize}; position: absolute; top: 0; left: 0; z-index: 1;">${letter}</div>`;
        const wrapperStyle = `position: relative; width: ${size}; height: ${size}; display: inline-block;`;

        if (isGroup) {
            return `<div class="chat-avatar-emoji" style="width: ${size}; height: ${size}; font-size: ${fontSize.replace('px', '') * 1.5}px;">${emoji || '👥'}</div>`;
        } 
        
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

    async function handleFolderNameChange(e) {
        const newName = e.target.value.trim();
        editingFolder.name = newName;
        if (newName.length > 0 && editingFolder.chatIds.length > 0 && editingFolder.id) await saveFolder();
    }

    async function handleAddChatToFolder(e) {
        const chatId = e.currentTarget.closest('.chat-item-to-add').getAttribute('data-chat-id');
        if (!editingFolder.chatIds.includes(chatId)) {
            editingFolder.chatIds.push(chatId);
            if (editingFolder.name.length > 0) await saveFolder();
            else { openConfigView('edit', editingFolder); document.getElementById('chat-folder-name').focus(); return; }
        }
        renderAddChatsState(); 
    }
    
    async function handleRemoveChatFromFolder(e) {
        const chatId = e.currentTarget.closest('.chat-item-to-add').getAttribute('data-chat-id');
        editingFolder.chatIds = editingFolder.chatIds.filter(id => id !== chatId);
        if (editingFolder.chatIds.length === 0 && editingFolder.id) {
            try { await deleteDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'folders', editingFolder.id)); } catch (e) { console.error(e); }
            editingFolder = null;
            openConfigView('list');
        } else { await saveFolder(); renderFolderEditState(); }
    }

    async function handleDeleteFolder() {
        if (confirm("Delete this folder?")) {
             try {
                await deleteDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'folders', editingFolder.id));
                editingFolder = null;
                openConfigView('list');
             } catch (e) { console.error(e); }
        }
    }

    async function saveFolder() {
        if (!currentUser || !editingFolder.name || editingFolder.chatIds.length === 0) return;
        const folderData = { name: editingFolder.name, chatIds: editingFolder.chatIds };
        try {
            if (editingFolder.id) await updateDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'folders', editingFolder.id), folderData);
            else {
                const newDocRef = await addDoc(collection(db, 'artifacts', appId, 'users', currentUser.uid, 'folders'), folderData);
                editingFolder.id = newDocRef.id;
            }
        } catch (e) { console.error("Error saving folder:", e); }
    }

    function handleGroupNameChange(e) {
        newGroupData.name = e.target.value.trim();
        const btn = document.getElementById('chat-btn-create-group');
        if(btn) btn.disabled = newGroupData.members.length < 2 || !newGroupData.name.trim();
    }

    function handleAddMemberToGroup(e) {
        const userId = e.currentTarget.closest('.chat-item-to-add').getAttribute('data-user-id');
        if (!newGroupData.members.includes(userId)) {
            newGroupData.members.push(userId);
            renderAddMembersState(); 
        }
    }

    function handleRemoveMemberFromGroup(e) {
        const userIdToRemove = e.currentTarget.getAttribute('data-user-id');
        newGroupData.members = newGroupData.members.filter(uid => uid !== userIdToRemove);
        if(configMode === 'group_new') {
            const btn = document.getElementById('chat-btn-create-group');
            if (btn) btn.disabled = newGroupData.members.length < 2 || !newGroupData.name.trim();
        }
        renderNewGroupFormState(false);
    }
    
    async function openGroupInfo(chatData) {
        if (!chatData.isGroup) return;
        try {
            const groupRef = doc(db, 'artifacts', appId, 'public', 'data', 'groups', chatData.id);
            const groupSnap = await getDoc(groupRef);
            if (groupSnap.exists()) {
                const groupFullData = groupSnap.data();
                newGroupData = {
                    id: chatData.id,
                    name: groupFullData.title,
                    members: groupFullData.members,
                    emoji: groupFullData.emoji,
                    isGroup: true,
                    createdBy: groupFullData.createdBy
                };
                originalGroupMembers = [...groupFullData.members];
                const isOwner = groupFullData.createdBy === currentUser.uid;
                configMode = isOwner ? 'group_edit' : 'group_view';
                openConfigView(isOwner ? 'edit_group' : 'view_group');
            } else { console.error("Group not found"); }
        } catch (e) { console.error("Error fetching group info:", e); }
    }
    
    async function handleCreateGroup() {
        if (newGroupData.members.length < 2 || !newGroupData.name.trim()) return;
        
        const btn = document.getElementById('chat-btn-create-group');
        btn.disabled = true; btn.textContent = 'Creating...';

        try {
            const now = serverTimestamp();
            
            const groupData = {
                title: newGroupData.name,
                members: newGroupData.members,
                emoji: newGroupData.emoji,
                isGroup: true,
                createdAt: now,
                createdBy: currentUser.uid
            };
            
            const groupRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'groups'), groupData);
            const groupId = groupRef.id;

            const chatEntry = {
                id: groupId,
                title: groupData.title,
                emoji: groupData.emoji,
                isGroup: true,
                members: groupData.members, 
                preview: 'Group created',
                lastUpdated: now,
                unreadCount: 0 
            };

            const promises = groupData.members.map(memberId => {
                return setDoc(doc(db, 'artifacts', appId, 'users', memberId, 'chats', groupId), chatEntry);
            });
            
            await Promise.all(promises);
            
            openChat(chatEntry);

        } catch (e) { 
            console.error("Error creating group:", e); 
            btn.textContent = 'Error!'; 
            setTimeout(() => { btn.disabled = false; btn.textContent = 'Create Group'; }, 2000);
        }
    }
    
    async function handleSaveGroupChanges() {
        if (!newGroupData.id) return;
        
        const btn = document.getElementById('chat-btn-save-group');
        btn.disabled = true; btn.textContent = 'Saving...';
        
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'groups', newGroupData.id), {
                title: newGroupData.name,
                members: newGroupData.members,
                emoji: newGroupData.emoji
            });

            const removedUsers = originalGroupMembers.filter(uid => !newGroupData.members.includes(uid));
            const removalPromises = removedUsers.map(uid => {
                return deleteDoc(doc(db, 'artifacts', appId, 'users', uid, 'chats', newGroupData.id));
            });
            await Promise.all(removalPromises);

            const updateData = { 
                id: newGroupData.id,
                title: newGroupData.name, 
                emoji: newGroupData.emoji, 
                members: newGroupData.members,
                isGroup: true,
                lastUpdated: serverTimestamp() 
            };

            const updatePromises = newGroupData.members.map(memberId => {
                return setDoc(doc(db, 'artifacts', appId, 'users', memberId, 'chats', newGroupData.id), updateData, { merge: true });
            });
            
            await Promise.all(updatePromises);

            document.getElementById('chat-chat-room-name').textContent = newGroupData.name;
            const headerAvatarContainer = document.querySelector('.chat-header-avatar-container');
            if (headerAvatarContainer) {
                headerAvatarContainer.innerHTML = createAvatarHtml(newGroupData.name, null, true, newGroupData.emoji, '36px', '16px');
            }
            updateChatHeaderStatus();
            
            showView('room');

        } catch (e) { 
            console.error("Error saving group:", e); 
            btn.textContent = 'Error!'; 
            setTimeout(() => { btn.disabled = false; btn.textContent = 'Save Changes'; }, 2000);
        }
    }

    function renderContacts(users) {
        const container = document.getElementById('chat-contacts-list-container');
        container.innerHTML = '';
        if (users.length === 0) { container.innerHTML = '<div class="chat-loading-placeholder">No other users.</div>'; return; }
        users.forEach(user => {
            const el = document.createElement('article');
            el.className = 'chat-chat-item';
            const safeName = escapeHtml(user.displayName);
            const avatarHtml = createAvatarHtml(user.displayName, user.photoURL);
            el.innerHTML = `<div class="chat-avatar-container">${avatarHtml}</div><div class="chat-chat-body"><div class="chat-chat-row"><span class="chat-chat-title">${safeName}</span></div><div class="chat-chat-preview-row"><p class="chat-chat-preview">Click to message</p></div></div>`;
            el.addEventListener('click', () => openChat({ id: user.uid, title: user.displayName, avatar: user.photoURL, isGroup: false }));
            container.appendChild(el);
        });
    }

    document.getElementById('chat-contact-search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const displayUsers = allUsers.filter(u => u.uid !== currentUser.uid);
        renderContacts(displayUsers.filter(u => u.displayName.toLowerCase().includes(term)));
    });

    function openChat(chatData) {
        if (chatData.isGroup) {
            currentChatId = chatData.id;
            currentChatPeerId = null;
        } else {
            currentChatPeerId = chatData.id; 
            const participants = [currentUser.uid, currentChatPeerId].sort();
            currentChatId = participants.join('_');
        }
        
        isCurrentChatPinned = !!chatData.pinned;
        isCurrentChatMuted = !!chatData.muted;
        updateChatMenuUI();

        document.getElementById('chat-chat-room-name').textContent = chatData.title;
        const avatarEl = document.getElementById('chat-chat-room-avatar');
        const parent = avatarEl.parentElement;
        const existingContainer = parent.querySelector('.chat-header-avatar-container');
        if (existingContainer) existingContainer.remove();
        
        const newAvatarContainer = document.createElement('div');
        newAvatarContainer.className = 'chat-header-avatar-container';
        newAvatarContainer.innerHTML = createAvatarHtml(chatData.title, chatData.avatar, chatData.isGroup, chatData.emoji, '36px', '16px');
        parent.insertBefore(newAvatarContainer, document.getElementById('chat-chat-room-name').parentElement.parentElement);
        
        if (chatData.isGroup) { newAvatarContainer.addEventListener('click', () => openGroupInfo(chatData)); }
        
        avatarEl.style.display = 'none';
        updateChatHeaderStatus();
        showView('room');
        loadMessages();
        
        const myChatDocId = currentChatPeerId ? currentChatPeerId : currentChatId;
        setDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'chats', myChatDocId), { unreadCount: 0 }, { merge: true });
        
        if (!chatData.isGroup && currentChatPeerId) {
            updateDoc(doc(db, 'artifacts', appId, 'users', currentChatPeerId, 'chats', currentUser.uid), { status: 'read' }).catch(e => {
                // Peer deleted chat
            });
        }
    }

    function loadMessages() {
        const container = document.getElementById('chat-messages-list');
        container.innerHTML = '<div class="chat-loading-placeholder">Loading...</div>';
        const msgsRef = collection(db, 'artifacts', appId, 'public', 'data', 'conversations', currentChatId, 'messages');
        
        const myChatDocId = currentChatPeerId ? currentChatPeerId : currentChatId;
        const myChatData = allChatsData.find(c => c.id === myChatDocId);
        
        let queryConstraint;

        if (!myChatData) {
             queryConstraint = query(msgsRef, where('createdAt', '>', Timestamp.now()), orderBy('createdAt', 'asc'));
        } 
        else if (myChatData.hiddenBefore) {
            queryConstraint = query(msgsRef, where('createdAt', '>=', myChatData.hiddenBefore), orderBy('createdAt', 'asc'));
        } 
        else {
            queryConstraint = query(msgsRef, orderBy('createdAt', 'asc'));
        }

        if (messagesUnsubscribe) messagesUnsubscribe();
        
        try {
            messagesUnsubscribe = onSnapshot(queryConstraint, (snapshot) => {
                container.innerHTML = '';
                if (snapshot.empty) {
                     // Empty
                }
                snapshot.forEach(doc => renderMessage(doc.data()));
                container.scrollTop = container.scrollHeight;
            }, (error) => {
                console.error("History load error:", error);
                container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger)">History check failed (missing index). New messages will appear.</div>';
            });
        } catch (e) {
            console.error("Query setup error:", e);
        }
    }

    function renderMessage(msg) {
        const container = document.getElementById('chat-messages-list');
        const isMe = msg.senderId === currentUser.uid;
        const div = document.createElement('div');
        div.className = `chat-message-bubble ${isMe ? 'chat-sent' : 'chat-received'}`;
        let timeStr = '';
        if (msg.createdAt) {
            const d = msg.createdAt.toDate();
            timeStr = `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
        }
        let senderNameHtml = '';
        if (!isMe && currentChatPeerId === null) {
             const sender = allUsers.find(u => u.uid === msg.senderId);
             const nameToDisplay = sender ? sender.displayName.split(' ')[0] : 'Unknown';
             senderNameHtml = `<span class="chat-sender-name">${escapeHtml(nameToDisplay)}</span>`;
        }
        div.innerHTML = `${senderNameHtml}${escapeHtml(msg.text)}<span class="chat-msg-time">${timeStr}</span>`;
        container.appendChild(div);
    }

    const btnSend = document.getElementById('chat-btn-send');
    const msgInput = document.getElementById('chat-msg-input');

    async function sendMessage() {
        const text = msgInput.value.trim();
        if (!text) return;

        msgInput.value = '';
        btnSend.disabled = true;
        
        const now = Timestamp.now();

        try {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'conversations', currentChatId, 'messages'), {
                text: text, senderId: currentUser.uid, createdAt: now
            });

            let previewText = "You: " + text;
            
            const myChatDocId = currentChatPeerId ? currentChatPeerId : currentChatId;
            const myChatRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'chats', myChatDocId);
            
            const myChatSnap = await getDoc(myChatRef);
            
            let myChatUpdateData = {
                id: myChatDocId,
                preview: previewText,
                lastUpdated: now, 
                unreadCount: 0,
                isGroup: !!(!currentChatPeerId),
                title: document.getElementById('chat-chat-room-name').textContent,
                pinned: isCurrentChatPinned,
                muted: isCurrentChatMuted // Preserve muted status
            };

            if (myChatSnap.exists()) {
                const existingData = myChatSnap.data();
                if (existingData.hiddenBefore) {
                    myChatUpdateData.hiddenBefore = existingData.hiddenBefore;
                }
                if (existingData.muted !== undefined) {
                    myChatUpdateData.muted = existingData.muted;
                }
            } else {
                myChatUpdateData.hiddenBefore = now;
            }

            await setDoc(myChatRef, myChatUpdateData, { merge: true });

            if (currentChatPeerId) {
                const peerChatRef = doc(db, 'artifacts', appId, 'users', currentChatPeerId, 'chats', currentUser.uid);
                const peerChatSnap = await getDoc(peerChatRef);

                if (peerChatSnap.exists()) {
                    await updateDoc(peerChatRef, {
                        preview: text,
                        lastUpdated: now,
                        unreadCount: increment(1)
                    });
                } else {
                    await setDoc(peerChatRef, {
                        id: currentUser.uid, 
                        title: currentUser.displayName || 'User',
                        avatar: currentUser.photoURL || '',
                        isGroup: false,
                        preview: text,
                        lastUpdated: now,
                        unreadCount: 1,
                        hiddenBefore: now 
                    });
                }
            } else {
                const myName = (currentUser.displayName || 'User').split(' ')[0];
                const groupPreviewText = `${myName}: ${text}`;
                
                let membersToNotify = [];
                const currentGroupChat = allChatsData.find(c => c.id === currentChatId);
                if (currentGroupChat && currentGroupChat.members) membersToNotify = currentGroupChat.members;
                else if (newGroupData && newGroupData.id === currentChatId) membersToNotify = newGroupData.members;
                
                if (membersToNotify.length === 0) {
                    const gSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'groups', currentChatId));
                    if(gSnap.exists()) membersToNotify = gSnap.data().members || [];
                }

                const peerPromises = membersToNotify
                    .filter(uid => uid !== currentUser.uid)
                    .map(peerId => {
                        return setDoc(doc(db, 'artifacts', appId, 'users', peerId, 'chats', currentChatId), {
                            preview: groupPreviewText,
                            unreadCount: increment(1),
                            lastUpdated: now,
                            isGroup: true
                        }, { merge: true });
                    });
                 await Promise.all(peerPromises);
            }
        } catch (e) { 
            console.error("Send error:", e); 
            alert("Error sending message.");
        } finally { btnSend.disabled = false; msgInput.focus(); }
    }

    btnSend.addEventListener('click', sendMessage);
    msgInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });
    msgInput.addEventListener('input', (e) => { btnSend.disabled = e.target.value.trim() === ''; });