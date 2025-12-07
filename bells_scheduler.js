/**
 * Bells Scheduler - Динамічний розклад дзвінків
 * Оновлює екран "Розклад дзвінків", Дашборд ТА Hero Card в розкладі
 * FIX: Використовує Hex-кольори та inline-styles для сумісності з кастомними темами
 * UPD: Модальне вікно уніфіковано зі стилем календаря (Bottom Sheet) + приховано скролбар
 * FIX: Додано реактивну зміну кольору без перезавантаження сторінки
 */

// ==================== НАЛАШТУВАННЯ ТЕМИ ====================
// Функції getThemeColor() та hexToRgba() винесені в utils.js

// Змінено const на let для можливості оновлення
let ACTIVE_THEME_HEX = getThemeColor();



/**
 * Створює динамічний CSS для елементів теми
 */
function injectDynamicCSS(color) {
    const styleId = 'dynamic-theme-styles';
    let styleTag = document.getElementById(styleId);

    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
    }

    const rgbaStart = hexToRgba(color, 0.2);
    const rgbaGlow = hexToRgba(color, 0.6);

    // Оновлюємо вміст стилів (працює навіть якщо тег вже існує)
    styleTag.innerHTML = `
        .current-time-tag::after {
            border-top-color: ${color} !important;
        }
        .timeline-progress {
            background: linear-gradient(90deg, ${rgbaStart} 0%, ${color} 100%) !important;
            box-shadow: 0 0 15px ${rgbaGlow};
        }
    `;
}

/**
 * Інжектує стилі для модального вікна, щоб вони відповідали календарю
 */
function injectModalStyles() {
    const styleId = 'shared-modal-styles';
    if (document.getElementById(styleId)) return;

    const styleTag = document.createElement('style');
    styleTag.id = styleId;
    styleTag.innerHTML = `
        /* --- СТИЛІ ДЛЯ КАЛЕНДАРЯ (Reused for Pairs Modal) --- */
        .calendar-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(2, 6, 23, 0.6);
            backdrop-filter: blur(8px);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1);
            z-index: 100; /* High z-index */
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
        }

        .calendar-modal-overlay.active {
            opacity: 1;
            pointer-events: auto;
        }

        .calendar-bottom-sheet {
            width: 100%;
            max-width: 450px;
            margin: 0 auto;
            max-height: 85vh;
            overflow-y: auto;
            background: rgba(15, 23, 42, 0.9);
            backdrop-filter: blur(30px) saturate(180%);
            -webkit-backdrop-filter: blur(30px) saturate(180%);
            border-radius: 32px 32px 0 0;
            border-top: 1px solid rgba(255, 255, 255, 0.15);
            border-left: 1px solid rgba(255, 255, 255, 0.05);
            border-right: 1px solid rgba(255, 255, 255, 0.05);
            box-shadow: 0 -10px 50px rgba(0, 0, 0, 0.5);
            transform: translateY(100%);
            transition: transform 0.4s cubic-bezier(0.19, 1, 0.22, 1);
            padding-bottom: max(20px, env(safe-area-inset-bottom));
            user-select: none;
            touch-action: none;
            
            /* --- ПРИХОВУВАННЯ СКРОЛБАРУ --- */
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE/Edge */
        }
        
        /* Приховування скролбару для Chrome/Safari/Webkit */
        .calendar-bottom-sheet::-webkit-scrollbar {
            display: none;
        }

        .calendar-modal-overlay.active .calendar-bottom-sheet {
            transform: translateY(0);
        }

        .drag-pill {
            width: 48px;
            height: 5px;
            background: rgba(255, 255, 255, 0.25);
            border-radius: 100px;
            margin: 16px auto 24px auto;
            cursor: grab;
        }
    `;
    document.head.appendChild(styleTag);
}

function applyStaticTheme() {
    const theme = ACTIVE_THEME_HEX;

    // Інжектуємо CSS правила
    injectDynamicCSS(theme);
    injectModalStyles();

    // 1. Кнопка годинника
    const clockBtn = document.getElementById('clock-btn');
    if (clockBtn) {
        // Ми НЕ видаляємо класи, щоб можна було знайти елемент знову, якщо тема зміниться ще раз
        // clockBtn.classList.remove('bg-brand-cyan/20', 'text-brand-cyan'); 

        clockBtn.style.backgroundColor = hexToRgba(theme, 0.2);
        clockBtn.style.color = theme;
        clockBtn.onclick = createAndShowAllPairsModal;
    }

    // 2. Інші статичні елементи
    const textElements = document.querySelectorAll('.text-brand-cyan');
    textElements.forEach(el => {
        // el.classList.remove('text-brand-cyan'); // Залишаємо клас для селектора
        el.style.color = theme;
    });
}

// ==================== ЛОГІКА МОДАЛЬНОГО ВІКНА (UNIFIED STYLE) ====================

window.createAndShowAllPairsModal = function () {
    let modal = document.getElementById('all-pairs-modal');

    // Створення модалки
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'all-pairs-modal';
        // Використовуємо клас календаря для оверлею
        modal.className = 'calendar-modal-overlay';

        // Внутрішня структура відповідає календарю
        modal.innerHTML = `
            <div class="calendar-bottom-sheet" id="modal-sheet">
                <!-- Ручка (drag pill) -->
                <div class="drag-pill"></div>

                <!-- Хедер (адаптований під стиль) -->
                <div class="px-6 pb-4 flex justify-between items-center border-b border-white/5 mb-4">
                    <div>
                        <h3 class="text-xl font-display font-bold text-white tracking-wide" style="font-family: 'Outfit', sans-serif;">Розклад занять</h3>
                        <p class="text-xs text-gray-400 font-medium mt-0.5">Всі пари на сьогодні</p>
                    </div>
                    <button id="close-modal-btn" class="w-9 h-9 rounded-full bg-white/5 text-gray-300 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all active:scale-95">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>
                
                <!-- Список пар -->
                <div class="px-5 pb-8 flex flex-col gap-3" id="all-pairs-list">
                    <!-- Cards will be injected here -->
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Логіка закриття
        const sheet = modal.querySelector('#modal-sheet');
        const closeBtn = modal.querySelector('#close-modal-btn');
        const dragPill = modal.querySelector('.drag-pill');

        const closeModal = () => {
            modal.classList.remove('active');
        };

        closeBtn.addEventListener('click', closeModal);

        // Закриття при кліку на фон (оверлей)
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // (Опціонально) Проста логіка закриття по свайпу на dragPill
        // Для повноцінного свайпу треба більше коду, але додамо клік для зручності
        dragPill.addEventListener('click', closeModal);

        // Експортуємо метод відкриття
        modal.open = () => {
            // Невеликий тайм-аут, щоб браузер встиг відрендерити елемент перед додаванням класу active (для анімації)
            requestAnimationFrame(() => {
                modal.classList.add('active');
            });
        };
    }

    // Наповнення контентом
    const listContainer = modal.querySelector('#all-pairs-list');
    listContainer.innerHTML = '';

    BELLS_SCHEDULE.forEach((lesson) => {
        const card = document.createElement('div');
        // Glassmorphism card style (схожий на тайли календаря, але адаптований під контент)
        card.className = 'group relative overflow-hidden bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between transition-all active:scale-[0.98] active:bg-white/10';

        const numBg = hexToRgba(ACTIVE_THEME_HEX, 0.15);
        const numColor = ACTIVE_THEME_HEX;

        card.innerHTML = `
             <div class="flex items-center gap-4 relative z-10">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-xl shadow-lg shadow-black/20" 
                     style="background-color: ${numBg}; color: ${numColor}; box-shadow: 0 0 15px ${hexToRgba(ACTIVE_THEME_HEX, 0.1)}">
                    ${lesson.id}
                </div>
                <div>
                    <h4 class="text-base font-bold text-gray-100 group-hover:text-white transition-colors" style="font-family: 'Outfit', sans-serif;">Пара ${lesson.id}</h4>
                    <div class="flex items-center gap-2 mt-0.5">
                        <i class="fa-regular fa-clock text-[10px] text-gray-500"></i>
                        <p class="text-xs text-gray-400 font-mono">${lesson.start} - ${lesson.end}</p>
                    </div>
                </div>
            </div>
            <div class="flex flex-col items-end relative z-10">
                <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Перерва</span>
                <span class="text-xs font-mono font-medium text-gray-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 group-hover:border-white/10 transition-colors">
                   ${lesson.breakStart}-${lesson.breakEnd}
                </span>
            </div>
            
            <!-- Hover Gradient Effect -->
            <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none"></div>
        `;
        listContainer.appendChild(card);
    });

    // Відкриваємо
    if (modal.open) modal.open();
}

// ==================== СТРУКТУРА ДАНИХ ====================

const BELLS_SCHEDULE = [
    { id: "I", start: "08:30", end: "09:50", breakStart: "09:07", breakEnd: "09:12" },
    { id: "II", start: "10:10", end: "11:30", breakStart: "10:47", breakEnd: "10:52" },
    { id: "III", start: "12:00", end: "13:20", breakStart: "12:37", breakEnd: "12:42" },
    { id: "IV", start: "13:30", end: "14:50", breakStart: "14:07", breakEnd: "14:12" },
    { id: "V", start: "15:00", end: "16:20", breakStart: "15:37", breakEnd: "15:42" },
    { id: "VI", start: "16:30", end: "17:50", breakStart: "17:07", breakEnd: "17:12" },
    { id: "VII", start: "18:00", end: "19:20", breakStart: "18:37", breakEnd: "18:42" },
    { id: "VIII", start: "19:30", end: "20:50", breakStart: "20:07", breakEnd: "20:12" }
];

// ==================== DOM ЕЛЕМЕНТИ ====================

const DOM_ELEMENTS = {
    // Notification View
    statusText: null,
    activeDot: null,
    activeStatusLabel: null,
    activeCard: null,
    activeCardTitle: null,
    activeCardTimes: null,
    activeCardEnd: null,
    timeLeftVal: null,
    timeLeftLabel: null,
    timelineProgress: null,
    currentTimeIndicator: null,
    upcomingList: null,
    tlStartTime: null,
    tlEndTime: null,
    bigBreakCard: null,
    nextLessonTitle: null,
    nextLessonTime: null,
    // Dashboard View
    dashTimer: null,
    dashNum: null,
    dashRange: null,
    dashDesc: null,
    dashLabel: null
};

// ==================== ФУНКЦІЇ-УТИЛІТИ ====================

function timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

function formatMinutesToTimeLeft(minutes) {
    if (minutes < 0) return "0 хв";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours} год ${mins} хв`;
    return `${mins} хв`;
}

function getMinutesOnly(minutes) {
    if (minutes < 0) return "0";
    return minutes.toString();
}

function getCurrentTimeInMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

function formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// ==================== ГОЛОВНІ ФУНКЦІЇ ====================

function getCurrentState(currentTime) {
    // === НОВА ЛОГІКА: Перевірка неділі ===
    const today = new Date();
    if (today.getDay() === 0) { // 0 = Неділя
        return {
            type: 'weekend',
            lesson: null,
            nextEventTime: null,
            statusText: 'Сьогодні вихідний'
        };
    }
    // ======================================

    for (let i = 0; i < BELLS_SCHEDULE.length; i++) {
        const lesson = BELLS_SCHEDULE[i];
        const startTime = timeToMinutes(lesson.start);
        const endTime = timeToMinutes(lesson.end);
        const breakStartTime = timeToMinutes(lesson.breakStart);
        const breakEndTime = timeToMinutes(lesson.breakEnd);

        if (currentTime >= startTime && currentTime < endTime) {
            if (currentTime >= breakStartTime && currentTime < breakEndTime) {
                return {
                    type: 'break',
                    lesson: lesson,
                    nextEventTime: breakEndTime,
                    statusText: 'Перерва'
                };
            }
            let nextEventTime;
            if (currentTime < breakStartTime) {
                nextEventTime = breakStartTime;
            } else {
                nextEventTime = endTime;
            }
            return {
                type: 'lesson',
                lesson: lesson,
                nextEventTime: nextEventTime,
                statusText: `Триває ${lesson.id} пара`
            };
        }

        if (i < BELLS_SCHEDULE.length - 1) {
            const nextLesson = BELLS_SCHEDULE[i + 1];
            const nextStartTime = timeToMinutes(nextLesson.start);

            if (currentTime >= endTime && currentTime < nextStartTime) {
                return {
                    type: 'big_break',
                    lesson: nextLesson,
                    nextEventTime: nextStartTime,
                    statusText: 'Велика перерва'
                };
            }
        }
    }

    const firstLessonStart = timeToMinutes(BELLS_SCHEDULE[0].start);
    const lastLessonEnd = timeToMinutes(BELLS_SCHEDULE[BELLS_SCHEDULE.length - 1].end);

    if (currentTime < firstLessonStart) {
        return {
            type: 'before_classes',
            lesson: BELLS_SCHEDULE[0],
            nextEventTime: firstLessonStart,
            statusText: 'Пари ще не почалися'
        };
    }

    if (currentTime >= lastLessonEnd) {
        return {
            type: 'after_classes',
            lesson: null,
            nextEventTime: null,
            statusText: 'Пари закінчилися'
        };
    }

    return null;
}
function renderActiveCard(lesson, currentTime) {
    if (!lesson || !DOM_ELEMENTS.activeCard) return;

    const tStart = timeToMinutes(lesson.start);
    const tEnd = timeToMinutes(lesson.end);
    const tBreakStart = timeToMinutes(lesson.breakStart);
    const tBreakEnd = timeToMinutes(lesson.breakEnd);

    if (DOM_ELEMENTS.activeCardTitle) DOM_ELEMENTS.activeCardTitle.textContent = lesson.id;
    if (DOM_ELEMENTS.activeCardTimes) DOM_ELEMENTS.activeCardTimes.textContent = lesson.start;
    if (DOM_ELEMENTS.activeCardEnd) DOM_ELEMENTS.activeCardEnd.textContent = lesson.end;

    let segmentStart, segmentEnd;
    let labelStartStr, labelEndStr;
    let timeLeftMinutes;
    let timeLeftTextLabel = "До кінця";

    if (currentTime < tBreakStart) {
        segmentStart = tStart;
        segmentEnd = tBreakStart;
        labelStartStr = lesson.start;
        labelEndStr = lesson.breakStart;
        timeLeftMinutes = tBreakStart - currentTime;
        timeLeftTextLabel = "До перерви";
    } else if (currentTime >= tBreakStart && currentTime < tBreakEnd) {
        segmentStart = tBreakStart;
        segmentEnd = tBreakEnd;
        labelStartStr = lesson.breakStart;
        labelEndStr = lesson.breakEnd;
        timeLeftMinutes = tBreakEnd - currentTime;
        timeLeftTextLabel = "Кінець перерви";
    } else {
        segmentStart = tBreakEnd;
        segmentEnd = tEnd;
        labelStartStr = lesson.breakEnd;
        labelEndStr = lesson.end;
        timeLeftMinutes = tEnd - currentTime;
        timeLeftTextLabel = "До кінця пари";
    }

    if (DOM_ELEMENTS.timeLeftVal) DOM_ELEMENTS.timeLeftVal.textContent = getMinutesOnly(timeLeftMinutes);
    if (DOM_ELEMENTS.timeLeftLabel) DOM_ELEMENTS.timeLeftLabel.textContent = timeLeftTextLabel;

    const totalSegmentDuration = segmentEnd - segmentStart;
    const elapsedInSegment = currentTime - segmentStart;
    const progressPercent = Math.max(0, Math.min(100, (elapsedInSegment / totalSegmentDuration) * 100));

    // Прогрес бар тепер керується класом .timeline-progress та CSS змінними для ширини
    if (DOM_ELEMENTS.timelineProgress) {
        DOM_ELEMENTS.timelineProgress.style.width = `${progressPercent}%`;
        // Gradient і тінь вже задані через injectDynamicCSS
    }

    // Оновлення індикатора поточного часу з акцентним кольором
    if (DOM_ELEMENTS.currentTimeIndicator) {
        DOM_ELEMENTS.currentTimeIndicator.style.left = `${progressPercent}%`;
        const timeTag = DOM_ELEMENTS.currentTimeIndicator.querySelector('.current-time-tag');
        if (timeTag) {
            timeTag.textContent = formatTime(currentTime);
            // Фарбуємо бігунок в акцентний колір
            timeTag.style.backgroundColor = ACTIVE_THEME_HEX;
            timeTag.style.color = '#000000';
            timeTag.style.fontWeight = 'bold';
            timeTag.style.boxShadow = `0 0 10px ${hexToRgba(ACTIVE_THEME_HEX, 0.5)}`;
        }
    }

    if (DOM_ELEMENTS.tlStartTime) DOM_ELEMENTS.tlStartTime.textContent = labelStartStr;
    if (DOM_ELEMENTS.tlEndTime) DOM_ELEMENTS.tlEndTime.textContent = labelEndStr;

    const leftDot = DOM_ELEMENTS.activeCard.querySelector('.timeline-point:first-of-type');
    if (leftDot) leftDot.classList.add('passed');

    // --- ОНОВЛЕННЯ ДАШБОРДУ ---
    if (DOM_ELEMENTS.dashTimer) DOM_ELEMENTS.dashTimer.textContent = getMinutesOnly(timeLeftMinutes);
    if (DOM_ELEMENTS.dashNum) DOM_ELEMENTS.dashNum.textContent = lesson.id;
    if (DOM_ELEMENTS.dashDesc) DOM_ELEMENTS.dashDesc.textContent = timeLeftTextLabel;

    if (DOM_ELEMENTS.dashLabel) {
        if (currentTime >= tBreakStart && currentTime < tBreakEnd) {
            DOM_ELEMENTS.dashLabel.textContent = "ПЕРЕРВА";
            DOM_ELEMENTS.dashLabel.className = "text-[10px] font-bold uppercase tracking-widest shadow-black drop-shadow-md";
            DOM_ELEMENTS.dashLabel.style.color = '#a855f7'; // purple
        } else {
            DOM_ELEMENTS.dashLabel.textContent = "ТРИВАЄ";
            DOM_ELEMENTS.dashLabel.className = "text-[10px] font-bold uppercase tracking-widest shadow-black drop-shadow-md";
            DOM_ELEMENTS.dashLabel.style.color = ACTIVE_THEME_HEX;
        }
    }
    updateSegmentGrid(lesson, currentTime);
}

function renderBigBreakCard(nextLesson, currentTime) {
    if (!DOM_ELEMENTS.bigBreakCard) return;

    if (DOM_ELEMENTS.nextLessonTitle) DOM_ELEMENTS.nextLessonTitle.textContent = `${nextLesson.id} пара`;
    if (DOM_ELEMENTS.nextLessonTime) DOM_ELEMENTS.nextLessonTime.textContent = `${nextLesson.start} - ${nextLesson.end}`;

    // Дашборд на великій перерві
    if (DOM_ELEMENTS.dashLabel) {
        DOM_ELEMENTS.dashLabel.textContent = "ВІДПОЧИНОК";
        DOM_ELEMENTS.dashLabel.className = "text-[10px] font-bold uppercase tracking-widest";
        DOM_ELEMENTS.dashLabel.style.color = '#f59e0b'; // amber
    }

    const nextStart = timeToMinutes(nextLesson.start);
    const diff = nextStart - currentTime;

    if (DOM_ELEMENTS.dashTimer) DOM_ELEMENTS.dashTimer.textContent = getMinutesOnly(diff);
    if (DOM_ELEMENTS.dashDesc) DOM_ELEMENTS.dashDesc.textContent = "До початку пар";
    if (DOM_ELEMENTS.dashRange) DOM_ELEMENTS.dashRange.textContent = `Далі: ${nextLesson.start}`;

    if (DOM_ELEMENTS.dashNum) DOM_ELEMENTS.dashNum.innerHTML = '<i class="fa-solid fa-mug-hot text-xl"></i>';
}

function updateSegmentGrid(lesson, currentTime) {
    const tStart = timeToMinutes(lesson.start);
    const tBreakStart = timeToMinutes(lesson.breakStart);
    const tBreakEnd = timeToMinutes(lesson.breakEnd);
    const tEnd = timeToMinutes(lesson.end);

    const updateBlock = (idPrefix, startTime, endTime, displayTimeStr, type) => {
        const elBg = document.getElementById(`${idPrefix}-bg`);
        const elTime = document.getElementById(`${idPrefix}-time`);

        if (elTime) elTime.textContent = displayTimeStr;

        if (currentTime >= endTime) {
            // Минула частина - зелений
            if (elBg) {
                elBg.className = 'absolute inset-0 bg-brand-green/20 transition-colors duration-300';
                elBg.style.backgroundColor = ''; // Скидаємо інлайн
            }
        } else if (currentTime >= startTime && currentTime < endTime) {
            // Активна частина
            if (elBg) {
                elBg.className = 'absolute inset-0 transition-colors duration-300 animate-pulse';
                if (type === 'theme') {
                    // Використовуємо тему з прозорістю 20%
                    elBg.style.backgroundColor = hexToRgba(ACTIVE_THEME_HEX, 0.2);
                } else {
                    elBg.style.backgroundColor = 'rgba(168, 85, 247, 0.2)'; // purple for break
                }
            }
        } else {
            // Майбутня частина
            if (elBg) {
                elBg.className = 'absolute inset-0 bg-transparent transition-colors duration-300';
                elBg.style.backgroundColor = 'transparent';
            }
        }
    };

    updateBlock('seg-1', tStart, tBreakStart, `${lesson.start}-${lesson.breakStart}`, 'theme');
    updateBlock('seg-2', tBreakStart, tBreakEnd, `${lesson.breakStart}-${lesson.breakEnd}`, 'break');
    updateBlock('seg-3', tBreakEnd, tEnd, `${lesson.breakEnd}-${lesson.end}`, 'theme');
}

function renderUpcomingCards(currentTime) {
    if (!DOM_ELEMENTS.upcomingList) return;

    // 1. Перевірка на неділю (з попереднього кроку)
    if (new Date().getDay() === 0) {
        const weekendHTML = `
            <div class="flex flex-col items-center justify-center py-10 opacity-70">
                <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
                    <i class="fa-solid fa-couch text-2xl text-gray-400"></i>
                </div>
                <p class="text-gray-400 text-sm font-medium">Сьогодні вихідний</p>
                <p class="text-gray-600 text-xs">Набирайтесь сил</p>
            </div>
        `;
        if (DOM_ELEMENTS.upcomingList.innerHTML.trim() !== weekendHTML.trim()) {
            DOM_ELEMENTS.upcomingList.innerHTML = weekendHTML;
        }
        return;
    }

    let newHTML = '';

    const upcomingLessons = BELLS_SCHEDULE.filter(lesson => {
        const startTime = timeToMinutes(lesson.start);
        return startTime > currentTime;
    });

    if (upcomingLessons.length > 0) {
        upcomingLessons.forEach((lesson, index) => {
            const startTime = timeToMinutes(lesson.start);
            const minutesUntilStart = startTime - currentTime;

            const opacityStyle = index > 0 ? `style="opacity: ${Math.max(0.5, 1 - (index * 0.15))}"` : '';
            const badgeBg = hexToRgba(ACTIVE_THEME_HEX, 0.1);
            const badgeColor = ACTIVE_THEME_HEX;

            // === НОВА ЛОГІКА ТАЙМЕРА ===
            let timeBadgeText;
            // Якщо до пари більше 120 хвилин (2 години) -> показуємо час початку
            if (minutesUntilStart > 120) {
                timeBadgeText = `о ${lesson.start}`;
            } else {
                // Якщо менше 2 годин -> вмикаємо таймер
                timeBadgeText = `Через ${formatMinutesToTimeLeft(minutesUntilStart)}`;
            }
            // ============================

            newHTML += `
                <div class="bell-card-glass p-4 flex items-center justify-between group" ${opacityStyle}>
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 font-display font-bold group-hover:bg-white/10 group-hover:text-white transition-colors">
                            ${lesson.id}
                        </div>
                        <div>
                            <h4 class="text-base font-bold text-gray-200">${lesson.id} пара</h4>
                            <p class="text-xs text-gray-500">${lesson.start} - ${lesson.end}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-xs px-2 py-1 rounded" style="background-color: ${badgeBg}; color: ${badgeColor};">
                            ${timeBadgeText}
                        </span>
                    </div>
                </div>
            `;
        });
    } else {
        newHTML = `
            <div class="flex flex-col items-center justify-center py-10 opacity-70">
                <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
                    <i class="fa-solid fa-mug-hot text-2xl text-gray-400"></i>
                </div>
                <p class="text-gray-400 text-sm font-medium">Більше пар сьогодні немає</p>
                <p class="text-gray-600 text-xs">Відпочивайте</p>
            </div>
        `;
    }

    if (DOM_ELEMENTS.upcomingList.innerHTML.trim() !== newHTML.trim()) {
        DOM_ELEMENTS.upcomingList.innerHTML = newHTML;
    }
}

/**
 * Головна функція оновлення
 */

// Cache for previous state to avoid unnecessary DOM updates
let previousState = {
    type: null,
    statusText: null,
    lessonId: null,
    timeLeft: null
};

function updateTimeAndSchedule() {

    const currentTime = getCurrentTimeInMinutes();
    const state = getCurrentState(currentTime);

    if (state) {
        // Only update if state changed
        const stateChanged = state.type !== previousState.type ||
            state.statusText !== previousState.statusText;

        if (stateChanged) {
            if (DOM_ELEMENTS.statusText) {
                DOM_ELEMENTS.statusText.textContent = `• ${state.statusText}`;
                DOM_ELEMENTS.statusText.className = "text-sm font-medium mb-1 animate-pulse";
                DOM_ELEMENTS.statusText.style.color = ACTIVE_THEME_HEX;
            }

            if (DOM_ELEMENTS.activeDot) {
                DOM_ELEMENTS.activeDot.className = "w-1.5 h-1.5 rounded-full animate-pulse";
                DOM_ELEMENTS.activeDot.style.backgroundColor = ACTIVE_THEME_HEX;
            }

            if (DOM_ELEMENTS.activeStatusLabel) {
                DOM_ELEMENTS.activeStatusLabel.className = "text-xs font-bold uppercase tracking-[0.2em]";
                DOM_ELEMENTS.activeStatusLabel.style.color = ACTIVE_THEME_HEX;
            }
        }

        // Логіка відображення карток (only if state type changed)
        if (state.type !== previousState.type) {
            if (state.type === 'weekend') {
                // === НОВЕ: Ховаємо все зайве у вихідний ===
                if (DOM_ELEMENTS.activeCard) DOM_ELEMENTS.activeCard.style.display = 'none';
                if (DOM_ELEMENTS.bigBreakCard) DOM_ELEMENTS.bigBreakCard.style.display = 'none';

                // Очищаємо дашборд або ставимо заглушки
                if (DOM_ELEMENTS.dashLabel) {
                    DOM_ELEMENTS.dashLabel.textContent = "ВИХІДНИЙ";
                    DOM_ELEMENTS.dashLabel.style.color = '#10b981'; // green
                }
                if (DOM_ELEMENTS.dashTimer) DOM_ELEMENTS.dashTimer.textContent = "--";
                if (DOM_ELEMENTS.dashDesc) DOM_ELEMENTS.dashDesc.textContent = "Пар немає";
            }
            else if (state.type === 'big_break') {
                if (DOM_ELEMENTS.activeCard) DOM_ELEMENTS.activeCard.style.display = 'none';
                if (DOM_ELEMENTS.bigBreakCard) DOM_ELEMENTS.bigBreakCard.style.display = 'flex';
                renderBigBreakCard(state.lesson, currentTime);
            }
            else if (state.type === 'lesson' || state.type === 'break') {
                if (DOM_ELEMENTS.bigBreakCard) DOM_ELEMENTS.bigBreakCard.style.display = 'none';
                if (DOM_ELEMENTS.activeCard) DOM_ELEMENTS.activeCard.style.display = 'flex';
                renderActiveCard(state.lesson, currentTime);
            }
            else if (state.type === 'before_classes') {
                if (DOM_ELEMENTS.bigBreakCard) DOM_ELEMENTS.bigBreakCard.style.display = 'none';
                if (DOM_ELEMENTS.activeCard) DOM_ELEMENTS.activeCard.style.display = 'flex';
                renderActiveCard(state.lesson, currentTime);
            }
            else {
                // after_classes
                if (DOM_ELEMENTS.activeCard) DOM_ELEMENTS.activeCard.style.display = 'none';
                if (DOM_ELEMENTS.bigBreakCard) DOM_ELEMENTS.bigBreakCard.style.display = 'none';
            }

            // Update upcoming cards only when state type changes
            renderUpcomingCards(currentTime);
        } else {
            // State type same, but update active card timer (lightweight update)
            if (state.type === 'lesson' || state.type === 'break') {
                updateActiveCardTimer(state.lesson, currentTime);
            } else if (state.type === 'big_break') {
                updateBigBreakTimer(state.lesson, currentTime);
            }
        }

        // Store current state
        previousState = {
            type: state.type,
            statusText: state.statusText,
            lessonId: state.lesson ? state.lesson.id : null
        };
    }

    // Update hero card (only if visible)
    updateHeroCard(currentTime);
}

/**
 * Lightweight timer update for active card (doesn't re-render entire card)
 */
function updateActiveCardTimer(lesson, currentTime) {
    if (!lesson || !DOM_ELEMENTS.activeCard) return;

    const tStart = timeToMinutes(lesson.start);
    const tEnd = timeToMinutes(lesson.end);
    const tBreakStart = timeToMinutes(lesson.breakStart);
    const tBreakEnd = timeToMinutes(lesson.breakEnd);

    let timeLeftMinutes;
    if (currentTime < tBreakStart) {
        timeLeftMinutes = tBreakStart - currentTime;
    } else if (currentTime >= tBreakStart && currentTime < tBreakEnd) {
        timeLeftMinutes = tBreakEnd - currentTime;
    } else {
        timeLeftMinutes = tEnd - currentTime;
    }

    // Only update timer text
    if (DOM_ELEMENTS.timeLeftVal) {
        DOM_ELEMENTS.timeLeftVal.textContent = getMinutesOnly(timeLeftMinutes);
    }
    if (DOM_ELEMENTS.dashTimer) {
        DOM_ELEMENTS.dashTimer.textContent = getMinutesOnly(timeLeftMinutes);
    }

    // Update progress bar
    let segmentStart, segmentEnd;
    if (currentTime < tBreakStart) {
        segmentStart = tStart;
        segmentEnd = tBreakStart;
    } else if (currentTime >= tBreakStart && currentTime < tBreakEnd) {
        segmentStart = tBreakStart;
        segmentEnd = tBreakEnd;
    } else {
        segmentStart = tBreakEnd;
        segmentEnd = tEnd;
    }

    const totalSegmentDuration = segmentEnd - segmentStart;
    const elapsedInSegment = currentTime - segmentStart;
    const progressPercent = Math.max(0, Math.min(100, (elapsedInSegment / totalSegmentDuration) * 100));

    if (DOM_ELEMENTS.timelineProgress) {
        DOM_ELEMENTS.timelineProgress.style.width = `${progressPercent}%`;
    }

    if (DOM_ELEMENTS.currentTimeIndicator) {
        DOM_ELEMENTS.currentTimeIndicator.style.left = `${progressPercent}%`;
        const timeTag = DOM_ELEMENTS.currentTimeIndicator.querySelector('.current-time-tag');
        if (timeTag) {
            timeTag.textContent = formatTime(currentTime);
        }
    }
}

/**
 * Lightweight timer update for big break
 */
function updateBigBreakTimer(nextLesson, currentTime) {
    if (!nextLesson) return;

    const nextStart = timeToMinutes(nextLesson.start);
    const diff = nextStart - currentTime;

    if (DOM_ELEMENTS.dashTimer) {
        DOM_ELEMENTS.dashTimer.textContent = getMinutesOnly(diff);
    }
}

/**
 * Update hero card (separated for clarity)
 */
function updateHeroCard(currentTime) {
    const heroTimer = document.getElementById('hero-timer-label');
    const heroRing = document.getElementById('hero-progress-ring');

    if (!heroTimer || !heroRing) return;

    const state = getCurrentState(currentTime);

    if (state && state.type === 'lesson') {
        const now = new Date();
        const [sh, sm] = state.lesson.start.split(':');
        const startD = new Date(); startD.setHours(sh, sm, 0, 0);
        const [eh, em] = state.lesson.end.split(':');
        const endD = new Date(); endD.setHours(eh, em, 0, 0);

        const totalMs = endD - startD;
        const elapsedMs = now - startD;
        const percent = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
        const minutesLeft = Math.ceil((endD - now) / 60000);

        heroTimer.textContent = `${minutesLeft}хв`;
        const circumference = 163.36;
        const offset = circumference - (percent / 100) * circumference;
        heroRing.style.strokeDashoffset = offset;
        heroRing.style.stroke = ACTIVE_THEME_HEX;
    } else {
        heroTimer.textContent = "--";
        heroRing.style.strokeDashoffset = 163.36;
    }
}

function initDOMElements() {
    const notificationsView = document.getElementById('notifications-view');
    const dashboardView = document.getElementById('dashboard-view');

    // Застосовуємо тему до кнопок та статичних текстів
    applyStaticTheme();

    if (notificationsView || dashboardView) {
        // Notification View Elements
        DOM_ELEMENTS.statusText = document.getElementById('schedule-status') || document.querySelector('.text-brand-cyan');
        if (!DOM_ELEMENTS.statusText) {
            const headerNow = document.querySelector('h1.text-3xl');
            if (headerNow) DOM_ELEMENTS.statusText = headerNow.nextElementSibling;
        }

        DOM_ELEMENTS.activeDot = document.getElementById('active-dot');
        DOM_ELEMENTS.activeStatusLabel = document.getElementById('active-status-label');

        DOM_ELEMENTS.activeCard = document.querySelector('.bell-card-active');
        DOM_ELEMENTS.activeCardTitle = document.getElementById('active-lesson-id');
        DOM_ELEMENTS.activeCardTimes = document.getElementById('active-lesson-start');
        DOM_ELEMENTS.activeCardEnd = document.getElementById('active-lesson-end');
        DOM_ELEMENTS.timeLeftVal = document.getElementById('active-timer-val');
        DOM_ELEMENTS.timeLeftLabel = document.getElementById('active-status-label');

        DOM_ELEMENTS.timelineProgress = document.querySelector('.timeline-progress');
        DOM_ELEMENTS.currentTimeIndicator = document.querySelector('.current-time-indicator');
        DOM_ELEMENTS.upcomingList = document.querySelector('.flex.flex-col.gap-3');
        DOM_ELEMENTS.tlStartTime = document.getElementById('tl-start-time');
        DOM_ELEMENTS.tlEndTime = document.getElementById('tl-end-time');

        DOM_ELEMENTS.bigBreakCard = document.getElementById('big-break-card');
        DOM_ELEMENTS.nextLessonTitle = document.getElementById('next-lesson-title');
        DOM_ELEMENTS.nextLessonTime = document.getElementById('next-lesson-time');

        // Dashboard View Elements
        DOM_ELEMENTS.dashTimer = document.getElementById('dash-timer-val');
        DOM_ELEMENTS.dashNum = document.getElementById('dash-lesson-num');
        DOM_ELEMENTS.dashRange = document.getElementById('dash-time-range');
        DOM_ELEMENTS.dashDesc = document.getElementById('dash-desc-label');
        DOM_ELEMENTS.dashLabel = document.getElementById('dash-status-label');
    }

    return true;
}

// ==================== ЗАПУСК ====================

// ==================== ЗАПУСК ТА REACTIVE THEME ====================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Ініціалізація елементів
    initDOMElements();

    // 2. Первинний запуск
    updateTimeAndSchedule();

    // 3. Запуск таймера (оновлення кожні 10 секунд для зниження навантаження)
    setInterval(updateTimeAndSchedule, 10000); // 10 seconds instead of 1

    console.log(`Bells Scheduler ініціалізовано. Колір теми: ${ACTIVE_THEME_HEX}`);

    // --- REACTIVE THEME UPDATE (Логіка як у meteo.js) ---
    window.addEventListener('themeChanged', (e) => {
        // Отримуємо новий колір з події (або дефолтний)
        const newThemeColor = e.detail && e.detail.themeColor ? e.detail.themeColor : '#00f2ea';

        console.log(`Theme changed event received: ${newThemeColor}`);

        // 1. Оновлюємо глобальну змінну, яку використовують всі функції рендерингу
        ACTIVE_THEME_HEX = newThemeColor;

        // 2. Оновлюємо статичні елементи та CSS-ін'єкції
        // (ця функція вже написана у вас вище, вона оновить clockBtn, styles, і т.д.)
        if (typeof applyStaticTheme === 'function') {
            applyStaticTheme();
        }

        // 3. Примусово оновлюємо розклад, щоб перефарбувати активні картки/прогрес-бари
        updateTimeAndSchedule();

        // 4. Якщо модальне вікно відкрите, його теж треба оновити
        const modal = document.getElementById('all-pairs-modal');
        if (modal && modal.classList.contains('active')) {
            // Перемальовуємо вміст модалки з новим кольором
            createAndShowAllPairsModal();
            // Повертаємо клас active, бо createAndShow може скинути стан (залежить від реалізації)
            // Але у вашому коді createAndShow створює заново HTML, тому це безпечно.
            // Щоб уникнути мерехтіння закриття/відкриття, можна просто оновити стилі карток всередині,
            // але повний перерендер найпростіший:
            const newModal = document.getElementById('all-pairs-modal');
            if (newModal) newModal.classList.add('active');
        }
    });
});