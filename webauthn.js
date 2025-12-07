// ==========================================
// WEBAUTHN.JS - Web Authentication API Integration
// Biometric authentication (Face ID / Touch ID / Windows Hello)
// ==========================================

/**
 * WebAuthn Helper Class
 * Handles biometric authentication using the Web Authentication API
 */
class WebAuthnManager {
    constructor() {
        this.rpName = "Університетський Дашборд";
        // Handle different environments
        const hostname = window.location.hostname;
        // For file:// protocol or empty hostname, use localhost
        // For localhost variations, normalize to "localhost"
        if (!hostname || hostname === '' || window.location.protocol === 'file:') {
            this.rpID = 'localhost';
        } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
            this.rpID = 'localhost';
        } else {
            this.rpID = hostname;
        }
        this.isAvailable = this.checkAvailability();
        this.storageKey = 'webauthn_credentials';
    }

    /**
     * Check if WebAuthn is available in this browser
     */
    checkAvailability() {
        const isAvailable = window.PublicKeyCredential !== undefined &&
            navigator.credentials !== undefined;

        if (isAvailable) {
            // Additional check for platform authenticator
            window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                .then(available => {
                    if (!available) {
                        console.warn('WebAuthn: Platform authenticator (Face ID/Touch ID) не доступний на цьому пристрої');
                    }
                })
                .catch(err => {
                    console.error('WebAuthn availability check error:', err);
                });
        }

        return isAvailable;
    }

    /**
     * Check if user has registered credentials
     */
    hasRegisteredCredentials() {
        const stored = localStorage.getItem(this.storageKey);
        return stored !== null && stored !== '';
    }

    /**
     * Generate a random challenge
     */
    generateChallenge() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return array;
    }

    /**
     * Convert ArrayBuffer to Base64 string
     */
    bufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    /**
     * Convert Base64 string to ArrayBuffer
     */
    base64ToBuffer(base64) {
        const binary = window.atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Register new biometric credential
     * @param {Object} user - User object with id, name, and email
     */
    async register(user) {
        if (!this.isAvailable) {
            throw new Error('WebAuthn не підтримується цим браузером');
        }

        try {
            const challenge = this.generateChallenge();

            // Convert user ID to Uint8Array
            const userIdBuffer = new TextEncoder().encode(user.id || user.uid);

            const publicKeyCredentialCreationOptions = {
                challenge: challenge,
                rp: {
                    name: this.rpName,
                },
                user: {
                    id: userIdBuffer,
                    name: user.email || user.name,
                    displayName: user.name || user.displayName || 'Користувач',
                },
                pubKeyCredParams: [
                    {
                        type: 'public-key',
                        alg: -7,  // ES256
                    },
                    {
                        type: 'public-key',
                        alg: -257, // RS256
                    }
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform', // Use platform authenticator (Face ID, Touch ID, Windows Hello)
                    userVerification: 'required',
                    requireResidentKey: false,
                },
                timeout: 60000,
                attestation: 'none',
            };

            // Only add rpID if not on file:// protocol
            if (window.location.protocol !== 'file:' && this.rpID && this.rpID !== 'localhost') {
                publicKeyCredentialCreationOptions.rp.id = this.rpID;
            }

            const credential = await navigator.credentials.create({
                publicKey: publicKeyCredentialCreationOptions,
            });

            if (!credential) {
                throw new Error('Не вдалося створити облікові дані');
            }

            // Store credential ID for later use
            const credentialData = {
                credentialId: this.bufferToBase64(credential.rawId),
                userId: user.id || user.uid,
                userName: user.name || user.displayName,
                userEmail: user.email,
                createdAt: new Date().toISOString(),
            };

            localStorage.setItem(this.storageKey, JSON.stringify(credentialData));

            console.log('WebAuthn credential registered successfully');
            return true;

        } catch (error) {
            console.error('WebAuthn registration error:', error);

            if (error.name === 'NotAllowedError') {
                throw new Error('Реєстрацію скасовано користувачем');
            } else if (error.name === 'NotSupportedError') {
                throw new Error('Цей пристрій не підтримує біометрію');
            } else if (error.name === 'InvalidStateError') {
                throw new Error('Облікові дані вже зареєстровані');
            } else {
                throw new Error('Помилка реєстрації: ' + error.message);
            }
        }
    }

    /**
     * Authenticate using biometric credential
     */
    async authenticate() {
        if (!this.isAvailable) {
            throw new Error('WebAuthn не підтримується цим браузером');
        }

        if (!this.hasRegisteredCredentials()) {
            throw new Error('Біометричні дані не налаштовані');
        }

        try {
            const stored = JSON.parse(localStorage.getItem(this.storageKey));
            const challenge = this.generateChallenge();

            const publicKeyCredentialRequestOptions = {
                challenge: challenge,
                allowCredentials: [{
                    id: this.base64ToBuffer(stored.credentialId),
                    type: 'public-key',
                    transports: ['internal'],
                }],
                timeout: 60000,
                userVerification: 'required',
            };

            // Only add rpID if not on file:// protocol
            if (window.location.protocol !== 'file:' && this.rpID && this.rpID !== 'localhost') {
                publicKeyCredentialRequestOptions.rpId = this.rpID;
            }

            const assertion = await navigator.credentials.get({
                publicKey: publicKeyCredentialRequestOptions,
            });

            if (!assertion) {
                throw new Error('Автентифікація не вдалася');
            }

            console.log('WebAuthn authentication successful');

            // Return stored user data
            return {
                userId: stored.userId,
                userName: stored.userName,
                userEmail: stored.userEmail,
            };

        } catch (error) {
            console.error('WebAuthn authentication error:', error);

            if (error.name === 'NotAllowedError') {
                throw new Error('Автентифікацію скасовано');
            } else if (error.name === 'NotSupportedError') {
                throw new Error('Цей пристрій не підтримує біометрію');
            } else {
                throw new Error('Помилка автентифікації: ' + error.message);
            }
        }
    }

    /**
     * Remove registered credentials
     */
    unregister() {
        localStorage.removeItem(this.storageKey);
        console.log('WebAuthn credentials removed');
    }

    /**
     * Get stored credential info
     */
    getCredentialInfo() {
        const stored = localStorage.getItem(this.storageKey);
        if (!stored) return null;
        return JSON.parse(stored);
    }
}

// Create global instance
window.webAuthnManager = new WebAuthnManager();

/**
 * Setup WebAuthn toggle in settings
 */
function setupWebAuthnToggle() {
    const toggle = document.getElementById('webauthn-toggle');
    const manager = window.webAuthnManager;

    if (!toggle) return;

    // Check if WebAuthn is available
    if (!manager.isAvailable) {
        toggle.disabled = true;
        toggle.checked = false;
        const label = toggle.closest('.setting-row').querySelector('p');
        if (label) {
            label.textContent = 'Не підтримується на цьому пристрої';
            label.style.color = '#ef4444';
        }
        return;
    }

    // Set initial state based on registered credentials
    toggle.checked = manager.hasRegisteredCredentials();

    // Handle toggle change
    toggle.onchange = async function (e) {
        e.preventDefault();

        if (this.checked) {
            // User wants to enable - register credentials
            try {
                // Get current Firebase user
                const auth = window.firebaseAuth;
                if (!auth || !auth.currentUser) {
                    showToast('Спочатку увійдіть в систему', 'error');
                    this.checked = false;
                    return;
                }

                const user = auth.currentUser;

                // Show loading state
                const settingRow = this.closest('.setting-row');
                const originalText = settingRow.querySelector('p').textContent;
                settingRow.querySelector('p').textContent = 'Налаштування...';

                // Register biometric credential
                await manager.register({
                    id: user.uid,
                    name: user.displayName,
                    email: user.email,
                });

                settingRow.querySelector('p').textContent = originalText;
                showToast('Face/Touch ID увімкнено! 🎉');

            } catch (error) {
                console.error('Failed to enable biometric auth:', error);
                showToast(error.message, 'error');
                this.checked = false;
            }
        } else {
            // User wants to disable - remove credentials
            manager.unregister();
            showToast('Face/Touch ID вимкнено');
        }
    };
}

/**
 * Biometric login from login screen
 */
window.biometricLogin = async function () {
    const manager = window.webAuthnManager;

    if (!manager.isAvailable) {
        showToast('Біометрична автентифікація не підтримується', 'error');
        return;
    }

    if (!manager.hasRegisteredCredentials()) {
        showToast('Спочатку увімкніть Face/Touch ID у налаштуваннях', 'error');
        return;
    }

    try {
        showToast('Використовуйте Face ID або Touch ID...');

        // Authenticate with biometrics
        const userData = await manager.authenticate();

        // Get Firebase auth instance
        const auth = window.firebaseAuth;

        // Check if there's already a Firebase session
        if (auth && auth.currentUser && auth.currentUser.uid === userData.userId) {
            // User is already authenticated, just show dashboard
            showToast('Вхід успішний! ✅');

            setTimeout(() => {
                if (window.openView) {
                    window.openView('dashboard-view');
                }
            }, 800);
        } else {
            // No Firebase session - show message to login with Google first
            showToast('Будь ласка, увійдіть через Google', 'error');
        }

    } catch (error) {
        console.error('Biometric login failed:', error);
        showToast(error.message, 'error');
    }
};

/**
 * Initialize WebAuthn when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    // Setup toggle in settings
    setupWebAuthnToggle();

    console.log('WebAuthn initialized. Available:', window.webAuthnManager.isAvailable);
    console.log('Credentials registered:', window.webAuthnManager.hasRegisteredCredentials());
});

// Export for use in other modules
export { WebAuthnManager };
