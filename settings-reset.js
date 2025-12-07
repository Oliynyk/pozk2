// ==========================================
// SETTINGS-RESET.JS - Reset Appearance Settings
// ==========================================

/**
 * Reset all appearance settings to defaults
 */
window.resetAppearanceSettings = function () {
    try {
        // 1. Reset animations to enabled
        localStorage.setItem('animationsEnabled', 'true');
        if (window.animationSettingsManager) {
            window.animationSettingsManager.setEnabled(true);
            window.animationSettingsManager.applyState(true);
        }

        // 2. Reset font size to default (16px)
        if (window.fontSizeManager) {
            window.fontSizeManager.reset();
        }

        // 3. Reset theme color to faculty color
        // Get faculty color from scheduleSettings
        let facultyColor = '#0ea5e9'; // Default blue
        try {
            const settings = JSON.parse(localStorage.getItem('scheduleSettings') || '{}');
            if (settings.faculty && typeof FACULTY_CONFIG !== 'undefined') {
                const faculty = FACULTY_CONFIG.find(f => f.key === settings.faculty);
                if (faculty && faculty.color) {
                    facultyColor = faculty.color;
                }
            }
        } catch (e) {
            console.warn('Could not get faculty color:', e);
        }

        // Set theme color
        localStorage.setItem('themeColor', facultyColor);

        // Update accent color manager if available
        if (window.accentColorManager) {
            window.accentColorManager.setColor(facultyColor, false);
            window.accentColorManager.applyColor(facultyColor);
            window.accentColorManager.updateActiveOption(facultyColor);
        }

        // Close modal
        if (window.closeModal) {
            window.closeModal('reset-ui');
        }

        // Show success toast
        if (window.showToast) {
            window.showToast('Налаштування скинуто ✨');
        }

        console.log('Appearance settings reset to defaults');
    } catch (e) {
        console.error('Error resetting appearance settings:', e);
        if (window.showToast) {
            window.showToast('Помилка скидання налаштувань', 'error');
        }
    }
};

/**
 * Modal helper functions
 */
window.openModal = function (modalId) {
    const modal = document.getElementById(`${modalId}-modal`);
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
};

window.closeModal = function (modalId) {
    const modal = document.getElementById(`${modalId}-modal`);
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    }
};

// ==========================================
// STORAGE MANAGEMENT
// ==========================================

/**
 * Calculate localStorage usage in bytes
 */
function getStorageUsage() {
    let total = 0;
    const details = {};

    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            const size = (localStorage[key].length + key.length) * 2; // UTF-16
            total += size;
            details[key] = size;
        }
    }

    return { total, details };
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Storage key categories for user-friendly display
 */
const STORAGE_CATEGORIES = {
    'Налаштування': {
        icon: 'fa-gear',
        color: 'blue',
        keys: ['themeColor', 'animationsEnabled', 'fontSize', 'scheduleSettings']
    },
    'Розклад': {
        icon: 'fa-calendar',
        color: 'purple',
        keys: ['scheduleDataState']
    },
    'Погода': {
        icon: 'fa-cloud-sun',
        color: 'cyan',
        keys: ['savedCities', 'weatherCache']
    },
    'Новини': {
        icon: 'fa-newspaper',
        color: 'orange',
        keys: ['meridian_last_seen_id']
    },
    'Безпека': {
        icon: 'fa-fingerprint',
        color: 'green',
        keys: ['webauthn_credentials']
    }
};

/**
 * Update storage display in settings
 */
window.updateStorageDisplay = function () {
    const { total, details } = getStorageUsage();
    const formattedSize = formatBytes(total);

    // Update all storage size displays
    document.querySelectorAll('.storage-size-display').forEach(el => {
        el.textContent = formattedSize;
    });

    // Update storage details in modal if it exists
    const detailsContainer = document.getElementById('storage-details');
    if (detailsContainer) {
        let html = '';
        let categorizedTotal = 0;

        // Group by categories
        for (const [categoryName, category] of Object.entries(STORAGE_CATEGORIES)) {
            let categorySize = 0;
            const matchedKeys = [];

            for (const key of category.keys) {
                if (details[key]) {
                    categorySize += details[key];
                    matchedKeys.push(key);
                }
            }

            if (categorySize > 0) {
                categorizedTotal += categorySize;
                const percent = Math.round((categorySize / total) * 100);

                html += `
                    <div class="bg-white/5 rounded-xl p-3 mb-2">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2">
                                <div class="w-8 h-8 rounded-lg bg-${category.color}-500/20 flex items-center justify-center">
                                    <i class="fa-solid ${category.icon} text-${category.color}-400 text-sm"></i>
                                </div>
                                <span class="text-white font-medium">${categoryName}</span>
                            </div>
                            <span class="text-gray-400 text-sm">${formatBytes(categorySize)}</span>
                        </div>
                        <div class="w-full bg-white/5 rounded-full h-1.5">
                            <div class="bg-${category.color}-500/50 h-1.5 rounded-full" style="width: ${percent}%"></div>
                        </div>
                    </div>
                `;
            }
        }

        // Add "Other" category for uncategorized keys
        const otherSize = total - categorizedTotal;
        if (otherSize > 0) {
            const percent = Math.round((otherSize / total) * 100);
            html += `
                <div class="bg-white/5 rounded-xl p-3 mb-2">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-lg bg-slate-500/20 flex items-center justify-center">
                                <i class="fa-solid fa-ellipsis text-slate-400 text-sm"></i>
                            </div>
                            <span class="text-white font-medium">Інше</span>
                        </div>
                        <span class="text-gray-400 text-sm">${formatBytes(otherSize)}</span>
                    </div>
                    <div class="w-full bg-white/5 rounded-full h-1.5">
                        <div class="bg-slate-500/50 h-1.5 rounded-full" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        }

        detailsContainer.innerHTML = html;
    }

    return { total, formatted: formattedSize, details };
};

/**
 * Clear all app cache/data
 */
window.clearAppCache = function () {
    try {
        // Store important keys to preserve
        const themeColor = localStorage.getItem('themeColor');
        const scheduleSettings = localStorage.getItem('scheduleSettings');

        // Clear all localStorage
        localStorage.clear();

        // Restore essential settings
        if (themeColor) localStorage.setItem('themeColor', themeColor);
        if (scheduleSettings) localStorage.setItem('scheduleSettings', scheduleSettings);

        // Update display
        updateStorageDisplay();

        // Show toast
        if (window.showToast) {
            window.showToast('Кеш очищено! ✨');
        }

        console.log('App cache cleared');
    } catch (e) {
        console.error('Error clearing cache:', e);
        if (window.showToast) {
            window.showToast('Помилка очищення кешу', 'error');
        }
    }
};

// Initialize storage display on load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(updateStorageDisplay, 500);
});
