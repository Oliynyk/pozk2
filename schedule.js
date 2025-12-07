// ==========================================
// SCHEDULE.JS - FINAL (Dynamic Colors)
// ==========================================

const UI = {
    daysShort: ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
};

let scheduleState = {
    data: {},
    dates: [],
    selected: null,
    timerId: null
};

// --- Ініціалізація ---
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('schedule-view')) renderSchedule();
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && document.getElementById('schedule-view')) {
        checkDataFreshness();
        updateHeaderToday();
        updateDashboardWidget()
    }
});

// --- Картка "Минулих пар" (Toggle logic) ---
window.toggleCard = function (element) {
    const isActive = element.classList.contains('active');
    const container = document.getElementById('cardsContainer');
    Array.from(container.children).forEach(c => c.classList.remove('active'));

    if (!isActive) {
        element.classList.add('active');
        if (navigator.vibrate) navigator.vibrate(5);
        element.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
};

// --- Головна функція ---
window.renderSchedule = function () {
    checkDataFreshness();

    const rawData = localStorage.getItem('scheduleDataState');
    const parsed = rawData ? JSON.parse(rawData) : { data: [] };
    const rawArray = Array.isArray(parsed) ? parsed : (parsed.data || []);

    // 0. Адаптер
    const lessonsArray = rawArray.map(item => {
        if (item.date && item.date.includes('-')) return item;
        let isoDate = item.full_date;
        if (item.full_date && item.full_date.includes('.')) {
            const parts = item.full_date.split('.');
            isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return {
            date: isoDate,
            beginTime: item.study_time_begin || item.beginTime,
            endTime: item.study_time_end || item.endTime,
            subject: item.discipline || item.subject,
            type: item.study_type || item.type,
            teacher: item.employee_short || item.teacher,
            classroom: item.cabinet || item.classroom,
            group: item.contingent || item.group
        };
    });

    // 1. Групування
    const activeLessonDates = new Set();
    scheduleState.data = lessonsArray.reduce((acc, item) => {
        if (!item.date) return acc;
        activeLessonDates.add(item.date);
        if (!acc[item.date]) acc[item.date] = [];
        acc[item.date].push(item);
        return acc;
    }, {});

    // 2. Активна дата
    if (!scheduleState.selected) {
        const todayKey = new Date().toISOString().split('T')[0];
        if (scheduleState.data[todayKey]) {
            scheduleState.selected = todayKey;
        } else {
            const keys = Object.keys(scheduleState.data).sort();
            scheduleState.selected = keys.length > 0 ? keys[0] : todayKey;
        }
    }

    // 3. Генеруємо вкладки (Пн-Нд)
    const targetDate = new Date(scheduleState.selected);
    const dayOfWeek = targetDate.getDay();
    const europeanDay = dayOfWeek === 0 ? 7 : dayOfWeek;
    const diff = europeanDay - 1;
    const monday = new Date(targetDate);
    monday.setDate(targetDate.getDate() - diff);

    scheduleState.dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const dayIndex = d.getDay();

        if (dayIndex >= 1 && dayIndex <= 5) {
            scheduleState.dates.push(dateStr);
        } else if (activeLessonDates.has(dateStr)) {
            scheduleState.dates.push(dateStr);
        }

        if (dateStr === scheduleState.selected && !scheduleState.dates.includes(dateStr)) {
            scheduleState.dates.push(dateStr);
        }
    }
    scheduleState.dates.sort();

    // 4. Малюємо все
    drawAll();
    updateHeaderToday();
    startDateClock();
    updateDashboardWidget()
};

// ==========================================
// 1. Оновлена функція drawAll
// ==========================================

function drawAll() {
    const container = document.getElementById('schedule-view');
    if (!container || !scheduleState.selected) return;
    const theme = getTheme();

    // --- A. Вкладки ---
    const pillsContainer = container.querySelector('.overflow-x-auto .flex');
    if (pillsContainer) {
        pillsContainer.innerHTML = scheduleState.dates.map(dateStr => {
            const d = new Date(dateStr);
            const shortName = UI.daysShort[d.getDay()];
            const dayNum = d.getDate();
            const isActive = dateStr === scheduleState.selected;

            const activeStyle = isActive
                ? `background-color: ${hexToRgba(theme, 0.2)}; color: ${theme}; border-color: ${theme};`
                : '';

            return `<button onclick="selectDate('${dateStr}')" class="date-pill ${isActive ? 'active' : ''}" style="${activeStyle}">${shortName} ${dayNum}</button>`;
        }).join('');

        setTimeout(() => {
            const activeBtn = pillsContainer.querySelector('.active');
            if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }, 50);
    }

    // --- B. Розподіл пар ---
    const contentStack = container.querySelector('.px-5.pb-20.flex.flex-col.gap-8');

    if (contentStack) {
        const rawLessons = scheduleState.data[scheduleState.selected] || [];
        const groupedLessons = groupLessonsByTime(rawLessons);

        let pastGroups = [];
        let activeGroup = null;
        let futureGroups = [];

        const todayStr = new Date().toISOString().split('T')[0];

        // Логіка сортування (Минулі / Активні / Майбутні)
        if (scheduleState.selected < todayStr) {
            pastGroups = [...groupedLessons];
        } else if (scheduleState.selected > todayStr) {
            futureGroups = [...groupedLessons];
        } else {
            groupedLessons.forEach(group => {
                const first = group.items[0];
                if (isLessonHappeningNow(first)) {
                    activeGroup = group;
                } else if (isLessonPast(first)) {
                    pastGroups.push(group);
                } else {
                    futureGroups.push(group);
                }
            });
        }

        let html = '';

        // 1. АКТИВНА ПАРА або ВЕЛИКА ПЕРЕРВА
        if (activeGroup) {
            // Якщо йде пара -> Hero Card
            html += renderHeroCard(activeGroup);
        } else if (scheduleState.selected === todayStr && futureGroups.length > 0) {
            // Якщо сьогодні, пари немає, але є майбутні -> Break Card
            html += renderBreakCard(futureGroups[0]);
        }

        // 2. ЗАВЕРШЕНІ
        if (pastGroups.length > 0) {
            html += `
            <div>
                <div class="flex items-center justify-between mb-3 pl-1">
                    <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest">Завершені пари</h3>
                </div>
                <div class="flex items-center gap-3 overflow-x-auto px-1 pb-4 no-scrollbar" id="cardsContainer" style="scrollbar-width: none;">
                    ${pastGroups.map(group => renderPastCard(group)).join('')}
                </div>
            </div>`;
        }

        // 3. МАЙБУТНІ
        // Заголовок змінюється залежно від контексту
        const listTitle = (activeGroup || (scheduleState.selected === todayStr && futureGroups.length > 0) || pastGroups.length > 0)
            ? "Далі сьогодні"
            : "Розклад занять";

        html += `
        <div>
            <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 pl-1">${listTitle}</h3>
            <div class="flex flex-col gap-3">`;

        if (futureGroups.length === 0 && !activeGroup && pastGroups.length === 0) {
            html += `
            <div class="flex flex-col items-center justify-center py-10 opacity-70">
                <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
                    <i class="fa-solid fa-mug-hot text-2xl text-gray-400"></i>
                </div>
                <p class="text-gray-400 text-sm font-medium">Сьогодні пар немає</p>
                <p class="text-gray-600 text-xs">Відпочивайте</p>
            </div>`;
        } else {
            futureGroups.forEach(group => {
                html += renderFutureCard(group);
            });

            if (rawLessons.length > 0) {
                const lastTime = groupedLessons[groupedLessons.length - 1].items[0].endTime;
                html += `
                <div class="ticket-card grayscale opacity-70 mt-2">
                    <div class="ticket-left">
                        <span class="tag-minimal">Кінець</span>
                        <span class="text-xl font-bold text-white font-display">${lastTime}</span>
                    </div>
                    <div class="ticket-right items-center text-center justify-center">
                        <div class="flex flex-col items-center">
                            <i class="fa-solid fa-check-circle text-gray-500 mb-1"></i>
                            <span class="text-xs font-bold uppercase tracking-widest text-gray-500">На сьогодні все</span>
                        </div>
                    </div>
                </div>`;
            }
        }

        html += `</div></div>`;
        contentStack.innerHTML = html;
    }
}

// ==========================================
// RENDER BREAK CARD (STATIC AMBER THEME)
// ==========================================

function renderBreakCard(nextGroup) {
    const nextLesson = nextGroup.items[0];

    // Використовуємо фіксовані кольори замість theme
    const amberColor = '#f59e0b'; // Amber (для іконки та тексту)
    const amberGlow = 'rgba(245, 158, 11, 0.2)'; // Прозорий amber для світіння

    return `
    <div class="animate-fade-in big-break-card p-8 mb-8 w-full text-center flex flex-col items-center justify-center min-h-[300px]" id="big-break-card">
        <div class="mb-6 relative">
            <div class="absolute inset-0 blur-xl rounded-full animate-pulse-slow" style="background-color: ${amberGlow}"></div>
            <i class="fa-solid fa-mug-hot text-6xl animate-float relative z-10" style="color: ${amberColor}"></i>
            <div class="absolute -top-4 -right-4 text-2xl animate-bounce">✨</div>
        </div>

        <h2 class="text-3xl font-display font-bold text-white mb-2 tracking-wide">Перерва</h2>
        <p class="text-sm font-medium uppercase tracking-widest mb-8" style="color: ${amberColor}; opacity: 0.8;">Час відпочити</p>

        <div class="bg-black/20 rounded-2xl p-4 w-full border border-white/5 backdrop-blur-sm">
            <p class="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Наступна пара</p>
            <h3 class="text-xl font-bold text-white mb-1 leading-tight">${nextLesson.subject}</h3>
            <p class="font-mono text-lg" style="color: ${amberColor}">${nextLesson.beginTime}</p>
        </div>

        <div class="mt-6 text-xs text-gray-500 italic">
            "Зроби каву, перезавантажся."
        </div>
    </div>`;
}

window.selectDate = function (dateStr) {
    scheduleState.selected = dateStr;
    renderSchedule();
};

// ==========================================
// RENDER TEMPLATES (DYNAMIC THEME)
// ==========================================

function groupLessonsByTime(lessons) {
    lessons.sort((a, b) => (a.beginTime || '').localeCompare(b.beginTime || ''));
    const groups = [];
    lessons.forEach(lesson => {
        const existing = groups.find(g => g.time === lesson.beginTime);
        if (existing) { existing.items.push(lesson); }
        else { groups.push({ time: lesson.beginTime, items: [lesson] }); }
    });
    return groups;
}

// --- FUTURE CARD ---
function renderFutureCard(group) {
    const items = group.items;
    const first = items[0];
    const isSplit = items.length > 1;
    const theme = getTheme();

    let rightSideContent = '';

    if (isSplit) {
        rightSideContent = `
            <div class="flex justify-between items-start mb-2">
                <h4 class="text-lg font-bold text-white leading-tight">${first.subject}</h4>
                <span class="text-[10px] border border-white/20 text-gray-400 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">${getShortType(first.type)}</span>
            </div>
            <div class="flex flex-col gap-2">
                ${items.map((item, idx) => `
                    <div class="relative flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5 overflow-hidden">
                        <div class="absolute left-0 top-0 bottom-0 w-1" style="background-color: ${idx === 0 ? hexToRgba(theme, 0.7) : '#a855f7'}"></div>
                        
                        <div class="flex items-center gap-2 pl-2">
                            <span class="text-[9px] font-bold text-white/80 uppercase px-1.5 rounded-sm" style="background-color: ${hexToRgba(theme, 0.2)}; color: ${theme}">${getGroupBadge(item.group)}</span>
                            <span class="text-xs text-gray-300 font-medium truncate max-w-[100px]">${item.teacher}</span>
                        </div>
                        <span class="text-xs text-gray-400 font-mono bg-black/20 px-1.5 rounded">${cleanClassroom(item.classroom)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        const cleanGroup = (first.group || '').replace('Група: ', '');
        rightSideContent = `
            <div class="flex justify-between items-start mb-1">
                <h4 class="text-lg font-bold text-white leading-tight">${first.subject}</h4>
                <span class="text-[10px] border border-white/20 text-gray-400 px-1.5 py-0.5 rounded whitespace-nowrap">${getShortType(first.type)}</span>
            </div>
            <div class="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                <i class="fa-solid fa-location-dot text-[10px]" style="color: ${theme}"></i>
                <span>${cleanClassroom(first.classroom)}</span>
                <span class="text-white/10">•</span>
                <span>${cleanGroup}</span>
            </div>
            <div class="mt-auto flex items-center gap-2 border-t border-white/5 pt-2">
                <div class="w-5 h-5 rounded-full bg-gray-700 overflow-hidden ring-1 ring-white/10">
                    <img src="https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(first.teacher.split(' ').slice(0, 2).join(' '))}" class="w-full h-full object-cover">
                </div>
                <span class="text-xs text-gray-400 font-medium">${first.teacher}</span>
            </div>
        `;
    }

    return `
    <div class="ticket-card">
        <div class="ticket-left">
            <span class="tag-minimal">Початок</span>
            <span class="text-xl font-bold text-white font-display">${first.beginTime}</span>
            <span class="text-[10px] text-gray-500 font-mono mt-1">${first.endTime}</span>
        </div>
        <div class="ticket-right">
            ${rightSideContent}
        </div>
    </div>`;
}

// --- HERO CARD ---
function renderHeroCard(group) {
    const items = group.items;
    const first = items[0];
    const isSplit = items.length > 1;
    const theme = getTheme();

    const progress = getProgress(first);
    const circumference = 163.36;
    const offset = circumference - (progress.percent / 100) * circumference;

    let detailsHtml = '';

    if (isSplit) {
        // Дизайн підгруп для HERO
        detailsHtml = `
            <h2 class="text-2xl font-display font-bold text-white leading-tight mb-4 mt-2">${first.subject}</h2>
            <div class="flex flex-col gap-2.5 clear-both">
                ${items.map((item, idx) => `
                    <div class="group relative flex items-center justify-between bg-white/10 p-2.5 rounded-xl border border-white/10 hover:bg-white/15 transition-colors">
                        <div class="absolute left-0 top-2 bottom-2 w-1 rounded-r-full" style="background-color: ${idx === 0 ? theme : '#c084fc'}"></div>
                        
                        <div class="flex items-center gap-3 pl-3">
                            <span class="text-[10px] font-bold text-black px-1.5 py-0.5 rounded-md shadow-sm" style="background-color: ${idx === 0 ? theme : '#c084fc'}">
                                ${getGroupBadge(item.group)}
                            </span>
                            <div class="flex flex-col">
                                <span class="text-sm text-white font-semibold leading-none mb-0.5">${item.teacher}</span>
                                <span class="text-[10px] text-gray-400">Викладач</span>
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded-lg">
                            <span class="text-xs font-mono text-white">${cleanClassroom(item.classroom)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        // Стандартний HERO
        const cleanGroup = (first.group || '').replace('Група: ', '');
        detailsHtml = `
            <h2 class="text-3xl font-display font-bold text-white leading-none mb-2 mt-2">${first.subject}</h2>
            <p class="text-sm text-gray-400 font-light mb-4">${cleanClassroom(first.classroom)}<span class="text-white/40 px-1">•</span>${cleanGroup}</p>
            
            <div class="mt-4 pt-4 border-t border-white/10 flex items-center gap-3 clear-both">
                <img src="https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(first.teacher.split(' ').slice(0, 2).join(' '))}" class="w-10 h-10 rounded-full border-2 shadow-lg" style="border-color: ${hexToRgba(theme, 0.3)}">
                <div>
                    <p class="text-xs text-gray-500 uppercase tracking-wider font-bold">Викладач</p>
                    <p class="text-sm text-white font-medium">${first.teacher}</p>
                </div>
                <button class="ml-auto w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white transition-colors hover:text-black"
                    onmouseover="this.style.backgroundColor='${theme}'"
                    onmouseout="this.style.backgroundColor='rgba(255,255,255,0.1)'">
                    <i class="fa-solid fa-arrow-right -rotate-45"></i>
                </button>
            </div>
        `;
    }

    return `
    <div class="animate-fade-in">
        <div class="flex justify-between items-end mb-3">
            <span class="text-xs font-bold uppercase tracking-widest animate-pulse flex items-center gap-1" style="color: ${theme}">Зараз триває</span>
            <span class="text-xs text-white/50 font-mono">${first.beginTime} - ${first.endTime}</span>
        </div>
        <div class="now-hero-card clearfix">
            <div class="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl pointer-events-none" style="background-color: ${hexToRgba(theme, 0.1)}"></div>
            
            <div class="relative z-10">
                <div class="progress-ring-container float-right ml-4 mb-2 relative">
                    <svg class="progress-ring" width="60" height="60">
                        <circle class="text-white/10" stroke="currentColor" stroke-width="4" fill="transparent" r="26" cx="30" cy="30" />
                        <circle class="progress-ring-circle" stroke="${theme}" stroke-width="4" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round" fill="transparent" r="26" cx="30" cy="30" style="transition: stroke-dashoffset 1s linear;" />
                    </svg>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <span class="text-xs font-bold text-white font-mono">${progress.minutesLeft}хв</span>
                    </div>
                </div>

                <div class="inline-block border px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider mb-1"
                     style="background-color: ${hexToRgba(theme, 0.2)}; color: ${theme}; border-color: ${hexToRgba(theme, 0.2)}; box-shadow: 0 0 10px ${hexToRgba(theme, 0.1)}">
                    ${getFullType(first.type)}
                </div>

                ${detailsHtml}
            </div>
        </div>
    </div>`;
}

// --- PAST CARD ---
function renderPastCard(group) {
    const items = group.items;
    const first = items[0];
    const isSplit = items.length > 1;
    const theme = getTheme();

    let infoContent;
    if (isSplit) {
        infoContent = `
            <div class="flex items-center gap-2 mt-1">
                <span class="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded" style="background-color: ${hexToRgba(theme, 0.1)}; color: ${theme}">${getShortType(first.type)}</span>
                <span class="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">2 підгрупи</span>
            </div>
        `;
    } else {
        infoContent = `
            <div class="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                <span class="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded" style="background-color: ${hexToRgba(theme, 0.1)}; color: ${theme}">${getShortType(first.type)}</span>
                <span class="truncate">${cleanClassroom(first.classroom)}</span>
                <span class="text-white/40">•</span>
                <span class="truncate">${first.teacher}</span>
            </div>
        `;
    }

    return `
    <div onclick="toggleCard(this)" class="group relative flex h-16 w-16 flex-none cursor-pointer overflow-hidden rounded-2xl border border-white/5 bg-white/5 transition-all duration-300 ease-out active:scale-95 [&.active]:w-[82%] [&.active]:shadow-lg">
        <div class="flex w-16 min-w-[4rem] flex-col items-center justify-center border-r border-transparent transition-colors group-[.active]:border-white/5 bg-black/20 group-[.active]:bg-transparent">
            <span class="font-display text-sm font-bold text-gray-300 group-[.active]:text-gray-200">${first.beginTime}</span>
            <span class="font-mono text-[10px] text-gray-400 group-[.active]:text-gray-300">${first.endTime}</span>
        </div>
        <div class="flex min-w-[14rem] flex-col justify-center px-4 opacity-0 transition-opacity duration-300 group-[.active]:opacity-100">
            <div class="flex items-center justify-between mb-0.5">
                <span class="truncate font-sans text-sm font-semibold text-white leading-tight">${first.subject}</span>
            </div>
            ${infoContent}
        </div>
    </div>`;
}

// --- Helpers ---

function getGroupBadge(str) {
    if (!str) return "";
    if (str.includes("1")) return "Гр. 1";
    if (str.includes("2")) return "Гр. 2";
    return "Гр.";
}

function cleanClassroom(str) {
    if (!str) return "Online";
    let cleaned = str.replace(/_/g, '').trim();
    const replacements = [
        { full: /Кабінет/gi, short: "Каб." },
        { full: /Аудиторія/gi, short: "Ауд." },
        { full: /Лабораторія/gi, short: "Лаб." },
        { full: /Читальна зала/gi, short: "Чит. зал" },
        { full: /фахових/gi, short: "фах." },
        { full: /практик/gi, short: "практ." },
        { full: /методики/gi, short: "метод." },
        { full: /технологій/gi, short: "техн." },
        { full: /комп['’]ютерний/gi, short: "комп." },
        { full: /інформатики/gi, short: "інф." },
        { full: /української/gi, short: "укр." },
        { full: /іноземних/gi, short: "іноз." }
    ];
    replacements.forEach(rep => { cleaned = cleaned.replace(rep.full, rep.short); });
    return cleaned;
}

function getFullType(type) {
    if (!type) return "Пара";
    if (type.includes("Лекц")) return "Лекція";
    if (type.includes("Практ")) return "Практика";
    if (type.includes("Лаб")) return "Лабораторна";
    if (type.includes("Сем")) return "Семінар";
    if (type.includes("Екз")) return "Екзамен";
    if (type.includes("Конс")) return "Консультація";
    return type;
}

function getShortType(type) {
    if (!type) return "Пара";
    if (type.includes("Лекц")) return "Лек";
    if (type.includes("Практ")) return "Прак";
    if (type.includes("Лаб")) return "Лаб";
    if (type.includes("Сем")) return "Сем";
    if (type.includes("Екз")) return "Екз";
    if (type.includes("Конс")) return "Конс";
    return type.substring(0, 4);
}

function isLessonHappeningNow(lesson) {
    if (!lesson.beginTime || !lesson.endTime) return false;
    const now = new Date();
    const [startH, startM] = lesson.beginTime.split(':');
    const start = new Date(); start.setHours(startH, startM, 0);
    const [endH, endM] = lesson.endTime.split(':');
    const end = new Date(); end.setHours(endH, endM, 0);
    return now >= start && now <= end;
}

function isLessonPast(lesson) {
    const todayStr = new Date().toISOString().split('T')[0];
    if (lesson.date < todayStr) return true;
    if (lesson.date > todayStr) return false;
    if (!lesson.endTime) return false;
    const now = new Date();
    const [h, m] = lesson.endTime.split(':');
    const lessonEnd = new Date();
    lessonEnd.setHours(h, m, 0);
    return now > lessonEnd;
}

function getProgress(lesson) {
    const now = new Date();
    const [startH, startM] = lesson.beginTime.split(':');
    const start = new Date(); start.setHours(startH, startM, 0);
    const [endH, endM] = lesson.endTime.split(':');
    const end = new Date(); end.setHours(endH, endM, 0);
    const totalMs = end - start;
    const elapsedMs = now - start;
    const percent = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
    const minutesLeft = Math.ceil((end - now) / 60000);
    return { percent, minutesLeft };
}

async function checkDataFreshness() {
    const rawData = localStorage.getItem('scheduleDataState');
    if (!rawData) return;
    try {
        const state = JSON.parse(rawData);
        if ((Date.now() - (state.lastUpdated || 0)) > 86400000) {
            if (window.fetchWeekSchedule) {
                await window.fetchWeekSchedule(new Date());
                updateHeaderToday();
            }
        }
    } catch (e) { console.error(e); }
}

function updateHeaderToday() {
    const container = document.getElementById('schedule-view');
    if (!container) return;

    // 1. Оновлення тексту дати
    const h2 = container.querySelector('h2');
    if (h2) {
        const today = new Date();
        const dName = today.toLocaleDateString('uk-UA', { weekday: 'long' });
        const dNum = today.getDate();
        h2.innerText = `${dName.charAt(0).toUpperCase() + dName.slice(1)}, ${dNum}`;
    }

    // 2. Оновлення кольорів кнопок (Виправлена логіка)
    const theme = getTheme(); // Отримуємо колір один раз

    // Список ID кнопок, які треба пофарбувати
    // Список ID кнопок, які треба пофарбувати
    const buttonsToColor = ['calendar-btn', 'clock-btn'];
    buttonsToColor.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            // Прибираємо старі класи (якщо є)
            btn.classList.remove('bg-brand-cyan/20', 'text-brand-cyan');

            // Встановлюємо нові кольори
            btn.style.backgroundColor = hexToRgba(theme, 0.2);
            btn.style.color = theme;
        }
    });


}

function startDateClock() {
    if (scheduleState.timerId) clearInterval(scheduleState.timerId);
    scheduleState.timerId = setInterval(() => {
        updateHeaderToday();
        renderSchedule();
        updateDashboardWidget()
    }, 60000);
}

// === Theme Helpers ===
// Функції getTheme() та hexToRgba() винесені у utils.js
// Для сумісності залишаємо алієси:
const getTheme = getThemeColor;


function applyBellsTheme() {
    const theme = getTheme(); // Ваша функція з schedule.js

    // 1. Кнопка "Годинник" у хедері
    const clockBtn = document.getElementById('clock-btn');
    if (clockBtn) {
        clockBtn.style.backgroundColor = hexToRgba(theme, 0.2);
        clockBtn.style.color = theme;
    }

    // 2. Текст статусу в хедері ("Триває I пара")
    const statusHeader = document.getElementById('status-header-text');
    if (statusHeader) {
        statusHeader.style.color = theme;
    }

    // 3. Елементи Активної Картки (Тільки якщо картка активна)

    // Глоу-ефект (фонове світіння)
    const activeGlow = document.getElementById('active-glow');
    if (activeGlow) {
        activeGlow.style.backgroundColor = hexToRgba(theme, 0.15);
    }

    // Активна крапка (біля таймера)
    const activeDot = document.getElementById('active-dot');
    if (activeDot) {
        activeDot.style.backgroundColor = theme;
        activeDot.style.boxShadow = `0 0 10px ${theme}`;
    }

    // Текстовий лейбл статусу
    const activeLabel = document.getElementById('active-status-label');
    if (activeLabel) {
        activeLabel.style.color = theme;
    }

    // Прогрес-бар (Timeline)
    const progressBar = document.getElementById('timeline-progress');
    if (progressBar) {
        progressBar.style.backgroundColor = theme;
        progressBar.style.boxShadow = `0 0 10px ${hexToRgba(theme, 0.5)}`;
    }

    // Наступна пара у блоці "Велика перерва" (якщо він видимий)
    const nextLessonTime = document.getElementById('next-lesson-time');
    if (nextLessonTime) {
        nextLessonTime.style.color = theme;
    }
}

// Викликайте цю функцію при завантаженні сторінки або рендері даних
// Наприклад:
// document.addEventListener('DOMContentLoaded', applyBellsTheme);

// ==========================================
// DASHBOARD WIDGET LOGIC (NEW & FIXED)
// ==========================================

function updateDashboardWidget() {
    const els = {
        statusText: document.getElementById('dash-status-text'),
        statusDot: document.getElementById('dash-status-dot'),
        statusPing: document.getElementById('dash-status-ping'),
        timeRange: document.getElementById('dash-time-range'),
        subject: document.getElementById('dash-subject'),
        location: document.getElementById('dash-location'),
        nextTime: document.getElementById('dash-next-time'),
        nextSubject: document.getElementById('dash-next-subject'),
        nextContainer: document.getElementById('dash-next-container'),
        bgGlow: document.getElementById('dash-bg-glow')
    };

    if (!els.subject) return;

    // Отримуємо тему (колір)
    const theme = getTheme();

    // Беремо дані на СЬОГОДНІ
    const todayStr = new Date().toISOString().split('T')[0];
    const rawLessons = scheduleState.data[todayStr] || [];

    if (rawLessons.length === 0) {
        setWidgetState(els, 'empty', theme);
        return;
    }

    const groupedLessons = groupLessonsByTime(rawLessons);
    let activeGroup = null;
    let nextGroup = null;

    // Шукаємо активну пару
    for (let i = 0; i < groupedLessons.length; i++) {
        const group = groupedLessons[i];
        const first = group.items[0];

        if (isLessonHappeningNow(first)) {
            activeGroup = group;
            nextGroup = groupedLessons[i + 1] || null;
            break;
        }
    }

    // Якщо активної немає, шукаємо найближчу майбутню
    if (!activeGroup) {
        const now = new Date();
        const nowTime = now.getHours() * 60 + now.getMinutes();

        nextGroup = groupedLessons.find(g => {
            const [h, m] = g.items[0].beginTime.split(':');
            return (h * 60 + +m) > nowTime;
        });
    }

    // Рендер стану
    if (activeGroup) {
        // --- ЗАРАЗ ЙДЕ ПАРА ---
        const lesson = activeGroup.items[0];
        const cleanGroup = (lesson.group || '').replace('Група: ', '');

        setWidgetTheme(els, 'active', theme);
        els.statusText.textContent = "Зараз триває";
        els.timeRange.textContent = `${lesson.beginTime} - ${lesson.endTime}`;
        els.subject.textContent = lesson.subject;
        els.location.innerHTML = `<i class="fa-solid fa-location-dot mr-1"></i> ${cleanClassroom(lesson.classroom)} • ${cleanGroup}`;

        updateNextWidget(els, nextGroup);

    } else if (nextGroup) {
        // --- ПЕРЕРВА (або до пар) ---
        const lesson = nextGroup.items[0];
        setWidgetTheme(els, 'pending', theme); // Жовтий або secondary колір
        els.statusText.textContent = "Далі за розкладом";
        els.timeRange.textContent = `Початок о ${lesson.beginTime}`;
        els.subject.textContent = lesson.subject;
        els.location.innerHTML = `<i class="fa-solid fa-clock mr-1"></i> ${cleanClassroom(lesson.classroom)}`;

        // Знаходимо наступну ПІСЛЯ цієї
        const idx = groupedLessons.indexOf(nextGroup);
        const afterNext = groupedLessons[idx + 1];
        updateNextWidget(els, afterNext);

    } else {
        // --- ПАРИ ЗАВЕРШЕНО ---
        setWidgetState(els, 'finished', theme);
    }
}

function updateNextWidget(els, nextGroup) {
    if (nextGroup) {
        const nextL = nextGroup.items[0];
        els.nextContainer.style.display = 'flex';
        els.nextTime.textContent = `Далі (${nextL.beginTime})`;
        els.nextSubject.textContent = nextL.subject;
    } else {
        els.nextContainer.style.display = 'flex';
        els.nextTime.textContent = "Далі";
        els.nextSubject.textContent = "Кінець пар";
    }
}

function setWidgetTheme(els, state, themeColor) {
    // state: 'active' | 'pending'

    // Активний стан - використовуємо колір теми
    if (state === 'active') {
        els.statusDot.className = `relative inline-flex rounded-full h-2 w-2 transition-colors duration-500`;
        els.statusDot.style.backgroundColor = themeColor;

        els.statusPing.className = `animate-ping absolute inline-flex h-full w-full rounded-full opacity-75`;
        els.statusPing.style.backgroundColor = themeColor;

        els.statusText.className = `text-xs font-medium uppercase tracking-wider transition-colors duration-500`;
        els.statusText.style.color = themeColor;

        if (els.bgGlow) {
            els.bgGlow.className = `absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 transition-colors duration-500 opacity-20`;
            els.bgGlow.style.backgroundColor = themeColor;
        }
    }
    // Очікування (жовтий, стандартний)
    else if (state === 'pending') {
        const amberColor = '#eab308'; // Tailwind yellow-500

        els.statusDot.className = `relative inline-flex rounded-full h-2 w-2 transition-colors duration-500 bg-yellow-500`;
        els.statusDot.style.backgroundColor = ''; // Скидаємо інлайн

        els.statusPing.className = `hidden`;

        els.statusText.className = `text-xs font-medium uppercase tracking-wider transition-colors duration-500 text-yellow-500`;
        els.statusText.style.color = '';

        if (els.bgGlow) {
            els.bgGlow.className = `absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 transition-colors duration-500 opacity-20 bg-yellow-500`;
            els.bgGlow.style.backgroundColor = '';
        }
    }
}

function setWidgetState(els, state, themeColor) {
    // Стан "Порожньо" або "Завершено" - сірий
    els.statusDot.className = `relative inline-flex rounded-full h-2 w-2 transition-colors duration-500 bg-gray-500`;
    els.statusDot.style.backgroundColor = '';

    els.statusPing.className = `hidden`;

    els.statusText.className = `text-xs font-medium uppercase tracking-wider transition-colors duration-500 text-gray-500`;
    els.statusText.style.color = '';

    if (els.bgGlow) {
        els.bgGlow.className = `absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 transition-colors duration-500 opacity-5 bg-white`;
        els.bgGlow.style.backgroundColor = '';
    }

    if (state === 'empty') {
        els.statusText.textContent = "Сьогодні вільно";
        els.timeRange.textContent = "";
        els.subject.textContent = "Пар немає";
        els.location.textContent = "Відпочивайте";
        els.nextContainer.style.display = 'none';
    } else if (state === 'finished') {
        els.statusText.textContent = "На сьогодні все";
        els.timeRange.textContent = "";
        els.subject.textContent = "Пари завершено";
        els.location.innerHTML = '<i class="fa-solid fa-check-circle mr-1"></i> Гарного відпочинку';
        els.nextContainer.style.display = 'none';
    }
}