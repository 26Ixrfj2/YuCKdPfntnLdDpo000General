// ==UserScript==
// @name         Anime 365 Poster Diagnostic Test
// @namespace    http://tampermonkey.net
// @version      1.0
// @description  Кнопка Тест рядом с Обновить в body > nav: показывает активное состояние загрузки постера, Пауза и Копирование
// @match        *://*.smotret-anime.app/*
// @match        *://smotret-anime.app/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    var USER = 'Ruroll';
    var REPO = 'WB35RWQwFRFijt000IMG';
    var CACHE_NAME = 'cr-posters-cache-v7';

    var PROTO = 'https' + '://';
    var BASE_RAWGH = PROTO + 'raw' + '.githubusercontent' + '.com/' + USER + '/' + REPO + '/main/';
    var BASE_STATICALLY = PROTO + 'cdn' + '.statically' + '.io/gh/' + USER + '/' + REPO + '/main/';
    var BASE_GITHACK = PROTO + 'raw' + '.githack' + '.com/' + USER + '/' + REPO + '/main/';

    var isPaused = false;
    var isRunning = false;
    var testGen = 0;
    var logsHtml = [];
    var logsPlain = [];

    function getAnimeId() {
        var path = window.location.pathname.replace(/\/+$/, '');
        var segments = path.split('/').filter(Boolean);
        if (segments.length !== 2 || segments.at(0) !== 'catalog') return null;
        var slug = segments.at(1);
        var dashIdx = slug.lastIndexOf('-');
        if (dashIdx === -1) return null;
        var id = slug.slice(dashIdx + 1);
        return /^\d+$/.test(id) ? id : null;
    }

    function addLog(msg, level) {
        var color = '#d4d4d4';
        if (level === 'ok') color = '#00ff88';
        else if (level === 'err') color = '#ff5555';
        else if (level === 'warn') color = '#ffbb33';
        else if (level === 'info') color = '#4fc3f7';

        var t = new Date().toLocaleTimeString();
        logsHtml.push('<span style="color:#777">[' + t + ']</span> <span style="color:' + color + '">' + msg + '</span>');
        logsPlain.push('[' + t + '] ' + msg.replace(/<[^>]*>/g, ''));
        renderPanel();
    }

    function ensurePanel() {
        var panel = document.getElementById('cr-poster-test-panel');
        if (panel) return panel;

        panel = document.createElement('div');
        panel.id = 'cr-poster-test-panel';
        panel.style.cssText =
            'position: fixed;' +
            'bottom: 14px;' +
            'right: 14px;' +
            'width: 540px;' +
            'max-width: 95vw;' +
            'background: rgba(14, 15, 19, 0.97);' +
            'border: 2px solid #29b6f6;' +
            'border-radius: 6px;' +
            'padding: 10px 12px;' +
            'font-family: monospace;' +
            'font-size: 11.5px;' +
            'line-height: 1.45;' +
            'color: #eee;' +
            'z-index: 2147483647;' +
            'box-shadow: 0 6px 28px rgba(0,0,0,0.92);' +
            'user-select: text;';

        panel.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #333;padding-bottom:6px;margin-bottom:6px;gap:8px;">' +
            '  <span id="cr-pt-status" style="color:#29b6f6;font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">ТЕСТ ПОСТЕРА: Готов</span>' +
            '  <div style="display:flex;gap:6px;flex-shrink:0;">' +
            '    <button id="cr-pt-pause" type="button" style="background:#333;color:#fff;border:1px solid #666;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:11px;">Пауза</button>' +
            '    <button id="cr-pt-copy" type="button" style="background:#29b6f6;color:#000;font-weight:bold;border:none;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:11px;">Скопировать</button>' +
            '    <button id="cr-pt-close" type="button" style="background:#442222;color:#ff8888;border:1px solid #773333;padding:2px 7px;border-radius:3px;cursor:pointer;font-size:11px;">✕</button>' +
            '  </div>' +
            '</div>' +
            '<div id="cr-pt-active" style="color:#ffbb33;margin-bottom:6px;word-break:break-all;font-size:11px;"></div>' +
            '<div id="cr-pt-body" style="max-height:260px;overflow-y:auto;user-select:text;background:#090a0d;padding:6px 8px;border-radius:4px;"></div>';

        document.body.appendChild(panel);

        document.getElementById('cr-pt-pause').addEventListener('click', function() {
            isPaused = !isPaused;
            this.textContent = isPaused ? 'Продолжить' : 'Пауза';
            this.style.background = isPaused ? '#b71c1c' : '#333';
            setStatus(isPaused ? 'ПАУЗА (можно выделять и копировать)' : 'Идёт проверка...');
        });

        document.getElementById('cr-pt-copy').addEventListener('click', function() {
            var btn = this;
            var txt = logsPlain.join('\n');
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(txt);
            } else {
                var ta = document.createElement('textarea');
                ta.value = txt;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
            }
            btn.textContent = 'Скопировано!';
            setTimeout(function() { btn.textContent = 'Скопировать'; }, 1500);
        });

        document.getElementById('cr-pt-close').addEventListener('click', function() {
            testGen++;
            isRunning = false;
            panel.remove();
        });

        return panel;
    }

    function setStatus(text) {
        var el = document.getElementById('cr-pt-status');
        if (el) el.textContent = 'ТЕСТ ПОСТЕРА: ' + text;
    }

    function setActiveUrl(text) {
        var el = document.getElementById('cr-pt-active');
        if (el) el.textContent = text ? ('Активный запрос: ' + text) : '';
    }

    function renderPanel() {
        ensurePanel();
        if (isPaused) return;
        var body = document.getElementById('cr-pt-body');
        if (body) {
            body.innerHTML = logsHtml.join('<br>');
            body.scrollTop = body.scrollHeight;
        }
    }
      function runPosterDiagnostic() {
        var animeId = getAnimeId();
        isPaused = false;
        logsHtml = [];
        logsPlain = [];
        var myGen = ++testGen;
        isRunning = true;

        ensurePanel();
        var pauseBtn = document.getElementById('cr-pt-pause');
        if (pauseBtn) {
            pauseBtn.textContent = 'Пауза';
            pauseBtn.style.background = '#333';
        }

        if (!animeId) {
            setStatus('ID не найден в URL');
            addLog('Ошибка: текущий URL не соответствует странице /catalog/slug-ID: ' + window.location.href, 'err');
            isRunning = false;
            return;
        }

        setStatus('Проверка ID ' + animeId);
        addLog('=== СТАРТ ДИАГНОСТИКИ ПОСТЕРА ДЛЯ ID: <b>' + animeId + '</b> ===', 'info');

        // 1. Проверяем состояние DOM-элемента постера от основного скрипта
        var host = document.getElementById('cr-poster-host');
        if (!host) {
            addLog('DOM: #cr-poster-host отсутствует на странице (основной скрипт удалил его после ошибки или не запустился)', 'warn');
        } else {
            var stEl = host.shadowRoot && host.shadowRoot.getElementById('st');
            var canvasEl = host.shadowRoot && host.shadowRoot.querySelector('.bg-canvas');
            addLog('DOM: #cr-poster-host найден (data-anime-id=' + host.getAttribute('data-anime-id') + '), #st="' + (stEl ? stEl.textContent : 'нет') + '" (display=' + (stEl ? stEl.style.display : '-') + '), canvas=' + (canvasEl ? canvasEl.width + 'x' + canvasEl.height : 'нет'), 'info');
        }

        // 2. Проверяем сохранённый маршрут в GM_getValue
        var savedRaw = '';
        try {
            if (typeof GM_getValue === 'function') {
                savedRaw = GM_getValue('cr_route_v7_' + animeId, '');
            }
        } catch (e) {
            addLog('GM_getValue ошибка: ' + e, 'err');
        }
        addLog('GM_getValue (cr_route_v7_' + animeId + '): ' + (savedRaw || 'пусто'), 'info');

        // 3. Проверяем Cache API
        var cacheCheck = ('caches' in window)
            ? caches.open(CACHE_NAME).then(function(c) {
                return c.match('https://cr-cache.local' + animeId).then(function(r) {
                    if (!r) {
                        addLog('Cache API (' + CACHE_NAME + '): записи для ID ' + animeId + ' нет', 'warn');
                    } else {
                        return r.blob().then(function(b) {
                            addLog('Cache API (' + CACHE_NAME + '): найдена запись! size=' + b.size + ' B, type=' + b.type + ', X-CR-Mode=' + r.headers.get('X-CR-Mode'), 'ok');
                        });
                    }
                });
            }).catch(function(e) {
                addLog('Cache API ошибка: ' + e, 'err');
            })
            : Promise.resolve(addLog('Cache API не поддерживается в окне', 'err'));

        cacheCheck.then(function() {
            if (myGen !== testGen) return;

            var exts = ['.jpg', '.JPG', '.jpeg', '.png', '.webp', '.PNG', '.WEBP'];
            var queue = [];

            exts.forEach(function(ext) {
                queue.push({ url: BASE_RAWGH + 'PosterRS/' + animeId + ext, label: 'RAWGH/PosterRS/' + animeId + ext });
                queue.push({ url: BASE_STATICALLY + 'PosterRS/' + animeId + ext, label: 'STATICALLY/PosterRS/' + animeId + ext });
                queue.push({ url: BASE_GITHACK + 'PosterRS/' + animeId + ext, label: 'GITHACK/PosterRS/' + animeId + ext });
            });
            exts.forEach(function(ext) {
                queue.push({ url: BASE_RAWGH + 'PostersBS/' + animeId + ext, label: 'RAWGH/PostersBS/' + animeId + ext });
                queue.push({ url: BASE_STATICALLY + 'PostersBS/' + animeId + ext, label: 'STATICALLY/PostersBS/' + animeId + ext });
                queue.push({ url: BASE_GITHACK + 'PostersBS/' + animeId + ext, label: 'GITHACK/PostersBS/' + animeId + ext });
            });
            exts.forEach(function(ext) {
                queue.push({ url: BASE_RAWGH + 'posters/' + animeId + ext, label: 'RAWGH/posters/' + animeId + ext });
                queue.push({ url: BASE_STATICALLY + 'posters/' + animeId + ext, label: 'STATICALLY/posters/' + animeId + ext });
                queue.push({ url: BASE_GITHACK + 'posters/' + animeId + ext, label: 'GITHACK/posters/' + animeId + ext });
            });

            addLog('Запускаю проверку ' + queue.length + ' URL по очереди...', 'info');

            function step(idx) {
                if (myGen !== testGen) return;
                if (isPaused) {
                    setTimeout(function() { step(idx); }, 250);
                    return;
                }
                if (idx >= queue.length) {
                    setStatus('ФИНИШ (ничего не найдено)');
                    setActiveUrl('');
                    addLog('=== ФИНИШ: все ' + queue.length + ' ссылок проверены, рабочий постер не найден ===', 'err');
                    isRunning = false;
                    return;
                }

                var item = queue[idx];
                var t0 = performance.now();
                setStatus('Шаг ' + (idx + 1) + ' из ' + queue.length);
                setActiveUrl(item.url);
                addLog('[' + (idx + 1) + '/' + queue.length + '] Запрос -> ' + item.label);

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: item.url,
                    nocache: true,
                    headers: { 'Accept': 'image/*' },
                    responseType: 'blob',
                    timeout: 15000,
                    onload: function(res) {
                        if (myGen !== testGen) return;
                        var dt = Math.round(performance.now() - t0);
                        var sz = res.response ? res.response.size : 0;
                        var tp = res.response ? res.response.type : 'none';

                        if (res.status === 200 && sz > 500) {
                            addLog('  ↳ HTTP 200 за ' + dt + 'мс | size=' + sz + ' B | type=' + tp + ' -> проверяю createImageBitmap...', 'ok');
                            createImageBitmap(res.response).then(function(bmp) {
                                if (myGen !== testGen) return;
                                var dims = bmp.width + 'x' + bmp.height;
                                if (typeof bmp.close === 'function') bmp.close();
                                setStatus('УСПЕХ на шаге ' + (idx + 1) + ' (' + dims + ')');
                                setActiveUrl('');
                                addLog('=== УСПЕХ! Картинка валидна (' + dims + '): ' + item.url + ' ===', 'ok');
                                isRunning = false;
                            }).catch(function(err) {
                                addLog('  ↳ ОШИБКА декодирования createImageBitmap: ' + err, 'err');
                                step(idx + 1);
                            });
                        } else {
                            addLog('  ↳ Ответ HTTP ' + res.status + ' за ' + dt + 'мс (size=' + sz + ' B, type=' + tp + ')', 'warn');
                            step(idx + 1);
                        }
                    },
                    onerror: function(err) {
                        if (myGen !== testGen) return;
                        var dt = Math.round(performance.now() - t0);
                        addLog('  ↳ ОШИБКА СЕТИ за ' + dt + 'мс: status=' + (err && err.status) + ', finalUrl=' + (err && err.finalUrl), 'err');
                        step(idx + 1);
                    },
                    ontimeout: function() {
                        if (myGen !== testGen) return;
                        addLog('  ↳ ТАЙМАУТ (15 сек превышен)', 'err');
                        step(idx + 1);
                    }
                });
            }

            step(0);
        });
    }

    function ensureTestButton() {
        var nav = document.querySelector('body > nav');
        var animeId = getAnimeId();
        var btn = document.getElementById('cr-poster-test-btn');

        if (!animeId || !nav) {
            if (btn) btn.style.display = 'none';
            return;
        }

        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'cr-poster-test-btn';
            btn.type = 'button';
            btn.title = 'Запустить диагностику загрузки постера для текущей страницы';
            btn.textContent = 'Тест';
            btn.style.cssText =
                'position: absolute;' +
                'right: 118px;' +
                'top: 50%;' +
                'transform: translateY(-50%);' +
                'z-index: 9999;' +
                'height: 30px;' +
                'line-height: 28px;' +
                'padding: 0 12px;' +
                'background: rgba(41, 182, 246, 0.16);' +
                'color: #29b6f6;' +
                'border: 1px solid rgba(41, 182, 246, 0.55);' +
                'border-radius: 3px;' +
                'font-size: 12px;' +
                'font-weight: 600;' +
                'font-family: Roboto, Lato, sans-serif;' +
                'cursor: pointer;';

            btn.addEventListener('mouseenter', function() {
                btn.style.background = '#29b6f6';
                btn.style.color = '#000000';
            });
            btn.addEventListener('mouseleave', function() {
                btn.style.background = 'rgba(41, 182, 246, 0.16)';
                btn.style.color = '#29b6f6';
            });

            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                runPosterDiagnostic();
            });

            if (getComputedStyle(nav).position === 'static') {
                nav.style.position = 'relative';
            }
            nav.appendChild(btn);
        }
      btn.style.display = 'inline-block';
}
setInterval(ensureTestButton, 500);
})();


