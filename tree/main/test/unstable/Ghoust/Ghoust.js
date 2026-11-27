// ==UserScript==
// @name         Anime 365 Crunchyroll Poster Picker (ЕЩЁ)
// @namespace    http://tampermonkey.net
// @version      2.3
// @description  Кнопка «ЕЩЁ» с вертикальными точками ellipsis-svgrepo-com.svg, компактным капсом в меню и белыми стрелками расширения с чёрной туманной подсветкой по контуру
// @match        *://*.smotret-anime.app/*
// @match        *://smotret-anime.app/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    var HF_REPO = 'MXOTGTUASG/NfrldGjy';
    var GH_USER = '26Ixrfj2';
    var GH_REPO = 'WB35RWQwFRFijt000IMG';

    var POSTER_CACHE_NAME = 'cr-posters-hf-cache-v1';
    var LOGO_CACHE_NAME = 'cr-logos-hf-cache-v1';
    var RESIZE_ICON_STORAGE_KEY = 'cr_pp_resize_svg_dataurl_v1';
    var ELLIPSIS_ICON_STORAGE_KEY = 'cr_pp_ellipsis_svg_dataurl_v1';

    var MODAL_ID = 'cr-poster-picker-modal';
    var LIGHTBOX_ID = 'cr-poster-lightbox-overlay';
    var STYLE_ID = 'cr-poster-picker-global-style-v23';

    var PROTO = 'https' + '://';
    var BASE_HF_RESOLVE = PROTO + 'huggingface' + '.co/datasets/' + HF_REPO + '/resolve/main/';
    var BASE_HF_TREE_API = PROTO + 'huggingface' + '.co/api/datasets/' + HF_REPO + '/tree/main/';

    var RESIZE_SVG_URLS = [
        PROTO + 'raw' + '.githubusercontent' + '.com/' + GH_USER + '/' + GH_REPO + '/main/General/Logo/gui-resize-full-svgrepo-com.svg',
        PROTO + 'cdn' + '.statically' + '.io/gh/' + GH_USER + '/' + GH_REPO + '/main/General/Logo/gui-resize-full-svgrepo-com.svg'
    ];

    var ELLIPSIS_SVG_URLS = [
        PROTO + 'raw' + '.githubusercontent' + '.com/' + GH_USER + '/' + GH_REPO + '/main/General/Logo/ellipsis-svgrepo-com.svg',
        PROTO + 'cdn' + '.statically' + '.io/gh/' + GH_USER + '/' + GH_REPO + '/main/General/Logo/ellipsis-svgrepo-com.svg'
    ];

    var memoryResizeDataUrl = null;
    var memoryEllipsisDataUrl = null;
    var resizeIconPromise = null;
    var ellipsisIconPromise = null;

    var postersListCache = {};
    var logosListCache = {};
    var pendingTreePromises = {};

    function blobToSvgDataUrl(blob) {
        return new Promise(function(resolve) {
            var reader = new FileReader();
            reader.onloadend = function() {
                var res = reader.result || null;
                if (res && res.indexOf('data:image/svg+xml') !== 0) {
                    res = res.replace(/^data:[^;]+;/, 'data:image/svg+xml;');
                }
                resolve(res);
            };
            reader.onerror = function() { resolve(null); };
            reader.readAsDataURL(blob);
        });
    }

    function getSvgAssetDataUrl(urls, storageKey, isResize) {
        if (isResize && memoryResizeDataUrl) return Promise.resolve(memoryResizeDataUrl);
        if (!isResize && memoryEllipsisDataUrl) return Promise.resolve(memoryEllipsisDataUrl);

        try {
            var saved = localStorage.getItem(storageKey);
            if (saved && saved.indexOf('data:image/') === 0) {
                if (isResize) memoryResizeDataUrl = saved;
                else memoryEllipsisDataUrl = saved;
                return Promise.resolve(saved);
            }
        } catch (e) {}

        if (isResize && resizeIconPromise) return resizeIconPromise;
        if (!isResize && ellipsisIconPromise) return ellipsisIconPromise;

        var p = new Promise(function(resolve) {
            var idx = 0;
            function tryNext() {
                if (idx >= urls.length) {
                    resolve(null);
                    return;
                }
                var url = urls.at(idx++);
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    responseType: 'blob',
                    timeout: 15000,
                    onload: function(res) {
                        if (res.status === 200 && res.response && res.response.size > 30) {
                            blobToSvgDataUrl(res.response).then(function(dataUrl) {
                                if (dataUrl) {
                                    if (isResize) memoryResizeDataUrl = dataUrl;
                                    else memoryEllipsisDataUrl = dataUrl;
                                    try { localStorage.setItem(storageKey, dataUrl); } catch (e) {}
                                }
                                resolve(dataUrl);
                            });
                        } else {
                            tryNext();
                        }
                    },
                    onerror: tryNext,
                    ontimeout: tryNext
                });
            }
            tryNext();
        }).then(function(res) {
            if (isResize) resizeIconPromise = null;
            else ellipsisIconPromise = null;
            return res;
        });

        if (isResize) resizeIconPromise = p;
        else ellipsisIconPromise = p;
        return p;
    }

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

    function getBucketPath(animeId) {
        var num = parseInt(animeId, 10);
        if (isNaN(num)) return null;
        var bucket = Math.floor(num / 1000) * 1000;
        return bucket + '/' + animeId;
    }

    function getSavedRoute(animeId, kind) {
        var key = kind === 'logo' ? ('cr_logo_route_hf_v1_' + animeId) : ('cr_route_hf_v1_' + animeId);
        try {
            if (typeof GM_getValue === 'function') {
                var raw = GM_getValue(key, '');
                if (raw) return JSON.parse(raw);
            }
        } catch (e) {}
        return null;
    }

    function saveRoute(animeId, url, kind) {
        var key = kind === 'logo' ? ('cr_logo_route_hf_v1_' + animeId) : ('cr_route_hf_v1_' + animeId);
        var payload = kind === 'logo' ? { url: url, align: 'left' } : { url: url, mode: 'bs' };
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(key, JSON.stringify(payload));
            }
        } catch (e) {}
    }

    function saveBlobToPersistentCache(animeId, blob, kind) {
        if (!('caches' in window)) return Promise.resolve();
        var cacheName = kind === 'logo' ? LOGO_CACHE_NAME : POSTER_CACHE_NAME;
        var cacheUrl = kind === 'logo'
            ? ('https://cr-logo-hf.local' + animeId)
            : ('https://cr-cache-hf.local' + animeId);
        var headers = kind === 'logo'
            ? { 'Content-Type': blob.type || 'image/png', 'X-CR-Logo-Align': 'left' }
            : { 'Content-Type': blob.type || 'image/jpeg', 'X-CR-Mode': 'bs' };

        return caches.open(cacheName).then(function(cache) {
            return cache.put(cacheUrl, new Response(blob, { headers: headers }));
        }).catch(function() {});
    }

    function fetchBlobViaGM(url) {
        return new Promise(function(resolve) {
            if (!url) {
                resolve(null);
                return;
            }
            if (url.indexOf('data:') === 0 || url.indexOf('blob:') === 0) {
                fetch(url).then(function(r) { return r.blob(); }).then(resolve).catch(function() { resolve(null); });
                return;
            }
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                headers: { 'Accept': 'image/*' },
                responseType: 'blob',
                timeout: 25000,
                onload: function(res) {
                    if (res.status === 200 && res.response && res.response.size > 100) {
                        resolve(res.response);
                    } else {
                        resolve(null);
                    }
                },
                onerror: function() { resolve(null); },
                ontimeout: function() { resolve(null); }
            });
        });
    }

    function fetchTreeFiles(apiSubPath) {
        var key = apiSubPath;
        if (pendingTreePromises[key]) return pendingTreePromises[key];

        pendingTreePromises[key] = new Promise(function(resolve) {
            GM_xmlhttpRequest({
                method: 'GET',
                url: BASE_HF_TREE_API + apiSubPath,
                headers: { 'Accept': 'application/json' },
                timeout: 20000,
                onload: function(res) {
                    delete pendingTreePromises[key];
                    if (res.status === 200 && res.responseText) {
                        try {
                            var list = JSON.parse(res.responseText);
                            resolve(Array.isArray(list) ? list : []);
                            return;
                        } catch (e) {}
                    }
                    resolve([]);
                },
                onerror: function() {
                    delete pendingTreePromises[key];
                    resolve([]);
                },
                ontimeout: function() {
                    delete pendingTreePromises[key];
                    resolve([]);
                }
            });
        });

        return pendingTreePromises[key];
    }

    function fetchAvailableItems(animeId, kind) {
        var cacheStore = kind === 'logo' ? logosListCache : postersListCache;
        if (cacheStore[animeId]) return Promise.resolve(cacheStore[animeId]);

        var folderPath = getBucketPath(animeId);
        if (!folderPath) return Promise.resolve([]);
        var targetPath = kind === 'logo' ? (folderPath + '/Logo') : folderPath;
return fetchTreeFiles(targetPath).then(function(list) {
var items = [];
list.forEach(function(entry) {
if (entry.type !== 'file' || !entry.path) return;
var fileName = entry.path.split('/').pop() || '';
if (!/.(jpg|jpeg|png|webp)$/i.test(fileName)) return;
if (kind !== 'logo' && /^E\d+./i.test(fileName)) return;
items.push({
name: fileName,
url: BASE_HF_RESOLVE + entry.path
});
});
items.sort(function(a, b) {
if (kind === 'logo') {
var mainRe = new RegExp('^' + animeId + '\.', 'i');
if (mainRe.test(a.name)) return -1;
if (mainRe.test(b.name)) return 1;
return a.name.localeCompare(b.name);
}
var mA = a.name.match(/T(\d+)./i);
var mB = b.name.match(/T(\d+)./i);
if (mA && mB) return parseInt(mA, 10) - parseInt(mB, 10);
if (mA) return -1;
if (mB) return 1;
var baseRe = new RegExp('^' + animeId + '\.', 'i');
if (baseRe.test(a.name)) return -1;
if (baseRe.test(b.name)) return 1;
return a.name.localeCompare(b.name);
});
cacheStore[animeId] = items;
return items;
});
}
function applySelectedAsset(animeId, assetUrl, blob, kind) {
var host = document.getElementById('cr-poster-host');
if (!host || !host.shadowRoot || host.getAttribute('data-anime-id') !== animeId) {
return Promise.resolve(false);
}
var sr = host.shadowRoot;
if (kind === 'logo') {
var bannerBox = sr.getElementById('cr-banner');
if (!bannerBox) return Promise.resolve(false);
if (!sr.getElementById('cr-logo-style')) {
var st = document.createElement('style');
st.id = 'cr-logo-style';
st.textContent =
'.cr-top-logo { position: absolute; top: 3.2vw; left: 4.9%; z-index: 4; max-width: 440px; max-height: 195px; width: auto; height: auto; object-fit: contain; object-position: left top; pointer-events: none; user-select: none; filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.85)); }' +
'@media (max-width: 960px) { .cr-top-logo { top: 16px; max-width: 260px; max-height: 120px; } }';
sr.appendChild(st);
}
var existingLogo = sr.getElementById('cr-anime-logo');
if (existingLogo) {
if (existingLogo.src && existingLogo.src.indexOf('blob:') === 0) {
URL.revokeObjectURL(existingLogo.src);
}
existingLogo.remove();
}
var img = document.createElement('img');
img.id = 'cr-anime-logo';
img.className = 'cr-top-logo';
img.setAttribute('data-logo-id', animeId);
img.alt = '';
img.src = URL.createObjectURL(blob);
bannerBox.appendChild(img);
saveRoute(animeId, assetUrl, 'logo');
return saveBlobToPersistentCache(animeId, blob, 'logo').then(function() { return true; });
}
// Установка постера (режим bs)
var bBanner = sr.getElementById('cr-banner');
var bgWrap = sr.getElementById('cr-bg-wrap');
var bCanvas = sr.querySelector('.bg-canvas');
var gradEl = sr.getElementById('cr-grad');
if (!bCanvas) return Promise.resolve(false);
return createImageBitmap(blob).then(function(bmp) {
if (bgWrap) bgWrap.style.height = '920px';
if (bBanner) bBanner.style.paddingTop = '520px';
bCanvas.classList.remove('mode-rs');
bCanvas.classList.add('mode-bs');
if (gradEl) gradEl.classList.add('is-bs');
bCanvas.width = bmp.width;
bCanvas.height = bmp.height;
bCanvas.getContext('2d').drawImage(bmp, 0, 0);
bCanvas.setAttribute('data-loaded', 'true');
if (typeof bmp.close === 'function') bmp.close();
saveRoute(animeId, assetUrl, 'bs');
return saveBlobToPersistentCache(animeId, blob, 'bs').then(function() { return true; });
}).catch(function() {
return false;
});
}
function ensureGlobalModalStyles() {
['cr-poster-picker-global-style-v2', 'cr-poster-picker-global-style-v21', 'cr-poster-picker-global-style-v22'].forEach(function(oldId) {
var el = document.getElementById(oldId);
if (el) el.remove();
});
if (document.getElementById(STYLE_ID)) return;
var st = document.createElement('style');
st.id = STYLE_ID;
st.textContent =
'@keyframes crCardShimmer {' +
'  0% { background-position: 200% 0; }' +
'  100% { background-position: -200% 0; }' +
'}' +
'#' + MODAL_ID + ' {' +
'  position: fixed !important; inset: 0 !important; z-index: 2147483645 !important;' +
'  background: rgba(0, 0, 0, 0.86) !important; display: none; align-items: center !important; justify-content: center !important;' +
'  font-family: Lato, Roboto, Arial, sans-serif !important; padding: 24px !important; box-sizing: border-box !important;' +
'}' +
'#' + MODAL_ID + '.is-open { display: flex !important; }' +
'.cr-pp-dialog {' +
'  position: relative !important; width: 100% !important; max-width: 1120px !important;' +
'  max-height: 88vh !important; display: flex !important; flex-direction: column !important;' +
'  background: #23252b !important; color: #ffffff !important; padding: 34px 36px 28px 36px !important;' +
'  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.96) !important; border-radius: 0 !important; box-sizing: border-box !important;' +
'}' +
'.cr-pp-close, .cr-pp-close:focus, .cr-pp-close:active {' +
'  position: absolute !important; top: 16px !important; right: 18px !important;' +
'  background: transparent !important; border: none !important; outline: none !important; box-shadow: none !important;' +
'  color: #a0a0a0 !important; font-size: 26px !important; line-height: 1 !important; cursor: pointer !important; padding: 4px !important;' +
'  transition: color 0.15s ease !important;' +
'}' +
'.cr-pp-close:hover { color: #ffffff !important; background: transparent !important; }' +
'.cr-pp-title {' +
'  font-size: 24px !important; font-weight: 700 !important; color: #ffffff !important;' +
'  margin: 0 0 24px 0 !important; padding: 0 !important; text-align: center !important; width: 100% !important;' +
'  flex-shrink: 0 !important;' +
'}' +
'.cr-pp-body {' +
'  overflow-y: auto !important; overflow-x: hidden !important; padding-right: 6px !important; flex: 1 1 auto !important;' +
'  scrollbar-width: thin !important; scrollbar-color: #f47521 #18191e !important;' +
'}' +
'.cr-pp-body::-webkit-scrollbar { width: 6px !important; }' +
'.cr-pp-body::-webkit-scrollbar-track { background: #18191e !important; }' +
'.cr-pp-body::-webkit-scrollbar-thumb { background: #f47521 !important; }' +
'.cr-pp-status {' +
'  text-align: center !important; padding: 48px 16px !important; font-size: 15px !important; color: #b8bcc4 !important;' +
'}' +
'.cr-pp-grid {' +
'  display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important;' +
'  gap: 24px 20px !important; width: 100% !important;' +
'}' +
'@media (max-width: 920px) { .cr-pp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }' +
'@media (max-width: 580px) { .cr-pp-grid { grid-template-columns: 1fr !important; } }' +
'.cr-pp-card {' +
'  display: flex !important; flex-direction: column !important; background: #18191e !important;' +
'  border: 1px solid rgba(255, 255, 255, 0.08) !important; box-sizing: border-box !important;' +
'}' +
'.cr-pp-card.is-current {' +
'  border-color: #f47521 !important;' +
'}' +
/* Контейнер картинки с плавным переливом с серого на чёрный во время загрузки */
'.cr-pp-thumb-box {' +
'  position: relative !important; width: 100% !important; aspect-ratio: 16 / 10 !important;' +
'  background: #101115 !important; overflow: hidden !important;' +
'}' +
'.cr-pp-thumb-box.is-loading {' +
'  background: linear-gradient(110deg, #101115 20%, #2c303a 50%, #101115 80%) !important;' +
'  background-size: 200% 100% !important;' +
'  animation: crCardShimmer 1.55s ease-in-out infinite !important;' +
'}' +
'.cr-pp-thumb-img {' +
'  width: 100% !important; height: 100% !important; object-fit: cover !important;' +
'  object-position: center 15% !important; display: block !important;' +
'  opacity: 0; transition: opacity 0.25s ease, transform 0.22s ease !important;' +
'}' +
'.cr-pp-thumb-img.is-logo-fit {' +
'  object-fit: contain !important; object-position: center center !important; padding: 16px !important; box-sizing: border-box !important;' +
'}' +
'.cr-pp-thumb-box:not(.is-loading) .cr-pp-thumb-img {' +
'  opacity: 1 !important;' +
'}' +
'.cr-pp-thumb-box:hover .cr-pp-thumb-img { transform: scale(1.03); }' +
/* Размер изображения оранжевым в левом нижнем углу тела картинки */
'.cr-pp-res-badge {' +
'  position: absolute !important; bottom: 8px !important; left: 8px !important; z-index: 4 !important;' +
'  background: rgba(0, 0, 0, 0.78) !important; color: #f47521 !important;' +
'  font-family: Lato, Roboto, Arial, sans-serif !important; font-size: 11px !important; font-weight: 700 !important;' +
'  letter-spacing: 0.4px !important; padding: 2px 7px !important; line-height: 1.3 !important;' +
'  pointer-events: none !important; display: none;' +
'}' +
'.cr-pp-res-badge.is-visible { display: inline-block !important; }' +
/* Кнопка расширить (gui-resize-full-svgrepo-com.svg): без тела, белые стрелки с чёрной туманной подсветкой по контуру */
'.cr-pp-zoom-btn, .cr-pp-zoom-btn:focus, .cr-pp-zoom-btn:active {' +
'  position: absolute !important; top: 9px !important; right: 9px !important; z-index: 8 !important;' +
'  width: 34px !important; height: 34px !important; padding: 0 !important; margin: 0 !important;' +
'  background: transparent !important; background-color: transparent !important;' +
'  border: none !important; outline: none !important; box-shadow: none !important; border-radius: 0 !important;' +
'  cursor: pointer !important;' +
'  display: flex !important; align-items: center !important; justify-content: center !important;' +
'  opacity: 0; visibility: hidden;' +
'  transition: opacity 0.16s ease, transform 0.15s ease !important;' +
'}' +
'.cr-pp-thumb-box:hover .cr-pp-zoom-btn, .cr-pp-card:hover .cr-pp-zoom-btn {' +
'  opacity: 1 !important; visibility: visible !important;' +
'}' +
'.cr-pp-zoom-btn:hover {' +
'  background: transparent !important; background-color: transparent !important;' +
'  transform: scale(1.14) !important;' +
'}' +
'.cr-pp-zoom-icon {' +
'  width: 22px !important; height: 22px !important; display: block !important; object-fit: contain !important;' +
'  filter: brightness(0) invert(1) drop-shadow(0 0 2px rgba(0, 0, 0, 1)) drop-shadow(0 0 5px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 11px rgba(0, 0, 0, 0.85)) !important;' +
'  pointer-events: none !important;' +
'}' +
/* Кнопка Установить под каждой картинкой */
'.cr-pp-install-btn, .cr-pp-install-btn:focus, .cr-pp-install-btn:active {' +
'  width: 100% !important; height: 40px !important; line-height: 40px !important; padding: 0 14px !important;' +
'  background: #2c2f37 !important; color: #ffffff !important; border: none !important; border-radius: 0 !important;' +
'  box-shadow: none !important; font-family: Lato, Roboto, Arial, sans-serif !important;' +
'  font-size: 13px !important; font-weight: 700 !important; letter-spacing: 0.7px !important;' +
'  text-transform: uppercase !important; text-align: center !important; cursor: pointer !important;' +
'  transition: background-color 0.16s ease, color 0.16s ease !important;' +
'}' +
'.cr-pp-install-btn:hover {' +
'  background: #f47521 !important; color: #000000 !important;' +
'}' +
'.cr-pp-install-btn.is-installed, .cr-pp-install-btn.is-installed:hover {' +
'  background: #f47521 !important; color: #000000 !important;' +
'}' +
'.cr-pp-install-btn.is-busy {' +
'  opacity: 0.75 !important; pointer-events: none !important;' +
'}' +
/* Нижняя панель с кнопкой ЗАГРУЗИТЬ */
'.cr-pp-footer {' +
'  margin-top: 22px !important; padding-top: 18px !important; border-top: 1px solid rgba(255, 255, 255, 0.12) !important;' +
'  display: flex !important; justify-content: center !important; flex-shrink: 0 !important;' +
'}' +
'.cr-pp-upload-toggle-btn, .cr-pp-upload-toggle-btn:focus, .cr-pp-upload-toggle-btn:active {' +
'  height: 42px !important; line-height: 42px !important; padding: 0 32px !important;' +
'  background: #2c2f37 !important; color: #ffffff !important; border: none !important; border-radius: 0 !important;' +
'  font-family: Lato, Roboto, Arial, sans-serif !important; font-size: 13px !important; font-weight: 700 !important;' +
'  letter-spacing: 0.8px !important; text-transform: uppercase !important; cursor: pointer !important;' +
'  transition: background-color 0.16s ease, color 0.16s ease !important;' +
'}' +
'.cr-pp-upload-toggle-btn:hover {' +
'  background: #f47521 !important; color: #000000 !important;' +
'}' +
/* Режим загрузки (Drag & Drop окно + продолговатый input URL + кнопка Сохранить) */
'.cr-pp-upload-view {' +
'  display: flex !important; flex-direction: column !important; gap: 18px !important; width: 100% !important; max-width: 760px !important; margin: 0 auto !important;' +
'}' +
'.cr-pp-dropzone {' +
'  position: relative !important; width: 100% !important; min-height: 310px !important;' +
'  background: #18191e !important; border: 2px dashed rgba(255, 255, 255, 0.24) !important;' +
'  display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important;' +
'  cursor: pointer !important; overflow: hidden !important; padding: 20px !important; box-sizing: border-box !important;' +
'  transition: border-color 0.18s ease, background-color 0.18s ease !important;' +
'}' +
'.cr-pp-dropzone:hover, .cr-pp-dropzone.is-dragover {' +
'  border-color: #f47521 !important; background: #1d1f26 !important;' +
'}' +
'.cr-pp-drop-hint {' +
'  text-align: center !important; color: #b8bcc4 !important; font-size: 15px !important; line-height: 1.6 !important; pointer-events: none !important;' +
'}' +
'.cr-pp-drop-hint strong { color: #ffffff !important; display: block !important; font-size: 17px !important; margin-bottom: 4px !important; }' +
'.cr-pp-drop-preview {' +
'  max-width: 100% !important; max-height: 340px !important; width: auto !important; height: auto !important;' +
'  object-fit: contain !important; display: none;' +
'}' +
'.cr-pp-drop-preview.is-visible { display: block !important; }' +
'.cr-pp-url-row {' +
'  display: flex !important; align-items: stretch !important; gap: 12px !important; width: 100% !important;' +
'}' +
'.cr-pp-url-input {' +
'  flex: 1 1 auto !important; height: 44px !important; padding: 0 16px !important;' +
'  background: #18191e !important; color: #ffffff !important; border: 1px solid rgba(255, 255, 255, 0.2) !important;' +
'  border-radius: 0 !important; font-family: Lato, Roboto, Arial, sans-serif !important; font-size: 14px !important;' +
'  outline: none !important; box-sizing: border-box !important; margin: 0 !important;' +
'}' +
'.cr-pp-url-input:focus {' +
'  border-color: #f47521 !important; box-shadow: none !important;' +
'}' +
'.cr-pp-save-btn, .cr-pp-save-btn:focus, .cr-pp-save-btn:active {' +
'  height: 44px !important; line-height: 44px !important; padding: 0 28px !important; flex-shrink: 0 !important;' +
'  background: #2c2f37 !important; color: #767a84 !important; border: none !important; border-radius: 0 !important;' +
'  font-family: Lato, Roboto, Arial, sans-serif !important; font-size: 13px !important; font-weight: 700 !important;' +
'  letter-spacing: 0.7px !important; text-transform: uppercase !important; cursor: not-allowed !important;' +
'  pointer-events: none !important; transition: background-color 0.16s ease, color 0.16s ease !important;' +
'}' +
'.cr-pp-save-btn.is-ready, .cr-pp-save-btn.is-ready:focus, .cr-pp-save-btn.is-ready:active {' +
'  background: #f47521 !important; color: #000000 !important; cursor: pointer !important; pointer-events: auto !important;' +
'}' +
'.cr-pp-save-btn.is-ready:hover {' +
'  background: #ff8533 !important; color: #000000 !important;' +
'}' +
/* Полноэкранный просмотр: крестик в чёрном кружке горит всегда */
'#' + LIGHTBOX_ID + ' {' +
'  position: fixed !important; inset: 0 !important; z-index: 2147483647 !important;' +
'  background: rgba(0, 0, 0, 0.94) !important; display: none; align-items: center !important; justify-content: center !important;' +
'  padding: 28px !important; box-sizing: border-box !important;' +
'}' +
'#' + LIGHTBOX_ID + '.is-open { display: flex !important; }' +
'.cr-pp-lb-img {' +
'  max-width: 92vw !important; max-height: 90vh !important; width: auto !important; height: auto !important;' +
'  object-fit: contain !important; display: block !important; box-shadow: 0 18px 54px rgba(0, 0, 0, 0.95) !important;' +
'}' +
'.cr-pp-lb-close, .cr-pp-lb-close:focus, .cr-pp-lb-close:active {' +
'  position: fixed !important; top: 22px !important; right: 26px !important; z-index: 2147483647 !important;' +
'  width: 44px !important; height: 44px !important; padding: 0 !important;' +
'  background: #000000 !important; background-color: #000000 !important; color: #ffffff !important;' +
'  border: 1px solid rgba(255, 255, 255, 0.25) !important; outline: none !important;' +
'  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.9) !important; border-radius: 50% !important;' +
'  font-size: 22px !important; line-height: 1 !important; cursor: pointer !important;' +
'  display: flex !important; align-items: center !important; justify-content: center !important;' +
'  opacity: 1 !important; visibility: visible !important;' +
'  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease !important;' +
'}' +
'.cr-pp-lb-close:hover {' +
'  background: #f47521 !important; color: #000000 !important; border-color: #f47521 !important;' +
'}';
document.head.appendChild(st);
}
function openLightbox(imageSrc) {
ensureGlobalModalStyles();
var lb = document.getElementById(LIGHTBOX_ID);
if (!lb) {
lb = document.createElement('div');
lb.id = LIGHTBOX_ID;
var closeBtn = document.createElement('button');
closeBtn.type = 'button';
closeBtn.className = 'cr-pp-lb-close';
closeBtn.title = 'Скрыть';
closeBtn.innerHTML = '✕';
closeBtn.addEventListener('click', function(e) {
e.stopPropagation();
lb.classList.remove('is-open');
});
var img = document.createElement('img');
img.className = 'cr-pp-lb-img';
img.alt = '';
lb.appendChild(closeBtn);
lb.appendChild(img);
lb.addEventListener('click', function(e) {
if (e.target === lb) lb.classList.remove('is-open');
});
document.body.appendChild(lb);
}
var lbImg = lb.querySelector('.cr-pp-lb-img');
if (lbImg) lbImg.src = imageSrc;
lb.classList.add('is-open');
}
document.addEventListener('keydown', function(e) {
if (e.key === 'Escape') {
var lb = document.getElementById(LIGHTBOX_ID);
if (lb && lb.classList.contains('is-open')) {
lb.classList.remove('is-open');
return;
}
var modal = document.getElementById(MODAL_ID);
if (modal && modal.classList.contains('is-open')) {
modal.classList.remove('is-open');
}
}
});
function buildUploadView(animeId, kind, onInstalledCallback) {
var wrap = document.createElement('div');
wrap.className = 'cr-pp-upload-view';
var dropzone = document.createElement('div');
dropzone.className = 'cr-pp-dropzone';
var fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'image/*';
fileInput.style.display = 'none';
var hint = document.createElement('div');
hint.className = 'cr-pp-drop-hint';
hint.innerHTML = 'Перетащите изображение сюдаили нажмите в это окно, чтобы выбрать файл с компьютера';
var previewImg = document.createElement('img');
previewImg.className = 'cr-pp-drop-preview';
previewImg.alt = '';
var resBadge = document.createElement('div');
resBadge.className = 'cr-pp-res-badge';
dropzone.appendChild(fileInput);
dropzone.appendChild(hint);
dropzone.appendChild(previewImg);
dropzone.appendChild(resBadge);
var urlRow = document.createElement('div');
urlRow.className = 'cr-pp-url-row';
var urlInput = document.createElement('input');
urlInput.type = 'text';
urlInput.className = 'cr-pp-url-input';
urlInput.placeholder = 'Вставьте прямую ссылку (URL) на изображение...';
var saveBtn = document.createElement('button');
saveBtn.type = 'button';
saveBtn.className = 'cr-pp-save-btn';
saveBtn.textContent = 'Сохранить';
urlRow.appendChild(urlInput);
urlRow.appendChild(saveBtn);
wrap.appendChild(dropzone);
wrap.appendChild(urlRow);
var selectedBlob = null;
var selectedSourceUrl = '';
var previewObjUrl = null;
var urlLoadTimer = null;
function setPreviewState(blob, sourceUrl) {
selectedBlob = blob;
selectedSourceUrl = sourceUrl || '';
if (previewObjUrl) {
URL.revokeObjectURL(previewObjUrl);
previewObjUrl = null;
}
if (blob) {
previewObjUrl = URL.createObjectURL(blob);
previewImg.onload = function() {
if (previewImg.naturalWidth && previewImg.naturalHeight) {
resBadge.textContent = previewImg.naturalWidth + '×' + previewImg.naturalHeight;
resBadge.classList.add('is-visible');
}
};
previewImg.src = previewObjUrl;
previewImg.classList.add('is-visible');
hint.style.display = 'none';
saveBtn.classList.add('is-ready');
} else {
previewImg.classList.remove('is-visible');
previewImg.removeAttribute('src');
resBadge.classList.remove('is-visible');
hint.style.display = 'block';
if (selectedSourceUrl) {
saveBtn.classList.add('is-ready');
} else {
saveBtn.classList.remove('is-ready');
}
}
}
function handleDroppedOrPickedFile(file) {
if (!file || !file.type || file.type.indexOf('image/') !== 0) return;
urlInput.value = '';
var reader = new FileReader();
reader.onload = function() {
setPreviewState(file, reader.result || ('local-file://' + file.name));
};
reader.readAsDataURL(file);
}
dropzone.addEventListener('click', function() {
fileInput.click();
});
fileInput.addEventListener('change', function() {
if (fileInput.files && fileInput.files) {
handleDroppedOrPickedFile(fileInput.files);
}
});
dropzone.addEventListener('dragover', function(e) {
e.preventDefault();
e.stopPropagation();
dropzone.classList.add('is-dragover');
});
dropzone.addEventListener('dragleave', function(e) {
e.preventDefault();
e.stopPropagation();
dropzone.classList.remove('is-dragover');
});
dropzone.addEventListener('drop', function(e) {
e.preventDefault();
e.stopPropagation();
dropzone.classList.remove('is-dragover');
if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files) {
handleDroppedOrPickedFile(e.dataTransfer.files);
}
});
urlInput.addEventListener('input', function() {
var val = (urlInput.value || '').trim();
if (urlLoadTimer) clearTimeout(urlLoadTimer);
if (!val) {
setPreviewState(null, '');
return;
}
saveBtn.classList.add('is-ready');
selectedSourceUrl = val;
selectedBlob = null;
urlLoadTimer = setTimeout(function() {
fetchBlobViaGM(val).then(function(blob) {
if ((urlInput.value || '').trim() !== val) return;
if (blob) {
setPreviewState(blob, val);
} else {
previewImg.onload = function() {
if (previewImg.naturalWidth && previewImg.naturalHeight) {
resBadge.textContent = previewImg.naturalWidth + '×' + previewImg.naturalHeight;
resBadge.classList.add('is-visible');
}
};
previewImg.src = val;
previewImg.classList.add('is-visible');
hint.style.display = 'none';
}
});
}, 350);
});
saveBtn.addEventListener('click', function(e) {
e.preventDefault();
e.stopPropagation();
if (!saveBtn.classList.contains('is-ready')) return;
var finalUrl = (urlInput.value || '').trim() || selectedSourceUrl;
if (!finalUrl && !selectedBlob) return;
saveBtn.textContent = 'Сохранение...';
saveBtn.style.pointerEvents = 'none';
var blobPromise = selectedBlob ? Promise.resolve(selectedBlob) : fetchBlobViaGM(finalUrl);
blobPromise.then(function(blob) {
saveBtn.style.pointerEvents = '';
if (!blob) {
saveBtn.textContent = 'Ошибка загрузки';
setTimeout(function() { saveBtn.textContent = 'Сохранить'; }, 1500);
return;
}
applySelectedAsset(animeId, finalUrl, blob, kind).then(function(ok) {
saveBtn.textContent = ok ? 'Сохранено!' : 'Сохранить';
if (ok && typeof onInstalledCallback === 'function') {
setTimeout(onInstalledCallback, 350);
}
});
});
});
return wrap;
}
function openPickerModal(animeId, kind) {
ensureGlobalModalStyles();
var existing = document.getElementById(MODAL_ID);
if (existing) existing.remove();
var isLogoMode = kind === 'logo';
var isUploadMode = false;
var overlay = document.createElement('div');
overlay.id = MODAL_ID;
var dialog = document.createElement('div');
dialog.className = 'cr-pp-dialog';
var closeBtn = document.createElement('button');
closeBtn.type = 'button';
closeBtn.className = 'cr-pp-close';
closeBtn.innerHTML = '✕';
closeBtn.addEventListener('click', function() {
overlay.classList.remove('is-open');
});
var heading = document.createElement('h2');
heading.className = 'cr-pp-title';
heading.textContent = isLogoMode ? 'Изменить лого' : 'Изменить постер';
var body = document.createElement('div');
body.className = 'cr-pp-body';
var footer = document.createElement('div');
footer.className = 'cr-pp-footer';
var uploadToggleBtn = document.createElement('button');
uploadToggleBtn.type = 'button';
uploadToggleBtn.className = 'cr-pp-upload-toggle-btn';
uploadToggleBtn.textContent = 'Загрузить';
footer.appendChild(uploadToggleBtn);
dialog.appendChild(closeBtn);
dialog.appendChild(heading);
dialog.appendChild(body);
dialog.appendChild(footer);
overlay.appendChild(dialog);
overlay.addEventListener('click', function(e) {
if (e.target === overlay) overlay.classList.remove('is-open');
});
document.body.appendChild(overlay);
overlay.classList.add('is-open');
function renderGalleryMode() {
isUploadMode = false;
uploadToggleBtn.textContent = 'Загрузить';
body.innerHTML = '';
var statusEl = document.createElement('div');
statusEl.className = 'cr-pp-status';
statusEl.textContent = isLogoMode ? 'Загрузка доступных логотипов...' : 'Загрузка доступных постеров...';
body.appendChild(statusEl);
fetchAvailableItems(animeId, kind).then(function(items) {
if (!document.body.contains(overlay) || isUploadMode) return;
if (!items || items.length === 0) {
statusEl.textContent = isLogoMode
? 'Логотипы для этого тайтла не найдены. Нажмите «Загрузить», чтобы добавить свой.'
: 'Постеры для этого тайтла не найдены. Нажмите «Загрузить», чтобы добавить свой.';
return;
}
var saved = getSavedRoute(animeId, kind);
var activeUrl = saved && saved.url ? saved.url : '';
var grid = document.createElement('div');
grid.className = 'cr-pp-grid';
items.forEach(function(item) {
var isCurrent = activeUrl === item.url;
var loadedBlob = null;
var displayObjectUrl = null;
var card = document.createElement('div');
card.className = 'cr-pp-card' + (isCurrent ? ' is-current' : '');
var thumbBox = document.createElement('div');
thumbBox.className = 'cr-pp-thumb-box is-loading';
var img = document.createElement('img');
img.className = 'cr-pp-thumb-img' + (isLogoMode ? ' is-logo-fit' : '');
img.alt = item.name;
thumbBox.appendChild(img);
var resBadge = document.createElement('div');
resBadge.className = 'cr-pp-res-badge';
thumbBox.appendChild(resBadge);
var zoomBtn = document.createElement('button');
zoomBtn.type = 'button';
zoomBtn.className = 'cr-pp-zoom-btn';
zoomBtn.title = 'Расширить';
var zoomImg = document.createElement('img');
zoomImg.className = 'cr-pp-zoom-icon';
zoomImg.alt = 'Расширить';
zoomImg.src = memoryResizeDataUrl || RESIZE_SVG_URLS.at(0);
if (!memoryResizeDataUrl) {
getSvgAssetDataUrl(RESIZE_SVG_URLS, RESIZE_ICON_STORAGE_KEY, true).then(function(dUrl) {
if (dUrl) zoomImg.src = dUrl;
});
}
zoomBtn.appendChild(zoomImg);
zoomBtn.addEventListener('click', function(e) {
e.preventDefault();
e.stopPropagation();
openLightbox(displayObjectUrl || item.url);
});
thumbBox.appendChild(zoomBtn);
var installBtn = document.createElement('button');
installBtn.type = 'button';
installBtn.className = 'cr-pp-install-btn' + (isCurrent ? ' is-installed' : '');
installBtn.textContent = isCurrent ? 'Установлено' : 'Установить';
installBtn.addEventListener('click', function(e) {
e.preventDefault();
e.stopPropagation();
installBtn.classList.add('is-busy');
installBtn.textContent = 'Установка...';
var blobPromise = loadedBlob ? Promise.resolve(loadedBlob) : fetchBlobViaGM(item.url);
blobPromise.then(function(blob) {
installBtn.classList.remove('is-busy');
if (!blob) {
installBtn.textContent = 'Ошибка загрузки';
setTimeout(function() {
installBtn.textContent = 'Установить';
}, 1500);
return;
}
loadedBlob = blob;
applySelectedAsset(animeId, item.url, blob, kind).then(function(ok) {
if (ok) {
grid.querySelectorAll('.cr-pp-card').forEach(function(c) {
c.classList.remove('is-current');
});
grid.querySelectorAll('.cr-pp-install-btn').forEach(function(b) {
b.classList.remove('is-installed');
b.textContent = 'Установить';
});
card.classList.add('is-current');
installBtn.classList.add('is-installed');
installBtn.textContent = 'Установлено';
} else {
installBtn.textContent = 'Установить';
}
});
});
});
card.appendChild(thumbBox);
card.appendChild(installBtn);
grid.appendChild(card);
img.onload = function() {
thumbBox.classList.remove('is-loading');
if (img.naturalWidth && img.naturalHeight) {
resBadge.textContent = img.naturalWidth + '×' + img.naturalHeight;
resBadge.classList.add('is-visible');
}
};
img.onerror = function() {
thumbBox.classList.remove('is-loading');
};
fetchBlobViaGM(item.url).then(function(blob) {
if (blob) {
loadedBlob = blob;
displayObjectUrl = URL.createObjectURL(blob);
img.src = displayObjectUrl;
} else {
img.src = item.url;
}
});
});
body.innerHTML = '';
body.appendChild(grid);
});
}
function renderUploadMode() {
isUploadMode = true;
uploadToggleBtn.textContent = 'Назад к списку';
body.innerHTML = '';
var uploadView = buildUploadView(animeId, kind, function() {
overlay.classList.remove('is-open');
});
body.appendChild(uploadView);
}
uploadToggleBtn.addEventListener('click', function(e) {
e.preventDefault();
e.stopPropagation();
if (isUploadMode) {
renderGalleryMode();
} else {
renderUploadMode();
}
});
renderGalleryMode();
}
function injectMoreButtonIntoPoster() {
var animeId = getAnimeId();
var host = document.getElementById('cr-poster-host');
if (!animeId || !host || !host.shadowRoot) return;
var sr = host.shadowRoot;
var bannerBox = sr.getElementById('cr-banner');
if (!bannerBox) return;
if (!sr.getElementById('cr-poster-more-btn-style-v23')) {
[
'cr-poster-more-btn-style',
'cr-poster-more-btn-style-v2',
'cr-poster-more-btn-style-v21',
'cr-poster-more-btn-style-v22'
].forEach(function(oldId) {
var el = sr.getElementById(oldId);
if (el) el.remove();
});
var st = document.createElement('style');
st.id = 'cr-poster-more-btn-style-v23';
st.textContent =
'.cr-poster-more-wrap {' +
'  position: absolute !important;' +
'  top: 2.2vw !important;' +
'  right: 4.9% !important;' +
'  z-index: 20 !important;' +
'  display: inline-flex !important;' +
'  flex-direction: column !important;' +
'  align-items: flex-end !important;' +
'}' +
'.cr-poster-more-btn, .cr-poster-more-btn:focus, .cr-poster-more-btn:active {' +
'  background: transparent !important;' +
'  background-color: transparent !important;' +
'  border: none !important;' +
'  outline: none !important;' +
'  box-shadow: none !important;' +
'  text-shadow: none !important;' +
'  border-radius: 0 !important;' +
'  padding: 6px 4px !important;' +
'  margin: 0 !important;' +
'  display: inline-flex !important;' +
'  align-items: center !important;' +
'  gap: 12px !important;' +
'  font-family: Lato, Roboto, Arial, sans-serif !important;' +
'  font-size: 16px !important;' +
'  font-weight: 700 !important;' +
'  letter-spacing: 1px !important;' +
'  text-transform: uppercase !important;' +
'  color: #b8bcc4 !important;' +
'  cursor: pointer !important;' +
'  transition: color 0.16s ease !important;' +
'}' +
'.cr-poster-more-dots {' +
'  display: inline-flex !important;' +
'  align-items: center !important;' +
'  justify-content: center !important;' +
'  flex-shrink: 0 !important;' +
'}' +
'.cr-poster-more-dots-img {' +
'  width: 24px !important;' +
'  height: 24px !important;' +
'  display: block !important;' +
'  object-fit: contain !important;' +
'  filter: brightness(0) invert(1) !important;' +
'  opacity: 0.72 !important;' +
'  transition: opacity 0.16s ease !important;' +
'}' +
'.cr-poster-more-btn:hover, .cr-poster-more-btn.is-open {' +
'  background: transparent !important;' +
'  background-color: transparent !important;' +
'  color: #ffffff !important;' +
'  text-shadow: none !important;' +
'}' +
'.cr-poster-more-btn:hover .cr-poster-more-dots-img, .cr-poster-more-btn.is-open .cr-poster-more-dots-img {' +
'  opacity: 1 !important;' +
'}' +
'.cr-poster-more-dropdown {' +
'  margin-top: 8px !important;' +
'  min-width: 205px !important;' +
'  background: #23252b !important;' +
'  background-color: #23252b !important;' +
'  border: none !important;' +
'  border-radius: 0 !important;' +
'  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.9) !important;' +
'  padding: 5px 0 !important;' +
'  display: none !important;' +
'  flex-direction: column !important;' +
'}' +
'.cr-poster-more-dropdown.is-open {' +
'  display: flex !important;' +
'}' +
'.cr-poster-more-dd-item, .cr-poster-more-dd-item:focus, .cr-poster-more-dd-item:active {' +
'  width: 100% !important;' +
'  background: transparent !important;' +
'  background-color: transparent !important;' +
'  border: none !important;' +
'  outline: none !important;' +
'  box-shadow: none !important;' +
'  text-shadow: none !important;' +
'  border-radius: 0 !important;' +
'  padding: 12px 18px !important;' +
'  margin: 0 !important;' +
'  text-align: left !important;' +
'  font-family: Lato, Roboto, Arial, sans-serif !important;' +
'  font-size: 13px !important;' +
'  font-weight: 700 !important;' +
'  letter-spacing: 0.7px !important;' +
'  text-transform: uppercase !important;' +
'  color: #dadada !important;' +
'  cursor: pointer !important;' +
'  transition: background-color 0.14s ease, color 0.14s ease !important;' +
'}' +
'.cr-poster-more-dd-item:hover {' +
'  background: #2e313a !important;' +
'  color: #ffffff !important;' +
'}' +
'@media (max-width: 960px) {' +
'  .cr-poster-more-wrap { top: 16px !important; }' +
'}';
sr.appendChild(st);
}
var existingWrap = sr.getElementById('cr-poster-more-wrap');
if (existingWrap && existingWrap.getAttribute('data-anime-id') === animeId) {
return;
}
if (existingWrap) existingWrap.remove();
var oldSingleBtn = sr.getElementById('cr-poster-more-btn');
if (oldSingleBtn) oldSingleBtn.remove();
var wrap = document.createElement('div');
wrap.id = 'cr-poster-more-wrap';
wrap.className = 'cr-poster-more-wrap';
wrap.setAttribute('data-anime-id', animeId);
var moreBtn = document.createElement('button');
moreBtn.type = 'button';
moreBtn.id = 'cr-poster-more-btn';
moreBtn.className = 'cr-poster-more-btn';
var dotsWrap = document.createElement('span');
dotsWrap.className = 'cr-poster-more-dots';
var dotsImg = document.createElement('img');
dotsImg.className = 'cr-poster-more-dots-img';
dotsImg.alt = '';
dotsImg.src = memoryEllipsisDataUrl || ELLIPSIS_SVG_URLS.at(0);
if (!memoryEllipsisDataUrl) {
getSvgAssetDataUrl(ELLIPSIS_SVG_URLS, ELLIPSIS_ICON_STORAGE_KEY, false).then(function(dUrl) {
if (dUrl) dotsImg.src = dUrl;
});
}
dotsWrap.appendChild(dotsImg);
var labelSpan = document.createElement('span');
labelSpan.textContent = 'ЕЩЁ';
moreBtn.appendChild(dotsWrap);
moreBtn.appendChild(labelSpan);
var dropdown = document.createElement('div');
dropdown.className = 'cr-poster-more-dropdown';
var optPoster = document.createElement('button');
optPoster.type = 'button';
optPoster.className = 'cr-poster-more-dd-item';
optPoster.textContent = 'ИЗМЕНИТЬ ПОСТЕР';
var optLogo = document.createElement('button');
optLogo.type = 'button';
optLogo.className = 'cr-poster-more-dd-item';
optLogo.textContent = 'ИЗМЕНИТЬ ЛОГО';
dropdown.appendChild(optPoster);
dropdown.appendChild(optLogo);
function closeDropdown() {
dropdown.classList.remove('is-open');
moreBtn.classList.remove('is-open');
}
moreBtn.addEventListener('click', function(e) {
e.preventDefault();
e.stopPropagation();
var willOpen = !dropdown.classList.contains('is-open');
dropdown.classList.toggle('is-open', willOpen);
moreBtn.classList.toggle('is-open', willOpen);
});
optPoster.addEventListener('click', function(e) {
e.preventDefault();
e.stopPropagation();
closeDropdown();
openPickerModal(animeId, 'poster');
});
optLogo.addEventListener('click', function(e) {
e.preventDefault();
e.stopPropagation();
closeDropdown();
openPickerModal(animeId, 'logo');
});
sr.addEventListener('click', function(e) {
if (!wrap.contains(e.target)) {
closeDropdown();
}
});
document.addEventListener('click', function(e) {
if (e.target !== host) {
closeDropdown();
}
});
wrap.appendChild(moreBtn);
wrap.appendChild(dropdown);
bannerBox.appendChild(wrap);
}
getSvgAssetDataUrl(RESIZE_SVG_URLS, RESIZE_ICON_STORAGE_KEY, true);
getSvgAssetDataUrl(ELLIPSIS_SVG_URLS, ELLIPSIS_ICON_STORAGE_KEY, false);
window.addEventListener('cr-reset-page-cache', function(e) {
var resetId = e && e.detail && e.detail.animeId;
if (resetId) {
delete postersListCache[resetId];
delete logosListCache[resetId];
} else {
postersListCache = {};
logosListCache = {};
}
});
window.addEventListener('popstate', injectMoreButtonIntoPoster);
setInterval(injectMoreButtonIntoPoster, 350);
})();

