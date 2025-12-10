// ==========================================
// ACCENT-COLOR.JS - Accent Color Manager
// ==========================================

/**
 * Accent Color Manager
 * Handles theme color selection and application
 */
class AccentColorManager {
    constructor() {
        this.storageKey = 'themeColor';
        this.defaultColor = '#0ea5e9'; // Default blue
    }

    /**
     * Initialize accent color settings
     */
    init() {
        // Load saved color
        const savedColor = this.getColor();

        // Apply to UI
        this.applyColor(savedColor);

        // Mark active option
        this.updateActiveOption(savedColor);

        console.log('Accent color initialized:', savedColor);
    }

    /**
     * Get current theme color (uses unified getThemeColor from utils.js)
     */
    getColor() {
        // Use utils.js getThemeColor for consistency
        return typeof getThemeColor === 'function' ? getThemeColor() : this.defaultColor;
    }

    /**
     * Set and save theme color
     */
    setColor(color, skipEvent = false) {
        // Single source of truth - only save to themeColor key
        localStorage.setItem('themeColor', color);

        // Dispatch event for other components (if not skipped to prevent loops)
        if (!skipEvent) {
            window.dispatchEvent(new CustomEvent('themeChanged', {
                detail: { themeColor: color, source: 'accent-color' }
            }));
        }
    }

    /**
     * Apply color to UI elements
     */
    applyColor(color) {
        // Set CSS custom properties for easy use
        document.documentElement.style.setProperty('--accent-color', color);
        document.documentElement.style.setProperty('--accent-color-rgb', this.hexToRgb(color));

        // Apply to specific elements
        this.applyToElements(color);
    }

    /**
     * Apply color to specific UI elements
     */
    applyToElements(color) {
        const rgbaLight = this.hexToRgba(color, 0.15);
        const rgbaMedium = this.hexToRgba(color, 0.3);
        const rgbaStrong = this.hexToRgba(color, 0.5);

        // 1. Brand-colored elements (text with brand-cyan class)
        document.querySelectorAll('.text-brand-cyan').forEach(el => {
            el.style.color = color;
        });

        // 2. Timeline progress bar
        const timelineProgress = document.querySelector('.timeline-progress');
        if (timelineProgress) {
            timelineProgress.style.background = `linear-gradient(90deg, ${color}, ${this.hexToRgba(color, 0.7)})`;
            timelineProgress.style.boxShadow = `0 0 15px ${rgbaMedium}`;
        }

        // 3. Active status dot
        const activeDot = document.getElementById('active-dot');
        if (activeDot) {
            activeDot.style.backgroundColor = color;
        }

        // 4. Status label
        const statusLabel = document.getElementById('active-status-label');
        if (statusLabel) {
            statusLabel.style.color = color;
        }

        // 5. Weather widget elements
        document.querySelectorAll('.hourly-card.active').forEach(el => {
            el.style.backgroundColor = rgbaLight;
            el.style.borderColor = rgbaMedium;
        });

        // 6. Active tabs
        document.querySelectorAll('.daily-tab-compact.active').forEach(el => {
            el.style.backgroundColor = rgbaLight;
            el.style.borderColor = rgbaMedium;
            el.style.color = color;
        });

        // 7. Save button gradient (if search.js is present)
        if (typeof updateThemeColors === 'function') {
            updateThemeColors(color);
        }

        // 8. Brand cyan icons
        document.querySelectorAll('[class*="bg-brand-cyan"]').forEach(el => {
            el.style.backgroundColor = color;
        });

        // 9. Gradient text
        document.querySelectorAll('.text-gradient-brand').forEach(el => {
            el.style.background = `linear-gradient(90deg, ${color}, #7f00ff)`;
            el.style.webkitBackgroundClip = 'text';
            el.style.webkitTextFillColor = 'transparent';
        });

        // 10. Dashboard card glows
        const weatherGlow = document.getElementById('weather-card-glow');
        if (weatherGlow) {
            weatherGlow.style.backgroundColor = this.hexToRgba(color, 0.1);
        }

        // 11. Schedule card glow
        const scheduleGlow = document.getElementById('dash-bg-glow');
        if (scheduleGlow) {
            scheduleGlow.style.backgroundColor = this.hexToRgba(color, 0.1);
        }

        // 12. Schedule status elements
        const statusDot = document.getElementById('dash-status-dot');
        const statusPing = document.getElementById('dash-status-ping');
        const statusText = document.getElementById('dash-status-text');

        if (statusDot) statusDot.style.backgroundColor = color;
        if (statusPing) statusPing.style.backgroundColor = color;
        if (statusText) statusText.style.color = color;
    }

    /**
     * Update active option in color picker
     */
    updateActiveOption(color) {
        const container = document.getElementById('accent-color-options');
        if (!container) return;

        // Remove active from all
        container.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('active');
            opt.innerHTML = '';
        });

        // Find and mark matching color
        const matchingOption = container.querySelector(`[data-color="${color}"]`);
        if (matchingOption) {
            matchingOption.classList.add('active');
            matchingOption.innerHTML = '<i data-lucide="check" class="text-white/90" width="16"></i>';

            // Reinit Lucide icon ONLY within this specific element (not entire page)
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons({
                    icons: { check: lucide.icons.check },
                    attrs: {},
                    nameAttr: 'data-lucide'
                });
            }
        }
    }

    /**
     * Convert HEX to RGB string
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
        }
        return '0, 242, 234'; // Default cyan
    }

    /**
     * Convert HEX to RGBA string
     */
    hexToRgba(hex, alpha = 1) {
        const rgb = this.hexToRgb(hex);
        return `rgba(${rgb}, ${alpha})`;
    }
}

// Create global instance
const accentColorManager = new AccentColorManager();

// Global function for onclick handlers
window.selectAccentColor = function (element) {
    const color = element.getAttribute('data-color');
    if (!color) return;

    // Save and apply
    accentColorManager.setColor(color);
    accentColorManager.applyColor(color);
    accentColorManager.updateActiveOption(color);

    // Show toast
    if (window.showToast) {
        window.showToast(`Колір акценту змінено`);
    }

    console.log('Accent color changed to:', color);
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    accentColorManager.init();

    // Make globally available
    window.accentColorManager = accentColorManager;
});

// Listen for theme changes from other components (like search.js)
window.addEventListener('themeChanged', (e) => {
    // Ignore events from this module to prevent loops
    if (e.detail && e.detail.source === 'accent-color') return;

    if (e.detail && e.detail.themeColor) {
        const color = e.detail.themeColor;
        // Save color but skip re-dispatching event
        accentColorManager.setColor(color, true);
        accentColorManager.applyColor(color);
        accentColorManager.updateActiveOption(color);
    }
});
