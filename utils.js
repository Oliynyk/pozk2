// ==========================================
// UTILITIES - Спільні функції для всіх модулів
// ==========================================

// Міграція localStorage (одноразова очистка старих даних)
(function migrateLocalStorage() {
    try {
        const settings = JSON.parse(localStorage.getItem('scheduleSettings') || '{}');
        if (settings.themeColor) {
            // Зберігаємо колір в єдиний ключ якщо ще не збережено
            if (!localStorage.getItem('themeColor')) {
                localStorage.setItem('themeColor', settings.themeColor);
            }
            // Видаляємо з scheduleSettings
            delete settings.themeColor;
            localStorage.setItem('scheduleSettings', JSON.stringify(settings));
            console.log('✓ localStorage migrated: removed themeColor from scheduleSettings');
        }
    } catch (e) { }
})();

/**
 * Конвертує HEX колір в RGBA
 * @param {string} hex - HEX колір (#RGB або #RRGGBB)
 * @param {number} alpha - Прозорість (0-1)
 * @returns {string} RGBA string
 */
function hexToRgba(hex, alpha) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Отримує колір теми з localStorage
 * @returns {string} HEX колір теми
 */
function getThemeColor() {
    return localStorage.getItem('themeColor') || '#0ea5e9';
}

/**
 * Застосовує активний стиль до елемента
 * @param {HTMLElement} el - DOM елемент
 * @param {string} color - HEX колір
 */
function applyActiveStyle(el, color) {
    if (!el) return;
    el.style.backgroundColor = hexToRgba(color, 0.4);
    el.style.borderColor = color;
    el.style.color = '#ffffff';
    el.style.boxShadow = `0 0 15px ${hexToRgba(color, 0.25)}`;
}

/**
 * Конвертує час у хвилини
 * @param {string} timeString - Час у форматі HH:MM
 * @returns {number} Хвилини з початку дня
 */
function timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Форматує хвилини в час
 * @param {number} minutes - Хвилини
 * @returns {string} Час у форматі HH:MM
 */
function formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Отримує поточний час у хвилинах
 * @returns {number} Хвилини з початку дня
 */
function getCurrentTimeInMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success' or 'error' (default: 'success')
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');

    if (!toast || !toastMsg) {
        console.warn('Toast elements not found, message:', message);
        return;
    }

    toastMsg.textContent = message;

    // Update icon based on type
    const iconContainer = toast.querySelector('div:first-child');
    if (iconContainer) {
        if (type === 'error') {
            iconContainer.className = 'w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-red-400';
            iconContainer.innerHTML = '<i data-lucide="x" width="14"></i>';
        } else {
            iconContainer.className = 'w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400';
            iconContainer.innerHTML = '<i data-lucide="check" width="14"></i>';
        }

        // Reinitialize Lucide icons for the new icon
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }

    // Show toast
    toast.classList.add('show');

    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Make showToast globally available
window.showToast = showToast;

// ==================== AURORA ANIMATION (OPTIMIZED) ====================
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('aurora-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    let t = 0;
    let lastFrameTime = 0;
    const targetFPS = 30; // Limit FPS for better performance
    const frameInterval = 1000 / targetFPS;

    // Particles (reduced count for performance)
    const particles = [];
    const particleCount = 40;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        initParticles();
    }

    function initParticles() {
        particles.length = 0;
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 2,
                speedY: Math.random() * 0.5 + 0.1,
                speedX: (Math.random() - 0.5) * 0.3,
                opacity: Math.random() * 0.5 + 0.1,
                pulseSpeed: Math.random() * 0.03 + 0.01
            });
        }
    }

    window.addEventListener('resize', resize);
    resize();

    function draw(currentTime) {
        if (!window.auroraAnimation.isRunning) return;

        // FPS limiting
        if (currentTime - lastFrameTime < frameInterval) {
            requestAnimationFrame(draw);
            return;
        }
        lastFrameTime = currentTime;

        // Clear
        ctx.fillStyle = "#0a0a0c";
        ctx.fillRect(0, 0, width, height);

        // 1. Background gradient (simplified)
        const pulse = Math.sin(t * 0.3) * 0.08 + 0.92;
        const gradient1 = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, width * 1.2);
        gradient1.addColorStop(0, `rgba(0, 242, 234, ${0.08 * pulse})`);
        gradient1.addColorStop(0.4, `rgba(127, 0, 255, ${0.06 * pulse})`);
        gradient1.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient1;
        ctx.fillRect(0, 0, width, height);

        // 2. Aurora waves (simplified - no ctx.filter for performance)
        const waveCount = 7;

        for (let i = 0; i < waveCount; i++) {
            ctx.beginPath();
            const baseY = (height * 0.25) + (height * 0.5) * (i / waveCount) + Math.sin(t * 0.15 + i) * 40;

            for (let x = 0; x <= width; x += 20) {
                const y = baseY +
                    Math.sin(x * 0.002 + t + i * 0.8) * 80 +
                    Math.sin(x * 0.006 - t + i) * 40;
                ctx.lineTo(x, y);
            }

            let baseColor;
            if (i % 3 === 0) baseColor = `0, 242, 234`;
            else if (i % 3 === 1) baseColor = `127, 0, 255`;
            else baseColor = `0, 200, 100`;

            const alpha = 0.12 + Math.sin(t + i) * 0.03;
            ctx.strokeStyle = `rgba(${baseColor}, ${alpha})`;
            ctx.lineWidth = 100 + Math.sin(t * 0.5 + i) * 30;
            ctx.lineCap = 'round';
            // CSS blur handles smoothing, no ctx.filter needed
            ctx.stroke();
        }

        // 3. Particles
        ctx.fillStyle = "white";
        particles.forEach(p => {
            const twinkle = 0.5 + Math.sin(t * p.pulseSpeed * 8) * 0.5;
            ctx.globalAlpha = p.opacity * twinkle;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();

            p.y -= p.speedY;
            p.x += p.speedX;

            if (p.y < -10) {
                p.y = height + 10;
                p.x = Math.random() * width;
            }
            if (p.x > width + 10) p.x = -10;
            if (p.x < -10) p.x = width + 10;
        });
        ctx.globalAlpha = 1.0;

        t += 0.012;
        requestAnimationFrame(draw);
    }

    // Make aurora animation globally accessible with pause/resume
    window.auroraAnimation = {
        isRunning: true,
        pause: function () {
            this.isRunning = false;
            console.log('Aurora animation paused');
        },
        resume: function () {
            if (!this.isRunning) {
                this.isRunning = true;
                draw();
                console.log('Aurora animation resumed');
            }
        }
    };

    draw();
});