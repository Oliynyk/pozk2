// ==========================================
// ANIMATIONS.JS - Animation Toggle Manager
// ==========================================

/**
 * Animation Settings Manager
 */
class AnimationSettingsManager {
    constructor() {
        this.storageKey = 'animationsEnabled';
        this.toggleId = 'animations-toggle';

        // Migrate old key if exists
        const oldValue = localStorage.getItem('animations_enabled');
        if (oldValue !== null) {
            localStorage.setItem(this.storageKey, oldValue);
            localStorage.removeItem('animations_enabled');
        }
    }

    /**
     * Initialize animation settings
     */
    init() {
        const toggle = document.getElementById(this.toggleId);
        if (!toggle) {
            console.warn('Animations toggle not found');
            return;
        }

        // Load saved state
        const enabled = this.isEnabled();
        toggle.checked = enabled;
        this.applyState(enabled);

        // Setup toggle handler
        toggle.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            this.setEnabled(isEnabled);
            this.applyState(isEnabled);

            // Show toast
            if (window.showToast) {
                window.showToast(
                    isEnabled ? 'Анімації увімкнено ✨' : 'Анімації вимкнено'
                );
            }
        });

        console.log('Animation settings initialized. Enabled:', enabled);
    }

    /**
     * Check if animations are enabled
     */
    isEnabled() {
        const stored = localStorage.getItem(this.storageKey);
        // Default to true (animations enabled)
        return stored === null ? true : stored === 'true';
    }

    /**
     * Set animation state
     */
    setEnabled(enabled) {
        localStorage.setItem(this.storageKey, enabled.toString());
    }

    /**
     * Apply animation state to body
     */
    applyState(enabled) {
        if (enabled) {
            document.body.classList.remove('no-animations');
            // Resume aurora animation
            this.resumeAurora();
        } else {
            document.body.classList.add('no-animations');
            // Pause aurora animation
            this.pauseAurora();
        }
    }

    /**
     * Pause aurora animation
     */
    pauseAurora() {
        if (window.auroraAnimation) {
            window.auroraAnimation.pause();
        }

        // Hide aurora canvas
        const canvas = document.getElementById('aurora-canvas');
        if (canvas) {
            canvas.style.opacity = '0';
        }

        console.log('Aurora effects disabled');
    }

    /**
     * Resume aurora animation
     */
    resumeAurora() {
        if (window.auroraAnimation) {
            window.auroraAnimation.resume();
        }

        // Show aurora canvas
        const canvas = document.getElementById('aurora-canvas');
        if (canvas) {
            canvas.style.opacity = '1';
        }

        console.log('Aurora effects enabled');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const animationManager = new AnimationSettingsManager();
    animationManager.init();

    // Make globally available
    window.animationSettingsManager = animationManager;
});

// Export for use in other modules
export { AnimationSettingsManager };
