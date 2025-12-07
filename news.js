document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'https://meridian.kpnu.edu.ua/wp-json/wp/v2/posts?_embed&per_page=5';
    const feedContainer = document.getElementById('news-feed');
    const scrollContainer = document.getElementById('scroll-container');
    const loader = document.getElementById('loading-indicator');

    let page = 1;
    let isLoading = false;
    let hasMore = true;
    const LAST_SEEN_KEY = 'meridian_last_seen_id';
    let lastSeenId = parseInt(localStorage.getItem(LAST_SEEN_KEY)) || 0;

    // --- ДОПОМІЖНІ ФУНКЦІЇ ---

    function formatDate(dateString) {
        const d = new Date(dateString);
        return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
    }

    function getImageUrl(post) {
        try {
            const media = post._embedded['wp:featuredmedia'][0].media_details.sizes;
            return (media.large || media.full || media.medium_large).source_url;
        } catch (e) {
            return 'https://placehold.co/600x600/18181b/3f3f46?text=Meridian';
        }
    }

    function estimateReadingTime(contentHtml) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contentHtml;
        const text = tempDiv.textContent || tempDiv.innerText || "";
        return `${Math.ceil(text.split(/\s+/).length / 200)} хв`;
    }

    function getRelativeTime(dateString) {
        const now = new Date();
        const published = new Date(dateString);
        const diffMs = now - published;
        const diffMins = Math.round(diffMs / 60000);
        const diffHours = Math.round(diffMins / 60);
        const diffDays = Math.round(diffHours / 24);

        if (diffMins < 1) return 'Щойно';
        if (diffMins < 60) return `Опубліковано ${diffMins} хв тому`;
        if (diffHours < 24) return `Опубліковано ${diffHours} год тому`;
        return `Опубліковано ${diffDays} дн. тому`;
    }

    // --- ФУНКЦІЯ ОНОВЛЕННЯ ВІДЖЕТА ---
    function updateWidget(post) {
        const wTitle = document.getElementById('widget-last-news-title');
        const wDesc = document.getElementById('widget-last-news-desc');
        const wTime = document.getElementById('widget-last-news-time');

        if (wTitle && post.title) {
            wTitle.innerHTML = post.title.rendered;
        }

        if (wDesc && post.excerpt) {
            // Очищаємо HTML теги з уривка
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = post.excerpt.rendered;
            // Обрізаємо до 120 символів
            let text = tempDiv.textContent || tempDiv.innerText || '';
            if (text.length > 170) text = text.substring(0, 170) + '...';
            wDesc.innerText = text;
        }

        if (wTime && post.date) {
            wTime.innerText = getRelativeTime(post.date);
        }
    }

    // --- ЛОГІКА НОВИН ---

    window.openArticle = function (post, date) {
        const overlay = document.getElementById('article-overlay');
        const viewTitle = document.getElementById('view-title');
        const viewBody = document.getElementById('view-body');
        const viewDate = document.getElementById('view-date');
        const viewReadTime = document.getElementById('view-read-time');
        const articleScroll = document.getElementById('article-scroll');

        if (!overlay) return;

        if (viewTitle) viewTitle.innerHTML = post.title.rendered;
        if (viewDate) viewDate.innerText = date;

        const text = post.content.rendered.replace(/<[^>]*>/g, '');
        const minutes = Math.ceil(text.split(/\s+/).length / 200);
        if (viewReadTime) viewReadTime.innerText = `${minutes} хв`;

        if (viewBody) {
            viewBody.innerHTML = post.content.rendered;
            viewBody.querySelectorAll('a').forEach(a => {
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
            });
            viewBody.querySelectorAll('p').forEach(p => {
                if (!p.innerText.trim() && !p.querySelector('img')) p.remove();
            });
        }

        if (articleScroll) articleScroll.scrollTop = 0;

        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
    };

    window.closeArticle = function () {
        const overlay = document.getElementById('article-overlay');
        const viewBody = document.getElementById('view-body');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                if (viewBody) viewBody.innerHTML = '';
            }, 400);
        }
    };

    function createPostCard(post, isNew) {
        const imgUrl = getImageUrl(post);
        const date = formatDate(post.date);
        const readTime = estimateReadingTime(post.content.rendered);

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = post.excerpt.rendered;
        const plainText = (tempDiv.textContent || '').substring(0, 100) + '...';

        const card = document.createElement('article');
        card.className = 'glass-card rounded-[24px] p-2 m-1 transition-transform duration-300 active:scale-[0.98] cursor-pointer group';

        const badgeHtml = isNew
            ? `<div class="flex items-center gap-2 mr-3">
                 <span class="w-1.5 h-1.5 rounded-full bg-brand-cyan shadow-[0_0_8px_rgba(0,242,234,0.6)] animate-pulse"></span>
                 <span class="text-[10px] font-bold text-brand-cyan tracking-wider font-display uppercase">НОВЕ</span>
               </div>` : ``;

        card.innerHTML = `
            <div class="relative w-full overflow-hidden rounded-2xl mb-3 border border-white/5 bg-black/20">
                <img src="${imgUrl}" loading="lazy" class="w-full h-auto max-h-[550px] object-contain mx-auto transition-transform duration-500 group-hover:scale-105" alt="News">
            </div>
            <div class="px-2 pb-2">
                <div class="flex items-center mb-3 min-h-[24px]">
                    ${badgeHtml} 
                    <div class="flex items-center gap-1 text-white/50">
                        <i class="fa-regular fa-clock text-[12px]"></i>
                        <span class="text-[11px] font-medium font-display">${readTime}</span>
                    </div>
                    <div class="px-2 py-1 bg-white/5 rounded-lg border border-white/5 text-[11px] font-bold text-white/80 font-display ml-auto">
                        ${date}
                    </div>
                </div>
                <p class="text-[15px] text-white/70 leading-relaxed font-light mb-4">
                    <span class="text-white font-medium">@meridian</span> ${plainText}
                </p>
                <button class="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-sm font-medium text-brand-white transition-colors flex items-center justify-center gap-2 pointer-events-none">
                    <span>Читати повністю</span>
                    <i class="fa-solid fa-arrow-right text-sm"></i>
                </button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            e.preventDefault();
            window.openArticle(post, date);
        });

        return card;
    }

    async function loadNews() {
        if (isLoading || !hasMore) return;
        isLoading = true;

        // Показуємо лоадер тільки якщо є контейнер і це не перше завантаження "в фоні"
        if (page > 1 && loader) loader.classList.remove('hidden');

        try {
            const res = await fetch(`${API_URL}&page=${page}`);
            if (!res.ok) throw new Error('Failed');
            const posts = await res.json();

            // 1. ОНОВЛЕННЯ ВІДЖЕТА (Тільки для першої сторінки)
            if (page === 1 && posts.length > 0) {
                updateWidget(posts[0]);
            }

            // Якщо немає контейнера стрічки (наприклад, ми на іншому екрані), 
            // але ми оновили віджет - виходимо, не малюємо картки
            if (!feedContainer) {
                isLoading = false;
                return;
            }

            if (page === 1) {
                const skeletons = document.getElementById('skeletons');
                if (skeletons) skeletons.remove();
            } else {
                if (loader) loader.classList.add('hidden');
            }

            if (posts.length === 0) {
                hasMore = false;
                return;
            }

            let newestId = posts[0].id;
            posts.forEach(post => {
                feedContainer.appendChild(createPostCard(post, post.id > lastSeenId));
            });

            if (page === 1 && newestId > lastSeenId) {
                localStorage.setItem(LAST_SEEN_KEY, newestId);
                lastSeenId = newestId;
            }
            page++;
        } catch (err) {
            console.error(err);
        } finally {
            isLoading = false;
        }
    }

    // Запускаємо завантаження
    loadNews();

    if (scrollContainer) {
        scrollContainer.addEventListener('scroll', () => {
            if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 400) {
                loadNews();
            }
        });
    }
});
