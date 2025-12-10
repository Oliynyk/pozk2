// ==========================================
// CALENDAR.JS - UI & INTEGRATION (Dynamic Theme)
// ==========================================

let calendarOverlay, calendarSheet, grid, monthLabel, yearLabel;

function initCalendarElements() {
    calendarOverlay = document.getElementById('calendarOverlay');
    calendarSheet = document.getElementById('calendarSheet');
    grid = document.getElementById('calendarGrid');
    monthLabel = document.getElementById('monthLabel');
    yearLabel = document.getElementById('yearLabel');

    if (!calendarOverlay) console.error("Calendar Overlay not found!");
}

// Ініціалізація
document.addEventListener('DOMContentLoaded', () => {
    initCalendarElements();
    if (typeof lucide !== 'undefined') lucide.createIcons();
});

let currentDate = new Date();
let selectedDate = new Date();

// Відкриття календаря (викликається з HTML)
window.goCalendar = function () {
    if (!calendarOverlay) initCalendarElements();

    // Синхронізуємо календар з поточною обраною датою в розкладі
    if (window.scheduleState && window.scheduleState.selected) {
        selectedDate = new Date(window.scheduleState.selected);
        currentDate = new Date(selectedDate); // Перемикаємо місяць на обрану дату
    }
    toggleCalendar(true);
};

function toggleCalendar(isOpen) {
    if (!calendarOverlay) initCalendarElements();
    if (!calendarOverlay) return;

    if (isOpen) {
        calendarOverlay.classList.add('active');
        calendarSheet.style.transform = '';

        // Оновлюємо стилі перед рендером
        updateStaticElementsTheme();
        renderCalendar();

        vibrateLight();

        setTimeout(() => {
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }, 50);
    } else {
        calendarOverlay.classList.remove('active');
    }
}

function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar();
    vibrateLight();
}

// Кнопка "Сьогодні" в календарі
window.selectToday = function () {
    const today = new Date();
    handleDateClick(today);
};

function vibrateLight() { if (navigator.vibrate) navigator.vibrate(10); }

// --- INTEGRATION LOGIC ---

async function handleDateClick(dateObj) {
    selectedDate = dateObj;
    currentDate = new Date(dateObj); // Оновлюємо поточний вигляд календаря
    renderCalendar(); // Перемальовуємо, щоб оновити виділення
    vibrateLight();

    // Форматуємо дату YYYY-MM-DD для пошуку
    const dateStr = dateObj.toLocaleDateString('en-CA'); // "2025-11-24"

    // 1. Перевіряємо, чи ця дата вже завантажена
    const rawState = localStorage.getItem('scheduleDataState');
    let isDataLoaded = false;

    if (rawState) {
        const state = JSON.parse(rawState);
        // Перевіряємо, чи входить дата в межі завантаженого тижня
        if (state.startDate && state.endDate) {
            const start = new Date(state.startDate); start.setHours(0, 0, 0, 0);
            const end = new Date(state.endDate); end.setHours(0, 0, 0, 0);
            const target = new Date(dateStr); target.setHours(0, 0, 0, 0);

            if (target >= start && target <= end) {
                isDataLoaded = true;
            }
        }
    }

    if (isDataLoaded) {
        console.log("📅 Дата в кеші. Перемикаємо...");
        if (window.selectDate) window.selectDate(dateStr);
        setTimeout(() => toggleCalendar(false), 200);
    } else {
        console.log("🌍 Дата поза кешем. Завантажуємо новий тиждень...");

        if (window.fetchWeekSchedule) {
            const result = await window.fetchWeekSchedule(dateObj);

            if (result) {
                // Оновлюємо розклад і обираємо дату
                if (window.renderSchedule) window.renderSchedule();
                if (window.selectDate) window.selectDate(dateStr);
                setTimeout(() => toggleCalendar(false), 300);
            } else {
                alert("Не вдалося завантажити дані на цей тиждень.");
            }
        } else {
            console.error("Функція fetchWeekSchedule не знайдена в search.js!");
        }
    }
}

// --- RENDER LOGIC ---

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const theme = getThemeColor(); // Використовуємо функцію з utils.js

    // Назва місяця з великої літери
    const monthName = new Intl.DateTimeFormat('uk-UA', { month: 'long' }).format(currentDate);
    monthLabel.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    yearLabel.textContent = year;

    grid.innerHTML = '';

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Коригування для Пн-Нд (getDay повертає 0 для Неділі)
    let padding = firstDay.getDay() - 1;
    if (padding < 0) padding = 6;

    const today = new Date();

    // Дні попереднього місяця
    for (let i = 0; i < padding; i++) {
        const dayNum = daysInPrevMonth - padding + i + 1;
        const cell = document.createElement('div');
        cell.className = 'day-cell other-month';
        cell.textContent = dayNum;
        grid.appendChild(cell);
    }

    // Дні поточного місяця
    for (let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement('div');
        cell.textContent = i;

        let className = 'day-cell';

        const isToday = (i === today.getDate() && month === today.getMonth() && year === today.getFullYear());
        const isSelected = (i === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear());

        if (isToday) className += ' today';
        if (isSelected) className += ' selected';

        cell.className = className;

        // ДИНАМІЧНІ СТИЛІ (Theme Color)
        if (isSelected) {
            // Якщо день обрано - заливаємо кольором факультету
            cell.style.backgroundColor = theme;
            cell.style.color = '#000000'; // Чорний текст на яскравому фоні
            cell.style.boxShadow = `0 0 15px ${hexToRgba(theme, 0.4)}`;
            cell.style.fontWeight = 'bold';
            cell.style.border = 'none';
        } else if (isToday) {
            // Якщо сьогодні, але не обрано - текст кольору факультету
            cell.style.color = theme;
            cell.style.fontWeight = 'bold';
            cell.style.border = `1px solid ${hexToRgba(theme, 0.5)}`;
        }

        // Клік по дню
        cell.onclick = () => {
            const clickedDate = new Date(year, month, i);
            handleDateClick(clickedDate);
        };

        grid.appendChild(cell);
    }
}

// Функція для стилізації статичних кнопок (Сьогодні, Стрілки)
function updateStaticElementsTheme() {
    const theme = getThemeColor();
    const btnToday = document.querySelector('.btn-calendar-primary');

    // Кнопка "Сьогодні"
    if (btnToday) {
        btnToday.style.background = `linear-gradient(to right, ${theme}, ${hexToRgba(theme, 0.8)})`;
        btnToday.style.color = '#000000';
        btnToday.style.boxShadow = `0 0 20px ${hexToRgba(theme, 0.3)}`;
        btnToday.style.border = 'none';
    }
}

// --- TOUCH LOGIC ---

let startX = 0;
let startY = 0;
let isDragging = false;
let isHorizontalSwipe = false;
const dragThreshold = 100;
const swipeThreshold = 50;

// Ініціалізуємо touch listeners тільки після завантаження DOM
document.addEventListener('DOMContentLoaded', () => {
    if (!calendarSheet) initCalendarElements();
    if (!calendarSheet) {
        console.error('calendarSheet not found, skipping touch listeners');
        return;
    }

    calendarSheet.addEventListener('touchstart', (e) => {
        if (calendarSheet.scrollTop > 0) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isDragging = true;
        isHorizontalSwipe = false;
        calendarSheet.style.transition = 'none';
    }, { passive: true });

    calendarSheet.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - startX;
        const diffY = currentY - startY;

        if (!isHorizontalSwipe && Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
            isHorizontalSwipe = true;
        }

        if (!isHorizontalSwipe && diffY > 0) {
            e.preventDefault();
            calendarSheet.style.transform = `translateY(${diffY}px)`;
        }
    }, { passive: false });

    calendarSheet.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        calendarSheet.style.transition = 'transform 0.4s cubic-bezier(0.19, 1, 0.22, 1)';

        const diffX = e.changedTouches[0].clientX - startX;
        const diffY = e.changedTouches[0].clientY - startY;

        if (isHorizontalSwipe) {
            calendarSheet.style.transform = '';
            if (Math.abs(diffX) > swipeThreshold) {
                changeMonth(diffX > 0 ? -1 : 1);
            }
        } else {
            if (diffY > dragThreshold) {
                toggleCalendar(false);
                setTimeout(() => { calendarSheet.style.transform = ''; }, 300);
            } else {
                calendarSheet.style.transform = '';
            }
        }
    });
});

// === Theme Helpers ===
// getTheme та hexToRgba вже визначені в utils.js та schedule.js