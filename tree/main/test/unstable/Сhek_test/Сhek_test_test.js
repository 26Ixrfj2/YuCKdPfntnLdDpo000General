// ==UserScript==
// @name         Anime 365 Crunchyroll Controls & Diagnostics
// @namespace    http://tampermonkey.net
// @version      1.2
// @description  Кнопки «Обновить» (сброс кэша) и «Тест» (диагностика загрузки) в body > nav
// @match        *://*.smotret-anime.app/*
// @match        *://smotret-anime.app/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    var USER = 'Ruroll';
    var REPO = 'WB35RWQwFRFijt000IMG';
    var POSTER_CACHE_NAME = 'cr-posters-cache-v8';
    var LOGO_CACHE_NAME = 'cr-logos-cache-v8';

    var PROTO = 'https' + '://';
    var BASE_RAWGH = PROTO + 'raw' + '.githubusercontent' + '.com/' + USER + '/' + REPO + '/main/';
    var BASE_STATICALLY = PROTO + 'cdn' + '.statically' + '.io/gh/' + USER + '/' + REPO + '/main/';

    var testGen = 0;

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

    function getSavedRouteInfo(key) {
        try {
            if (typeof GM_getValue === 'function') {
                var raw = GM_getValue(key, '');
                if (raw) return JSON.parse(raw);
            }
        } catch (e) {}
        return null;
    }

    function clearPageStorages(animeId) {
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue('cr_route_v8_' + animeId, '');
                GM_setValue('cr_logo_route_v8_' + animeId, '');
            }
        } catch (e) {}

        var promises = [];
        if ('caches' in window) {
            promises.push(
                caches.open(POSTER_CACHE_NAME)
                    .then(function(c) { return c.delete('https://cr-cache.local' + animeId); })
                    .catch(function() {})
            );
            promises.push(
                caches.open(LOGO_CACHE_NAME)
                    .then(function(c) { return c.delete('https://cr-logo-cache.local' + animeId); })
                    .catch(function() {})
            );
        }
        return Promise.all(promises);
    }

    function ensureRefreshButton(animeId, nav) {
        var btn = document.getElementById('cr-cache-reset-btn');
        if (!animeId || !nav) {
            if (btn) btn.style.display = 'none';
            return;
        }
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'cr-cache-reset-btn';
            btn.type = 'button';
            btn.title = 'Сбросить кэш постера и логотипа для текущей страницы';
            btn.innerHTML = '↻ Обновить';
            btn.style.cssText =
                'position: absolute;' +
                'right: 14px;' +
                'top: 50%;' +
                'transform: translateY(-50%);' +
                'z-index: 9999;' +
                'height: 30px;' +
                'line-height: 28px;' +
                'padding: 0 12px;' +
                'background: rgba(244, 117, 33, 0.16);' +
                'color: #f47521;' +
                'border: 1px solid rgba(244, 117, 33, 0.55);' +
                'border-radius: 3px;' +
                'font-size: 12px;' +
                'font-weight: 600;' +
                'font-family: Roboto, Lato, sans-serif;' +
                'cursor: pointer;';

            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var curId = getAnimeId();
                if (!curId) return;

                btn.innerHTML = '↻ Сброс...';
                clearPageStorages(curId).then(function() {
                    window.dispatchEvent(new CustomEvent('cr-reset-page-cache', {
                        detail: { animeId: curId }
                    }));
                    setTimeout(function() {
                        btn.innerHTML = '↻ Обновить';
                    }, 800);
                });
            });

            if (getComputedStyle(nav).position === 'static') {
                nav.style.position = 'relative';
            }
            nav.appendChild(btn);
        }
        btn.style.display = 'inline-block';
    }
    function probeUrlList(urls, label, addLog, isCancelled, onDone) {
        function next(idx) {
            if (isCancelled()) return;
            if (idx >= urls.length) {
                addLog('  ✗ ' + label + ': не найдено в базе (проверено вариантов: ' + urls.length + ')', 'err');
                onDone(null);
                return;
            }
            var url = urls[idx];
            var fileName = url.split('/main/').pop();
            var hostTag = url.indexOf('statically') !== -1 ? 'Statically' : 'RawGH';
            var t0 = performance.now();

            GM_xmlhttpRequest({
                method: 'GET',
                url: url + '?_t=' + Date.now(),
                responseType: 'blob',
                timeout: 15000,
                onload: function(res) {
                    if (isCancelled()) return;
                    var dt = Math.round(performance.now() - t0);
                    if (res.status === 200 && res.response && res.response.size > 100) {
                        addLog('  ✓ НАЙДЕНО [' + hostTag + ']: ' + fileName + ' (' + res.response.size + ' байт, ' + dt + 'мс)', 'ok');
                        onDone(url);
                    } else {
                        next(idx + 1);
                    }
                },
                onerror: function() {
                    if (isCancelled()) return;
                    next(idx + 1);
                },
                ontimeout: function() {
                    if (isCancelled()) return;
                    addLog('  ! Таймаут: ' + fileName, 'err');
                    next(idx + 1);
                }
            });
        }
        next(0);
    }

    function runPosterDiagnostic() {
        var animeId = getAnimeId();
        if (!animeId) return;

        var myGen = ++testGen;
        var isCancelled = function() { return myGen !== testGen; };

        var oldModal = document.getElementById('cr-diag-modal');
        if (oldModal) oldModal.remove();

        var modal = document.createElement('div');
        modal.id = 'cr-diag-modal';
        modal.style.cssText =
            'position: fixed; top: 64px; right: 16px; width: 490px; max-width: calc(100vw - 32px);' +
            'max-height: 75vh; background: #141519; color: #e6e6e6; border: 1px solid #333;' +
            'border-radius: 6px; z-index: 999999; font-family: monospace; font-size: 12px;' +
            'display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.85);';

        modal.innerHTML =
            '<div style="padding: 10px 14px; background: #1f2127; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">' +
            '  <strong style="color: #29b6f6;">Диагностика ID: ' + animeId + '</strong>' +
            '  <button id="cr-diag-close" style="background: none; border: none; color: #aaa; font-size: 16px; cursor: pointer;">✕</button>' +
            '</div>' +
            '<div id="cr-diag-log" style="padding: 12px; overflow-y: auto; line-height: 1.5; white-space: pre-wrap;"></div>';

        document.body.appendChild(modal);
        document.getElementById('cr-diag-close').onclick = function() { testGen++; modal.remove(); };

        var logBox = document.getElementById('cr-diag-log');
        function addLog(text, type) {
            var line = document.createElement('div');
            line.textContent = text;
            if (type === 'ok') line.style.color = '#66bb6a';
            else if (type === 'err') line.style.color = '#ef5350';
            else if (type === 'info') line.style.color = '#29b6f6';
            else if (type === 'dim') line.style.color = '#9e9e9e';
            logBox.appendChild(line);
            logBox.scrollTop = logBox.scrollHeight;
        }

        var savedPoster = getSavedRouteInfo('cr_route_v8_' + animeId);
        var savedLogo = getSavedRouteInfo('cr_logo_route_v8_' + animeId);

        addLog('=== 1. Проверка сохранённых маршрутов и DOM ===', 'info');
        var host = document.getElementById('cr-poster-host');
        var canvas = host && host.shadowRoot && host.shadowRoot.querySelector('.bg-canvas');
        var isPosterReady = !!(canvas && canvas.getAttribute('data-loaded') === 'true');
        var logoEl = host && host.shadowRoot && host.shadowRoot.getElementById('cr-anime-logo');

        addLog('DOM Постер: ' + (isPosterReady ? 'Отрисован (' + canvas.width + 'x' + canvas.height + ')' : 'Отсутствует (баннер отключен)'), isPosterReady ? 'ok' : 'dim');
        addLog('DOM Логотип: ' + (logoEl ? 'Отрисован' : 'Отсутствует'), logoEl ? 'ok' : 'dim');
        addLog('Кэш маршрута постера: ' + (savedPoster ? savedPoster.url.split('/main/').pop() + ' [' + savedPoster.mode + ']' : 'нет записи'), 'dim');
        addLog('Кэш маршрута логотипа: ' + (savedLogo ? savedLogo.url.split('/main/').pop() + ' [' + savedLogo.align + ']' : 'нет записи'), 'dim');

        var exts = ['.jpg', '.png', '.webp', '.JPG', '.PNG', '.jpeg', '.WEBP'];
        var posterUrls = [];
        if (savedPoster && savedPoster.url) posterUrls.push(savedPoster.url);
        ['PosterRS/', 'PostersBS/', 'posters/'].forEach(function(dir) {
            exts.forEach(function(ext) {
                var u = BASE_RAWGH + dir + animeId + ext;
                if (posterUrls.indexOf(u) === -1) posterUrls.push(u);
            });
        });
        ['.jpg', '.png', '.webp'].forEach(function(ext) {
            ['PosterRS/', 'PostersBS/', 'posters/'].forEach(function(dir) {
                posterUrls.push(BASE_STATICALLY + dir + animeId + ext);
            });
        });

        var logoUrls = [];
        if (savedLogo && savedLogo.url) logoUrls.push(savedLogo.url);
        ['Logo/', 'LogoCNT/'].forEach(function(dir) {
            exts.forEach(function(ext) {
                var u = BASE_RAWGH + dir + animeId + ext;
                if (logoUrls.indexOf(u) === -1) logoUrls.push(u);
            });
        });
        ['.png', '.jpg', '.webp'].forEach(function(ext) {
            ['Logo/', 'LogoCNT/'].forEach(function(dir) {
                logoUrls.push(BASE_STATICALLY + dir + animeId + ext);
            });
        });

        addLog('\n=== 2. Сетевой поиск постера ===', 'info');
        probeUrlList(posterUrls, 'Постер', addLog, isCancelled, function() {
            if (isCancelled()) return;
            addLog('\n=== 3. Сетевой поиск логотипа ===', 'info');
            probeUrlList(logoUrls, 'Логотип', addLog, isCancelled, function() {
                if (isCancelled()) return;
                addLog('\nДиагностика завершена.', 'info');
            });
        });
    }

    function ensureTestButton(animeId, nav) {
        var btn = document.getElementById('cr-poster-test-btn');
        if (!animeId || !nav) {
            if (btn) btn.style.display = 'none';
            return;
        }
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'cr-poster-test-btn';
            btn.type = 'button';
            btn.title = 'Запустить диагностику загрузки постера и логотипа';
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

    function syncControls() {
        var animeId = getAnimeId();
        var nav = document.querySelector('body > nav');
        ensureRefreshButton(animeId, nav);
        ensureTestButton(animeId, nav);
    }

    window.addEventListener('popstate', syncControls);
    setInterval(syncControls, 500);
})();
