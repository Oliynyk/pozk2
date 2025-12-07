// ==========================================
// FONT-SIZE.JS - Font Size Manager
// ==========================================

/**
 * Font Size Settings Manager
 */
class FontSizeManager {
    constructor() {
        this.storageKey = 'fontSize';
        this.sliderId = 'font-size-slider';
        this.minSize = 14; // px
        this.maxSize = 20; // px
        this.defaultSize = 16; // px
    }

    /**
     * Initialize font size settings
     */
    init() {
        const slider = document.getElementById(this.sliderId);
        if (!slider) {
            console.warn('Font size slider not found');
            return;
        }

        // Set slider range
        slider.min = this.minSize;
        slider.max = this.maxSize;

        // Load saved size or default
        const savedSize = this.getSize();
        slider.value = savedSize;
        this.applySize(savedSize);

        // Setup change handler
        slider.addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            this.setSize(size);
            this.applySize(size);
        });

        // Show toast on change complete
        slider.addEventListener('change', (e) => {
            const size = parseInt(e.target.value);
            if (window.showToast) {
                window.showToast(`Розмір шрифту: ${size}px`);
            }
        });

        console.log('Font size manager initialized. Size:', savedSize);
    }

    /**
     * Get current font size
     */
    getSize() {
        const saved = localStorage.getItem(this.storageKey);
        return saved ? parseInt(saved) : this.defaultSize;
    }

    /**
     * Set font size
     */
    setSize(size) {
        localStorage.setItem(this.storageKey, size.toString());
    }

    /**
     * Apply font size to document
     */
    applySize(size) {
        // Set CSS variable for global font size
        document.documentElement.style.setProperty('--base-font-size', `${size}px`);
    }

    /**
     * Reset to default
     */
    reset() {
        this.setSize(this.defaultSize);
        this.applySize(this.defaultSize);

        const slider = document.getElementById(this.sliderId);
        if (slider) {
            slider.value = this.defaultSize;
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const fontSizeManager = new FontSizeManager();
    fontSizeManager.init();

    // Make globally available for reset function
    window.fontSizeManager = fontSizeManager;
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FontSizeManager };
}
