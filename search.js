// ==========================================
// 1. КОНФІГУРАЦІЯ ТА СТАН
// ==========================================
const VUZ_ID = 11571;
const BASE_URL = 'https://vnz.osvita.net/WidgetSchedule.asmx/';

// Мапінг (Розшифровка факультетів)
// Оновлено згідно з офіційними назвами К-ПНУ
const FACULTY_CONFIG = {
    // Фізико-математичний (FK_FIZMAT)
    "Q1W2ZPSPVI3A": {
        title: "Фізико-математичний",
        subtitle: "Physics, Math & CS",
        icon: "fa-laptop-code",
        color: "#0ea5e9"
    },
    // Педагогічний (FK_PE)
    "UZ76XHHD0S93": {
        title: "Педагогічний",
        subtitle: "Primary & Preschool Education",
        icon: "fa-child-reaching",
        color: "#f43f5e"
    },
    // Фізичної культури (FK_FIZKULT)
    "6GQC4YG48ATU": {
        title: "Фізичної культури",
        subtitle: "Physical Culture & Sports",
        icon: "fa-dumbbell",
        color: "#f97316"
    },
    // Корекційної та соц. педагогіки і психології (FK_SOPSR)
    "AAIOTL120WR8": {
        title: "Корекційної та соц. педагогіки",
        subtitle: "Psychology & Social Work",
        icon: "fa-users",
        color: "#d946ef"
    },
    // Української філології та журналістики (FK_UFZH)
    "LT2I40E0HG2R": {
        title: "Укр. філології та журналістики",
        subtitle: "Ukrainian Philology",
        icon: "fa-book-open",
        color: "#eab308"
    },
    // Іноземної філології (FK_INOZFIL)
    "BAAZKY5BSTFE": {
        title: "Іноземної філології",
        subtitle: "Foreign Languages",
        icon: "fa-language",
        color: "#8b5cf6"
    },
    // Історичний (FK_ISTOR)
    "HB1HGVBOVSWP": {
        title: "Історичний",
        subtitle: "History & Archaeology",
        icon: "fa-landmark",
        color: "#78716c"
    },
    // Природничо-економічний (FK_PEDANOH)
    "Y0CC4AHJI0CD": {
        title: "Природничо-економічний",
        subtitle: "Natural Sciences & Economics",
        icon: "fa-flask",
        color: "#22c55e"
    }
};

const appState = {
    faculty: null,
    form: null, // Буде ініціалізовано автоматично
    course: null,
    group: null,
    groupName: null,
    themeColor: null // Буде ініціалізовано через getThemeColor()
};

// ==========================================
// 2. ВІЗУАЛЬНІ HELPER-И
// ==========================================
// Функції hexToRgba та applyActiveStyle винесені в utils.js

// Оновлення кольорів інтерфейсу
function updateThemeColors(color) {
    appState.themeColor = color;

    // 1. Оновлюємо бейджи
    document.querySelectorAll('.step-badge').forEach(badge => {
        badge.style.backgroundColor = hexToRgba(color, 0.15);
        badge.style.color = color;
        badge.style.boxShadow = `0 0 10px ${hexToRgba(color, 0.2)}`;
    });

    // 2. Оновлюємо індикатор "Тип навчання"
    const formIndicator = document.getElementById('form-indicator');
    if (formIndicator) {
        formIndicator.style.backgroundColor = hexToRgba(color, 0.4);
        formIndicator.style.borderColor = color;
        formIndicator.style.boxShadow = `0 0 10px ${hexToRgba(color, 0.2)}`;
    }

    // 3. Оновлюємо кнопку збереження
    const btnSave = document.querySelector('.search-submit-btn');
    if (btnSave && !btnSave.classList.contains('pointer-events-none')) {
        btnSave.style.background = `linear-gradient(to right, ${color}, ${hexToRgba(color, 0.8)})`;
        btnSave.style.boxShadow = `0 0 20px ${hexToRgba(color, 0.4)}`;
    }

    // 4. Перефарбовуємо активний курс та групу
    const activeCourseBtn = document.querySelector('.course-btn.active');
    if (activeCourseBtn) applyActiveStyle(activeCourseBtn, color);

    const activeGroupChip = document.querySelector('.group-chip.active');
    if (activeGroupChip) applyActiveStyle(activeGroupChip, color);
}

// ==========================================
// 3. ТРАНСПОРТ (JSONP)
// ==========================================
function fetchJsonp(method, params) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_logic_' + Math.floor(Math.random() * 100000);
        let orderedKeys = [];

        if (method === 'GetStudyGroups') {
            orderedKeys = ['aVuzID', 'aFacultyID', 'aEducationForm', 'aCourse', 'aGiveStudyTimes'];
        } else if (method === 'GetScheduleDataX') {
            orderedKeys = ['aStudyGroupID', 'aStartDate', 'aEndDate', 'aStudyTypeID', 'aVuzID'];
        } else {
            orderedKeys = Object.keys(params);
        }

        const queryParams = orderedKeys.map(key => {
            const val = params[key];
            const formattedVal = (typeof val === 'string' && val !== 'null') ? encodeURIComponent(`"${val}"`) : val;
            return `${key}=${formattedVal}`;
        });

        queryParams.push(`callback=${callbackName}`);
        queryParams.push(`_=${Date.now()}`);

        const script = document.createElement('script');
        script.src = `${BASE_URL}${method}?${queryParams.join('&')}`;

        window[callbackName] = (data) => {
            resolve(data);
            document.body.removeChild(script);
            delete window[callbackName];
        };
        script.onerror = () => {
            reject();
            document.body.removeChild(script);
            delete window[callbackName];
        };
        document.body.appendChild(script);
    });
}

// ==========================================
// 4. ІНІЦІАЛІЗАЦІЯ ТА РЕНДЕР
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. UI Elements & Date
    const dateEl = document.getElementById('dash-date');
    if (dateEl) dateEl.innerText = new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });

    // --- ВИПРАВЛЕНИЙ БЛОК ---
    // Ми шукаємо елементи безпосередньо за ID. 
    // Якщо ID не знайдено, використовуємо fallback (старий метод), щоб не виникало помилок null.
    const headers = Array.from(document.querySelectorAll('h3'));

    window.ui = {
        // Шукаємо ID 'faculty-container', якщо ні - шукаємо H3 з текстом "Факультет"
        faculty: document.getElementById('faculty-container') || headers.find(h => h.innerText.includes('Факультет'))?.nextElementSibling,

        formIndicator: document.getElementById('form-indicator'),

        // Шукаємо ID 'course-container', якщо ні - шукаємо H3 з текстом "Курс"
        course: document.getElementById('course-container') || headers.find(h => h.innerText.includes('Курс'))?.nextElementSibling,

        // Шукаємо ID 'group-container', якщо ні - шукаємо H3 з текстом "Група" або "Проєктна Група"
        group: document.getElementById('group-container') || headers.find(h => h.innerText.includes('Група') || h.innerText.includes('Проєктна'))?.nextElementSibling,

        btnSave: document.querySelector('.search-submit-btn')
    };

    // Ініціалізуємо колір теми з localStorage
    appState.themeColor = (typeof getThemeColor === 'function') ? getThemeColor() : '#0ea5e9';
    // ------------------------


    if (window.ui.btnSave) {
        window.ui.btnSave.classList.add('opacity-50', 'pointer-events-none');
        window.ui.btnSave.onclick = saveAndLogSchedule;
    }

    // 2. Load Initial Data
    try {
        const resp = await fetchJsonp('GetStudentScheduleFiltersData', { aVuzID: VUZ_ID });
        if (resp.d) {
            renderFaculties(resp.d.faculties);
            setupForms(resp.d.educForms);
            renderCourses(resp.d.courses);

            // Відновлення стану з LocalStorage
            restoreState();
        }
    } catch (e) {
        console.error("API Error", e);
        if (window.ui.faculty) window.ui.faculty.innerHTML = '<p class="text-red-500 text-center">Помилка з\'єднання з сервером</p>';
    }

    // Примусово перевіряємо стан меню для поточного активного екрану при завантаженні
    const currentActive = document.querySelector('.app-view.active-view');
    if (currentActive) {
        // Викликаємо логіку меню для вже активного елемента (не змінюючи view)
        const nav = document.getElementById('global-nav');
        if (nav) {
            if (typeof SHOW_BOTTOM_NAV_ON !== 'undefined' && SHOW_BOTTOM_NAV_ON.includes(currentActive.id)) {
                nav.style.display = 'flex';
                if (typeof updateBottomNav === 'function') updateBottomNav(currentActive.id);
            } else {
                nav.style.display = 'none';
            }
        }
    }
});

function renderFaculties(list) {
    if (!window.ui.faculty) return;
    window.ui.faculty.innerHTML = list.map(f => {
        // Використовуємо наш оновлений FACULTY_CONFIG або дефолтні значення
        const conf = FACULTY_CONFIG[f.Key] || { title: f.Value, subtitle: "Факультет", icon: "fa-graduation-cap", color: "#888" };

        return `
            <div onclick="window.selectFaculty(this, '${f.Key}')" 
                 data-key="${f.Key}"
                 data-color="${conf.color}"
                 class="faculty-card cursor-pointer group relative p-4 rounded-2xl bg-white/5 border border-white/10 text-left hover:bg-white/10 transition-all active:scale-95">
                <div class="absolute top-3 right-3 opacity-0 transition-opacity check-icon">
                    <i class="fa-solid fa-circle-check"></i>
                </div>
                <i class="fa-solid ${conf.icon} text-2xl text-gray-400 mb-2 icon-main transition-colors"></i>
                <p class="text-sm font-bold text-gray-300 leading-tight title-text line-clamp-2">${conf.title}</p>
                <p class="text-[12px] text-gray-400 mt-1 truncate">${conf.subtitle}</p>
            </div>
        `;
    }).join('');
}

function setupForms(forms) {
    window.formMap = {};
    if (forms[0]) window.formMap['day'] = forms[0].Key;
    if (forms[1]) window.formMap['ext'] = forms[1].Key;

    // Ініціалізація дефолтного стану
    if (!appState.form) {
        appState.form = window.formMap['day'] || "1";
    }
}

function renderCourses(list) {
    if (!window.ui.course) return;
    window.ui.course.innerHTML = list.map(c => `
        <button onclick="window.selectCourse(this, '${c.Key}')"
            data-key="${c.Key}"
            class="course-btn w-full h-24 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-gray-400 transition-all active:scale-95">
            ${c.Value.replace(/\D/g, '') || c.Value}
        </button>
    `).join('');
}

// Функція відновлення стану
async function restoreState() {
    const saved = localStorage.getItem('scheduleSettings');
    if (!saved) {
        if (window.ui.group) window.ui.group.innerHTML = '<p class="text-gray-500 text-xs w-full text-center">Оберіть параметри</p>';
        return;
    }

    try {
        const parsed = JSON.parse(saved);

        // 1. Факультет
        if (parsed.faculty) {
            const facultyEl = document.querySelector(`.faculty-card[data-key="${parsed.faculty}"]`);
            if (facultyEl) {
                window.selectFaculty(facultyEl, parsed.faculty);
            }
        }

        // 2. Форма навчання
        if (parsed.form) {
            const type = Object.keys(window.formMap).find(key => window.formMap[key] === parsed.form) || 'day';
            window.setForm(type);
        }

        // 3. Курс
        if (parsed.course) {
            const courseEl = document.querySelector(`.course-btn[data-key="${parsed.course}"]`);
            if (courseEl) {
                window.selectCourse(courseEl, parsed.course);
            }
        }

        // 4. Група (відкладаємо до завантаження списку)
        appState.pendingGroupRestore = parsed.group;

    } catch (e) {
        console.error("Error restoring state", e);
        localStorage.removeItem('scheduleSettings');
    }
}

// ==========================================
// 5. ЛОГІКА ВИБОРУ
// ==========================================

window.selectFaculty = function (el, key) {
    appState.faculty = key;

    // Скидання стилів карток
    document.querySelectorAll('.faculty-card').forEach(card => {
        card.className = "faculty-card cursor-pointer group relative p-4 rounded-2xl bg-white/5 border border-white/10 text-left hover:bg-white/10 transition-all active:scale-95";
        card.style = "";
        card.querySelector('.check-icon').style.opacity = '0';

        const icon = card.querySelector('.icon-main');
        icon.classList.replace('text-white', 'text-gray-400');
        icon.style.color = '';

        const title = card.querySelector('.title-text');
        title.classList.replace('text-white', 'text-gray-300');
    });

    const color = el.getAttribute('data-color') || '#7f00ff';
    updateThemeColors(color);

    // Активуємо обрану
    el.className = "faculty-card cursor-pointer group relative p-4 rounded-2xl text-left transition-all active:scale-95 border";
    el.style.background = `linear-gradient(135deg, ${hexToRgba(color, 0.2)}, ${hexToRgba(color, 0.5)})`;
    el.style.borderColor = color;
    el.style.boxShadow = `0 0 20px ${hexToRgba(color, 0.5)}`;

    el.querySelector('.check-icon').style.opacity = '1';
    el.querySelector('.check-icon').style.color = color;

    const icon = el.querySelector('.icon-main');
    icon.classList.replace('text-gray-400', 'text-white');

    const title = el.querySelector('.title-text');
    title.classList.replace('text-gray-300', 'text-white');

    resetGroups();
    loadGroups();
};

window.setForm = function (type) {
    appState.form = window.formMap ? window.formMap[type] : (type === 'day' ? "1" : "3");

    const indicator = document.getElementById('form-indicator');
    const btnDay = document.getElementById('btn-day');
    const btnExt = document.getElementById('btn-ext');

    btnDay.classList.replace('text-white', 'text-gray-400');
    btnExt.classList.replace('text-white', 'text-gray-400');

    if (type === 'day') {
        indicator.style.transform = 'translateX(0)';
        indicator.style.left = '4px'; // Fallback
        btnDay.classList.replace('text-gray-400', 'text-white');
    } else {
        indicator.style.transform = 'translateX(100%)';
        if (indicator.style.transform === 'none') indicator.style.left = '50%'; // Fallback
        btnExt.classList.replace('text-gray-400', 'text-white');
    }

    resetGroups();
    loadGroups();
};

window.selectCourse = function (el, key) {
    appState.course = key;

    document.querySelectorAll('.course-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.className = "course-btn w-full h-24 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-gray-400 transition-all active:scale-95";
        btn.style = "";
    });

    el.classList.add('active');
    applyActiveStyle(el, appState.themeColor);

    resetGroups();
    loadGroups();
};

window.selectGroup = function (el, key, name) {
    appState.group = key;
    appState.groupName = name;
    appState.pendingGroupRestore = null;

    document.querySelectorAll('.group-chip').forEach(chip => {
        chip.classList.remove('active');
        chip.className = "group-chip px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-gray-300 transition-all active:scale-95 hover:bg-white/10";
        chip.style = "";
    });

    el.classList.add('active');
    applyActiveStyle(el, appState.themeColor);

    if (window.ui.btnSave) {
        window.ui.btnSave.classList.remove('opacity-50', 'pointer-events-none');
        window.ui.btnSave.style.background = `linear-gradient(to right, ${appState.themeColor}, ${hexToRgba(appState.themeColor, 0.8)})`;
        window.ui.btnSave.style.boxShadow = `0 0 20px ${hexToRgba(appState.themeColor, 0.4)}`;
    }
};

// ==========================================
// 6. ГРУПИ ТА ЗБЕРЕЖЕННЯ
// ==========================================

async function loadGroups() {
    if (!appState.faculty || !appState.form || !appState.course) {
        if (window.ui.group) window.ui.group.innerHTML = '<p class="text-gray-500 text-xs w-full text-center">Оберіть параметри</p>';
        return;
    }

    const container = window.ui.group;
    container.innerHTML = '<div class="w-full text-center py-4"><i class="fa-solid fa-circle-notch fa-spin text-gray-500 text-xl"></i></div>';

    if (window.ui.btnSave) {
        window.ui.btnSave.classList.add('opacity-50', 'pointer-events-none');
        window.ui.btnSave.style.background = '';
        window.ui.btnSave.style.boxShadow = '';
    }
    appState.group = null;

    try {
        const minLoadingTime = new Promise(resolve => setTimeout(resolve, 300));

        const request = fetchJsonp('GetStudyGroups', {
            aVuzID: VUZ_ID,
            aFacultyID: appState.faculty,
            aEducationForm: appState.form,
            aCourse: appState.course,
            aGiveStudyTimes: false
        });

        const [_, resp] = await Promise.all([minLoadingTime, request]);

        const groups = resp.d.studyGroups || [];
        if (groups.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-xs w-full text-center">Групи відсутні</p>';
            return;
        }

        container.innerHTML = groups.map(g => `
            <button onclick="window.selectGroup(this, '${g.Key}', '${g.Value}')"
                data-key="${g.Key}"
                class="group-chip px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-gray-300 transition-all active:scale-95 hover:bg-white/10">
                ${g.Value}
            </button>
        `).join('');

        // Авто-вибір групи при відновленні
        if (appState.pendingGroupRestore) {
            const groupBtn = container.querySelector(`button[data-key="${appState.pendingGroupRestore}"]`);
            if (groupBtn) {
                window.selectGroup(groupBtn, appState.pendingGroupRestore, groupBtn.innerText.trim());
            }
            appState.pendingGroupRestore = null;
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="text-red-400 text-xs text-center">Помилка завантаження</p>';
    }
}

function resetGroups() {
    if (appState.faculty && appState.course) {
        if (window.ui.group) window.ui.group.innerHTML = '<p class="text-gray-500 text-xs w-full text-center">Оновлення...</p>';
    }

    if (window.ui.btnSave) {
        window.ui.btnSave.classList.add('opacity-50', 'pointer-events-none');
        window.ui.btnSave.style.background = '';
        window.ui.btnSave.style.boxShadow = '';
    }
}

// ==========================================
// SEARCH.JS - WEEKLY LOAD LOGIC
// ==========================================

// Допоміжна функція: Отримати межі тижня для будь-якої дати
window.getWeekRange = function (date) {
    const current = new Date(date);
    // Визначаємо день тижня (0 - Нд, 1 - Пн ... 6 - Сб)
    const day = current.getDay();
    // Рахуємо різницю до Понеділка (якщо Нд, то віднімаємо 6 днів, інакше day-1)
    const diffToMon = current.getDate() - day + (day === 0 ? -6 : 1);

    const monday = new Date(current);
    monday.setDate(diffToMon);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return { start: monday, end: sunday };
};

// Функція завантаження тижня (Reusable)
window.fetchWeekSchedule = async function (targetDate) {
    const { start, end } = window.getWeekRange(targetDate);

    // Форматування для API (DD.MM.YYYY)
    const dateStr = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    const isoDate = (d) => d.toISOString(); // Для збереження в state

    let groupId = appState.group;
    let groupName = appState.groupName;

    // Якщо змінні пусті (наприклад, при авто-оновленні), спробуємо взяти з localStorage
    if (!groupId) {
        const saved = JSON.parse(localStorage.getItem('scheduleSettings') || '{}');
        groupId = saved.group;
        groupName = saved.groupName;
    }
    if (!groupId) return null;

    console.log(`📅 Завантажую тиждень: ${dateStr(start)} - ${dateStr(end)}`);

    try {
        const res = await fetchJsonp('GetScheduleDataX', {
            aVuzID: VUZ_ID,
            aStudyGroupID: groupId,
            aStartDate: dateStr(start),
            aEndDate: dateStr(end),
            aStudyTypeID: null
        });

        if (res.d) {
            // Формуємо об'єкт стану
            const stateObject = {
                data: res.d,
                startDate: isoDate(start), // Зберігаємо межі завантаженого тижня
                endDate: isoDate(end),
                lastUpdated: Date.now(),   // Час оновлення
                groupID: groupId,
                groupName: groupName
            };
            // Зберігаємо
            localStorage.setItem('scheduleDataState', JSON.stringify(stateObject));
            return stateObject;
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
    return null;
};


// Головна кнопка "Отримати розклад"
window.saveAndLogSchedule = async function () {
    if (!appState.group) return;

    // 1. Зберігаємо налаштування (БЕЗ themeColor!)
    const { themeColor, ...settingsWithoutColor } = appState;
    const settings = { ...settingsWithoutColor, timestamp: Date.now() };
    localStorage.setItem('scheduleSettings', JSON.stringify(settings));

    // 2. Синхронізуємо колір теми з єдиним ключем
    if (themeColor) {
        localStorage.setItem('themeColor', themeColor);
    }

    // 3. Сповіщаємо всі компоненти про зміну кольору
    window.dispatchEvent(new CustomEvent('themeChanged', {
        detail: { themeColor: themeColor || '#0ea5e9' }
    }));

    // =====================================================

    if (window.ui.btnSave) {
        window.ui.btnSave.innerText = "Завантаження...";
        window.ui.btnSave.classList.add('opacity-70');
    }

    // 2. Завантажуємо ПОТОЧНИЙ тиждень
    const result = await window.fetchWeekSchedule(new Date());

    if (window.ui.btnSave) {
        window.ui.btnSave.innerText = "Отримати розклад";
        window.ui.btnSave.classList.remove('opacity-70');
    }

    if (result) {
        // 3. Переходимо
        if (window.openView) window.openView('schedule-view');
        if (window.renderSchedule) window.renderSchedule();
    } else {
        alert("Помилка завантаження або розклад порожній.");
    }
};
// Навігаційна логіка винесена в navigation.js