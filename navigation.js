// ==========================================
// NAVIGATION.JS - Unified Navigation System
// ==========================================

// 1. КОНФІГУРАЦІЯ
const BTN_STYLES = {
    DEFAULT: "text-white bg-black/40",
    THEMED: "themed-btn"
};

const THEMED_BUTTON_IDS = ['city-search-overlay', 'calendar-btn', 'clock-btn'];

// Navigation history stack
let viewHistory = ['dashboard-view'];
const MAX_HISTORY = 20;

const NAV_CONFIG = {
    'dashboard-view': { left: null, right: null, centerHtml: null },
    'app-container': { left: null, right: null },

    'search-view': {
        left: { icon: 'arrow_back_ios_new', action: () => window.goBack(), style: BTN_STYLES.DEFAULT, id: 'menu-back-btn' },
        right: null
    },

    'weather-view': {
        left: { icon: 'arrow_back_ios_new', action: () => window.goBack(), style: BTN_STYLES.DEFAULT, id: 'global-back-btn' },
        right: {
            icon: 'edit_location_alt',
            action: () => { if (window.openSearchModal) window.openSearchModal(); },
            style: BTN_STYLES.THEMED,
            id: 'city-search-overlay'
        }
    },

    'notifications-view': {
        left: { icon: 'arrow_back_ios_new', action: () => window.goBack(), style: BTN_STYLES.DEFAULT, id: 'global-back-btn' },
        right: {
            icon: 'schedule',
            action: () => { if (window.createAndShowAllPairsModal) window.createAndShowAllPairsModal(); },
            style: BTN_STYLES.THEMED,
            id: 'clock-btn'
        }
    },

    'individual-chat-view': {
        left: { icon: 'arrow_back_ios_new', action: () => window.closeIndividualChat(), style: BTN_STYLES.DEFAULT },
        right: {
            icon: 'more_vert',
            action: () => { console.log('Chat menu - coming soon'); },
            style: BTN_STYLES.DEFAULT
        },
        centerHtml: `
            <div id="chat-header-info" class="h-12 gap-2 px-1 py-1 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center cursor-pointer">
                <div class="relative">
                    <img id="chat-header-avatar" src="" class="w-9 h-9 rounded-full object-cover bg-gray-700 hidden">
                    <div id="chat-header-initials" class="w-9 h-9 rounded-full bg-gradient-to-br from-brand-cyan to-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-brand-cyan/20">
                    </div>
                </div>
                <div class="flex flex-col pr-2.5 gap-0.5">
                    <h3 id="chat-header-name" class="text-sm font-bold text-white leading-tight"></h3>
                    <span id="chat-header-status" class="text-[10px] text-brand-cyan/80 font-medium">Онлайн</span>
                </div>
            </div>
        `
    },

    'schedule-view': {
        left: { icon: 'arrow_back_ios_new', action: () => window.goBack(), style: BTN_STYLES.DEFAULT, id: 'global-back-btn' },
        right: {
            icon: 'calendar_month',
            action: () => window.goCalendar(),
            style: BTN_STYLES.THEMED,
            id: 'calendar-btn'
        }
    },

    'chat': {
        left: { icon: 'arrow_back_ios_new', action: () => window.goBack(), style: BTN_STYLES.DEFAULT },
        right: { icon: 'more_vert', action: () => toggleChatMenu(), style: BTN_STYLES.DEFAULT },
        // Залишаємо mx-2, щоб вкладки мали відступ від країв
        centerHtml: `
            <div id="chat-tabs-wrapper" class="w-full h-12 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center p-1 overflow-x-auto no-scrollbar shadow-lg transition-all duration-300 mx-2">
                <div id="chat-folder-tabs" class="flex items-center gap-1 w-full">
                    <button class="folder-tab active flex-1 min-w-max px-4 py-2 rounded-full bg-white/10 text-white text-[13px] font-semibold shadow-sm whitespace-nowrap active:scale-95 transition-all" data-folder="all">Всі чати</button>
                    <!-- Dynamic folder tabs injected by chat-folders.js -->
                </div>
            </div>
        `
    },

    'users-view': {
        left: { icon: 'arrow_back_ios_new', action: () => window.openView('chat'), style: BTN_STYLES.DEFAULT },
        right: {
            icon: 'tune',
            action: () => window.toggleUsersSortMenu(),
            style: BTN_STYLES.DEFAULT
        },
        centerHtml: `
            <div class="w-full h-12 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center px-4 shadow-lg transition-all duration-300 mx-2">
                <i class="material-icons text-white/50 text-xl mr-2">search</i>
                <input 
                    type="text" 
                    id="users-search-input" 
                    placeholder="Пошук користувачів..." 
                    class="flex-1 bg-transparent text-white text-sm placeholder-white/40 outline-none"
                    autocomplete="off"
                />
            </div>
        `
    },

    'default': {
        left: { icon: 'arrow_back_ios_new', action: () => window.goBack(), style: BTN_STYLES.DEFAULT, id: 'global-back-btn' },
        right: null
    }
};

const SHOW_BOTTOM_NAV_ON = ['notifications-view', 'schedule-view', 'search-view'];


// View levels: 0 = root, 1 = main screens, 2 = nested screens
const VIEW_LEVELS = {
    'dashboard-view': 0,
    // Level 1 - Main screens (accessible from dashboard/bottom nav)
    'weather-view': 1,
    'schedule-view': 1,
    'notifications-view': 1,
    'chat': 1,
    'menu-view': 1,
    'news-view': 1,
    // Level 2 - Nested screens
    'folders-view': 2,
    'folder-edit-view': 2,
    'folder-add-chats-view': 2,
    'search-view': 2
};

function getViewLevel(viewId) {
    return VIEW_LEVELS[viewId] ?? 1; // Default to level 1
}

// 2. ГОЛОВНА ФУНКЦІЯ
window.openView = function (viewId, addToHistory = true) {
    document.querySelectorAll('.app-view').forEach(el => el.classList.remove('active-view'));
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active-view');
        window.scrollTo(0, 0);
    }

    // Smart history tracking
    if (addToHistory && viewHistory[viewHistory.length - 1] !== viewId) {
        const currentLevel = getViewLevel(viewHistory[viewHistory.length - 1]);
        const newLevel = getViewLevel(viewId);

        if (newLevel > currentLevel) {
            // Going deeper - add to history
            viewHistory.push(viewId);
        } else if (newLevel === currentLevel && newLevel > 0) {
            // Same level (not dashboard) - replace last entry
            viewHistory[viewHistory.length - 1] = viewId;
        } else if (newLevel < currentLevel) {
            // Going up - add to history (but goBack handles this)
            viewHistory.push(viewId);
        } else {
            // Dashboard or other - add normally
            viewHistory.push(viewId);
        }

        if (viewHistory.length > MAX_HISTORY) viewHistory.shift();
    }

    updateTopNav(viewId);
    updateBottomNav(viewId);
    updateFabVisibility(viewId);
};

// Go back to previous view
window.goBack = function () {
    if (viewHistory.length > 1) {
        viewHistory.pop(); // Remove current
        const previousView = viewHistory[viewHistory.length - 1];
        window.openView(previousView, false); // Don't add to history
    } else {
        window.goHome();
    }
};


// 3. ЛОГІКА ВЕРХНЬОГО МЕНЮ
function updateTopNav(viewId) {
    const leftBtn = document.getElementById('nav-left-btn');
    const rightBtn = document.getElementById('nav-right-btn');
    const centerArea = document.getElementById('nav-center-area');

    const config = NAV_CONFIG[viewId] || NAV_CONFIG['default'];

    configureButton(leftBtn, config.left);
    configureButton(rightBtn, config.right);
    resetScrollStyles(leftBtn, rightBtn);

    if (centerArea) {
        if (config.centerHtml) {
            centerArea.innerHTML = config.centerHtml;
            centerArea.className = "flex-1 flex justify-center pointer-events-auto transition-all duration-300 min-w-0 opacity-100 scale-100";
        } else {
            centerArea.className = "flex-1 flex justify-center pointer-events-auto transition-all duration-300 min-w-0 opacity-0 scale-95";
            setTimeout(() => {
                const currentConfig = NAV_CONFIG[viewId] || NAV_CONFIG['default'];
                if (!currentConfig.centerHtml) centerArea.innerHTML = '';
            }, 300);
        }
    }
}

function configureButton(btnElement, btnConfig) {
    if (!btnElement) return;
    if (!btnConfig) {
        btnElement.classList.add('hidden');
        btnElement.classList.remove('flex');
        return;
    }

    btnElement.classList.remove('hidden');
    btnElement.classList.add('flex');
    const iconSpan = btnElement.querySelector('span');
    if (iconSpan) iconSpan.textContent = btnConfig.icon;
    btnElement.onclick = btnConfig.action;

    const baseClass = "pointer-events-auto w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center active:scale-95 transition-all duration-300 backdrop-blur-sm border border-white/10 shadow-lg overflow-hidden whitespace-nowrap z-20";
    const isThemed = THEMED_BUTTON_IDS.includes(btnConfig.id) || btnConfig.style === BTN_STYLES.THEMED;

    if (isThemed) {
        // Use unified getThemeColor() from utils.js
        const themeColor = (typeof getThemeColor === 'function') ? getThemeColor() : '#0ea5e9';
        const bg = (typeof hexToRgba === 'function') ? hexToRgba(themeColor, 0.2) : themeColor;
        btnElement.className = baseClass;
        btnElement.style.backgroundColor = bg;
        btnElement.style.color = themeColor;
        btnElement.style.borderColor = "rgba(255,255,255,0.1)";
    } else {
        btnElement.className = `${baseClass} ${btnConfig.style}`;
        btnElement.style.backgroundColor = "";
        btnElement.style.color = "";
    }
    if (btnConfig.id) btnElement.setAttribute('data-pseudo-id', btnConfig.id);
}

function resetScrollStyles(leftBtn, rightBtn) {
    // Просто скидаємо стилі кнопок, не чіпаючи вкладки
    if (leftBtn) { leftBtn.style.marginLeft = ''; leftBtn.style.opacity = ''; leftBtn.style.pointerEvents = ''; }
    if (rightBtn) { rightBtn.style.marginRight = ''; rightBtn.style.opacity = ''; rightBtn.style.pointerEvents = ''; }

    // Скидаємо стилі для кнопки FAB
    const fabBtn = document.getElementById('chat-fab-btn');
    if (fabBtn) { fabBtn.style.transform = 'translateY(0)'; fabBtn.style.opacity = '1'; }
}


// 4. НИЖНЄ МЕНЮ & FAB
function updateBottomNav(viewId) {
    const bottomNav = document.getElementById('global-nav');
    if (!bottomNav) return;

    if (SHOW_BOTTOM_NAV_ON.includes(viewId)) {
        bottomNav.style.display = 'flex';
        bottomNav.querySelectorAll('.nav-btn').forEach(btn => {
            const isActive = btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(viewId);
            btn.className = `nav-btn w-12 h-12 rounded-full flex items-center justify-center transition active:scale-95 outline-none ${isActive ? 'text-white bg-white/10' : 'text-white/50 hover:text-white hover:bg-white/10'}`;
        });
    } else {
        bottomNav.style.display = 'none';
    }
}

// ВИПРАВЛЕНО: Керування видимістю через клас hidden
function updateFabVisibility(viewId) {
    const fabBtn = document.getElementById('chat-fab-btn');
    if (!fabBtn) return;

    if (viewId === 'chat') {
        fabBtn.classList.remove('hidden'); // Показуємо
        fabBtn.style.display = 'flex';     // На випадок конфлікту стилів
        fabBtn.style.transform = 'translateY(0)';
        fabBtn.style.opacity = '1';
    } else {
        fabBtn.classList.add('hidden');    // Ховаємо
        fabBtn.style.display = 'none';
    }
}


// 5. HELPER ФУНКЦІЇ
if (!window.goHome) window.goHome = function () { window.openView('dashboard-view'); };

window.toggleChatMenu = function () {
    const modal = document.getElementById('chat-top-menu-modal');
    modal.classList.toggle('hidden');
};

window.toggleFabMenu = function () {
    const modal = document.getElementById('chat-fab-menu-modal');
    const btn = document.getElementById('chat-fab-btn');
    const icon = document.getElementById('fab-icon');
    const isOpening = modal.classList.contains('hidden');

    if (isOpening) {
        modal.classList.remove('hidden');
        icon.classList.remove('fa-pen');
        icon.classList.add('fa-xmark', 'rotate-90');
        btn.style.backgroundColor = '#ffffff';
        btn.style.boxShadow = '0 0 20px rgba(255,255,255,0.3)';
    } else {
        modal.classList.add('hidden');
        icon.classList.remove('fa-xmark', 'rotate-90');
        icon.classList.add('fa-pen');
        btn.style.backgroundColor = '';
        btn.style.boxShadow = '';
    }
};

// ==========================================
// UNIVERSAL SCROLL LOGIC
// ==========================================
function initUniversalScroll() {
    let lastScrollTop = 0;
    const leftBtn = document.getElementById('nav-left-btn');
    const rightBtn = document.getElementById('nav-right-btn');
    const fabBtn = document.getElementById('chat-fab-btn');

    const handleScroll = (e) => {
        const target = e.target === document ? document.documentElement : e.target;
        const currentScroll = target.scrollTop || window.scrollY;
        const isScrollingDown = currentScroll > lastScrollTop;

        if (Math.abs(currentScroll - lastScrollTop) < 5) return;

        // --- 1. ВЕРХНЄ МЕНЮ ---
        if (currentScroll > 50) {
            // Ховаємо кнопки (розїжджаються в боки)
            if (leftBtn) {
                leftBtn.style.marginLeft = '-60px';
                leftBtn.style.opacity = '0';
                leftBtn.style.pointerEvents = 'none';
            }
            if (rightBtn) {
                rightBtn.style.marginRight = '-60px';
                rightBtn.style.opacity = '0';
                rightBtn.style.pointerEvents = 'none';
            }

            // ПРИБРАНО: Логіку, яка розтягувала вкладки (classList.remove('mx-2')...)
            // Тепер вкладки просто залишаються як є, але оскільки кнопки зникли (margin -60px),
            // flex-контейнер автоматично надасть вкладкам більше місця, не ламаючи верстку.

        } else {
            // Повертаємо кнопки
            if (leftBtn) {
                leftBtn.style.marginLeft = '0px';
                leftBtn.style.opacity = '1';
                leftBtn.style.pointerEvents = 'auto';
            }
            if (rightBtn) {
                rightBtn.style.marginRight = '0px';
                rightBtn.style.opacity = '1';
                rightBtn.style.pointerEvents = 'auto';
            }
        }

        // --- 2. FAB (Тільки якщо він не hidden) ---
        if (fabBtn && !fabBtn.classList.contains('hidden')) {
            const isMenuOpen = !document.getElementById('chat-fab-menu-modal').classList.contains('hidden');

            // Ховаємо, якщо скрол вниз > 100px і меню не відкрите
            if (!isMenuOpen && isScrollingDown && currentScroll > 100) {
                fabBtn.style.transform = 'translateY(200%) scale(0.8)';
                fabBtn.style.opacity = '0';
            } else {
                fabBtn.style.transform = 'translateY(0) scale(1)';
                fabBtn.style.opacity = '1';
            }
        }

        lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
    };

    window.addEventListener('scroll', handleScroll, true);
}

document.addEventListener('DOMContentLoaded', initUniversalScroll);

// Ініціалізація при старті (про всяк випадок перевіряємо, де ми)
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initUniversalScroll();
    // При першому завантаженні кнопки повинні бути приховані, якщо це не чат
    // Але оскільки ми додали class="hidden" в HTML, це відбудеться автоматично.
}

// ==========================================
// REACTIVE THEME UPDATE FOR NAVIGATION
// ==========================================
window.addEventListener('themeChanged', (e) => {
    const newColor = e.detail && e.detail.themeColor ? e.detail.themeColor : '#0ea5e9';

    // Update all themed buttons
    THEMED_BUTTON_IDS.forEach(btnId => {
        const btn = document.querySelector(`[data-pseudo-id="${btnId}"]`);
        if (btn && typeof hexToRgba === 'function') {
            btn.style.backgroundColor = hexToRgba(newColor, 0.2);
            btn.style.color = newColor;
        }
    });
});