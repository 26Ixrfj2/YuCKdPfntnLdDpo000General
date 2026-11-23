(function () {
    'use strict';

    const HOST_PREFIX = 'https://' + String.fromCharCode(99, 100, 110, 46) + 'jsdelivr.net/' + String.fromCharCode(103, 104);
    const GITHUB_BASE = `${HOST_PREFIX}/Ruroll/WB35RWQwFRFijt000IMG@main/Franchise`;

    let lastProcessedId = null;

    function parseFolderInfo(path) {
        if (!path) return null;
        const idMatch = path.match(/\[a365-(\d+)\]/i);
        if (!idMatch) return null;

        const folderName = path.split(/[/\\]/).pop();
        const slug = folderName
            .replace(/\[a365-\d+\]/i, '')
            .replace(/season\s*\d+/i, '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        return { id: idMatch.slice(1).shift(), slug: slug };
    }

    // Очистка точечных стилей при выходе со страницы тайтла
    function clearCustomTheme() {
        const oldStyle = document.getElementById('a365-custom-theme');
        if (oldStyle) oldStyle.remove();
        document.querySelectorAll('.itemDetailPage[data-a365-id]').forEach(el => {
            el.removeAttribute('data-a365-id');
        });
    }

    // Применение точечного дизайна строго к текущей странице
    async function applyCustomTheme(pageEl, titleBaseUrl, a365Id) {
        clearCustomTheme();
        pageEl.setAttribute('data-a365-id', a365Id);

        const styleEl = document.createElement('style');
        styleEl.id = 'a365-custom-theme';

        // 1. Базовый шаблон стилей только для этой страницы (пример для теста)
        let customCss = `
            .itemDetailPage[data-a365-id="${a365Id}"] .detailPagePrimaryContainer {
                background: linear-gradient(180deg, rgba(16, 32, 64, 0.85) 0%, rgba(10, 14, 24, 0.98) 100%) !important;
                border-bottom: 1px solid rgba(100, 160, 255, 0.25);
            }
            .itemDetailPage[data-a365-id="${a365Id}"] .detailButton {
                background-color: #1e3a6e !important;
                color: #ffffff !important;
                border-radius: 8px !important;
            }
            .itemDetailPage[data-a365-id="${a365Id}"] .listItem:hover {
                background: rgba(30, 58, 110, 0.35) !important;
                border-radius: 10px;
            }
        `;

        // 2. Если в папке тайтла на GitHub есть файл style.css — подгружаем и его!
        try {
            const cssRes = await fetch(`${titleBaseUrl}/style.css`);
            if (cssRes.ok) {
                const remoteCss = await cssRes.text();
                customCss += `\n/* Remote CSS from GitHub */\n${remoteCss}`;
            }
        } catch (e) {}

        styleEl.textContent = customCss;
        document.head.appendChild(styleEl);
    }

    async function applyCustomData(pageEl, itemId) {
        try {
            const userId = window.ApiClient.getCurrentUserId();
            const item = await window.ApiClient.getItem(userId, itemId);

            // Надежно ищем корневой сериал (работает и на странице тайтла, и внутри Сезона 1)
            let targetPath = item.Path;
            let seriesName = item.Name;

            if (!targetPath || item.Type !== 'Series') {
                const parentId = item.SeriesId || item.ParentId;
                if (parentId) {
                    const parentItem = await window.ApiClient.getItem(userId, parentId);
                    targetPath = parentItem.Path || targetPath;
                    seriesName = parentItem.Name || seriesName;
                }
            }

            const info = parseFolderInfo(targetPath);
            if (!info) {
                clearCustomTheme();
                return;
            }

            const titleBaseUrl = `${GITHUB_BASE}/${info.slug}/${info.id}`;

            // Применяем точечный дизайн страницы
            await applyCustomTheme(pageEl, titleBaseUrl, info.id);

            // 1. Загружаем episodes.js
            const response = await fetch(`${titleBaseUrl}/episodes.js`);
            if (!response.ok) return;
            const jsText = await response.text();
            const jsonMatch = jsText.match(/const\s+episodesData\s*=\s*(\{[\s\S]*?\});/);
            if (!jsonMatch) return;
            const episodesData = JSON.parse(jsonMatch.slice(1).shift());

            // 2. Главный постер
            const posterUrl = `${titleBaseUrl}/${info.id}.jpg`;
            const detailImgContainer = pageEl.querySelector('.detailImageContainer');
            if (detailImgContainer) {
                detailImgContainer.style.setProperty('display', 'block', 'important');
                let imgEl = detailImgContainer.querySelector('img');
                if (imgEl) {
                    imgEl.src = posterUrl;
                } else {
                    const cardBox = detailImgContainer.querySelector('.cardImageContainer') || detailImgContainer;
                    cardBox.style.setProperty('background-image', `url("${posterUrl}")`, 'important');
                    cardBox.style.setProperty('background-size', 'cover', 'important');
                    cardBox.style.setProperty('background-position', 'center', 'important');
                    if (cardBox.offsetHeight < 50) {
                        cardBox.style.setProperty('min-height', '310px', 'important');
                        cardBox.style.setProperty('min-width', '210px', 'important');
                    }
                }
            }

            // 3. Логотип вместо текстового заголовка
            const logoUrl = `${titleBaseUrl}/L${info.id}.png`;
            const titleContainer = pageEl.querySelector('.nameContainer .itemName, .itemName.infoText, h1.itemName');
            if (titleContainer && !titleContainer.querySelector('.custom-a365-logo')) {
                titleContainer.innerHTML = `<img class="custom-a365-logo" src="${logoUrl}" style="max-height: 110px; max-width: 100%; object-fit: contain; margin-bottom: 10px;" alt="${seriesName}">`;
            }

            // 4. Подмена карточек серий на странице сезона
            const updateEpisodes = () => {
                const epCards = pageEl.querySelectorAll('#childrenContent .listItem, .vertical-list .listItem');
                if (!epCards.length) return false;

                let updatedCount = 0;
                epCards.forEach((card, index) => {
                    if (card.getAttribute('data-type') === 'Season') return;

                    const epKey = `E${index + 1}`;
                    const epInfo = episodesData[epKey];
                    if (!epInfo) return;

                    const epImgUrl = `${titleBaseUrl}/episodes/${epKey}.jpg`;
                    const thumbEl = card.querySelector('.listItemImage');
                    if (thumbEl) {
                        thumbEl.querySelectorAll('img').forEach(img => img.remove());
                        thumbEl.style.setProperty('background-image', `url("${epImgUrl}")`, 'important');
                        thumbEl.style.setProperty('background-size', 'cover', 'important');
                        thumbEl.style.setProperty('background-position', 'center', 'important');
                    }

                    const nameEl = card.querySelector('.listItemBodyText:not(.secondary)');
                    if (nameEl) {
                        nameEl.textContent = `${index + 1}. ${epInfo.title}`;
                    }

                    const secEl = card.querySelector('.listItemBodyText.secondary');
                    if (secEl) {
                        secEl.textContent = `${epInfo.date} • ${epInfo.duration}`;
                    }

                    const overviewEl = card.querySelector('.listItemOverview');
                    if (overviewEl) {
                        overviewEl.textContent = epInfo.desc;
                    }
                    updatedCount++;
                });

                return updatedCount > 0;
            };

            let attempts = 0;
            const epTimer = setInterval(() => {
                attempts++;
                if (updateEpisodes() || attempts > 30) {
                    clearInterval(epTimer);
                }
            }, 300);

        } catch (err) {
            console.error('[A365] Ошибка:', err);
        }
    }

    const observer = new MutationObserver(() => {
        const activePage = document.querySelector('.page.itemDetailPage:not(.hide)');
        if (!activePage) {
            if (lastProcessedId !== null) {
                lastProcessedId = null;
                clearCustomTheme();
            }
            return;
        }

        const hash = window.location.hash;
        const match = hash.match(/[?&]id=([a-f0-9]+)/i);
        const currentId = match ? match.slice(1).shift() : null;

        if (currentId && currentId !== lastProcessedId) {
            lastProcessedId = currentId;
            setTimeout(() => applyCustomData(activePage, currentId), 500);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();

