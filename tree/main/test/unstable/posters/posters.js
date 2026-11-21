// ==UserScript==
// @name         Anime 365 Crunchyroll Banner (GitHub Loader)
// @namespace    http://tampermonkey.net
// @version      10.0
// @description  Кэширование постеров (Cache API + GM_setValue) и кнопка сброса кэша текущей страницы в body > nav
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
    var CACHE_NAME = 'cr-posters-cache-v3';
    var failedIds = {};
    var loadedCache = {};
    var isLoading = false;

    var PROTO = 'https' + '://';
    var BASE_RAWGH = PROTO + 'raw' + '.githubusercontent' + '.com/' + USER + '/' + REPO + '/main/';
    var BASE_STATICALLY = PROTO + 'cdn' + '.statically' + '.io/gh/' + USER + '/' + REPO + '/main/';
    var BASE_GITHACK = PROTO + 'raw' + '.githack' + '.com/' + USER + '/' + REPO + '/main/';

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

    function renderBitmap(bmp, mode, bannerBox, bgWrap, bCanvas, gradEl, st) {
        bCanvas.classList.remove('mode-rs', 'mode-bs');
        if (gradEl) gradEl.classList.remove('is-bs');
        if (mode === 'rs') {
            var realW = bgWrap.clientWidth || document.documentElement.clientWidth || 1920;
            var boxH = 820;
            bgWrap.style.height = boxH + 'px';
            bannerBox.style.paddingTop = '380px';
            bCanvas.width = realW;
            bCanvas.height = boxH;
            bCanvas.classList.add('mode-rs');
            drawRSFitInBanner(bCanvas.getContext('2d'), bmp, realW, boxH);
        } else if (mode === 'bs') {
            bgWrap.style.height = '920px';
            bannerBox.style.paddingTop = '520px';
            bCanvas.width = bmp.width;
            bCanvas.height = bmp.height;
            bCanvas.classList.add('mode-bs');
            if (gradEl) gradEl.classList.add('is-bs');
            bCanvas.getContext('2d').drawImage(bmp, 0, 0);
        } else {
            bgWrap.style.height = '780px';
            bannerBox.style.paddingTop = '380px';
            bCanvas.width = bmp.width;
            bCanvas.height = bmp.height;
            bCanvas.getContext('2d').drawImage(bmp, 0, 0);
        }
        if (st) st.style.display = 'none';
    }

    function readFromPersistentCache(animeId) {
        if (!('caches' in window)) return Promise.resolve(null);
        return caches.open(CACHE_NAME).then(function(cache) {
            return cache.match('https://cr-cache.local' + animeId).then(function(resp) {
                if (!resp) return null;
                var mode = resp.headers.get('X-CR-Mode') || 'default';
                return resp.blob().then(function(blob) {
                    return { blob: blob, mode: mode };
                });
            });
        }).catch(function() {
            return null;
        });
    }

    function saveToPersistentCache(animeId, blob, mode) {
        if (!('caches' in window)) return;
        caches.open(CACHE_NAME).then(function(cache) {
            var resp = new Response(blob, {
                headers: {
                    'Content-Type': blob.type || 'image/jpeg',
                    'X-CR-Mode': mode
                }
            });
            cache.put('https://cr-cache.local' + animeId, resp);
        }).catch(function() {});
    }

    function clearPersistentCache(animeId) {
        if (!('caches' in window)) return Promise.resolve();
        return caches.open(CACHE_NAME).then(function(cache) {
            return cache.delete('https://cr-cache.local' + animeId);
        }).catch(function() {});
    }

    function getSavedRoute(animeId) {
        try {
            if (typeof GM_getValue === 'function') {
                var raw = GM_getValue('cr_route_v3_' + animeId, '');
                if (raw) return JSON.parse(raw);
            }
        } catch (e) {}
        return null;
    }

    function saveRoute(animeId, url, mode) {
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue('cr_route_v3_' + animeId, JSON.stringify({ url: url, mode: mode }));
            }
        } catch (e) {}
    }

    function clearSavedRoute(animeId) {
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue('cr_route_v3_' + animeId, '');
            }
        } catch (e) {}
    }

    function initBanner(animeId, forceFresh) {
        if (document.getElementById('cr-poster-host') || failedIds[animeId] || isLoading) return;
        isLoading = true;

        var host = document.createElement('div');
        host.id = 'cr-poster-host';
        host.setAttribute('data-anime-id', animeId);
        host.style.cssText = 'display: block; width: 100%; clear: both; position: relative; z-index: 10; margin: 0; padding: 0;';

        var shadow = host.attachShadow({ mode: 'open' });
        shadow.innerHTML =
            '<style>' +
            '* { box-sizing: border-box; margin: 0; padding: 0; border: none; }' +
            '.banner { position: relative; width: 100%; background: #000000; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-start; padding: 380px 4.9% 24px 4.9%; margin-bottom: 20px; font-family: Roboto, Lato, sans-serif; color: #fff; }' +
            '.bg-wrap { position: absolute; top: 0; left: 0; right: 0; width: 100%; height: 780px; z-index: 1; pointer-events: none; overflow: hidden; background: #000000; }' +
            '.bg-canvas { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center 15%; }' +
            '.bg-canvas.mode-rs { object-fit: none; object-position: center top; }' +
            '.bg-canvas.mode-bs { object-fit: cover; object-position: center 8%; }' +
            '.gradient { position: absolute; inset: 0; background: linear-gradient(to top, #000000 0%, #000000 18%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.05) 75%, rgba(0,0,0,0.2) 100%), linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 55%, rgba(0,0,0,0.5) 100%); z-index: 2; pointer-events: none; }' +
            '.gradient.is-bs { background: linear-gradient(to top, #000000 0%, #000000 13%, rgba(0,0,0,0.52) 34%, rgba(0,0,0,0.12) 56%, rgba(0,0,0,0) 70%), linear-gradient(to right, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.08) 55%, rgba(0,0,0,0.44) 100%); }' +
            '.content-wrap { position: relative; z-index: 3; width: 100%; max-width: 100%; margin: 0 auto; }' +
            '.status { position: absolute; top: 16px; right: 20px; z-index: 4; color: #aaa; font-size: 12px; background: rgba(0,0,0,0.6); padding: 4px 10px; border-radius: 4px; }' +
            '</style>' +
            '<div class="banner" id="cr-banner">' +
            '<div class="bg-wrap" id="cr-bg-wrap"><canvas class="bg-canvas"></canvas><div class="gradient" id="cr-grad"></div></div>' +
            '<div class="status" id="st">Загрузка ' + animeId + '...</div>' +
            '<div class="content-wrap" id="cr-grid"></div>' +
            '</div>';

        var nav = document.querySelector('body > nav') || document.querySelector('nav');
        if (nav) {
            nav.insertAdjacentElement('afterend', host);
        } else {
            document.body.prepend(host);
        }

        var bannerBox = shadow.getElementById('cr-banner');
        var bgWrap = shadow.getElementById('cr-bg-wrap');
        var bCanvas = shadow.querySelector('.bg-canvas');
        var gradEl = shadow.getElementById('cr-grad');
        var st = shadow.getElementById('st');

        if (!forceFresh && loadedCache[animeId]) {
            var mem = loadedCache[animeId];
            createImageBitmap(mem.blob).then(function(bmp) {
                renderBitmap(bmp, mem.mode, bannerBox, bgWrap, bCanvas, gradEl, st);
                isLoading = false;
            }).catch(function() {
                delete loadedCache[animeId];
                isLoading = false;
            });
            return;
        }

        if (forceFresh) {
            startNetworkLoad(true);
            return;
        }

        readFromPersistentCache(animeId).then(function(cached) {
            if (cached && cached.blob && cached.blob.size > 500) {
                loadedCache[animeId] = cached;
                createImageBitmap(cached.blob).then(function(bmp) {
                    renderBitmap(bmp, cached.mode, bannerBox, bgWrap, bCanvas, gradEl, st);
                    isLoading = false;
                }).catch(function() {
                    startNetworkLoad(false);
                });
            } else {
                startNetworkLoad(false);
            }
        });

        function startNetworkLoad(bypassHttpCache) {
            var savedRoute = bypassHttpCache ? null : getSavedRoute(animeId);
            var exts = ['.jpg', '.JPG', '.jpeg', '.png', '.webp', '.PNG', '.WEBP'];
            var queue = [];
            var bust = bypassHttpCache ? ('?_t=' + Date.now()) : '';

            if (savedRoute && savedRoute.url) {
                queue.push({ url: savedRoute.url, mode: savedRoute.mode, isSaved: true });
            }

            exts.forEach(function(ext) {
                queue.push({ url: BASE_RAWGH + 'PosterRS/' + animeId + ext + bust, mode: 'rs', cleanUrl: BASE_RAWGH + 'PosterRS/' + animeId + ext });
                queue.push({ url: BASE_STATICALLY + 'PosterRS/' + animeId + ext + bust, mode: 'rs', cleanUrl: BASE_STATICALLY + 'PosterRS/' + animeId + ext });
                queue.push({ url: BASE_GITHACK + 'PosterRS/' + animeId + ext + bust, mode: 'rs', cleanUrl: BASE_GITHACK + 'PosterRS/' + animeId + ext });
});
exts.forEach(function(ext) {
queue.push({ url: BASE_RAWGH + 'PostersBS/' + animeId + ext + bust, mode: 'bs', cleanUrl: BASE_RAWGH + 'PostersBS/' + animeId + ext });
queue.push({ url: BASE_STATICALLY + 'PostersBS/' + animeId + ext + bust, mode: 'bs', cleanUrl: BASE_STATICALLY + 'PostersBS/' + animeId + ext });
queue.push({ url: BASE_GITHACK + 'PostersBS/' + animeId + ext + bust, mode: 'bs', cleanUrl: BASE_GITHACK + 'PostersBS/' + animeId + ext });
});
exts.forEach(function(ext) {
queue.push({ url: BASE_RAWGH + 'posters/' + animeId + ext + bust, mode: 'default', cleanUrl: BASE_RAWGH + 'posters/' + animeId + ext });
queue.push({ url: BASE_STATICALLY + 'posters/' + animeId + ext + bust, mode: 'default', cleanUrl: BASE_STATICALLY + 'posters/' + animeId + ext });
queue.push({ url: BASE_GITHACK + 'posters/' + animeId + ext + bust, mode: 'default', cleanUrl: BASE_GITHACK + 'posters/' + animeId + ext });
});
function handleFail() {
isLoading = false;
failedIds[animeId] = true;
if (host && host.parentNode) host.remove();
}
function tryNext(idx) {
if (idx >= queue.length) {
handleFail();
return;
}
var item = queue.at(idx);
var reqOpts = {
method: 'GET',
url: item.url,
headers: { 'Accept': 'image/*' },
responseType: 'blob',
timeout: 30000,
onload: function(res) {
if (res.status === 200 && res.response && res.response.size > 500) {
var blob = res.response;
createImageBitmap(blob).then(function(bmp) {
loadedCache[animeId] = { blob: blob, mode: item.mode };
saveToPersistentCache(animeId, blob, item.mode);
saveRoute(animeId, item.cleanUrl || item.url, item.mode);
renderBitmap(bmp, item.mode, bannerBox, bgWrap, bCanvas, gradEl, st);
isLoading = false;
}).catch(function() {
if (item.isSaved) clearSavedRoute(animeId);
tryNext(idx + 1);
});
} else {
if (item.isSaved) clearSavedRoute(animeId);
tryNext(idx + 1);
}
},
onerror: function() {
if (item.isSaved) clearSavedRoute(animeId);
tryNext(idx + 1);
},
ontimeout: function() {
tryNext(idx + 1);
}
};
if (bypassHttpCache) {
reqOpts.nocache = true;
reqOpts.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
}
GM_xmlhttpRequest(reqOpts);
}
tryNext(0);
}
}
function drawRSFitInBanner(ctx, img, tw, th) {
ctx.fillStyle = '#000000';
ctx.fillRect(0, 0, tw, th);
var visibleH = 720;
var scale = Math.min(visibleH / img.height, tw / img.width);
var w = Math.round(img.width * scale);
var h = Math.round(img.height * scale);
var x = Math.round((tw - w) / 2);
var y = 0;
ctx.drawImage(img, x, y, w, h);
var fadeW = Math.min(260, Math.round(w * 0.28));
var gradL = ctx.createLinearGradient(x, 0, x + fadeW, 0);
gradL.addColorStop(0, '#000000');
gradL.addColorStop(0.35, 'rgba(0,0,0,0.68)');
gradL.addColorStop(1, 'rgba(0,0,0,0)');
ctx.fillStyle = gradL;
ctx.fillRect(x, y, fadeW, h);
var gradR = ctx.createLinearGradient(x + w - fadeW, 0, x + w, 0);
gradR.addColorStop(0, 'rgba(0,0,0,0)');
gradR.addColorStop(0.65, 'rgba(0,0,0,0.68)');
gradR.addColorStop(1, '#000000');
ctx.fillStyle = gradR;
ctx.fillRect(x + w - fadeW, y, fadeW, h);
var fadeB = Math.min(180, Math.round(h * 0.28));
var gradB = ctx.createLinearGradient(0, y + h - fadeB, 0, y + h);
gradB.addColorStop(0, 'rgba(0,0,0,0)');
gradB.addColorStop(1, '#000000');
ctx.fillStyle = gradB;
ctx.fillRect(x, y + h - fadeB, w, fadeB);
}
function ensureRefreshButton(animeId) {
var nav = document.querySelector('body > nav');
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
'cursor: pointer;' +
'transition: background 0.15s, color 0.15s;';
btn.addEventListener('mouseenter', function() {
btn.style.background = '#f47521';
btn.style.color = '#000000';
});
btn.addEventListener('mouseleave', function() {
btn.style.background = 'rgba(244, 117, 33, 0.16)';
btn.style.color = '#f47521';
});
btn.addEventListener('click', function(e) {
e.preventDefault();
e.stopPropagation();
var curId = getAnimeId();
if (!curId) return;
btn.innerHTML = '↻ Сброс...';
delete loadedCache[curId];
delete failedIds[curId];
clearSavedRoute(curId);
isLoading = false;
// Сообщаем скрипту логотипов, что нужно тоже сбросить кэш этого ID
window.dispatchEvent(new CustomEvent('cr-reset-page-cache', { detail: { animeId: curId } }));
clearPersistentCache(curId).then(function() {
var oldHost = document.getElementById('cr-poster-host');
if (oldHost) oldHost.remove();
initBanner(curId, true);
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
function syncVisibility() {
var animeId = getAnimeId();
ensureRefreshButton(animeId);
var host = document.getElementById('cr-poster-host');
if (animeId) {
if (!host && !failedIds[animeId] && !isLoading) {
initBanner(animeId, false);
} else if (host && host.getAttribute('data-anime-id') !== animeId) {
isLoading = false;
host.remove();
initBanner(animeId, false);
}
} else {
isLoading = false;
if (host) host.remove();
}
}
window.addEventListener('popstate', syncVisibility);
document.addEventListener('click', function() { setTimeout(syncVisibility, 200); });
setInterval(syncVisibility, 500);
})();


// ==UserScript==
// @name         Anime 365 Crunchyroll Text & Info Overlay
// @namespace    http://tampermonkey.net
// @version      6.1
// @description  Верстка Crunchyroll с исправленным рендером текста и удалением слов продолжение / другая история
// @match        *://*.smotret-anime.app/*
// @match        *://smotret-anime.app/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==
(function() {
    'use strict';
    var titleByAnimeId = {};
    var SKIP_RELATION_WORDS = [
        'продолжение',
        'другая история',
        'предыстория',
        'ответвление',
        'адаптация',
        'спин-офф',
        'альтернативная версия',
        'альтернативный сеттинг',
        'полная версия',
        'обобщение',
        'прямое продолжение'
    ];
    function isTitleFromAnotherId(checkId, titleText) {
        for (var id in titleByAnimeId) {
            if (Object.prototype.hasOwnProperty.call(titleByAnimeId, id)) {
                if (id !== checkId && titleByAnimeId[id] === titleText) {
                    return true;
                }
            }
        }
        return false;
    }
    function injectInfo() {
        var host = document.getElementById('cr-poster-host');
        if (!host || !host.shadowRoot) return;
        var grid = host.shadowRoot.getElementById('cr-grid');
        if (!grid) return;
        var currentAnimeId = host.getAttribute('data-anime-id') || '';
        var line1El = document.querySelector('.card .card-content h2.line-1');
        var line2El = document.querySelector('.card .card-content h2.line-2');
        if (!line1El) return;
        var textLine1 = line1El.textContent.replace(/смотреть онлайн/gi, '').trim();
        if (!textLine1) return;
        if (currentAnimeId && isTitleFromAnotherId(currentAnimeId, textLine1)) {
            return;
        }
        var existingInfo = host.shadowRoot.getElementById('cr-info-col');
        if (existingInfo) {
            if (existingInfo.getAttribute('data-rendered-title') === textLine1 &&
                existingInfo.getAttribute('data-rendered-id') === currentAnimeId) {
                return;
            }
            grid.innerHTML = '';
            var oldTip = host.shadowRoot.querySelector('.cr-mouse-tip');
            if (oldTip) oldTip.remove();
            var oldStyle = host.shadowRoot.getElementById('cr-overlay-style');
            if (oldStyle) oldStyle.remove();
        }
        if (currentAnimeId) {
            titleByAnimeId[currentAnimeId] = textLine1;
        }
        var fullBg = document.querySelector('.full-background');
        if (fullBg) {
            fullBg.style.setProperty('background', '#000000', 'important');
            fullBg.style.setProperty('background-color', '#000000', 'important');
        }
        var bannerBox = host.shadowRoot.getElementById('cr-banner');
        if (bannerBox) {
            bannerBox.style.paddingLeft = '4.9%';
            bannerBox.style.paddingRight = '4.9%';
        }
        grid.style.maxWidth = '100%';
        var textLine2 = line2El ? line2El.textContent.replace(/смотреть онлайн/gi, '').trim() : '';
        var scoreEl = document.querySelector('.card .card-content [itemprop="ratingValue"]') ||
                      document.querySelector('.card .card-content .m-series-score__value span');
        var ratingScore = scoreEl ? scoreEl.textContent.trim() : '';
        var blackBoxBtn = document.querySelector('.m-black-box .m-black-box-button');
        var watchLinkEl = blackBoxBtn ? blackBoxBtn.closest('a') : document.querySelector('.col.s12.m8.l9.col-even > a');
        var hasWatchBtn = !!(blackBoxBtn && blackBoxBtn.textContent.includes('Начать просмотр'));
        var descBlocks = Array.from(document.querySelectorAll('.card-content'));
        var shikiBlock = null;
        var defaultBlock = null;
        descBlocks.forEach(function(b) {
            var h3 = b.querySelector('h3');
            if (!h3) return;
            var t = h3.textContent.trim();
            if (t.includes('Альтернативное описание аниме') && b.textContent.includes('shikimori')) shikiBlock = b;
            else if (t.includes('Описание аниме')) defaultBlock = b;
        });
        var targetDesc = shikiBlock || defaultBlock;
        var descHtml = '';
        if (targetDesc) {
            var dClone = targetDesc.cloneNode(true);
            dClone.querySelectorAll('h3, .m-description-source').forEach(function(el) { el.remove(); });
            descHtml = dClone.innerHTML.trim();
        }
        var typeText = '';
        var yearText = '';
        var curItem = document.querySelector('.m-connections-list__item_current');
        if (curItem) {
            var cClone = curItem.cloneNode(true);
            cClone.querySelectorAll('ul, a').forEach(function(el) { el.remove(); });
            cClone.querySelectorAll('.m-connections-list__type').forEach(function(typeEl) {
                var low = typeEl.textContent.trim().toLowerCase();
                var isRelation = SKIP_RELATION_WORDS.some(function(w) { return low.indexOf(w) !== -1; });
                if (isRelation) {
                    typeEl.remove();
                }
            });
            var yEl = cClone.querySelector('.m-connections-list__year');
            if (yEl) {
                yearText = yEl.textContent.trim();
                yEl.remove();
            }
            typeText = cClone.textContent
                .replace(/\s*,\s*,+/g, ',')
                .replace(/^[\s,–—-]+|[\s,–—-]+$/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        }
        var subMetaParts = [];
        if (typeText) subMetaParts.push(typeText);
        if (yearText) subMetaParts.push(yearText);
        var subMetaLine = subMetaParts.join(' • ');
        var genres = Array.from(document.querySelectorAll('.m-genres-list a.m-genres-list__item')).map(function(a) {
            var gName = a.textContent.trim();
            return '<a class="cr-tag" href="' + a.getAttribute('href') + '">' + gName + '</a>';
        }).join('<span class="cr-comma">, </span>');
        var studios = Array.from(document.querySelectorAll('.m-studios-list a')).map(function(a) {
            var stName = a.textContent.trim();
            if (!stName) {
                var imgAlt = a.querySelector('img');
                stName = imgAlt ? (imgAlt.getAttribute('alt') || imgAlt.getAttribute('title') || '') : '';
            }
            if (!stName) {
                var slugPart = (a.getAttribute('href') || '').split('/').pop().replace(/^\d+-/, '').replace(/-/g, ' ');
                stName = slugPart.replace(/\b\w/g, function(l) { return l.toUpperCase(); });
            }
            return '<a class="cr-studio-link" href="' + a.getAttribute('href') + '">' + stName + '</a>';
        }).join(', ');
        var minorTitles = Array.from(document.querySelectorAll('.m-minor-titles-list span')).map(function(sp) {
            var titleStr = sp.textContent.trim();
            if (!titleStr) return '';
            var safeAttr = titleStr.replace(/"/g, '&quot;');
            return '<span class="cr-alt-item" data-copy="' + safeAttr + '">' + titleStr + '</span>';
        }).filter(Boolean).join('<span class="cr-alt-sep"> / </span>');
                var style = document.createElement('style');
        style.id = 'cr-overlay-style';
        style.textContent =
            '* { box-sizing: border-box; margin: 0; padding: 0; }' +
            '.cr-top-header { display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 44px; }' +
            '.cr-h1 { font-size: 36px; font-weight: 700; line-height: 1.15; margin-bottom: 6px; color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,0.9); }' +
            '.cr-h2 { font-size: 16px; color: #cfcfcf; margin-bottom: 8px; text-shadow: 0 1px 6px rgba(0,0,0,0.9); }' +
            '.cr-submeta { font-size: 17px; font-weight: 500; color: #d0d0d0; margin-bottom: 10px; letter-spacing: 0.3px; }' +
            '.cr-rate { font-size: 15px; font-weight: 700; color: #f47521; margin-bottom: 18px; }' +
            '.cr-btn-slot { min-height: 44px; display: flex; align-items: center; }' +
            '.cr-btn { display: inline-flex; align-items: center; gap: 8px; background: #f47521; color: #000 !important; font-weight: 700; font-size: 14px; text-transform: uppercase; padding: 0 28px; height: 44px; border-radius: 2px; text-decoration: none !important; cursor: pointer; border: none; transition: background 0.2s; }' +
            '.cr-btn:hover { background: #ff8533; }' +
            '.cr-collapsible-wrap { position: relative; width: 100%; height: 96px; overflow: hidden; transition: height 0.38s cubic-bezier(0.25, 0.8, 0.25, 1), padding-bottom 0.38s ease; }' +
            '.cr-collapsible-wrap.is-open { padding-bottom: 22px; }' +
            '.cr-bottom-flex { display: flex; justify-content: flex-start; align-items: flex-start; gap: 112px; width: 100%; }' +
            '.cr-desc-col { flex: 0 0 50%; width: 50%; max-width: 50%; font-size: 14px; line-height: 24px; color: #e6e6e6; }' +
            '.cr-desc-col p { margin: 0; line-height: 24px; }' +
            '.cr-desc-col .description-sep { height: 0; margin: 0; padding: 0; display: block; }' +
            '.cr-desc-col br { display: none; }' +
            '.cr-right { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 12px; font-size: 14px; line-height: 24px; }' +
            '.cr-inline-block { display: block; line-height: 24px; margin: 0; }' +
            '.cr-lbl { font-size: 14px; font-weight: 400; color: #ffffff; margin-right: 6px; }' +
            '.cr-tags-inline { display: inline; color: #9a9a9a; font-size: 14px; font-weight: 400; }' +
            '.cr-tag { display: inline; background: transparent !important; border: none !important; box-shadow: none !important; color: #9a9a9a !important; padding: 0 !important; font-size: 14px; font-weight: 400; text-transform: none; text-decoration: none !important; transition: color 0.15s ease; }' +
            '.cr-tag:hover { color: #ffffff !important; background: transparent !important; }' +
            '.cr-comma { color: #9a9a9a; }' +
            '.cr-studio-link { color: #9a9a9a !important; font-weight: 400; text-decoration: none !important; font-size: 14px; transition: color 0.15s ease; }' +
            '.cr-studio-link:hover { color: #ffffff !important; }' +
            '.cr-alt-list { display: inline; color: #9a9a9a; font-size: 14px; font-weight: 400; }' +
            '.cr-alt-item { display: inline; cursor: pointer; color: #9a9a9a; transition: color 0.15s ease; }' +
            '.cr-alt-item:hover, .cr-alt-item.is-hovered { color: #ffffff; }' +
            '.cr-alt-sep { color: #666666; }' +
            '.cr-mouse-tip { position: fixed; top: 0; left: 0; transform: translate(-50%, calc(-100% - 4px)); background: #23252b; color: #ffffff; border: 1px solid rgba(255,255,255,0.25); border-radius: 3px; padding: 5px 11px; font-size: 12px; font-weight: 400; white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity 0.15s ease; z-index: 999999; box-shadow: 0 4px 14px rgba(0,0,0,0.85); display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }' +
            '.cr-mouse-tip.visible { opacity: 1; pointer-events: auto; }' +
            '.cr-mouse-tip:hover { background: #2e3138; border-color: rgba(255,255,255,0.45); }' +
            '.cr-mouse-tip.copied { background: #1e2226; border-color: rgba(255,255,255,0.5); color: #ffffff; }' +
            '.cr-bottom-fade { position: absolute; top: 68px; left: 0; right: 0; height: 28px; background: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.42) 45%, rgba(0,0,0,0.88) 85%, #000000 100%); pointer-events: none; z-index: 4; opacity: 1; transition: opacity 0.32s ease; }' +
            '.cr-collapsible-wrap.is-open .cr-bottom-fade { opacity: 0; }' +
            '.cr-footer-bar { width: 100%; border-bottom: 2px solid rgba(255,255,255,0.28); padding-top: 20px; padding-bottom: 14px; display: flex; justify-content: flex-start; }' +
            '.cr-more-btn { background: none !important; border: none !important; color: #f47521 !important; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; cursor: pointer; padding: 0; text-decoration: none !important; transition: color 0.15s ease; }' +
            '.cr-more-btn:hover { color: #ffffff !important; text-decoration: none !important; }' +
            '@media (max-width: 960px) { .cr-bottom-flex { flex-direction: column; gap: 24px; } .cr-desc-col { flex: none; width: 100%; max-width: 100%; } }';
        host.shadowRoot.appendChild(style);
                var mouseTip = document.createElement('div');
        mouseTip.className = 'cr-mouse-tip';
        mouseTip.innerHTML = '<span class="cr-tip-ico">⧉</span><span class="cr-tip-txt">Скопировать</span>';
        host.shadowRoot.appendChild(mouseTip);
        var btnHtml = '<div class="cr-btn-slot"></div>';
        if (hasWatchBtn) {
            if (watchLinkEl && watchLinkEl.href) {
                btnHtml = '<div class="cr-btn-slot"><a class="cr-btn" href="' + watchLinkEl.href + '">▶ СМОТРЕТЬ</a></div>';
            } else {
                btnHtml = '<div class="cr-btn-slot"><button type="button" class="cr-btn" id="cr-play-proxy">▶ СМОТРЕТЬ</button></div>';
            }
        }
        var topHeader = document.createElement('div');
        topHeader.className = 'cr-top-header';
        topHeader.id = 'cr-info-col';
        topHeader.setAttribute('data-rendered-id', currentAnimeId);
        topHeader.setAttribute('data-rendered-title', textLine1);
        topHeader.innerHTML =
            '<div class="cr-h1">' + textLine1 + '</div>' +
            (textLine2 ? '<div class="cr-h2">' + textLine2 + '</div>' : '') +
            (subMetaLine ? '<div class="cr-submeta">' + subMetaLine + '</div>' : '') +
            (ratingScore ? '<div class="cr-rate">★ ' + ratingScore + ' из 10</div>' : '') +
            btnHtml;
        var collapsibleWrap = document.createElement('div');
        collapsibleWrap.className = 'cr-collapsible-wrap';
        collapsibleWrap.id = 'cr-wrap';
        var bottomFlex = document.createElement('div');
        bottomFlex.className = 'cr-bottom-flex';
        var descCol = document.createElement('div');
        descCol.className = 'cr-desc-col';
        descCol.innerHTML = descHtml || '';
        var rightCol = document.createElement('div');
        rightCol.className = 'cr-right';
        rightCol.innerHTML =
            (genres ? '<div class="cr-inline-block"><span class="cr-lbl">Жанры:</span><span class="cr-tags-inline">' + genres + '</span></div>' : '') +
            (studios ? '<div class="cr-inline-block"><span class="cr-lbl">Студия:</span><span>' + studios + '</span></div>' : '') +
            (minorTitles ? '<div class="cr-inline-block"><span class="cr-lbl">Другие названия:</span><span class="cr-alt-list">' + minorTitles + '</span></div>' : '');
        bottomFlex.appendChild(descCol);
        bottomFlex.appendChild(rightCol);
        collapsibleWrap.appendChild(bottomFlex);
        var bottomFade = document.createElement('div');
        bottomFade.className = 'cr-bottom-fade';
        collapsibleWrap.appendChild(bottomFade);
        var footerBar = document.createElement('div');
        footerBar.className = 'cr-footer-bar';
        footerBar.innerHTML = '<button type="button" class="cr-more-btn" id="cr-dbtn">Подробнее</button>';
        grid.appendChild(topHeader);
        grid.appendChild(collapsibleWrap);
        grid.appendChild(footerBar);
        var dBtn = host.shadowRoot.getElementById('cr-dbtn');
        var wrapEl = host.shadowRoot.getElementById('cr-wrap');
        var bannerEl = host.shadowRoot.getElementById('cr-banner');
        var COLLAPSED_H = 96;
        if (dBtn && wrapEl) {
            dBtn.addEventListener('click', function() {
                var isOpening = !wrapEl.classList.contains('is-open');
                if (isOpening) {
                    var targetH = bottomFlex.scrollHeight + 22;
                    wrapEl.style.height = COLLAPSED_H + 'px';
                    wrapEl.offsetHeight;
                    wrapEl.classList.add('is-open');
                    wrapEl.style.height = targetH + 'px';
                    if (bannerEl) bannerEl.classList.add('is-expanded');
                    dBtn.textContent = 'Свернуть';
                } else {
                    wrapEl.style.height = wrapEl.scrollHeight + 'px';
                    wrapEl.offsetHeight;
                    wrapEl.classList.remove('is-open');
                    wrapEl.style.height = COLLAPSED_H + 'px';
                    if (bannerEl) bannerEl.classList.remove('is-expanded');
                    dBtn.textContent = 'Подробнее';
                }
            });
        }
        var currentCopyText = '';
        var activeTitleEl = null;
        var stopTimer = null;
        var hideTimer = null;
        var isOverText = false;
        var isOverTip = false;
        function clearTitleHighlight() {
            if (activeTitleEl) {
                activeTitleEl.classList.remove('is-hovered');
                activeTitleEl = null;
            }
        }
        function setTitleHighlight(el) {
            if (activeTitleEl && activeTitleEl !== el) {
                activeTitleEl.classList.remove('is-hovered');
            }
            activeTitleEl = el;
            if (activeTitleEl) activeTitleEl.classList.add('is-hovered');
        }
        function showTipAboveTitle(el, mouseX) {
            if (!el) return;
            var rect = el.getBoundingClientRect();
            mouseTip.classList.remove('copied');
            mouseTip.querySelector('.cr-tip-ico').textContent = '⧉';
            mouseTip.querySelector('.cr-tip-txt').textContent = 'Скопировать';
            mouseTip.style.left = mouseX + 'px';
            mouseTip.style.top = rect.top + 'px';
            mouseTip.classList.add('visible');
            setTitleHighlight(el);
        }
        function performCopy() {
            if (!currentCopyText) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(currentCopyText);
            } else {
                var ta = document.createElement('textarea');
                ta.value = currentCopyText;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
            }
            mouseTip.classList.add('copied');
            mouseTip.querySelector('.cr-tip-ico').textContent = '✓';
            mouseTip.querySelector('.cr-tip-txt').textContent = 'Скопировано';
        }
        function scheduleHide() {
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(function() {
                if (!isOverText && !isOverTip) {
                    mouseTip.classList.remove('visible');
                    clearTitleHighlight();
                }
            }, 220);
        }
        mouseTip.addEventListener('mouseenter', function() {
            isOverTip = true;
            if (hideTimer) clearTimeout(hideTimer);
            if (activeTitleEl) activeTitleEl.classList.add('is-hovered');
        });
        mouseTip.addEventListener('mouseleave', function() {
            isOverTip = false;
            scheduleHide();
        });
        mouseTip.addEventListener('click', function(e) {
            e.stopPropagation();
            performCopy();
        });
        host.shadowRoot.querySelectorAll('.cr-alt-item').forEach(function(item) {
            item.addEventListener('mouseenter', function(e) {
                isOverText = true;
                if (hideTimer) clearTimeout(hideTimer);
                currentCopyText = item.getAttribute('data-copy') || '';
                setTitleHighlight(item);
                if (stopTimer) clearTimeout(stopTimer);
                var mx = e.clientX;
                stopTimer = setTimeout(function() {
                    if (isOverText) showTipAboveTitle(item, mx);
                }, 320);
            });
            item.addEventListener('mousemove', function(e) {
                isOverText = true;
                if (hideTimer) clearTimeout(hideTimer);
                currentCopyText = item.getAttribute('data-copy') || '';
                setTitleHighlight(item);
                if (!mouseTip.classList.contains('visible')) {
                    if (stopTimer) clearTimeout(stopTimer);
                    var mx = e.clientX;
                    stopTimer = setTimeout(function() {
                        if (isOverText) showTipAboveTitle(item, mx);
                    }, 320);
                }
            });
            item.addEventListener('mouseleave', function() {
                isOverText = false;
                if (stopTimer) clearTimeout(stopTimer);
                scheduleHide();
            });
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                currentCopyText = item.getAttribute('data-copy') || '';
                performCopy();
            });
        });
        var proxyBtn = host.shadowRoot.getElementById('cr-play-proxy');
        if (proxyBtn && blackBoxBtn) {
            proxyBtn.addEventListener('click', function() { blackBoxBtn.click(); });
        }
    }
    setInterval(injectInfo, 250);
})();





// ==UserScript==
// @name         Anime 365 Crunchyroll Title Formatter
// @namespace    http://tampermonkey.net
// @version      1.1
// @description  Переносит номер сезона на строку ниже тем же шрифтом, что и название, и уменьшает шрифт при длине > 1/4 экрана
// @match        *://*.smotret-anime.app/*
// @match        *://smotret-anime.app/*
// @grant        none
// ==/UserScript==
(function() {
    'use strict';
    var SEASON_REGEX = /(?:[\s:\-–—•]+|\()((?:\d+(?:-[йяе])?\s+сезон|сезон\s+\d+|season\s+\d+|\d+(?:st|nd|rd|th)\s+season))\)?$/i;
    function formatBannerTitle() {
        var host = document.getElementById('cr-poster-host');
        if (!host || !host.shadowRoot) return;
        var h1 = host.shadowRoot.querySelector('.cr-h1');
        if (!h1) return;
        var rawText = h1.getAttribute('data-raw-title');
        if (!rawText) {
            rawText = h1.textContent.trim();
            if (!rawText) return;
            h1.setAttribute('data-raw-title', rawText);
        }
        if (h1.getAttribute('data-formatted-for') !== rawText) {
            var match = rawText.match(SEASON_REGEX);
            if (match) {
                var seasonPart = match.at(1).trim();
                var mainPart = rawText.slice(0, match.index).replace(/[\s:\-–—•(]+$/, '').trim();
                h1.innerHTML =
                    '<span class="cr-main-title-line">' + mainPart + '</span>' +
                    '<span class="cr-season-subline">' + seasonPart + '</span>';
            } else {
                h1.textContent = rawText;
            }
            if (!host.shadowRoot.getElementById('cr-title-formatter-style')) {
                var st = document.createElement('style');
                st.id = 'cr-title-formatter-style';
                st.textContent =
                    '.cr-main-title-line { display: block; }' +
                    '.cr-season-subline { display: block; font-size: inherit; font-weight: inherit; line-height: inherit; color: inherit; margin-top: 2px; }';
                host.shadowRoot.appendChild(st);
            }
            h1.setAttribute('data-formatted-for', rawText);
        }
        var maxQuarterWidth = window.innerWidth * 0.25;
        var baseSize = 36;
        var minSize = 18;
        h1.style.fontSize = baseSize + 'px';
        h1.style.whiteSpace = 'nowrap';
        var currentSize = baseSize;
        while (h1.scrollWidth > maxQuarterWidth && currentSize > minSize) {
            currentSize -= 1;
            h1.style.fontSize = currentSize + 'px';
        }
        h1.style.whiteSpace = 'normal';
    }
    window.addEventListener('resize', formatBannerTitle);
    setInterval(formatBannerTitle, 250);
})();

// ==UserScript==
// @name         Anime 365 Crunchyroll Logo Overlay
// @namespace    http://tampermonkey.net
// @version      8.0
// @description  Подгружает логотип из Logo / LogoCNT с кэшированием и сбросом по кнопке в nav
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
    var LOGO_CACHE_NAME = 'cr-logos-cache-v4';

    var activeAnimeId = null;
    var isLoading = false;
    var loadedLogoCache = {};
    var failedLogoIds = {};
    var forceFreshForId = {};

    var PROTO = 'https' + '://';
    var BASE_RAWGH = PROTO + 'raw' + '.githubusercontent' + '.com/' + USER + '/' + REPO + '/main/';
    var BASE_GITHACK = PROTO + 'raw' + '.githack' + '.com/' + USER + '/' + REPO + '/main/';
    var BASE_STATICALLY = PROTO + 'cdn' + '.statically' + '.io/gh/' + USER + '/' + REPO + '/main/';

    function getSavedLogoRoute(animeId) {
        try {
            if (typeof GM_getValue === 'function') {
                var raw = GM_getValue('cr_logo_route_v4_' + animeId, '');
                if (raw) return JSON.parse(raw);
            }
        } catch (e) {}
        return null;
    }

    function saveLogoRoute(animeId, url, align) {
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue('cr_logo_route_v4_' + animeId, JSON.stringify({ url: url, align: align }));
            }
        } catch (e) {}
    }

    function clearSavedLogoRoute(animeId) {
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue('cr_logo_route_v4_' + animeId, '');
            }
        } catch (e) {}
    }

    function readLogoFromCache(animeId) {
        if (!('caches' in window)) return Promise.resolve(null);
        return caches.open(LOGO_CACHE_NAME).then(function(cache) {
            return cache.match('https://cr-logo-cache.local/' + animeId).then(function(resp) {
                if (!resp) return null;
                var align = resp.headers.get('X-CR-Logo-Align') || 'left';
                return resp.blob().then(function(blob) {
                    return { blob: blob, align: align };
                });
            });
        }).catch(function() {
            return null;
        });
    }

    function saveLogoToCache(animeId, blob, align) {
        if (!('caches' in window)) return;
        caches.open(LOGO_CACHE_NAME).then(function(cache) {
            var resp = new Response(blob, {
                headers: {
                    'Content-Type': blob.type || 'image/png',
                    'X-CR-Logo-Align': align
                }
            });
            cache.put('https://cr-logo-cache.local/' + animeId, resp);
        }).catch(function() {});
    }

    function clearLogoCache(animeId) {
        if (!('caches' in window)) return Promise.resolve();
        return caches.open(LOGO_CACHE_NAME).then(function(cache) {
            return cache.delete('https://cr-logo-cache.local/' + animeId);
        }).catch(function() {});
    }

    // Слушаем нажатие кнопки «↻ Обновить» в nav
    window.addEventListener('cr-reset-page-cache', function(e) {
        var resetId = e && e.detail && e.detail.animeId;
        if (!resetId) return;
        delete loadedLogoCache[resetId];
        delete failedLogoIds[resetId];
        clearSavedLogoRoute(resetId);
        forceFreshForId[resetId] = true;
        if (activeAnimeId === resetId) {
            activeAnimeId = null;
            isLoading = false;
        }
        clearLogoCache(resetId);
    });

    function ensureLogoStyle(shadow) {
        if (shadow.getElementById('cr-logo-style')) return;
        var st = document.createElement('style');
        st.id = 'cr-logo-style';
        st.textContent =
            '.cr-top-logo {' +
            '  position: absolute;' +
            '  top: 3.2vw;' +
            '  left: 4.9%;' +
            '  z-index: 4;' +
            '  max-width: 440px;' +
            '  max-height: 195px;' +
            '  width: auto;' +
            '  height: auto;' +
            '  object-fit: contain;' +
            '  object-position: left top;' +
            '  pointer-events: none;' +
            '  user-select: none;' +
            '  filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.85));' +
            '}' +
            '.cr-top-logo.is-center {' +
            '  left: 50%;' +
            '  transform: translateX(-50%);' +
            '  object-position: center top;' +
            '}' +
            '@media (max-width: 960px) {' +
            '  .cr-top-logo {' +
            '    top: 16px;' +
            '    max-width: 260px;' +
            '    max-height: 120px;' +
            '  }' +
            '}';
        shadow.appendChild(st);
    }

    function renderLogo(shadow, animeId, blob, alignMode) {
        var host = document.getElementById('cr-poster-host');
        if (!host || host.getAttribute('data-anime-id') !== animeId) return;

        var bannerBox = shadow.getElementById('cr-banner');
        if (!bannerBox) return;

        ensureLogoStyle(shadow);

        var existing = shadow.getElementById('cr-anime-logo');
        if (existing) {
            if (existing.src && existing.src.startsWith('blob:')) {
                URL.revokeObjectURL(existing.src);
            }
            existing.remove();
        }

        var objectUrl = URL.createObjectURL(blob);
        var img = document.createElement('img');
        img.id = 'cr-anime-logo';
        img.className = 'cr-top-logo' + (alignMode === 'center' ? ' is-center' : '');
        img.setAttribute('data-logo-id', animeId);
        img.alt = '';
        img.src = objectUrl;

        bannerBox.appendChild(img);
    }

    function loadLogoWithCache(shadow, animeId) {
        var bypass = !!forceFreshForId[animeId];
        delete forceFreshForId[animeId];

        if (!bypass && loadedLogoCache[animeId]) {
            var mem = loadedLogoCache[animeId];
            renderLogo(shadow, animeId, mem.blob, mem.align);
            isLoading = false;
            return;
        }

        if (bypass) {
            startLogoNetworkLoad(shadow, animeId, true);
            return;
        }

        readLogoFromCache(animeId).then(function(cached) {
            if (cached && cached.blob && cached.blob.size > 100) {
                loadedLogoCache[animeId] = cached;
                renderLogo(shadow, animeId, cached.blob, cached.align);
                isLoading = false;
            } else {
                startLogoNetworkLoad(shadow, animeId, false);
            }
        });
    }

    function startLogoNetworkLoad(shadow, animeId, bypassHttpCache) {
        var savedRoute = bypassHttpCache ? null : getSavedLogoRoute(animeId);
        var exts = ['.png', '.jpg', '.JPG', '.jpeg', '.webp', '.PNG', '.WEBP'];
        var queue = [];
        var bust = bypassHttpCache ? ('?_t=' + Date.now()) : '';

        if (savedRoute && savedRoute.url) {
            queue.push({ url: savedRoute.url, align: savedRoute.align || 'left', isSaved: true });
        }

        exts.forEach(function(ext) {
            queue.push({ url: BASE_RAWGH + 'Logo/' + animeId + ext, align: 'left', cleanUrl: BASE_RAWGH + 'Logo/' + animeId + ext });
            queue.push({ url: BASE_GITHACK + 'Logo/' + animeId + ext + bust, align: 'left', cleanUrl: BASE_GITHACK + 'Logo/' + animeId + ext });
            queue.push({ url: BASE_STATICALLY + 'Logo/' + animeId + ext + bust, align: 'left', cleanUrl: BASE_STATICALLY + 'Logo/' + animeId + ext });
        });

        exts.forEach(function(ext) {
            queue.push({ url: BASE_RAWGH + 'LogoCNT/' + animeId + ext, align: 'center', cleanUrl: BASE_RAWGH + 'LogoCNT/' + animeId + ext });
            queue.push({ url: BASE_GITHACK + 'LogoCNT/' + animeId + ext + bust, align: 'center', cleanUrl: BASE_GITHACK + 'LogoCNT/' + animeId + ext });
            queue.push({ url: BASE_STATICALLY + 'LogoCNT/' + animeId + ext + bust, align: 'center', cleanUrl: BASE_STATICALLY + 'LogoCNT/' + animeId + ext });
        });

        function tryNext(idx) {
            if (idx >= queue.length || activeAnimeId !== animeId) {
                if (idx >= queue.length) failedLogoIds[animeId] = true;
                isLoading = false;
                return;
            }
            var item = queue[idx];
            var reqOpts = {
                method: 'GET',
                url: item.url,
                headers: { 'Accept': 'image/*' },
                responseType: 'blob',
                timeout: 30000,
                onload: function(res) {
                    if (res.status === 200 && res.response && res.response.size > 100) {
                        var blob = res.response;
                        createImageBitmap(blob).then(function(bmp) {
                            if (bmp && typeof bmp.close === 'function') bmp.close();
                            loadedLogoCache[animeId] = { blob: blob, align: item.align };
                            saveLogoToCache(animeId, blob, item.align);
                            saveLogoRoute(animeId, item.cleanUrl || item.url, item.align);
                            if (activeAnimeId === animeId) {
                                renderLogo(shadow, animeId, blob, item.align);
                            }
                            isLoading = false;
                        }).catch(function() {
                            if (item.isSaved) clearSavedLogoRoute(animeId);
                            tryNext(idx + 1);
                        });
                    } else {
                        if (item.isSaved) clearSavedLogoRoute(animeId);
                        tryNext(idx + 1);
                    }
                    },
onerror: function() {
if (item.isSaved) clearSavedLogoRoute(animeId);
tryNext(idx + 1);
},
ontimeout: function() {
tryNext(idx + 1);
}
};
if (bypassHttpCache) {
reqOpts.nocache = true;
reqOpts.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
}
GM_xmlhttpRequest(reqOpts);
}
tryNext(0);
}
function syncLogo() {
var host = document.getElementById('cr-poster-host');
if (!host || !host.shadowRoot) {
activeAnimeId = null;
isLoading = false;
return;
}
var animeId = host.getAttribute('data-anime-id');
if (!animeId || failedLogoIds[animeId]) {
return;
}
var statusEl = host.shadowRoot.getElementById('st');
var canvasEl = host.shadowRoot.querySelector('.bg-canvas');
var isPosterLoaded = (statusEl && statusEl.style.display === 'none') ||
(canvasEl && canvasEl.width > 0 && canvasEl.height > 0);
if (!isPosterLoaded) return;
if (activeAnimeId !== animeId && !isLoading) {
activeAnimeId = animeId;
isLoading = true;
loadLogoWithCache(host.shadowRoot, animeId);
}
}
setInterval(syncLogo, 250);
})();

