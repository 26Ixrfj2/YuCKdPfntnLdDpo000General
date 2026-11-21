// ==UserScript==
// @name         Anime365 Cinema Mode (Version A1.16 - Single Scroll Trigger)
// @namespace    http://tampermonkey.net
// @version      1.16.0
// @description  Based on A1.10. Performs smart scroll strictly ONCE after cinema-mode toggle or dynamic player content update.
// @match        https://smotret-anime.app*
// @match        https://*.smotret-anime.app/*
// @grant        none
// @run-at       document-start
// ==/UserScript==
(function() {
    'use strict';
    
    // Переменные для отслеживания уникальности контента плеера и состояний
    let lastPlayerStateKey = '';
    let isCinemaModeActive = false;

    const styleTag = document.createElement('style');
    styleTag.id = 'cinema-mode-styles';
    styleTag.innerText = `
        body div.body-container > div > div > div > div.col.s12.m8.l9.col-even > div:nth-child(2) {
            position: relative !important;
        }
        .cinema-emergency-btn {
            position: absolute !important; bottom: 10px !important; left: calc(50% - 20%) !important;
            transform: translateX(-50%) !important; z-index: 2147483647 !important; width: 3.8em !important; height: 16px !important;   
            cursor: pointer !important; background-color: transparent !important; border: none !important;
            color: rgba(255, 255, 255, 0.8) !important; font-size: 15px !important; font-family: Arial, sans-serif !important;
            font-weight: 900 !important; display: inline-flex !important; align-items: center !important;
            justify-content: center !important; line-height: 1 !important; box-shadow: none !important;
            transition: text-shadow 0.25s ease-in-out, color 0.25s ease-in-out !important;
        }
        .cinema-emergency-btn:hover {
            color: #ffffff !important;
            text-shadow: 0px 0px 8px rgba(255, 255, 255, 1.0), 0px 0px 16px rgba(255, 255, 255, 0.6) !important; 
        }

        /* --- КИНОРЕЖИМ: НАСТРОЙКА КАРКАСА СЕТКИ --- */
        body.cinema-mode div.body-container > div > div > div.row {
            display: grid !important;
            grid-template-columns: 75% 25% !important;
            row-gap: 8px !important;
            column-gap: 0px !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
        }

        body.cinema-mode div.body-container > div > div > div > div.col.s12.m8.l9.col-even {
            display: contents !important;
        }

        body.cinema-mode div.body-container > div > div > div > div.col.s12.m8.l9.col-even > div:nth-child(1),
        body.cinema-mode div.body-container > div > div > div > div.col.s12.m8.l9.col-even > div:nth-child(2) {
            grid-column: 1 / span 2 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin-bottom: 8px !important;
            box-sizing: border-box !important;
        }

        /* --- ЛЕВАЯ КОЛОНКА НИЖЕ ПЛЕЕРА --- */
        body.cinema-mode div.body-container > div > div > div > div.col.s12.m8.l9.col-even > div:nth-child(n+3),
        body.cinema-mode #comments {
            grid-column: 1 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            margin-bottom: 8px !important;
            margin-top: 0px !important;
        }

        body.cinema-mode .comments-spoiler-btn {
            grid-column: 1 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            margin-top: 35px !important;
            margin-bottom: 8px !important;
        }

        body.cinema-mode .video-container, body.cinema-mode #videoFrame, body.cinema-mode .card-content {
            width: 100% !important; max-width: 100% !important;
        }
        body.cinema-mode .video-container { height: auto !important; aspect-ratio: 16 / 9 !important; }
        body.cinema-mode #videoFrame { height: 100% !important; }

        /* --- ПРАВАЯ КОЛОНКА --- */
        body.cinema-mode div.body-container > div > div > div > div.col.s12.m4.l3.col-even {
            grid-column: 2 !important;
            grid-row: 3 / span 30 !important;
            width: 100% !important;
            max-width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
            margin-top: 0 !important; 
            top: 0 !important;
            position: relative !important;
            box-sizing: border-box !important;
            padding-right: 0px !important; 
            padding-left: 15px !important; 
        }

        body.cinema-mode div.body-container > div > div > div > div.col.s12.m4.l3.col-even > * {
            margin-bottom: 8px !important;
            margin-top: 0px !important;
            width: 100% !important;
        }

        body.cinema-mode div.body-container > div > div > div > div.col.s12.m4.l3.col-even .m-catalog-item__poster,
        body.cinema-mode div.body-container > div > div > div > div.col.s12.m4.l3.col-even [class*="poster"] {
            display: none !important;
        }
        .m-comments-invite, div[class*="m-comments-invite"] { display: none !important; }

        /* --- SPOILER COMMENTS --- */
        #comments { display: none; margin-top: 15px !important; width: 100% !important; }
        #comments.spoiler-open { display: block !important; }
        .comments-spoiler-btn {
            display: block !important; width: 100% !important; padding: 12px !important; background-color: #35363a !important; 
            color: rgba(255, 255, 255, 0.8) !important; border: 1px solid #4a4b50 !important; border-radius: 4px !important;
            cursor: pointer !important; font-size: 14px !important; font-weight: bold !important; text-align: center !important;
            margin-top: 20px !important; margin-bottom: 20px !important; transition: all 0.25s ease-in-out !important; box-shadow: none !important;
        }
        .comments-spoiler-btn:hover {
            color: #ffffff !important; background-color: #4a4b50 !important; border-color: rgba(255, 255, 255, 0.6) !important;
            text-shadow: 0px 0px 8px rgba(255, 255, 255, 1.0), 0px 0px 14px rgba(255, 255, 255, 0.5) !important;
            box-shadow: 0px 0px 10px rgba(255, 255, 255, 0.3) !important;
        }
    `;

    // Единоразовая умная прокрутка
    function singleCheckAndScroll(container) {
        if (!container) return;
        
        // Даем 100мс на корректный просчет новых размеров DOM-элементов плеера сайтом
        setTimeout(() => {
            const rect = container.getBoundingClientRect();
            // Проверяем, виден ли нижний край плеера на экране
            const isBottomVisible = (rect.bottom >= 0 && rect.bottom <= window.innerHeight);

            // Скроллим только если элемент реально находится за пределами экрана
            if (!isBottomVisible) {
                const absoluteBottom = window.pageYOffset + rect.bottom;
                window.scrollTo({
                    top: absoluteBottom - window.innerHeight + 15,
                    behavior: 'smooth'
                });
            }
        }, 100);
    }

    function injectAndFilter() {
        const targetContainer = document.querySelector('body div.body-container > div > div > div > div.col.s12.m8.l9.col-even > div:nth-child(2)');
        
        const playerExists = !!targetContainer;
        if (!playerExists && document.body.classList.contains('cinema-mode')) {
            document.body.classList.remove('cinema-mode');
            window.dispatchEvent(new Event('resize'));
        }

        if (!document.getElementById('cinema-mode-styles') && document.head) {
            document.head.appendChild(styleTag);
        }

        if (targetContainer) {
            let btn = targetContainer.querySelector('.cinema-emergency-btn');
            if (!btn) {
                btn = document.createElement('button');
                btn.className = 'cinema-emergency-btn';
                btn.type = 'button';
                
                if (document.body.classList.contains('cinema-mode')) {
                    btn.title = 'Обычный экран';
                    btn.innerText = '🡆🡄';
                } else {
                    btn.title = 'Широкий экран';
                    btn.innerText = '🡄🡆';
                }

                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    document.body.classList.toggle('cinema-mode');
                    
                    if (document.body.classList.contains('cinema-mode')) {
                        btn.title = 'Обычный экран';
                        btn.innerText = '🡆🡄';
                        // Вызов разового скролла при ручном включении режима кнопки
                        singleCheckAndScroll(targetContainer);
                    } else {
                        btn.title = 'Широкий экран';
                        btn.innerText = '🡄🡆';
                    }
                    
                    window.dispatchEvent(new Event('resize'));
                });
                targetContainer.appendChild(btn);
            } else {
                if (document.body.classList.contains('cinema-mode')) {
                    if (btn.innerText !== '🡆🡄') btn.innerText = '🡆🡄';
                    if (btn.title !== 'Обычный экран') btn.title = 'Обычный экран';
                } else {
                    if (btn.innerText !== '🡄🡆') btn.innerText = '🡄🡆';
                    if (btn.title !== 'Широкий экран') btn.title = 'Широкий экран';
                }
            }

            if (btn.style.display !== 'inline-flex') {
                btn.style.setProperty('display', 'inline-flex', 'important');
            }
// ЕДИНАРОДНЫЙ СКРОЛЛ ПРИ ОБНОВЛЕНИИ СТРАНИЦЫ / СМЕНЕ СЕРИИ
if (document.body.classList.contains('cinema-mode')) {
// Вычисляем уникальный ключ состояния плеера (по внутренней ссылке iframe или ID видео)
const iframe = targetContainer.querySelector('iframe');
const currentKey = iframe ? iframe.src : targetContainer.innerHTML.length.toString();
// Если мы находимся в широком режиме и контент плеера ИЗМЕНИЛСЯ (переключили серию/озвучку)
if (currentKey !== lastPlayerStateKey) {
lastPlayerStateKey = currentKey;
// Запуск скролла строго ОДИН РАЗ за сессию обновления
singleCheckAndScroll(targetContainer);
}
} else {
// Сбрасываем ключ при выключенном режиме, чтобы он корректно отработал при повторном включении
lastPlayerStateKey = '';
}
}
const commentsBlock = document.getElementById('comments');
if (commentsBlock) {
let spoilerBtn = document.querySelector('.comments-spoiler-btn');
if (!spoilerBtn) {
spoilerBtn = document.createElement('button');
spoilerBtn.className = 'comments-spoiler-btn';
spoilerBtn.type = 'button';
spoilerBtn.innerText = 'Показать комментарии';
spoilerBtn.addEventListener('click', function(e) {
e.preventDefault();
commentsBlock.classList.toggle('spoiler-open');
if (commentsBlock.classList.contains('spoiler-open')) {
spoilerBtn.innerText = 'Скрыть комментарии';
} else {
spoilerBtn.innerText = 'Показать комментарии';
}
});
commentsBlock.parentNode.insertBefore(spoilerBtn, commentsBlock);
}
}
if (document.body) {
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
let node;
while (node = walker.nextNode()) {
const text = node.nodeValue;
if (text.includes("Подписывайтесь на канал") || text.includes("Поделиться аниме:") || text.includes("Давайте обсудим это аниме!")) {
const parentElement = node.parentElement;
if (parentElement) {
const targetBlock = parentElement.closest('.col-even > div') || parentElement.closest('div.card') || parentElement.closest('.card-content > div') || parentElement.closest('.m-comments-invite');
if (targetBlock && !targetBlock.classList.contains('body-container') && !targetBlock.classList.contains('col-even') && targetBlock.style.display !== 'none') {
targetBlock.style.setProperty('display', 'none', 'important');
}
}
}
}
}
}
setInterval(injectAndFilter, 200);
})();
