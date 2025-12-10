// meteo.js - LITE VERSION (Чиста, без мапи, без зайвих експортів)

// ==========================================
// 1. ГЛОБАЛЬНІ ЗМІННІ
// ==========================================
let fullForecastData = null;
let currentCityName = null;
let currentActiveIndex = 0;
let lastCardsData = []; // Cache for re-rendering pinned metrics

const DEFAULT_CITY = { name: "Кам'янець-Подільський", lat: 48.6833, lon: 26.5833, type: 'default' };
const MAX_PINNED_METRICS = 3;

// ==========================================
// PINNED METRICS MANAGEMENT
// ==========================================

function getPinnedMetrics() {
    try {
        return JSON.parse(localStorage.getItem('weatherPinnedMetrics') || '[]');
    } catch (e) {
        return [];
    }
}

function savePinnedMetrics(pinned) {
    localStorage.setItem('weatherPinnedMetrics', JSON.stringify(pinned));
}

function isPinned(metricId) {
    return getPinnedMetrics().includes(metricId);
}

window.togglePinnedMetric = function (metricId) {
    let pinned = getPinnedMetrics();

    if (pinned.includes(metricId)) {
        // Unpin
        pinned = pinned.filter(id => id !== metricId);
    } else if (pinned.length < MAX_PINNED_METRICS) {
        // Pin
        pinned.push(metricId);
    } else {
        // Max reached, show toast
        if (window.showToast) {
            window.showToast(`Максимум ${MAX_PINNED_METRICS} закріплені метрики`);
        }
        return;
    }

    savePinnedMetrics(pinned);

    // Re-render both sections
    renderHeroPinnedMetrics();

    // Re-render details grid (need current day/hour context)
    if (lastCardsData.length > 0) {
        renderWeatherDetailsGridFromCache();
    }

    if (window.showToast) {
        window.showToast(pinned.includes(metricId) ? 'Метрику закріплено 📌' : 'Метрику відкріплено');
    }
};

function renderHeroPinnedMetrics() {
    const container = document.getElementById('hero-pinned-metrics');
    if (!container || lastCardsData.length === 0) return;

    const pinned = getPinnedMetrics();

    // Get cards to show: pinned first, then defaults to fill up to 3
    const defaultMetricIds = ['wind', 'humidity', 'feels_like'];
    let cardsToShow = [];

    // First add pinned cards
    pinned.forEach(id => {
        const card = lastCardsData.find(c => c.id === id);
        if (card) cardsToShow.push({ ...card, isPinned: true });
    });

    // Then fill with defaults (up to 3 total)
    defaultMetricIds.forEach(id => {
        if (cardsToShow.length >= 3) return;
        if (!pinned.includes(id)) {
            const card = lastCardsData.find(c => c.id === id);
            if (card) cardsToShow.push({ ...card, isPinned: false });
        }
    });

    // If still less than 3, add any remaining
    if (cardsToShow.length < 3) {
        lastCardsData.forEach(card => {
            if (cardsToShow.length >= 3) return;
            if (!cardsToShow.find(c => c.id === card.id)) {
                cardsToShow.push({ ...card, isPinned: pinned.includes(card.id) });
            }
        });
    }

    container.innerHTML = cardsToShow.slice(0, 3).map(card => `
        <div class="hero-metric-card ${card.isPinned ? 'pinned' : ''}" onclick="togglePinnedMetric('${card.id}')">
            <div class="metric-icon">
                <i class="fa-solid ${card.icon}"></i>
            </div>
            <div class="metric-content gap-1 flex flex-col" >
                <div class="metric-title">${card.title}</div>
                <div class="metric-value">${card.chipValue}</div>
                <div class="metric-desc">${(card.footer || '').replace(/<[^>]*>/g, '')}</div>
            </div>
            <div class="pin-indicator">
                <i class="fa-solid fa-thumbtack"></i>
            </div>
        </div>
    `).join('');
}

function renderWeatherDetailsGridFromCache() {
    const weatherDetailsGridEl = document.getElementById('weather-details-grid');
    if (!weatherDetailsGridEl || lastCardsData.length === 0) return;

    const pinnedIds = getPinnedMetrics();
    const visibleCards = lastCardsData.filter(card => !pinnedIds.includes(card.id));

    weatherDetailsGridEl.innerHTML = visibleCards.map(card => {
        const isPinnedClass = pinnedIds.includes(card.id) ? 'pinned' : '';
        const canPin = pinnedIds.length < MAX_PINNED_METRICS || pinnedIds.includes(card.id);

        return `<div class="detail-card ${isPinnedClass}">
            <div class="card-header">
                <i class="fa-solid ${card.icon} card-icon-small"></i>
                <span class="card-title">${card.title}</span>
                <button class="pin-btn ${isPinned(card.id) ? 'active' : ''} ${!canPin ? 'disabled' : ''}" 
                    onclick="event.stopPropagation(); togglePinnedMetric('${card.id}')"
                    ${!canPin ? 'disabled' : ''}>
                    <i class="fa-solid fa-thumbtack"></i>
                </button>
            </div>
            ${card.content}
            <div class="card-footer card-description">${card.footer}</div>
        </div>`;
    }).join('');
}

// ==========================================
// 2. ДОПОМІЖНІ ФУНКЦІЇ
// ==========================================

function normalizeForComparison(name) {
    if (!name || typeof name !== 'string') return "";
    return name.toLowerCase()
        .replace(/^(м\.|с\.|смт\.?|селище|місто)\s*/, '')
        .replace(/['`’‘\-—–\s\(\)]/g, '');
}

function transliterate(word) {
    const a = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e', 'є': 'ye',
        'ж': 'zh', 'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l',
        'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ь': '',
        'ю': 'yu', 'я': 'ya', ' ': ' ', '-': '-', '\'': '', '’': '', '`': ''
    };
    return word.toLowerCase().split('').map(char => a[char] || char).join('');
}

function cleanLocationName(name) {
    if (!name) return "";
    let clean = name;
    clean = clean.split(',')[0].trim();
    clean = clean.replace(/^(село|місто|смт|селище)\s+/i, '');
    return clean;
}
// Форматує температуру: додає "+" для плюсової, округлює
function formatTemp(temp) {
    if (temp === null || temp === undefined) return '--';
    const val = Math.round(temp);
    // Якщо більше 0, додаємо "+", інакше (0 або мінус) залишаємо як є
    return (val > 0 ? '' : '') + val;
}
function getWeatherIconAndText(code, is_day = 1) {
    const isNight = is_day === 0;
    const iconData = {
        0: { day: "icon-clear-day", night: "icon-clear-night", text: "Ясно" },
        1: { day: "icon-partly-cloudy-day", night: "icon-partly-cloudy-night", text: "Малохмарно" },
        2: { day: "icon-partly-cloudy-day", night: "icon-partly-cloudy-night", text: "Мінлива хмарність" },
        3: { day: "icon-cloudy", night: "icon-cloudy", text: "Хмарно" },
        45: { day: "icon-fog-day", night: "icon-fog-night", text: "Туман" },
        48: { day: "icon-fog-day", night: "icon-fog-night", text: "Паморозь" },
        51: { day: "icon-drizzle", night: "icon-drizzle", text: "Мряка" },
        53: { day: "icon-drizzle", night: "icon-drizzle", text: "Мряка" },
        55: { day: "icon-drizzle", night: "icon-drizzle", text: "Мряка" },
        61: { day: "icon-rain", night: "icon-rain", text: "Слабкий дощ" },
        63: { day: "icon-rain", night: "icon-rain", text: "Дощ" },
        65: { day: "icon-heavy-rain", night: "icon-heavy-rain", text: "Сильний дощ" },
        80: { day: "icon-rain", night: "icon-rain", text: "Злива" },
        81: { day: "icon-heavy-rain", night: "icon-heavy-rain", text: "Злива" },
        82: { day: "icon-heavy-rain", night: "icon-heavy-rain", text: "Сильна злива" },
        71: { day: "icon-snow", night: "icon-snow", text: "Сніг" },
        73: { day: "icon-snow", night: "icon-snow", text: "Сніг" },
        75: { day: "icon-heavy-snow", night: "icon-heavy-snow", text: "Сильний сніг" },
        95: { day: "icon-thunderstorm", night: "icon-thunderstorm", text: "Гроза" },
        96: { day: "icon-thunderstorm", night: "icon-thunderstorm", text: "Гроза з градом" },
        99: { day: "icon-thunderstorm", night: "icon-thunderstorm", text: "Гроза з градом" },
    };
    const data = iconData[code] || { day: "icon-unknown", night: "icon-unknown", text: "Невідомо" };
    return { icon: isNight ? data.night : data.day, text: data.text };
}

function formatHour(dateString) { return new Date(dateString).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }); }
function formatDay(dateString) { return new Date(dateString).toLocaleDateString('uk-UA', { weekday: 'short' }); }
function getCurrentHourIndex(hourly, current) {
    const currentTime = current ? current.time : hourly.time[0];
    const now = new Date(currentTime);
    const index = hourly.time.findIndex(timeStr => new Date(timeStr) > now);
    return index > 0 ? index - 1 : 0;
}
function getCardinalDirection(angle) {
    const directions = ['Пн', 'Пн-Сх', 'Сх', 'Пд-Сх', 'Пд', 'Пд-Зх', 'Зх', 'Пн-Зх'];
    return directions[Math.round(angle / 45) % 8];
}

function getTemperatureTrend(hourly, dayIndex, currentHourIndex, actualCurrentTemp) {
    const isToday = dayIndex === 0;
    const startIndex = isToday ? currentHourIndex : dayIndex * 24;
    const temps = hourly.temperature_2m.slice(startIndex, startIndex + 24).filter(t => t !== null && t !== undefined);

    if (temps.length === 0) {
        return { currentTemp: Math.round(actualCurrentTemp), minTemp: '--', maxTemp: '--', minTime: '--', maxTime: '--', trend: '', badgeClass: 'hidden' };
    }

    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const minTimeIndex = hourly.temperature_2m.indexOf(minTemp, startIndex);
    const maxTimeIndex = hourly.temperature_2m.indexOf(maxTemp, startIndex);
    const minTime = minTimeIndex !== -1 ? formatHour(hourly.time[minTimeIndex]) : '--';
    const maxTime = maxTimeIndex !== -1 ? formatHour(hourly.time[maxTimeIndex]) : '--';

    let nextTemp = null;
    let trend = 'Стабільно';
    let badgeClass = 'status-badge badge-stable';

    if (isToday && hourly.temperature_2m[currentHourIndex + 1] !== undefined) {
        nextTemp = hourly.temperature_2m[currentHourIndex + 1];
        if (nextTemp > actualCurrentTemp + 0.5) {
            trend = 'Підвищується';
            badgeClass = 'status-badge badge-up';
        } else if (nextTemp < actualCurrentTemp - 0.5) {
            trend = 'Знижується';
            badgeClass = 'status-badge badge-down';
        }
    } else if (!isToday) {
        // ЗМІНА ТУТ: додаємо formatTemp
        trend = `${formatTemp(minTemp)}° / ${formatTemp(maxTemp)}°`;
        badgeClass = 'status-badge badge-stable';
    }

    return {
        currentTemp: Math.round(actualCurrentTemp),
        minTemp: Math.round(minTemp),
        maxTemp: Math.round(maxTemp),
        minTime: minTime,
        maxTime: maxTime,
        trend: trend,
        badgeClass: badgeClass
    };
}

// ==========================================
// 3. API ФУНКЦІЇ (NOMINATIM & WEATHER)
// ==========================================

async function getCityNameFromCoords(lat, lon) {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=uk`;
        const res = await fetch(url, { headers: { 'User-Agent': 'WeatherAppUA/1.0' } });
        if (!res.ok) throw new Error("Geo Error");
        const data = await res.json();
        const addr = data.address;

        if (addr) {
            if (addr.village) return "с. " + addr.village;
            if (addr.hamlet) return "с. " + addr.hamlet;
            if (addr.town) return "смт " + addr.town;
            if (addr.city) return "м. " + addr.city;
            if (addr.suburb) return addr.suburb;
            if (addr.city_district) return addr.city_district;
            if (addr.road) {
                const near = addr.village || addr.town || addr.city || "";
                return near ? `${addr.road} (${near})` : addr.road;
            }
            if (data.name) return data.name;
            if (addr.municipality) return addr.municipality.replace('громада', '').trim();
        }
        return "Невідоме місце";
    } catch (e) {
        try {
            const backupUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=uk`;
            const backupRes = await fetch(backupUrl);
            const backupData = await backupRes.json();
            return backupData.locality || backupData.city || `Точка (${lat.toFixed(3)}, ${lon.toFixed(3)})`;
        } catch (err) {
            return `Коорд: ${lat.toFixed(3)}, ${lon.toFixed(3)}`;
        }
    }
}

// ==========================================
// 4. ФУНКЦІЇ ЗБЕРЕЖЕННЯ (HISTORY)
// ==========================================

function saveCity(cityObj) {
    try {
        let cities = JSON.parse(localStorage.getItem('savedCities')) || [];
        const newFingerprint = normalizeForComparison(cityObj.name);
        cities = cities.filter(c => normalizeForComparison(c.name) !== newFingerprint);
        cities.unshift(cityObj);
        localStorage.setItem('savedCities', JSON.stringify(cities.slice(0, 5)));
        renderSavedCities();
    } catch (e) {
        console.error("Помилка збереження міста:", e);
    }
}

function removeCity(cityName) {
    let cities = JSON.parse(localStorage.getItem('savedCities')) || [];
    cities = cities.filter(c => c.name !== cityName);
    localStorage.setItem('savedCities', JSON.stringify(cities));
    renderSavedCities();
}

// ==========================================
// ОНОВЛЕНА ФУНКЦІЯ РЕНДЕРУ ІСТОРІЇ
// ==========================================

function renderSavedCities() {
    const list = document.getElementById('saved-cities-list');
    if (!list) return;

    const cities = JSON.parse(localStorage.getItem('savedCities')) || [];
    list.innerHTML = '';

    if (cities.length === 0) {
        list.innerHTML = '<div class="text-center text-gray-500 text-xs py-4 opacity-50">Історія пошуку порожня</div>';
        return;
    }

    cities.forEach(c => {
        const item = document.createElement('div');
        // Стилі залишаються тими ж
        item.className = "flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-gray-300 hover:bg-white/10 transition-all cursor-pointer group relative overflow-hidden active:scale-[0.98]";

        item.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-white group-hover:bg-white/10 transition-all pointer-events-none">
                <i class="fa-solid fa-clock-rotate-left"></i>
            </div>
            <span class="text-sm font-medium flex-1 pointer-events-none text-white/80 group-hover:text-white transition-colors">${c.name}</span>
            <button class="delete-btn w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all z-10 active:scale-90" title="Видалити">
                <i class="fa-solid fa-trash-can text-sm"></i>
            </button>
        `;

        // === ГОЛОВНА ЛОГІКА ===
        // Клік по елементу списку
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // 1. Одразу вантажимо погоду по збережених координатах
            // (Ми пропускаємо етап пошуку та геокодингу, бо координати вже є)
            loadWeatherFromCoords(c.lat, c.lon, c.name);

            // 2. Закриваємо модальне вікно пошуку
            if (typeof window.closeSearchModal === 'function') {
                window.closeSearchModal();
            } else {
                // Фоллбек, якщо функція недоступна
                document.getElementById('city-search-overlay')?.classList.remove('active');
                setTimeout(() => document.getElementById('city-search-overlay')?.classList.add('hidden'), 300);
            }
        });

        // Клік по кнопці видалення
        item.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Зупиняємо, щоб не спрацював клік по батьківському елементу (не вантажило погоду)
            removeCity(c.name);
        });

        list.appendChild(item);
    });
}

// ==========================================
// 5. ОСНОВНА ІНІЦІАЛІЗАЦІЯ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    const weatherContainerEl = document.getElementById('weather-container');
    const loadingMsgEl = document.getElementById('loading-weather-msg');

    // UI Elements
    const cityInputEl = document.getElementById('city-input');
    const fetchWeatherBtn = document.getElementById('fetch-weather-btn');
    const searchToggleBtn = document.getElementById('search-toggle-btn');
    const searchOverlay = document.getElementById('city-search-overlay');
    const closeSearchBtn = document.getElementById('close-search-btn');
    const geoLocateBtn = document.getElementById('geo-locate-btn');
    const geoMapBtn = document.getElementById('geo-map-btn');

    // --- MODAL FUNCTIONS ---
    function openSearchModal() {
        if (!searchOverlay) return;
        searchOverlay.classList.remove('hidden');
        setTimeout(() => searchOverlay.classList.add('active'), 10);
        renderSavedCities();
    }

    function closeSearchModal() {
        if (!searchOverlay) return;
        searchOverlay.classList.remove('active');
        setTimeout(() => {
            if (!searchOverlay.classList.contains('active')) {
                searchOverlay.classList.add('hidden');
            }
        }, 300);
    }
    window.closeSearchModal = closeSearchModal;
    window.openSearchModal = openSearchModal;

    // --- EVENT LISTENERS ---
    if (searchToggleBtn) searchToggleBtn.addEventListener('click', openSearchModal);
    if (closeSearchBtn) closeSearchBtn.addEventListener('click', closeSearchModal);
    if (searchOverlay) {
        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) closeSearchModal();
        });
    }

    // ==========================================
    // ЛОГІКА МАПИ (LEAFLET)
    // ==========================================

    let mapInstance = null;
    let mapMarker = null;
    let selectedMapLocation = null; // { lat, lon, name }

    // Елементи мапи
    const mapViewContainer = document.getElementById('map-view-container');
    const closeMapViewBtn = document.getElementById('close-map-view-btn');
    const confirmMapLocationBtn = document.getElementById('confirm-map-location-btn');
    const mapMyLocBtn = document.getElementById('map-my-loc-btn');

    // Елементи інформації про точку
    const mapSelectedCityEl = document.getElementById('map-selected-city');
    const mapSelectedCoordsEl = document.getElementById('map-selected-coords');

    // 1. Відкриття мапи
    if (geoMapBtn) {
        geoMapBtn.style.display = 'flex'; // Показуємо кнопку

        geoMapBtn.addEventListener('click', () => {
            if (!mapViewContainer) return;

            // Показуємо контейнер
            mapViewContainer.classList.remove('hidden');
            // Анімація виїзду (чекаємо трохи, щоб прибрався display: none)
            setTimeout(() => {
                mapViewContainer.style.transform = 'translateX(0)';
            }, 10);

            // Ініціалізуємо мапу (якщо ще не створена)
            if (!mapInstance) {
                initLeafletMap();
            } else {
                // Оновлюємо розмір мапи (важливо для Leaflet після display:none)
                setTimeout(() => mapInstance.invalidateSize(), 300);
            }
        });
    }

    // 2. Функція ініціалізації
    function initLeafletMap() {
        // Центруємо мапу (беремо поточне місто або дефолт)
        const startLat = fullForecastData?.current?.latitude || DEFAULT_CITY.lat;
        const startLon = fullForecastData?.current?.longitude || DEFAULT_CITY.lon;

        mapInstance = L.map('leaflet-map', {
            zoomControl: false // Ховаємо стандартні кнопки зуму (для краси)
        }).setView([startLat, startLon], 6);

        // Додаємо шар OpenStreetMap (Стандартний, кольоровий, укр. мова)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(mapInstance);

        // Додаємо подію кліку по мапі
        mapInstance.on('click', onMapClick);
    }

    // 3. Обробка кліку по мапі
    async function onMapClick(e) {
        const { lat, lng } = e.latlng;

        // Ставимо або переміщуємо маркер
        if (mapMarker) {
            mapMarker.setLatLng([lat, lng]);
        } else {
            mapMarker = L.marker([lat, lng]).addTo(mapInstance);
        }

        // Оновлюємо UI (показуємо, що вантажиться)
        mapSelectedCoordsEl.innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        mapSelectedCityEl.innerText = "Визначаємо місце...";
        confirmMapLocationBtn.disabled = true;

        // Отримуємо назву міста (використовуємо вашу існуючу функцію)
        const cityName = await getCityNameFromCoords(lat, lng);

        // Зберігаємо вибір
        selectedMapLocation = { lat, lon: lng, name: cityName };

        // Оновлюємо UI фінально
        mapSelectedCityEl.innerText = cityName;
        confirmMapLocationBtn.disabled = false;
    }

    // 4. Закриття мапи
    if (closeMapViewBtn) {
        closeMapViewBtn.addEventListener('click', closeMapView);
    }

    function closeMapView() {
        if (!mapViewContainer) return;
        mapViewContainer.style.transform = 'translateX(100%)'; // Анімація вправо
        setTimeout(() => {
            mapViewContainer.classList.add('hidden');
        }, 300);
    }

    // 5. Підтвердження вибору
    if (confirmMapLocationBtn) {
        confirmMapLocationBtn.addEventListener('click', async () => {
            if (selectedMapLocation) {
                // Закриваємо мапу
                closeMapView();
                // Закриваємо модалку пошуку
                closeSearchModal();

                // Вантажимо погоду
                await loadWeatherFromCoords(selectedMapLocation.lat, selectedMapLocation.lon, selectedMapLocation.name);

                // Зберігаємо в історію
                saveCity({
                    name: selectedMapLocation.name,
                    lat: selectedMapLocation.lat,
                    lon: selectedMapLocation.lon,
                    type: 'map'
                });
            }
        });
    }

    // 6. Кнопка "Моя локація" на мапі
    if (mapMyLocBtn) {
        mapMyLocBtn.addEventListener('click', () => {
            if (!navigator.geolocation) return alert("Геолокація недоступна");

            mapMyLocBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; // Крутилка

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;

                    // Центруємо мапу
                    mapInstance.setView([lat, lon], 12);
                    // Імітуємо клік по цих координатах
                    onMapClick({ latlng: { lat, lng: lon } });

                    mapMyLocBtn.innerHTML = '<i class="fa-solid fa-crosshairs text-xl"></i>';
                },
                () => {
                    alert("Не вдалося отримати локацію");
                    mapMyLocBtn.innerHTML = '<i class="fa-solid fa-crosshairs text-xl"></i>';
                }
            );
        });
    }

    if (geoLocateBtn) {
        geoLocateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fetchGeolocation();
        });
    }

    if (cityInputEl) {
        cityInputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                fetchWeatherBtn.click();
            }
        });
    }

    if (fetchWeatherBtn) {
        fetchWeatherBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fetchWeatherByCityName(cityInputEl.value);
        });
    }

    // Tabs
    const dailyTabsContainer = document.getElementById('daily-tabs-container');
    if (dailyTabsContainer) {
        dailyTabsContainer.addEventListener('click', (e) => {
            const tab = e.target.closest('.daily-tab-compact');
            if (!tab) return;

            const themeColor = typeof getThemeColor === 'function' ? getThemeColor() : '#00f2ea';

            document.querySelectorAll('.daily-tab-compact').forEach(t => {
                t.classList.remove('active');
                t.style.background = '';
                t.style.borderColor = '';
                t.style.color = '';
                t.style.boxShadow = '';
            });

            tab.classList.add('active');
            if (typeof hexToRgba === 'function') {
                tab.style.background = hexToRgba(themeColor, 0.15);
                tab.style.borderColor = hexToRgba(themeColor, 0.4);
                tab.style.color = themeColor;
                tab.style.boxShadow = `0 0 15px ${hexToRgba(themeColor, 0.1)}`;
            }

            const index = parseInt(tab.dataset.index);
            currentActiveIndex = index;
            renderDetailedView(index);
        });
    }

    // --- CORE LOGIC ---

    async function initWeatherApp() {
        const savedCities = JSON.parse(localStorage.getItem('savedCities')) || [];
        const cityToLoad = savedCities.length > 0 ? savedCities[0] : DEFAULT_CITY;
        await loadWeatherFromCoords(cityToLoad.lat, cityToLoad.lon, cityToLoad.name);
    }

    async function fetchWeatherByCityName(city) {
        if (!city) return;
        const loadingMsgEl = document.getElementById('loading-weather-msg');
        if (loadingMsgEl) loadingMsgEl.style.display = 'block';

        const rawCity = city.trim();
        const attempts = [];
        attempts.push(rawCity);
        const latinName = transliterate(rawCity);
        if (latinName !== rawCity.toLowerCase()) attempts.push(latinName);
        if (rawCity.includes("-")) {
            attempts.push(rawCity.replace(/-/g, " "));
            attempts.push(latinName.replace(/-/g, " "));
        }
        const lowerRaw = rawCity.toLowerCase();
        if ((lowerRaw.includes("кам'янець") || lowerRaw.includes("камянець")) && !lowerRaw.includes("буз")) {
            attempts.push("Kamianets-Podilskyi");
        }

        const uniqueAttempts = [...new Set(attempts)];
        let foundLocation = null;

        for (const term of uniqueAttempts) {
            try {
                const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=10&language=uk`;
                const res = await fetch(geoUrl);
                const data = await res.json();
                if (data.results && data.results.length > 0) {
                    foundLocation = data.results[0];
                    break;
                }
            } catch (e) { console.warn(`Error searching "${term}":`, e); }
        }

        if (foundLocation) {
            const { latitude, longitude, name } = foundLocation;
            const cleanName = cleanLocationName(name);
            await loadWeatherFromCoords(latitude, longitude, cleanName);
            saveCity({ name: cleanName, lat: latitude, lon: longitude, type: 'manual' });
            closeSearchModal();
        } else {
            alert(`Місто "${rawCity}" не знайдено.`);
            if (loadingMsgEl) loadingMsgEl.style.display = 'none';
        }
    }

    function fetchGeolocation() {
        if (!navigator.geolocation) return alert("Геолокація недоступна");
        const loadingMsgEl = document.getElementById('loading-weather-msg');
        if (loadingMsgEl) loadingMsgEl.style.display = 'block';

        const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                const name = await getCityNameFromCoords(lat, lon);
                await loadWeatherFromCoords(lat, lon, name);
                saveCity({ name, lat, lon, type: 'geo' });
                closeSearchModal();
            },
            (err) => {
                if (loadingMsgEl) loadingMsgEl.style.display = 'none';
                if (!fullForecastData) alert("Не вдалося отримати локацію.");
            },
            options
        );
    }

    async function loadWeatherFromCoords(lat, lon, displayName) {
        const loadingMsgEl = document.getElementById('loading-weather-msg');
        const weatherContainerEl = document.getElementById('weather-container');

        if (loadingMsgEl) loadingMsgEl.style.display = 'block';

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day,apparent_temperature,pressure_msl&hourly=temperature_2m,weather_code,precipitation_probability,is_day,apparent_temperature,pressure_msl,dew_point_2m,cloud_cover,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum&timezone=auto`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("API Error");
            fullForecastData = await res.json();
            currentCityName = displayName;

            updateDashboardWidget(fullForecastData.current, displayName);
            renderDailyTabs(fullForecastData.daily);
            renderDetailedView(0);

            if (loadingMsgEl) loadingMsgEl.style.display = 'none';
            if (weatherContainerEl) weatherContainerEl.classList.remove('hidden');
        } catch (e) {
            console.error(e);
            if (loadingMsgEl) loadingMsgEl.innerText = "Помилка завантаження";
        }
    }
    window.loadWeatherFromCoords = loadWeatherFromCoords;
    // --- UI HELPERS ---

    function updateDashboardWidget(current, cityName) {
        const widgetTemp = document.getElementById('widget-temp');
        const widgetCity = document.getElementById('widget-city');
        const widgetDesc = document.getElementById('widget-desc');
        const widgetIcon = document.getElementById('widget-icon');
        const widgetWind = document.getElementById('widget-wind');
        const widgetHum = document.getElementById('widget-humidity');
        if (!widgetTemp) return;

        const { icon, text } = getWeatherIconAndText(current.weather_code, current.is_day);

        // ЗМІНА ТУТ: використовуємо formatTemp
        widgetTemp.innerText = `${formatTemp(current.temperature_2m)}°`;

        widgetCity.innerText = cityName;
        widgetDesc.innerText = text;
        widgetWind.innerText = `${current.wind_speed_10m} м/с`;
        widgetHum.innerText = `${current.relative_humidity_2m}%`;
        const baseClasses = "w-20 h-20 bg-contain bg-center bg-no-repeat";
        const newClassString = `${baseClasses} ${icon}`;
        if (widgetIcon.className !== newClassString) {
            widgetIcon.className = newClassString;
        }
    }

    function renderDailyTabs(daily) {
        if (!dailyTabsContainer) return;
        dailyTabsContainer.innerHTML = '';

        const themeColor = typeof getThemeColor === 'function' ? getThemeColor() : '#00f2ea';

        daily.time.forEach((t, i) => {
            const { icon } = getWeatherIconAndText(daily.weather_code[i]);
            const btn = document.createElement('div');
            btn.className = `daily-tab-compact cursor-pointer transition-all duration-200`;
            btn.dataset.index = i;

            // ЗМІНА ТУТ: formatTemp для макс і мін температури
            btn.innerHTML = `
                <span id="daily-tabs" class="tab-day">${i === 0 ? 'Сьогодні' : formatDay(t)}</span>
                <div class="w-8 h-8 bg-contain bg-center bg-no-repeat my-1 ${icon}"></div>
                <span class="font-bold">${formatTemp(daily.temperature_2m_max[i])}°</span>
                <span class="text-[10px] opacity-60">${formatTemp(daily.temperature_2m_min[i])}°</span>
            `;

            if (i === 0) {
                btn.classList.add('active');
                if (typeof hexToRgba === 'function') {
                    btn.style.background = hexToRgba(themeColor, 0.15);
                    btn.style.borderColor = hexToRgba(themeColor, 0.4);
                    btn.style.color = themeColor;
                    btn.style.boxShadow = `0 0 15px ${hexToRgba(themeColor, 0.1)}`;
                }
            }
            dailyTabsContainer.appendChild(btn);
        });
    }

    function renderDetailedView(index) {
        const { daily, hourly, current } = fullForecastData;
        const isToday = index === 0;
        const currentHourIdx = getCurrentHourIndex(hourly, current);
        let temp, code, isDay;
        if (isToday) {
            temp = current.temperature_2m;
            code = current.weather_code;
            isDay = current.is_day;
        } else {
            const middayIndex = index * 24 + 12;
            temp = hourly.temperature_2m[middayIndex];
            code = daily.weather_code[index];
            isDay = 1;
        }
        const { icon, text } = getWeatherIconAndText(code, isDay);

        // ЗМІНА ТУТ: головна температура на детальному екрані
        const detailTemp = document.getElementById('detailed-temp');
        if (detailTemp) detailTemp.innerText = `${formatTemp(temp)}°`;

        const detailCond = document.getElementById('detailed-condition');
        if (detailCond) detailCond.innerText = text;

        const detailTime = document.getElementById('detailed-time');
        if (detailTime) detailTime.innerText = currentCityName;

        const detailDate = document.getElementById('detailed-date-info');
        if (detailDate) detailDate.innerText = isToday ?
            `Сьогодні, ${new Date().toLocaleDateString('uk-UA')}` :
            new Date(daily.time[index]).toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });

        const detailSun = document.getElementById('detailed-sunrise-sunset');
        if (detailSun) detailSun.innerHTML = `<span><i class="fa-solid fa-sun"></i> ${formatHour(daily.sunrise[index])}</span><span><i class="fa-solid fa-moon"></i> ${formatHour(daily.sunset[index])}</span>`;

        const heroIcon = document.getElementById('detailed-icon');
        if (heroIcon) heroIcon.className = `hero-weather-icon-lg ${icon}`;

        const hourlyContainer = document.getElementById('hourly-forecast');
        if (hourlyContainer) {
            hourlyContainer.innerHTML = '';
            const start = index * 24;
            const end = start + 24;
            for (let i = start; i < end; i += 3) {
                if (!hourly.time[i]) break;
                const hTime = hourly.time[i];
                const hTemp = hourly.temperature_2m[i];
                const hCode = hourly.weather_code[i];
                const hIsDay = hourly.is_day[i];
                const { icon: hIcon } = getWeatherIconAndText(hCode, hIsDay);
                const div = document.createElement('div');
                div.className = 'hourly-card';
                // ЗМІНА ТУТ: погодинна температура
                div.innerHTML = `
                    <span class="text-xs opacity-70">${formatHour(hTime)}</span>
                    <div class="w-8 h-8 bg-contain bg-center bg-no-repeat my-1 ${hIcon}"></div>
                    <span class="font-bold text-sm">${formatTemp(hTemp)}°</span>
                `;
                hourlyContainer.appendChild(div);
            }
        }
        renderWeatherDetailsGrid(index, currentHourIdx);
    }

    function renderWeatherDetailsGrid(dayIndex, currentHourIndex) {
        const weatherDetailsGridEl = document.getElementById('weather-details-grid');
        if (!fullForecastData || !weatherDetailsGridEl) return;

        const { daily, hourly, current } = fullForecastData;
        let data = {};
        let actualCurrentTemp;

        if (dayIndex === 0 && current) {
            data = current;
            actualCurrentTemp = current.temperature_2m;
        } else {
            const hourIndex = (dayIndex * 24) + 12;
            Object.keys(hourly).forEach(key => {
                if (Array.isArray(hourly[key]) && hourly[key][hourIndex] !== undefined) {
                    data[key] = hourly[key][hourIndex];
                }
            });
            data.precipitation_sum = daily.precipitation_sum ? daily.precipitation_sum[dayIndex] : 0;
            actualCurrentTemp = data.temperature_2m;
        }

        const tempAnalysis = getTemperatureTrend(hourly, dayIndex, currentHourIndex, actualCurrentTemp);
        const feelsLikeValue = Math.round(data.apparent_temperature || data.temperature_2m || 0);
        const windSpeed = (data.wind_speed_10m || 0).toFixed(1);
        const windGusts = (data.wind_gusts_10m || 0).toFixed(1);
        const windDirAngle = data.wind_direction_10m || 0;
        const windDirText = getCardinalDirection(windDirAngle);
        const humidityValue = Math.round(data.relative_humidity_2m || 0);
        const dewPointValue = Math.round(data.dew_point_2m || 0);
        const humidityLevel = humidityValue < 40 ? 'Сухо' : humidityValue > 70 ? 'Волого' : 'Комфорт';
        const cloudCoverValue = Math.round(data.cloud_cover || 0);
        const cloudStatus = cloudCoverValue <= 10 ? 'Ясно' : cloudCoverValue <= 40 ? 'Змінна' : 'Хмарно';
        const precipSum = (data.precipitation_sum || daily.precipitation_sum[dayIndex] || 0).toFixed(1);
        let precipProb = 0;

        if (dayIndex === 0 && currentHourIndex !== -1) {
            precipProb = hourly.precipitation_probability[currentHourIndex];
        } else if (dayIndex !== 0) {
            const dailyProbabilities = hourly.precipitation_probability.slice(dayIndex * 24, (dayIndex + 1) * 24);
            precipProb = Math.max(...dailyProbabilities.filter(p => p !== null && p !== undefined)) || 0;
        }
        const precipDesc = (precipProb > 50) ? `Вис. ймовірність` : `Низька ймов.`;
        const pressure_hPa = data.pressure_msl || 0;
        const pressure_mmHg = (pressure_hPa / 1.33322).toFixed(0);

        const cards = [
            {
                id: 'temperature',
                title: 'Температура',
                icon: 'fa-temperature-half',
                // ЗМІНА ТУТ: formatTemp для основної температури картки
                content: `<div class="card-main-content gap-3"><div class="flex items-center gap-1"><span class="card-value">${formatTemp(tempAnalysis.currentTemp)}</span><span class="card-unit">°C</span></div><div class="${tempAnalysis.badgeClass}">${tempAnalysis.trend}</div></div>`,
                // ЗМІНА ТУТ: formatTemp для мін/макс у футері
                footer: `<span class="opacity-70">Мін ${formatTemp(tempAnalysis.minTemp)}° • Макс ${formatTemp(tempAnalysis.maxTemp)}°</span>`,
                chipValue: `${formatTemp(tempAnalysis.currentTemp)}°`
            },
            {
                id: 'feels_like',
                title: 'Відчувається',
                icon: 'fa-person-rays',
                // ЗМІНА ТУТ: formatTemp для відчувається
                content: `<div class="card-main-content"><div class="flex items-center gap-1"><span class="card-value">${formatTemp(feelsLikeValue)}</span><span class="card-unit">°C</span></div></div>`,
                footer: (tempAnalysis.currentTemp - feelsLikeValue > 2) ? 'Прохолодніше через вітер' : 'Комфортно',
                chipValue: `${formatTemp(feelsLikeValue)}°`
            },
            {
                id: 'wind',
                title: 'Вітер',
                icon: 'fa-wind',
                content: `<div class="card-main-content gap-5"><div class="flex items-center gap-1"><span class="card-value">${windSpeed}</span><span class="card-unit">м/с</span></div><div id="arrow-up" class="flex items-center gap-2 mt-1"><i class="fa-solid fa-arrow-up" style="transform: rotate(${windDirAngle}deg);"></i><span class="text-sm font-medium text-white">${windDirText}</span></div></div>`,
                footer: `Пориви до ${windGusts} м/с`,
                chipValue: `${windSpeed} м/с`
            },
            {
                id: 'humidity',
                title: 'Вологість',
                icon: 'fa-droplet',
                content: `<div class="card-main-content"><div class="flex items-center gap-1"><span class="card-value">${humidityValue}</span><span class="card-unit">%</span></div></div>`,
                footer: `Роса ${dewPointValue}° • ${humidityLevel}`,
                chipValue: `${humidityValue}%`
            },
            {
                id: 'precipitation',
                title: 'Опади',
                icon: 'fa-cloud-rain',
                content: `<div class="card-main-content"><div class="flex items-center gap-1"><span class="card-value">${precipSum}</span><span class="card-unit">мм</span></div></div>`,
                footer: `${precipDesc} (${precipProb}%)`,
                chipValue: `${precipSum} мм`
            },
            {
                id: 'clouds',
                title: 'Хмарність',
                icon: 'fa-cloud',
                content: `<div class="card-main-content"><div class="flex items-center gap-1"><span class="card-value">${cloudCoverValue}</span><span class="card-unit">%</span></div></div>`,
                footer: `${cloudStatus}`,
                chipValue: `${cloudCoverValue}%`
            },
            {
                id: 'pressure',
                title: 'Тиск',
                icon: 'fa-gauge-high',
                content: `<div class="card-main-content"><div class="flex items-center gap-1"><span class="card-value">${pressure_mmHg}</span><span class="card-unit text-xs">мм</span></div></div>`,
                footer: `${Math.round(pressure_hPa)} гПа`,
                chipValue: `${pressure_mmHg} мм`
            },
        ];

        // Cache cards data for re-rendering
        lastCardsData = cards;

        // Get pinned metrics
        const pinnedIds = getPinnedMetrics();

        // Filter out pinned cards from grid
        const visibleCards = cards.filter(card => !pinnedIds.includes(card.id));

        weatherDetailsGridEl.innerHTML = visibleCards.map(card => {
            const canPin = pinnedIds.length < MAX_PINNED_METRICS;

            return `<div class="detail-card">
                <div class="card-header">
                    <i class="fa-solid ${card.icon} card-icon-small"></i>
                    <span class="card-title">${card.title}</span>
                    <button class="pin-btn ${!canPin ? 'disabled' : ''}" 
                        onclick="event.stopPropagation(); togglePinnedMetric('${card.id}')"
                        title="Закріпити в Hero Card"
                        ${!canPin ? 'disabled' : ''}>
                        <i class="fa-solid fa-thumbtack"></i>
                    </button>
                </div>
                ${card.content}
                <div class="card-footer card-description">${card.footer}</div>
            </div>`;
        }).join('');

        // Render pinned metrics in Hero Card
        renderHeroPinnedMetrics();
    }

    // --- REACTIVE THEME UPDATE ---
    window.addEventListener('themeChanged', (e) => {
        const newThemeColor = e.detail && e.detail.themeColor ? e.detail.themeColor : '#00f2ea';

        const activeTab = document.querySelector('.daily-tab-compact.active');
        if (activeTab && typeof hexToRgba === 'function') {
            activeTab.style.background = hexToRgba(newThemeColor, 0.15);
            activeTab.style.borderColor = hexToRgba(newThemeColor, 0.4);
            activeTab.style.color = newThemeColor;
            activeTab.style.boxShadow = `0 0 15px ${hexToRgba(newThemeColor, 0.1)}`;
        }

        const fetchBtn = document.getElementById('fetch-weather-btn');
        if (fetchBtn) {
            fetchBtn.style.backgroundColor = newThemeColor;
            fetchBtn.style.color = '#0f172a';
        }
    });

    // --- ЛИШЕ ЦЯ ФУНКЦІЯ ПОТРІБНА ДЛЯ ЗОВНІШНЬОГО СВІТУ (Кнопка в хедера) ---
    window.fetchGeolocation = fetchGeolocation;

    // Запуск
    initWeatherApp();
});