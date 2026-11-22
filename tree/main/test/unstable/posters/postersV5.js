// ==UserScript==
// @name         Anime 365 Crunchyroll Banner (GitHub Loader)
// @namespace    http://tampermonkey.net
// @version      13.2
// @description  Точечная загрузка постеров через Statically CDN + резервный RawGH с остановкой на первом найденном файле
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
    var CACHE_NAME = 'cr-posters-cache-v10';
    var failedIds = {};
    var loadedCache = {};
    var isLoading = false;
    var loadGen = 0;

    var PROTO = 'https' + '://';
    var BASE_STATICALLY = PROTO + 'cdn' + '.statically' + '.io/gh/' + USER + '/' + REPO + '/main/';
    var BASE_RAWGH = PROTO + 'raw' + '.githubusercontent' + '.com/' + USER + '/' + REPO + '/main/';

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

    function removeBannerHost() {
        var oldHost = document.getElementById('cr-poster-host');
        if (oldHost) oldHost.remove();
    }

    function mountAndRenderBanner(animeId, bmp, mode, myGen) {
        if (myGen !== loadGen || getAnimeId() !== animeId) {
            if (bmp && typeof bmp.close === 'function') bmp.close();
            return;
        }

        removeBannerHost();

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
            '.status { display: none; }' +
            '</style>' +
            '<div class="banner" id="cr-banner">' +
            '<div class="bg-wrap" id="cr-bg-wrap"><canvas class="bg-canvas"></canvas><div class="gradient" id="cr-grad"></div></div>' +
            '<div class="status" id="st"></div>' +
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

        bCanvas.setAttribute('data-loaded', 'true');
        isLoading = false;
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
        }).catch(function() { return null; });
    }

    function saveToPersistentCache(animeId, blob, mode) {
        if (!('caches' in window)) return;
        caches.open(CACHE_NAME).then(function(cache) {
            var resp = new Response(blob, {
                headers: { 'Content-Type': blob.type || 'image/jpeg', 'X-CR-Mode': mode }
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
                var raw = GM_getValue('cr_route_v10_' + animeId, '');
                if (raw) return JSON.parse(raw);
            }
        } catch (e) {}
        return null;
    }

    function saveRoute(animeId, url, mode) {
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue('cr_route_v10_' + animeId, JSON.stringify({ url: url, mode: mode }));
            }
        } catch (e) {}
    }

    function clearSavedRoute(animeId) {
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue('cr_route_v10_' + animeId, '');
            }
        } catch (e) {}
    }
    function initBanner(animeId, forceFresh) {
        if (!forceFresh && (document.getElementById('cr-poster-host') || failedIds[animeId] || isLoading)) return;

        removeBannerHost();
        isLoading = true;
        var myGen = ++loadGen;

        if (!forceFresh && loadedCache[animeId]) {
            var mem = loadedCache[animeId];
            createImageBitmap(mem.blob).then(function(bmp) {
                mountAndRenderBanner(animeId, bmp, mem.mode, myGen);
            }).catch(function() {
                if (myGen !== loadGen) return;
                delete loadedCache[animeId];
                startNetworkLoad(false);
            });
            return;
        }

        if (forceFresh) {
            startNetworkLoad(true);
            return;
        }

        readFromPersistentCache(animeId).then(function(cached) {
            if (myGen !== loadGen) return;
            if (cached && cached.blob && cached.blob.size > 500) {
                loadedCache[animeId] = cached;
                createImageBitmap(cached.blob).then(function(bmp) {
                    mountAndRenderBanner(animeId, bmp, cached.mode, myGen);
                }).catch(function() {
                    if (myGen !== loadGen) return;
                    startNetworkLoad(false);
                });
            } else {
                startNetworkLoad(false);
            }
        });

        function startNetworkLoad(bypassCache) {
            var savedRoute = bypassCache ? null : getSavedRoute(animeId);
            var exts = ['.jpg', '.png', '.webp'];
            var queue = [];

            if (savedRoute && savedRoute.url) {
                queue.push({ url: savedRoute.url, mode: savedRoute.mode, isSaved: true });
            }

            // Сначала быстрый CDN Statically (доступен без блокировок)
            exts.forEach(function(ext) {
                queue.push({ url: BASE_STATICALLY + 'PostersBS/' + animeId + ext, mode: 'bs' });
                queue.push({ url: BASE_STATICALLY + 'PosterRS/' + animeId + ext, mode: 'rs' });
                queue.push({ url: BASE_STATICALLY + 'posters/' + animeId + ext, mode: 'default' });
            });

            // Резервный проход через RawGH
            exts.forEach(function(ext) {
                queue.push({ url: BASE_RAWGH + 'PostersBS/' + animeId + ext, mode: 'bs' });
                queue.push({ url: BASE_RAWGH + 'PosterRS/' + animeId + ext, mode: 'rs' });
                queue.push({ url: BASE_RAWGH + 'posters/' + animeId + ext, mode: 'default' });
            });

            function handleFail() {
                if (myGen !== loadGen) return;
                isLoading = false;
                failedIds[animeId] = true;
                removeBannerHost();
            }

            function tryNext(idx) {
                if (myGen !== loadGen || getAnimeId() !== animeId) {
                    isLoading = false;
                    return;
                }
                if (idx >= queue.length) {
                    handleFail();
                    return;
                }
                var item = queue.at(idx);

                var req = {
                    method: 'GET',
                    url: item.url,
                    headers: { 'Accept': 'image/*' },
                    responseType: 'blob',
                    timeout: 15000,
                    onload: function(res) {
                        if (myGen !== loadGen) return;
                        if (res.status === 200 && res.response && res.response.size > 500) {
                            var blob = res.response;
                            createImageBitmap(blob).then(function(bmp) {
                                if (myGen !== loadGen) return;
                                loadedCache[animeId] = { blob: blob, mode: item.mode };
                                saveToPersistentCache(animeId, blob, item.mode);
                                saveRoute(animeId, item.url, item.mode);
                                mountAndRenderBanner(animeId, bmp, item.mode, myGen);
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
                        if (myGen !== loadGen) return;
                        if (item.isSaved) clearSavedRoute(animeId);
                        tryNext(idx + 1);
                    },
                    ontimeout: function() {
                        if (myGen !== loadGen) return;
                        tryNext(idx + 1);
                    }
                };
                if (bypassCache) {
                    req.nocache = true;
                    req.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
                }
                GM_xmlhttpRequest(req);
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
        ctx.drawImage(img, x, 0, w, h);

        var fadeW = Math.min(260, Math.round(w * 0.28));
        var gradL = ctx.createLinearGradient(x, 0, x + fadeW, 0);
        gradL.addColorStop(0, '#000000');
        gradL.addColorStop(0.35, 'rgba(0,0,0,0.68)');
        gradL.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradL;
        ctx.fillRect(x, 0, fadeW, h);

        var gradR = ctx.createLinearGradient(x + w - fadeW, 0, x + w, 0);
        gradR.addColorStop(0, 'rgba(0,0,0,0)');
        gradR.addColorStop(0.65, 'rgba(0,0,0,0.68)');
        gradR.addColorStop(1, '#000000');
        ctx.fillStyle = gradR;
        ctx.fillRect(x + w - fadeW, 0, fadeW, h);

        var fadeB = Math.min(180, Math.round(h * 0.28));
        var gradB = ctx.createLinearGradient(0, h - fadeB, 0, h);
        gradB.addColorStop(0, 'rgba(0,0,0,0)');
        gradB.addColorStop(1, '#000000');
        ctx.fillStyle = gradB;
        ctx.fillRect(x, h - fadeB, w, fadeB);
    }

    window.addEventListener('cr-reset-page-cache', function(e) {
        var curId = e && e.detail && e.detail.animeId;
        if (!curId) return;
        delete loadedCache[curId];
        delete failedIds[curId];
        clearSavedRoute(curId);
        isLoading = false;
        loadGen++;
        clearPersistentCache(curId).then(function() {
            if (getAnimeId() === curId) {
                initBanner(curId, true);
            }
        });
    });

    function syncVisibility() {
        var animeId = getAnimeId();
        var host = document.getElementById('cr-poster-host');
        if (animeId) {
            if (host && host.getAttribute('data-anime-id') !== animeId) {
                isLoading = false;
                loadGen++;
                removeBannerHost();
                if (!failedIds[animeId]) initBanner(animeId, false);
            } else if (!host && !failedIds[animeId] && !isLoading) {
                initBanner(animeId, false);
            }
        } else {
            isLoading = false;
            loadGen++;
            removeBannerHost();
        }
    }

    window.addEventListener('popstate', syncVisibility);
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
// @version      10.0
// @description  Рабочая схема загрузки логотипов из Logo / LogoCNT + кэширование + сброс по кнопке в nav
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
    var LOGO_CACHE_NAME = 'cr-logos-cache-v7';

    var activeAnimeId = null;
    var isLoading = false;
    var logoGen = 0;
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
                var raw = GM_getValue('cr_logo_route_v7_' + animeId, '');
                if (raw) return JSON.parse(raw);
            }
        } catch (e) {}
        return null;
    }

    function saveLogoRoute(animeId, url, align) {
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue('cr_logo_route_v7_' + animeId, JSON.stringify({ url: url, align: align }));
            }
        } catch (e) {}
    }

    function clearSavedLogoRoute(animeId) {
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue('cr_logo_route_v7_' + animeId, '');
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

    window.addEventListener('cr-reset-page-cache', function(e) {
        var resetId = e && e.detail && e.detail.animeId;
        if (!resetId) return;
        delete loadedLogoCache[resetId];
        delete failedLogoIds[resetId];
        clearSavedLogoRoute(resetId);
        forceFreshForId[resetId] = true;
        logoGen++;
        isLoading = false;
        if (activeAnimeId === resetId) {
            activeAnimeId = null;
        }
        var host = document.getElementById('cr-poster-host');
        if (host && host.shadowRoot) {
            var oldImg = host.shadowRoot.getElementById('cr-anime-logo');
            if (oldImg) oldImg.remove();
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
        var myGen = ++logoGen;
        var bypass = !!forceFreshForId[animeId];
        delete forceFreshForId[animeId];

        if (!bypass && loadedLogoCache[animeId]) {
            var mem = loadedLogoCache[animeId];
            renderLogo(shadow, animeId, mem.blob, mem.align);
            isLoading = false;
            return;
        }

        if (bypass) {
            startLogoNetworkLoad(shadow, animeId, true, myGen);
            return;
        }

        readLogoFromCache(animeId).then(function(cached) {
            if (myGen !== logoGen) return;
            if (cached && cached.blob && cached.blob.size > 100) {
                loadedLogoCache[animeId] = cached;
                renderLogo(shadow, animeId, cached.blob, cached.align);
                isLoading = false;
            } else {
                startLogoNetworkLoad(shadow, animeId, false, myGen);
            }
        });
    }

    function startLogoNetworkLoad(shadow, animeId, bypassCache, myGen) {
        var savedRoute = bypassCache ? null : getSavedLogoRoute(animeId);
        var exts = ['.png', '.jpg', '.JPG', '.jpeg', '.webp', '.PNG', '.WEBP'];
        var queue = [];
        var bust = bypassCache ? ('?_t=' + Date.now()) : '';

        if (savedRoute && savedRoute.url) {
            queue.push({ url: savedRoute.url, align: savedRoute.align || 'left', isSaved: true });
        }

        // Точно тот же порядок из рабочей v7.0: сначала BASE_RAWGH, затем GITHACK и STATICALLY
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
            if (myGen !== logoGen) return;
            if (idx >= queue.length || activeAnimeId !== animeId) {
                if (idx >= queue.length) failedLogoIds[animeId] = true;
                isLoading = false;
                return;
            }
            var item = queue[idx];
            var req = {
                method: 'GET',
                url: item.url,
                headers: { 'Accept': 'image/*' },
                responseType: 'blob',
                timeout: 30000,
                onload: function(res) {
                    if (myGen !== logoGen) return;
                    if (res.status === 200 && res.response && res.response.size > 100) {
                        var blob = res.response;
                        createImageBitmap(blob).then(function(bmp) {
                            if (bmp && typeof bmp.close === 'function') bmp.close();
                            if (myGen !== logoGen) return;
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
                    if (myGen !== loadGen) return;
                    if (item.isSaved) clearSavedLogoRoute(animeId);
                    tryNext(idx + 1);
                },
                ontimeout: function() {
                    if (myGen !== loadGen) return;
                    tryNext(idx + 1);
                }
            };
            if (bypassCache) {
                req.nocache = true;
                req.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
                req.headers['Pragma'] = 'no-cache';
            }
            GM_xmlhttpRequest(req);
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
// ==UserScript==
// @name         Anime 365 Crunchyroll Logo Overlay
// @namespace    http://tampermonkey.net
// @version      11.2
// @description  Точечная загрузка логотипов через Statically CDN + резервный RawGH с остановкой при нахождении
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
    var LOGO_CACHE_NAME = 'cr-logos-cache-v10';

    var activeAnimeId = null;
    var isLoading = false;
    var logoGen = 0;
    var loadedLogoCache = {};
    var failedLogoIds = {};
    var forceFreshForId = {};

    var PROTO = 'https' + '://';
    var BASE_STATICALLY = PROTO + 'cdn' + '.statically' + '.io/gh/' + USER + '/' + REPO + '/main/';
    var BASE_RAWGH = PROTO + 'raw' + '.githubusercontent' + '.com/' + USER + '/' + REPO + '/main/';

    function getSavedLogoRoute(animeId) {
        try {
            if (typeof GM_getValue === 'function') {
                var raw = GM_getValue('cr_logo_route_v10_' + animeId, '');
                if (raw) return JSON.parse(raw);
            }
        } catch (e) {}
        return null;
    }

    function saveLogoRoute(animeId, url, align) {
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue('cr_logo_route_v10_' + animeId, JSON.stringify({ url: url, align: align }));
            }
        } catch (e) {}
    }

    function clearSavedLogoRoute(animeId) {
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue('cr_logo_route_v10_' + animeId, '');
            }
        } catch (e) {}
    }

    function readLogoFromCache(animeId) {
        if (!('caches' in window)) return Promise.resolve(null);
        return caches.open(LOGO_CACHE_NAME).then(function(cache) {
            return cache.match('https://cr-logo-cache.local' + animeId).then(function(resp) {
                if (!resp) return null;
                var align = resp.headers.get('X-CR-Logo-Align') || 'left';
                return resp.blob().then(function(blob) {
                    return { blob: blob, align: align };
                });
            });
        }).catch(function() { return null; });
    }

    function saveLogoToCache(animeId, blob, align) {
        if (!('caches' in window)) return;
        caches.open(LOGO_CACHE_NAME).then(function(cache) {
            var resp = new Response(blob, {
                headers: { 'Content-Type': blob.type || 'image/png', 'X-CR-Logo-Align': align }
            });
            cache.put('https://cr-logo-cache.local' + animeId, resp);
        }).catch(function() {});
    }

    function clearLogoCache(animeId) {
        if (!('caches' in window)) return Promise.resolve();
        return caches.open(LOGO_CACHE_NAME).then(function(cache) {
            return cache.delete('https://cr-logo-cache.local' + animeId);
        }).catch(function() {});
    }

    window.addEventListener('cr-reset-page-cache', function(e) {
        var resetId = e && e.detail && e.detail.animeId;
        if (!resetId) return;
        delete loadedLogoCache[resetId];
        delete failedLogoIds[resetId];
        clearSavedLogoRoute(resetId);
        forceFreshForId[resetId] = true;
        logoGen++;
        isLoading = false;
        if (activeAnimeId === resetId) activeAnimeId = null;

        var host = document.getElementById('cr-poster-host');
        if (host && host.shadowRoot) {
            var oldImg = host.shadowRoot.getElementById('cr-anime-logo');
            if (oldImg) oldImg.remove();
        }
        clearLogoCache(resetId);
    });
    function ensureLogoStyle(shadow) {
        if (shadow.getElementById('cr-logo-style')) return;
        var st = document.createElement('style');
        st.id = 'cr-logo-style';
        st.textContent =
            '.cr-top-logo { position: absolute; top: 3.2vw; left: 4.9%; z-index: 4; max-width: 440px; max-height: 195px; width: auto; height: auto; object-fit: contain; object-position: left top; pointer-events: none; user-select: none; filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.85)); }' +
            '.cr-top-logo.is-center { left: 50%; transform: translateX(-50%); object-position: center top; }' +
            '@media (max-width: 960px) { .cr-top-logo { top: 16px; max-width: 260px; max-height: 120px; } }';
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
            if (existing.src && existing.src.startsWith('blob:')) URL.revokeObjectURL(existing.src);
            existing.remove();
        }

        var img = document.createElement('img');
        img.id = 'cr-anime-logo';
        img.className = 'cr-top-logo' + (alignMode === 'center' ? ' is-center' : '');
        img.setAttribute('data-logo-id', animeId);
        img.alt = '';
        img.src = URL.createObjectURL(blob);
        bannerBox.appendChild(img);
    }

    function loadLogoWithCache(shadow, animeId) {
        var myGen = ++logoGen;
        var bypass = !!forceFreshForId[animeId];
        delete forceFreshForId[animeId];

        if (!bypass && loadedLogoCache[animeId]) {
            var mem = loadedLogoCache[animeId];
            renderLogo(shadow, animeId, mem.blob, mem.align);
            isLoading = false;
            return;
        }

        if (bypass) {
            startLogoNetworkLoad(shadow, animeId, true, myGen);
            return;
        }

        readLogoFromCache(animeId).then(function(cached) {
            if (myGen !== logoGen) return;
            if (cached && cached.blob && cached.blob.size > 100) {
                loadedLogoCache[animeId] = cached;
                renderLogo(shadow, animeId, cached.blob, cached.align);
                isLoading = false;
            } else {
                startLogoNetworkLoad(shadow, animeId, false, myGen);
            }
        });
    }

    function startLogoNetworkLoad(shadow, animeId, bypassCache, myGen) {
        var savedRoute = bypassCache ? null : getSavedLogoRoute(animeId);
        var exts = ['.png', '.webp', '.jpg'];
        var queue = [];

        if (savedRoute && savedRoute.url) {
            queue.push({ url: savedRoute.url, align: savedRoute.align || 'left', isSaved: true });
        }

        // Сначала быстрый CDN Statically
        exts.forEach(function(ext) {
            queue.push({ url: BASE_STATICALLY + 'Logo/' + animeId + ext, align: 'left' });
            queue.push({ url: BASE_STATICALLY + 'LogoCNT/' + animeId + ext, align: 'center' });
        });

        // Резервный проход через RawGH
        exts.forEach(function(ext) {
            queue.push({ url: BASE_RAWGH + 'Logo/' + animeId + ext, align: 'left' });
            queue.push({ url: BASE_RAWGH + 'LogoCNT/' + animeId + ext, align: 'center' });
        });

        function tryNext(idx) {
            if (myGen !== logoGen) return;
            if (idx >= queue.length || activeAnimeId !== animeId) {
                if (idx >= queue.length) failedLogoIds[animeId] = true;
                isLoading = false;
                return;
            }
            var item = queue.at(idx);
            var req = {
                method: 'GET',
                url: item.url,
                headers: { 'Accept': 'image/*' },
                responseType: 'blob',
                timeout: 15000,
                onload: function(res) {
                    if (myGen !== logoGen) return;
                    if (res.status === 200 && res.response && res.response.size > 100) {
                        var blob = res.response;
                        createImageBitmap(blob).then(function(bmp) {
                            if (bmp && typeof bmp.close === 'function') bmp.close();
                            if (myGen !== logoGen) return;
                            loadedLogoCache[animeId] = { blob: blob, align: item.align };
                            saveLogoToCache(animeId, blob, item.align);
                            saveLogoRoute(animeId, item.url, item.align);
                            if (activeAnimeId === animeId) renderLogo(shadow, animeId, blob, item.align);
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
                    if (myGen !== logoGen) return;
                    if (item.isSaved) clearSavedLogoRoute(animeId);
                    tryNext(idx + 1);
                },
                ontimeout: function() {
                    if (myGen !== logoGen) return;
                    tryNext(idx + 1);
                }
            };
            if (bypassCache) {
                req.nocache = true;
                req.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            }
            GM_xmlhttpRequest(req);
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
        if (!animeId || failedLogoIds[animeId]) return;

        var canvasEl = host.shadowRoot.querySelector('.bg-canvas');
        var isPosterLoaded = !!(canvasEl && canvasEl.getAttribute('data-loaded') === 'true');
        if (!isPosterLoaded) return;

        if (activeAnimeId !== animeId && !isLoading) {
            activeAnimeId = animeId;
            isLoading = true;
            loadLogoWithCache(host.shadowRoot, animeId);
        }
    }

    setInterval(syncLogo, 250);
})();

// ==UserScript==
// @name         Anime 365 Crunchyroll Franchise Core
// @namespace    http://tampermonkey.net
// @version      1.2
// @description  Ядро франшиз: поиск папок в GitHub, кэширование превью, загрузка episodes.js и защита описания в баннере при возврате Назад
// @match        *://*.smotret-anime.app/*
// @match        *://smotret-anime.app/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    var USER = 'Ruroll';
    var REPO = 'WB35RWQwFRFijt000IMG';
    var FOLDER_CACHE_KEY = 'cr_franchise_folder_map_v6';
    var EXT_CACHE_KEY = 'cr_franchise_ext_map_v6';
    var WATCHED_CACHE_KEY = 'cr_franchise_watched_v1';
    var THUMB_CACHE_NAME = 'cr-ep-thumbs-v2';

    var PROTO = 'https' + '://';
    var API_TREE_URL = PROTO + 'api.github' + '.com/repos/' + USER + '/' + REPO + '/git/trees/main?recursive=1';
    var GITHUB_ROOT_URL = PROTO + 'github' + '.com/' + USER + '/' + REPO + '/tree/main/Franchise';
    var BASE_STATICALLY = PROTO + 'cdn' + '.statically' + '.io/gh/' + USER + '/' + REPO + '/main/';
    var BASE_RAWGH = PROTO + 'raw' + '.githubusercontent' + '.com/' + USER + '/' + REPO + '/main/';

    var folderCache = null;
    var extCache = null;
    var watchedCache = null;
    var metaCache = {};
    var indexPromise = null;
    var memBlobCache = {};
    var lastRestoredHref = '';

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

    function loadSavedFolders() {
        if (folderCache) return folderCache;
        try {
            if (typeof GM_getValue === 'function') {
                var raw = GM_getValue(FOLDER_CACHE_KEY, '');
                if (raw) {
                    var parsed = JSON.parse(raw);
                    if (parsed && parsed.folders && Object.keys(parsed.folders).length > 0) {
                        folderCache = parsed.folders;
                        return folderCache;
                    }
                }
            }
        } catch (e) {}
        folderCache = {};
        return folderCache;
    }

    function saveAllFolders(newMap) {
        folderCache = Object.assign(loadSavedFolders(), newMap);
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(FOLDER_CACHE_KEY, JSON.stringify({ ts: Date.now(), folders: folderCache }));
            }
        } catch (e) {}
        return folderCache;
    }

    function getPreferredExt(animeId) {
        if (!extCache) {
            try { extCache = JSON.parse(GM_getValue(EXT_CACHE_KEY, '{}') || '{}'); } catch (e) { extCache = {}; }
        }
        return extCache[animeId] || '.png';
    }

    function savePreferredExt(animeId, ext) {
        if (!extCache) extCache = {};
        if (extCache[animeId] === ext) return;
        extCache[animeId] = ext;
        try {
            if (typeof GM_setValue === 'function') GM_setValue(EXT_CACHE_KEY, JSON.stringify(extCache));
        } catch (e) {}
    }

    function getWatchedMap() {
        if (!watchedCache) {
            try { watchedCache = JSON.parse(GM_getValue(WATCHED_CACHE_KEY, '{}') || '{}'); } catch (e) { watchedCache = {}; }
        }
        return watchedCache;
    }

    function isEpisodeWatched(animeId, code) {
        var map = getWatchedMap();
        return !!(map[animeId] && map[animeId][code]);
    }

    function toggleEpisodeWatched(animeId, code) {
        var map = getWatchedMap();
        if (!map[animeId]) map[animeId] = {};
        map[animeId][code] = !map[animeId][code];
        if (!map[animeId][code]) delete map[animeId][code];
        try {
            if (typeof GM_setValue === 'function') GM_setValue(WATCHED_CACHE_KEY, JSON.stringify(map));
        } catch (e) {}
        return !!map[animeId][code];
    }
    function getCachedThumbUrl(cacheKey) {
        if (memBlobCache[cacheKey]) return Promise.resolve(memBlobCache[cacheKey]);
        if (!('caches' in window)) return Promise.resolve(null);
        return caches.open(THUMB_CACHE_NAME).then(function(cache) {
            return cache.match(cacheKey).then(function(resp) {
                if (!resp) return null;
                return resp.blob().then(function(blob) {
                    if (!blob || blob.size < 100) return null;
                    var u = URL.createObjectURL(blob);
                    memBlobCache[cacheKey] = u;
                    return u;
                });
            });
        }).catch(function() { return null; });
    }

    function saveThumbToCache(cacheKey, blob) {
        var u = URL.createObjectURL(blob);
        memBlobCache[cacheKey] = u;
        if ('caches' in window) {
            caches.open(THUMB_CACHE_NAME).then(function(cache) {
                cache.put(cacheKey, new Response(blob, {
                    headers: { 'Content-Type': blob.type || 'image/png' }
                }));
            }).catch(function() {});
        }
        return u;
    }

    function fetchText(url, timeoutMs) {
        return new Promise(function(resolve) {
            try {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    timeout: timeoutMs || 25000,
                    onload: function(res) { resolve(res.status === 200 ? (res.responseText || '') : ''); },
                    onerror: function() { resolve(''); },
                    ontimeout: function() { resolve(''); }
                });
            } catch (e) {
                resolve('');
            }
        });
    }

    function extractTreeLinks(html) {
        var links = [];
        if (!html) return links;
        var doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('a[href*="/tree/main/Franchise/"]').forEach(function(a) {
            var href = a.getAttribute('href') || '';
            var idx = href.indexOf('/tree/main/');
            if (idx === -1) return;
            var rawSub = href.slice(idx + '/tree/main/'.length);
            var relEncoded = rawSub.split('?').at(0).split('#').at(0);
            try {
                var decoded = decodeURIComponent(relEncoded);
                if (links.indexOf(decoded) === -1) links.push(decoded);
            } catch (e) {}
        });
        return links;
    }

    function buildFullFranchiseIndex() {
        if (indexPromise) return indexPromise;

        indexPromise = fetchText(API_TREE_URL, 25000).then(function(apiText) {
            var foundMap = {};
            if (apiText) {
                try {
                    var data = JSON.parse(apiText);
                    if (data && Array.isArray(data.tree)) {
                        data.tree.forEach(function(node) {
                            if (node.type === 'tree' && node.path && node.path.indexOf('Franchise/') === 0) {
                                var parts = node.path.split('/');
                                if (parts.length === 3) {
                                    var m = parts.at(2).match(/^(\d+)(?:\s|\[|$)/);
                                    if (m) foundMap[m.at(1)] = node.path;
                                }
                            }
                        });
                    }
                } catch (e) {}
            }

            if (Object.keys(foundMap).length > 0) {
                return saveAllFolders(foundMap);
            }

            return fetchText(GITHUB_ROOT_URL, 25000).then(function(rootHtml) {
                var franchiseDirs = extractTreeLinks(rootHtml).filter(function(p) {
                    return p.split('/').length === 2;
                });
                if (!franchiseDirs.length) return {};

                return Promise.all(franchiseDirs.map(function(fDir) {
                    var encodedUrl = PROTO + 'github' + '.com/' + USER + '/' + REPO + '/tree/main/' +
                        fDir.split('/').map(encodeURIComponent).join('/');
                    return fetchText(encodedUrl, 25000).then(function(subHtml) {
                        var subPaths = extractTreeLinks(subHtml);
                        var localMap = {};
                        subPaths.forEach(function(sp) {
                            var folderName = sp.split('/').pop() || '';
                            var m = folderName.match(/^(\d+)(?:\s|\[|$)/);
                            if (m) localMap[m.at(1)] = sp;
                        });
                        return localMap;
                    });
                })).then(function(maps) {
                    var merged = {};
                    maps.forEach(function(m) { Object.assign(merged, m); });
                    if (Object.keys(merged).length > 0) {
                        return saveAllFolders(merged);
                    }
                    return {};
                });
            });
        }).then(function(res) {
            indexPromise = null;
            return res;
        }).catch(function() {
            indexPromise = null;
            return {};
        });

        return indexPromise;
    }

    function findTitleFolder(animeId) {
        var saved = loadSavedFolders();
        if (saved[animeId]) return Promise.resolve(saved[animeId]);
        return buildFullFranchiseIndex().then(function(map) {
            return (map && map[animeId]) || null;
        });
    }
    function parseEpisodesScriptText(rawText) {
        if (!rawText) return {};
        var trimmed = rawText.trim();
        try {
            if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') {
                return JSON.parse(trimmed);
            }
        } catch (e) {}

        var firstBrace = trimmed.indexOf('{');
        var lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            var objLiteral = trimmed.slice(firstBrace, lastBrace + 1);
            try {
                return (new Function('return (' + objLiteral + ');'))();
            } catch (e) {}
        }
        return {};
    }

    function loadEpisodesMetadata(animeId, folderPath) {
        if (metaCache[animeId]) return Promise.resolve(metaCache[animeId]);
        var encodedJs = folderPath.split('/').map(encodeURIComponent).join('/') + '/episodes.js';
        var encodedJson = folderPath.split('/').map(encodeURIComponent).join('/') + '/episodes.json';

        return fetchText(BASE_STATICALLY + encodedJs, 12000)
            .then(function(txt) { return txt || fetchText(BASE_RAWGH + encodedJs, 12000); })
            .then(function(txt) { return txt || fetchText(BASE_STATICALLY + encodedJson, 12000); })
            .then(function(txt) { return txt || fetchText(BASE_RAWGH + encodedJson, 12000); })
            .then(function(txt) {
                var parsed = parseEpisodesScriptText(txt);
                metaCache[animeId] = (parsed && typeof parsed === 'object') ? parsed : {};
                return metaCache[animeId];
            }).catch(function() {
                metaCache[animeId] = {};
                return {};
            });
    }

    function loadAndCacheThumb(imgEl, cardEl, animeId, folderPath, fileCode) {
        var cacheKey = 'https://cr-ep-thumb.local' + animeId + '/' + fileCode;
        getCachedThumbUrl(cacheKey).then(function(cachedUrl) {
            if (cachedUrl) {
                imgEl.src = cachedUrl;
                return;
            }

            var encodedBase = folderPath.split('/').map(encodeURIComponent).join('/') + '/episodes/' + encodeURIComponent(fileCode);
            var prefExt = getPreferredExt(animeId);
            var exts = ['.png', '.jpg', '.webp'];
            if (prefExt && exts.indexOf(prefExt) !== -1) {
                exts = [prefExt].concat(exts.filter(function(x) { return x !== prefExt; }));
            }

            var candidates = [];
            exts.forEach(function(ext) { candidates.push({ url: BASE_STATICALLY + encodedBase + ext, ext: ext }); });
            exts.forEach(function(ext) { candidates.push({ url: BASE_RAWGH + encodedBase + ext, ext: ext }); });

            var idx = 0;
            function tryNext() {
                if (idx >= candidates.length) {
                    cardEl.style.display = 'none';
                    return;
                }
                var item = candidates.at(idx++);
                try {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: item.url,
                        responseType: 'blob',
                        timeout: 15000,
                        onload: function(res) {
                            if (res.status === 200 && res.response && res.response.size > 100) {
                                savePreferredExt(animeId, item.ext);
                                imgEl.src = saveThumbToCache(cacheKey, res.response);
                            } else {
                                tryNext();
                            }
                        },
                        onerror: tryNext,
                        ontimeout: tryNext
                    });
                } catch (e) {
                    tryNext();
                }
            }
            tryNext();
        });
    }

    // Восстановление описания в баннере при возврате стрелкой «Назад» в браузере
    function ensureBannerDescriptionIntact() {
        var animeId = getAnimeId();
        if (!animeId) return;

        var host = document.getElementById('cr-poster-host');
        if (!host || !host.shadowRoot) return;

        var grid = host.shadowRoot.getElementById('cr-grid');
        var descText = grid ? (grid.textContent || '').trim() : '';

        if (grid && descText.length === 0) {
            var sourceBlock = document.querySelector('.m-catalog-item-description') ||
                              document.querySelector('.card-content p');
            if (sourceBlock && (sourceBlock.textContent || '').trim().length > 0) {
                host.remove();
            }
        }
    }

    window.addEventListener('pageshow', function() {
        setTimeout(ensureBannerDescriptionIntact, 80);
        setTimeout(ensureBannerDescriptionIntact, 350);
    });
    window.addEventListener('popstate', function() {
        setTimeout(ensureBannerDescriptionIntact, 80);
        setTimeout(ensureBannerDescriptionIntact, 350);
    });
    setInterval(function() {
        if (location.href !== lastRestoredHref) {
            lastRestoredHref = location.href;
            setTimeout(ensureBannerDescriptionIntact, 250);
        }
        ensureBannerDescriptionIntact();
    }, 450);

    window.addEventListener('cr-reset-page-cache', function(e) {
        var resetId = e && e.detail && e.detail.animeId;
        folderCache = {};
        extCache = {};
        metaCache = {};
        indexPromise = null;
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(FOLDER_CACHE_KEY, '');
                GM_setValue(EXT_CACHE_KEY, '');
            }
        } catch (err) {}

        if ('caches' in window && resetId) {
            caches.open(THUMB_CACHE_NAME).then(function(cache) {
                cache.keys().then(function(reqs) {
                    reqs.forEach(function(r) {
                        if (r.url.indexOf('/' + resetId + '/') !== -1) cache.delete(r);
                    });
                });
            }).catch(function() {});
        }

        Object.keys(memBlobCache).forEach(function(k) {
            if (!resetId || k.indexOf('/' + resetId + '/') !== -1) {
                URL.revokeObjectURL(memBlobCache[k]);
                delete memBlobCache[k];
            }
        });
    });

    var targetWin = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    targetWin.CRFranchiseCore = {
        getAnimeId: getAnimeId,
        findTitleFolder: findTitleFolder,
        loadEpisodesMetadata: loadEpisodesMetadata,
        loadAndCacheThumb: loadAndCacheThumb,
        isEpisodeWatched: isEpisodeWatched,
        toggleEpisodeWatched: toggleEpisodeWatched
    };
})();

// ==UserScript==
// @name         Anime 365 Crunchyroll Franchise UI
// @namespace    http://tampermonkey.net
// @version      1.4
// @description  Карточки серий 6 в ряд, выравнивание 24 МИН по базовой линии, контрастный шрифт без свечения и оранжевый Play на превью
// @match        *://*.smotret-anime.app/*
// @match        *://smotret-anime.app/*
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    var renderGen = 0;

    function ensureFranchiseStyles() {
        if (document.getElementById('cr-franchise-ep-style')) return;
        var st = document.createElement('style');
        st.id = 'cr-franchise-ep-style';
        st.textContent =
            '#cr-franchise-episodes-section, #cr-franchise-episodes-section * {' +
            '  text-shadow: none !important;' +
            '  -webkit-font-smoothing: antialiased !important;' +
            '  -moz-osx-font-smoothing: grayscale !important;' +
            '}' +
            '#cr-franchise-episodes-section {' +
            '  display: block !important; width: 100% !important; background: #000000 !important; color: #ffffff !important;' +
            '  padding: 28px 4.9% 64px 4.9% !important; margin: 0 0 24px 0 !important; box-sizing: border-box !important;' +
            '  font-family: Lato, Roboto, Arial, sans-serif !important; border-bottom: 1px solid rgba(255,255,255,0.12) !important; clear: both !important;' +
            '}' +
            '.cr-ep-section-header { display: block !important; font-size: 24px !important; font-weight: 700 !important; color: #ffffff !important; margin-bottom: 20px !important; }' +

            '.cr-ep-grid {' +
            '  display: grid !important;' +
            '  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;' +
            '  gap: 28px 16px !important;' +
            '  width: 100% !important;' +
            '}' +
            '@media (max-width: 1360px) { .cr-ep-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }' +
            '@media (max-width: 900px) { .cr-ep-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }' +

            '.cr-ep-card { position: relative !important; display: flex !important; flex-direction: column !important; background: #000000 !important; overflow: visible !important; }' +
            '.cr-ep-thumb-link { display: block !important; text-decoration: none !important; color: #ffffff !important; }' +
            '.cr-ep-thumb-wrap { position: relative !important; width: 100% !important; aspect-ratio: 16 / 10 !important; background: #141519 !important; overflow: hidden !important; }' +
            '.cr-ep-thumb {' +
            '  display: block !important; width: 100% !important; height: 100% !important;' +
            '  object-fit: cover !important; object-position: center center !important;' +
            '  transition: transform 0.25s ease, filter 0.25s ease !important;' +
            '}' +
            '.cr-ep-thumb-wrap:hover .cr-ep-thumb { transform: scale(1.04); filter: brightness(0.84); }' +

            /* Длительность: цифра и МИН лежат на одной базовой линии, контрастный шрифт без размытия */
            '.cr-ep-duration {' +
            '  position: absolute !important; bottom: 7px !important; right: 7px !important;' +
            '  height: 22px !important; padding: 0 7px !important;' +
            '  background: rgba(0, 0, 0, 0.72) !important; color: #ffffff !important;' +
            '  font-family: Lato, Roboto, Arial, sans-serif !important;' +
            '  font-weight: 700 !important; letter-spacing: 0.3px !important;' +
            '  display: inline-flex !important; align-items: center !important; justify-content: center !important;' +
            '  z-index: 6 !important; opacity: 1; transition: opacity 0.2s ease !important; pointer-events: none !important;' +
            '}' +
            '.cr-ep-dur-inner {' +
            '  display: inline-flex !important; align-items: baseline !important; gap: 3px !important; line-height: 1 !important;' +
            '}' +
            '.cr-ep-dur-num { font-size: 13px !important; font-weight: 700 !important; line-height: 1 !important; color: #ffffff !important; }' +
            '.cr-ep-dur-unit { font-size: 10px !important; font-weight: 700 !important; line-height: 1 !important; color: #ffffff !important; text-transform: uppercase !important; }' +
            '.cr-ep-thumb-wrap:hover .cr-ep-duration { opacity: 0 !important; }' +

            '.cr-ep-watched-badge { position: absolute !important; bottom: 7px !important; left: 7px !important; background: rgba(0,0,0,0.82) !important; color: #f47521 !important; font-size: 10px !important; font-weight: 700 !important; padding: 2px 6px !important; z-index: 6 !important; display: none; text-transform: uppercase !important; }' +
            '.cr-ep-card.is-watched .cr-ep-watched-badge { display: inline-block !important; }' +
            '.cr-ep-card.is-watched .cr-ep-thumb { opacity: 0.65; }' +

            /* Оранжевый треугольник Play: появляется ТОЛЬКО при наведении на картинку серии */
            '.cr-ep-play-badge {' +
            '  position: absolute !important; top: 10px !important; left: 10px !important;' +
            '  display: flex !important; align-items: center !important; justify-content: center !important;' +
            '  opacity: 0; transition: opacity 0.2s ease !important; pointer-events: none !important; z-index: 8 !important;' +
            '}' +
            '.cr-ep-thumb-wrap:hover .cr-ep-play-badge { opacity: 1 !important; }' +
            '.cr-ep-play-triangle {' +
            '  display: block !important; width: 0 !important; height: 0 !important;' +
            '  border-style: solid !important;' +
            '  border-width: 10px 0 10px 18px !important;' +
            '  border-color: transparent transparent transparent #f47521 !important;' +
            '  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.85)) !important;' +
            '}' +

            /* Нижний блок карточки: контрастный текст без свечения */
            '.cr-ep-bottom-bar {' +
            '  position: relative !important; display: flex !important; align-items: flex-start !important; justify-content: space-between !important;' +
            '  gap: 6px !important; padding: 10px 2px 4px 2px !important; min-height: 76px !important;' +
            '  opacity: 1; visibility: visible; transition: opacity 0.22s ease !important;' +
            '}' +
            '.cr-ep-card.is-thumb-hovered .cr-ep-bottom-bar,' +
            '.cr-ep-card.is-neighbor-covered .cr-ep-bottom-bar,' +
            '.cr-ep-card:has(.cr-ep-thumb-wrap:hover) .cr-ep-bottom-bar {' +
            '  opacity: 0 !important; visibility: hidden !important; pointer-events: none !important;' +
            '}' +
            '.cr-ep-base-meta { display: flex !important; flex-direction: column !important; gap: 4px !important; flex: 1 1 auto !important; min-width: 0 !important; }' +
            '.cr-ep-num { display: block !important; font-size: 13px !important; font-weight: 700 !important; line-height: 1.25 !important; color: #a0a0a0 !important; text-transform: uppercase !important; }' +
            '.cr-ep-base-title-link { text-decoration: none !important; color: inherit !important; display: block !important; }' +
            '.cr-ep-base-title {' +
            '  display: -webkit-box !important; -webkit-line-clamp: 2 !important; -webkit-box-orient: vertical !important; overflow: hidden !important;' +
            '  font-size: 13px !important; font-weight: 700 !important; line-height: 1.3 !important; color: #ffffff !important;' +
            '  text-transform: uppercase !important; transition: color 0.15s ease !important;' +
            '}' +
            '.cr-ep-card:hover .cr-ep-base-title, .cr-ep-base-title-link:hover .cr-ep-base-title { color: #f47521 !important; }' +

            /* Три точки и квадратное меню */
            '.cr-ep-menu-anchor { position: relative !important; align-self: flex-end !important; flex-shrink: 0 !important; z-index: 25 !important; }' +
            '.cr-ep-dots-btn, .cr-ep-dots-btn:focus, .cr-ep-dots-btn:active {' +
            '  width: 32px !important; height: 32px !important; background: transparent !important; background-color: transparent !important;' +
            '  border: none !important; outline: none !important; box-shadow: none !important; border-radius: 0 !important;' +
            '  color: rgba(255, 255, 255, 0.72) !important; font-size: 22px !important; line-height: 1 !important; cursor: pointer !important;' +
            '  display: flex !important; align-items: center !important; justify-content: center !important;' +
            '  opacity: 0; transition: opacity 0.15s ease, color 0.15s ease !important;' +
            '}' +
            '.cr-ep-card:hover .cr-ep-dots-btn, .cr-ep-dots-btn.is-active { opacity: 1 !important; }' +
            '.cr-ep-dots-btn:hover, .cr-ep-dots-btn.is-active, .cr-ep-dots-btn.is-active:hover {' +
            '  background: transparent !important; background-color: transparent !important; color: #ffffff !important;' +
            '}' +

            '.cr-ep-popup-menu {' +
            '  position: absolute !important; right: 0 !important; top: 100% !important; margin-top: 0 !important;' +
            '  background: #1c1e24 !important; border: none !important; outline: none !important; box-shadow: 0 8px 24px rgba(0,0,0,0.95) !important;' +
            '  border-radius: 0 !important; padding: 0 !important; min-width: 220px !important; display: none; z-index: 60 !important;' +
            '}' +
            '.cr-ep-popup-menu.is-open { display: block !important; }' +
            '.cr-ep-popup-item, .cr-ep-popup-item:focus, .cr-ep-popup-item:active {' +
            '  width: 100% !important; background: transparent !important; background-color: transparent !important;' +
            '  border: none !important; outline: none !important; box-shadow: none !important; border-radius: 0 !important;' +
'  color: rgba(255, 255, 255, 0.78) !important; text-align: left !important; padding: 11px 14px !important;' +
'  font-size: 13px !important; font-weight: 500 !important; cursor: pointer !important; font-family: inherit !important; display: block !important;' +
'  transition: color 0.12s ease !important;' +
'}' +
'.cr-ep-popup-item:hover {' +
'  background: transparent !important; background-color: transparent !important; color: #ffffff !important;' +
'}' +
/* Инфо-панель поверх соседней карточки: уменьшен шрифт даты выхода (12px), контрастный шрифт */
'.cr-ep-neighbor-panel {' +
'  position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;' +
'  background: #000000 !important; color: #ffffff !important;' +
'  padding: 0 12px 0 12px !important; display: flex !important; flex-direction: column !important; align-items: flex-start !important;' +
'  justify-content: flex-start !important; z-index: 99 !important; pointer-events: none !important;' +
'  opacity: 0; visibility: hidden; transition: opacity 0.25s ease !important; box-sizing: border-box !important; overflow: hidden !important;' +
'}' +
'.cr-ep-neighbor-panel.is-visible { opacity: 1 !important; visibility: visible !important; }' +
'.cr-ep-np-num { display: block !important; width: 100% !important; font-size: 14px !important; font-weight: 700 !important; color: #a0a0a0 !important; text-transform: uppercase !important; line-height: 1.25 !important; margin: 0 0 8px 0 !important; padding: 0 !important; }' +
'.cr-ep-np-title { display: block !important; width: 100% !important; font-size: 14px !important; font-weight: 700 !important; color: #f47521 !important; text-transform: uppercase !important; line-height: 1.3 !important; margin: 0 0 8px 0 !important; padding: 0 !important; }' +
'.cr-ep-np-date { display: block !important; width: 100% !important; font-size: 12px !important; font-weight: 600 !important; color: #a0a0a0 !important; line-height: 1.2 !important; margin: 0 0 10px 0 !important; padding: 0 !important; }' +
'.cr-ep-np-desc { display: -webkit-box !important; -webkit-line-clamp: 8 !important; -webkit-box-orient: vertical !important; overflow: hidden !important; width: 100% !important; font-size: 13px !important; font-weight: 400 !important; line-height: 1.42 !important; color: #ffffff !important; margin: 0 !important; padding: 0 !important; white-space: normal !important; }';
document.head.appendChild(st);
}
    function renderDurationBadge(durEl, rawDur) {
        if (!rawDur) {
            durEl.style.display = 'none';
            return;
        }
        var str = String(rawDur).trim();
        var m = str.match(/^(\d+(?:[:.]\d+)?)\s*(.*)$/);
        durEl.innerHTML = '';
        var inner = document.createElement('span');
        inner.className = 'cr-ep-dur-inner';

        if (m) {
            var numSpan = document.createElement('span');
            numSpan.className = 'cr-ep-dur-num';
            numSpan.textContent = m.at(1);
            inner.appendChild(numSpan);

            var unitText = (m.at(2) || 'МИН').replace(/\.$/, '').toUpperCase();
            if (unitText) {
                var unitSpan = document.createElement('span');
                unitSpan.className = 'cr-ep-dur-unit';
                unitSpan.textContent = unitText;
                inner.appendChild(unitSpan);
            }
        } else {
            inner.textContent = str.toUpperCase();
        }
        durEl.appendChild(inner);
        durEl.style.display = 'inline-flex';
    }

    function detectEpisodeInfo(labelText, href) {
        var clean = labelText.replace(/play_circle_filled/gi, '').trim();
        if (/трейлер|trailer/i.test(clean) || /treyler/i.test(href || '')) {
            return null;
        }
        var numMatch = clean.match(/^(\d+)\s*серия/i) || (href || '').match(/\/(\d+)-seriya-/i);
        if (numMatch) {
            var num = numMatch.at(1);
            return {
                num: num,
                code: 'E' + num,
                seriesLabel: (num + ' СЕРИЯ'),
                rawLabel: clean
            };
        }
        return null;
    }

    function getMetaForEpisode(epMeta, parsed) {
        if (!epMeta) return {};
        return epMeta[parsed.code] ||
               epMeta[parsed.num] ||
               epMeta['e' + parsed.num] ||
               epMeta[parsed.num + ' серия'] ||
               epMeta[parsed.seriesLabel] ||
               {};
    }

    function insertSectionBelowBanner(sectionEl) {
        var bannerHost = document.getElementById('cr-poster-host');
        if (bannerHost) {
            bannerHost.insertAdjacentElement('afterend', sectionEl);
            return;
        }
        var nav = document.querySelector('body > nav') || document.querySelector('nav');
        if (nav) nav.insertAdjacentElement('afterend', sectionEl);
        else document.body.prepend(sectionEl);
    }

    function hideAllNeighborPanels(grid) {
        if (!grid) return;
        grid.querySelectorAll('.cr-ep-neighbor-panel.is-visible').forEach(function(p) {
            p.classList.remove('is-visible');
        });
        grid.querySelectorAll('.cr-ep-card.is-neighbor-covered').forEach(function(c) {
            c.classList.remove('is-neighbor-covered');
        });
    }

    function showNeighborInfo(grid, sourceCard, data) {
        hideAllNeighborPanels(grid);
        var visibleCards = Array.from(grid.querySelectorAll('.cr-ep-card')).filter(function(c) {
            return c.style.display !== 'none';
        });
        var pos = visibleCards.indexOf(sourceCard);
        if (pos === -1 || visibleCards.length < 2) return;

        var targetCard = visibleCards.at(pos + 1);
        if (!targetCard || targetCard.offsetTop !== sourceCard.offsetTop) {
            targetCard = visibleCards.at(pos - 1);
        }
        if (!targetCard) return;

        var panel = targetCard.querySelector('.cr-ep-neighbor-panel');
        if (!panel) return;

        panel.innerHTML = '';

        var pNum = document.createElement('div');
        pNum.className = 'cr-ep-np-num';
        pNum.textContent = data.seriesLabel;
        panel.appendChild(pNum);

        var pTitle = document.createElement('div');
        pTitle.className = 'cr-ep-np-title';
        pTitle.textContent = data.title;
        panel.appendChild(pTitle);

        if (data.date) {
            var pDate = document.createElement('div');
            pDate.className = 'cr-ep-np-date';
            pDate.textContent = data.date;
            panel.appendChild(pDate);
        }

        if (data.desc) {
            var pDesc = document.createElement('div');
            pDesc.className = 'cr-ep-np-desc';
            pDesc.textContent = data.desc;
            panel.appendChild(pDesc);
        }

        targetCard.classList.add('is-neighbor-covered');
        panel.classList.add('is-visible');
    }
        function renderFranchiseEpisodes(core, animeId, folderPath) {
        var origEpCard = document.querySelector('.card-content.m-episode-list');
        if (!origEpCard) return;

        var links = Array.from(origEpCard.querySelectorAll('a.m-episode-item')).filter(function(a) {
            var h = a.getAttribute('href') || '';
            return h.indexOf('-' + animeId + '/') !== -1 || h.indexOf('/' + animeId + '/') !== -1;
        });
        if (!links.length) return;

        ensureFranchiseStyles();

        var existingSection = document.getElementById('cr-franchise-episodes-section');
        if (existingSection) existingSection.remove();

        var section = document.createElement('div');
        section.id = 'cr-franchise-episodes-section';
        section.setAttribute('data-anime-id', animeId);

        var header = document.createElement('div');
        header.className = 'cr-ep-section-header';
        header.textContent = 'Серии';
        section.appendChild(header);

        var grid = document.createElement('div');
        grid.className = 'cr-ep-grid';

        var cardRecords = [];

        links.forEach(function(a) {
            var href = a.getAttribute('href') || '#';
            var parsed = detectEpisodeInfo(a.textContent, href);
            if (!parsed) return;

            var cardData = {
                seriesLabel: parsed.seriesLabel,
                title: parsed.rawLabel,
                duration: '',
                date: '',
                desc: ''
            };

            var card = document.createElement('div');
            card.className = 'cr-ep-card' + (core.isEpisodeWatched(animeId, parsed.code) ? ' is-watched' : '');

            var thumbLink = document.createElement('a');
            thumbLink.className = 'cr-ep-thumb-link';
            thumbLink.href = href;

            var thumbWrap = document.createElement('div');
            thumbWrap.className = 'cr-ep-thumb-wrap';

            var img = document.createElement('img');
            img.className = 'cr-ep-thumb';
            img.alt = cardData.title;
            thumbWrap.appendChild(img);

            var watchedBadge = document.createElement('div');
            watchedBadge.className = 'cr-ep-watched-badge';
            watchedBadge.textContent = 'Просмотрено';
            thumbWrap.appendChild(watchedBadge);

            var durEl = document.createElement('div');
            durEl.className = 'cr-ep-duration';
            durEl.style.display = 'none';
            thumbWrap.appendChild(durEl);

            var playBadge = document.createElement('div');
            playBadge.className = 'cr-ep-play-badge';
            var playTri = document.createElement('div');
            playTri.className = 'cr-ep-play-triangle';
            playBadge.appendChild(playTri);
            thumbWrap.appendChild(playBadge);

            thumbLink.appendChild(thumbWrap);

            var bottomBar = document.createElement('div');
            bottomBar.className = 'cr-ep-bottom-bar';

            var baseMeta = document.createElement('div');
            baseMeta.className = 'cr-ep-base-meta';

            var numEl = document.createElement('div');
            numEl.className = 'cr-ep-num';
            numEl.textContent = cardData.seriesLabel;

            var titleLink = document.createElement('a');
            titleLink.className = 'cr-ep-base-title-link';
            titleLink.href = href;

            var titleEl = document.createElement('div');
            titleEl.className = 'cr-ep-base-title';
            titleEl.textContent = cardData.title;

            titleLink.appendChild(titleEl);
            baseMeta.appendChild(numEl);
            baseMeta.appendChild(titleLink);

            var menuAnchor = document.createElement('div');
            menuAnchor.className = 'cr-ep-menu-anchor';

            var dotsBtn = document.createElement('button');
            dotsBtn.type = 'button';
            dotsBtn.className = 'cr-ep-dots-btn';
            dotsBtn.innerHTML = '&#8942;';

            var popupMenu = document.createElement('div');
            popupMenu.className = 'cr-ep-popup-menu';

            var watchToggleItem = document.createElement('button');
            watchToggleItem.type = 'button';
            watchToggleItem.className = 'cr-ep-popup-item';
            watchToggleItem.textContent = core.isEpisodeWatched(animeId, parsed.code)
                ? 'Убрать из просмотренного'
                : 'Добавить в просмотренное';

            var menuHideTimer = null;
            function closeMenu() {
                popupMenu.classList.remove('is-open');
                dotsBtn.classList.remove('is-active');
            }
            function scheduleMenuClose() {
                if (menuHideTimer) clearTimeout(menuHideTimer);
                menuHideTimer = setTimeout(closeMenu, 260);
            }
            function cancelMenuClose() {
                if (menuHideTimer) clearTimeout(menuHideTimer);
            }

            dotsBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                cancelMenuClose();
                var willOpen = !popupMenu.classList.contains('is-open');
                document.querySelectorAll('.cr-ep-popup-menu.is-open').forEach(function(m) {
                    m.classList.remove('is-open');
                });
                document.querySelectorAll('.cr-ep-dots-btn.is-active').forEach(function(b) {
                    b.classList.remove('is-active');
                });
                if (willOpen) {
                    popupMenu.classList.add('is-open');
                    dotsBtn.classList.add('is-active');
                }
            });

            menuAnchor.addEventListener('mouseenter', cancelMenuClose);
            menuAnchor.addEventListener('mouseleave', scheduleMenuClose);
            popupMenu.addEventListener('mouseenter', cancelMenuClose);
            popupMenu.addEventListener('mouseleave', scheduleMenuClose);
            card.addEventListener('mouseleave', scheduleMenuClose);

            watchToggleItem.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var nowWatched = core.toggleEpisodeWatched(animeId, parsed.code);
                card.classList.toggle('is-watched', nowWatched);
                watchToggleItem.textContent = nowWatched
                    ? 'Убрать из просмотренного'
                    : 'Добавить в просмотренное';
                closeMenu();
            });

            popupMenu.appendChild(watchToggleItem);
            menuAnchor.appendChild(dotsBtn);
            menuAnchor.appendChild(popupMenu);

            bottomBar.appendChild(baseMeta);
            bottomBar.appendChild(menuAnchor);

            var neighborPanel = document.createElement('div');
            neighborPanel.className = 'cr-ep-neighbor-panel';

            card.appendChild(thumbLink);
            card.appendChild(bottomBar);
            card.appendChild(neighborPanel);

            thumbWrap.addEventListener('mouseenter', function() {
                card.classList.add('is-thumb-hovered');
                showNeighborInfo(grid, card, cardData);
            });
            thumbWrap.addEventListener('mouseleave', function() {
                card.classList.remove('is-thumb-hovered');
                hideAllNeighborPanels(grid);
            });

            grid.appendChild(card);
            core.loadAndCacheThumb(img, card, animeId, folderPath, parsed.code);

            cardRecords.push({
                parsed: parsed,
                cardData: cardData,
                titleEl: titleEl,
                durEl: durEl,
                imgEl: img
            });
        });

        if (!cardRecords.length) return;

        section.appendChild(grid);
        insertSectionBelowBanner(section);

        var parentCard = origEpCard.closest('.card');
        if (parentCard) parentCard.style.display = 'none';
        else origEpCard.style.display = 'none';

        core.loadEpisodesMetadata(animeId, folderPath).then(function(epMeta) {
            if (core.getAnimeId() !== animeId || !epMeta) return;
            cardRecords.forEach(function(rec) {
                var info = getMetaForEpisode(epMeta, rec.parsed);
                if (!info) return;
                if (info.title || info.name) {
                    rec.cardData.title = info.title || info.name;
                    rec.titleEl.textContent = rec.cardData.title;
                    rec.imgEl.alt = rec.cardData.title;
                }
                if (info.duration || info.time) {
                    rec.cardData.duration = info.duration || info.time;
                    renderDurationBadge(rec.durEl, rec.cardData.duration);
                }
                if (info.date || info.releaseDate || info.aired) {
                    rec.cardData.date = info.date || info.releaseDate || info.aired;
                }
                if (info.desc || info.description) {
                    rec.cardData.desc = info.desc || info.description;
                }
            });
        });
    }

    function syncFranchiseUI() {
        var targetWin = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        var core = targetWin.CRFranchiseCore;
        if (!core) return;

        var animeId = core.getAnimeId();
        var existingSection = document.getElementById('cr-franchise-episodes-section');

        if (!animeId) {
            if (existingSection) existingSection.remove();
            return;
        }

        if (existingSection && existingSection.getAttribute('data-anime-id') !== animeId) {
            existingSection.remove();
            existingSection = null;
        }

        if (existingSection && existingSection.getAttribute('data-anime-id') === animeId) {
            var bannerHost = document.getElementById('cr-poster-host');
if (bannerHost && bannerHost.nextElementSibling !== existingSection) {
bannerHost.insertAdjacentElement('afterend', existingSection);
}
return;
}
var origEpCard = document.querySelector('.card-content.m-episode-list');
if (!origEpCard) return;
var hasMatchingLinks = Array.from(origEpCard.querySelectorAll('a.m-episode-item')).some(function(a) {
var h = a.getAttribute('href') || '';
return h.indexOf('-' + animeId + '/') !== -1 || h.indexOf('/' + animeId + '/') !== -1;
});
if (!hasMatchingLinks) return;
var myGen = ++renderGen;
core.findTitleFolder(animeId).then(function(folderPath) {
if (myGen !== renderGen || core.getAnimeId() !== animeId) return;
if (!folderPath) return;
renderFranchiseEpisodes(core, animeId, folderPath);
});
}
window.addEventListener('cr-reset-page-cache', function() {
renderGen++;
var oldBlock = document.getElementById('cr-franchise-episodes-section');
if (oldBlock) oldBlock.remove();
});
window.addEventListener('popstate', syncFranchiseUI);
setInterval(syncFranchiseUI, 400);
})();

// ==UserScript==
// @name         Anime 365 Crunchyroll Franchise Trailer
// @namespace    http://tampermonkey.net
// @version      1.0
// @description  Отдельный модуль вкладок «Трейлер» и «Серии» для тайтлов франшиз с автоизвлечением iframe-плеера
// @match        *://*.smotret-anime.app/*
// @match        *://smotret-anime.app/*
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    var embedUrlCache = {};
    var pendingRequests = {};

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

    function findTrailerLinkOnPage(animeId) {
        var origEpCard = document.querySelector('.card-content.m-episode-list');
        if (!origEpCard) return null;

        var links = Array.from(origEpCard.querySelectorAll('a.m-episode-item'));
        for (var i = 0; i < links.length; i++) {
            var a = links.at(i);
            var href = a.getAttribute('href') || '';
            var text = (a.textContent || '').replace(/play_circle_filled/gi, '').trim();
            var belongsToTitle = href.indexOf('-' + animeId + '/') !== -1 || href.indexOf('/' + animeId + '/') !== -1;
            if (!belongsToTitle) continue;

            if (/treyler/i.test(href) || /трейлер|trailer/i.test(text)) {
                return new URL(href, window.location.origin).href;
            }
        }
        return null;
    }

    function parseEmbedSrcFromHtml(html) {
        if (!html) return null;
        var doc = new DOMParser().parseFromString(html, 'text/html');

        // 1. Ищем блок после ссылки <a class="m-embed-code-link">HTML-код для вставки на сайт</a>
        var embedLink = doc.querySelector('a.m-embed-code-link');
        if (embedLink && embedLink.nextElementSibling) {
            var nextEl = embedLink.nextElementSibling;
            var rawCode = nextEl.value || nextEl.textContent || nextEl.innerHTML || '';
            var srcMatch = rawCode.match(/src\s*=\s*["']([^"']*\/translations\/embed\/\d+[^"']*)["']/i);
            if (srcMatch) return srcMatch.at(1);
        }

        // 2. Ищем напрямую <iframe src=".../translations/embed/...">
        var directIframe = doc.querySelector('iframe[src*="/translations/embed/"]');
        if (directIframe) {
            return directIframe.getAttribute('src');
        }

        // 3. Резервный поиск ID озвучки по регулярному выражению в исходном коде страницы
        var fallbackMatch = html.match(/https?:\/\/[^"'\s<>]+\/translations\/embed\/\d+/i) ||
                            html.match(/\/translations\/embed\/\d+/i);
        if (fallbackMatch) {
            var found = fallbackMatch.at(0);
            return found.charAt(0) === '/' ? (window.location.origin + found) : found;
        }

        return null;
    }
    function fetchTrailerEmbedUrl(animeId, trailerPageUrl) {
        var storageKey = 'cr_trailer_embed_' + animeId;
        if (embedUrlCache[animeId]) {
            return Promise.resolve(embedUrlCache[animeId]);
        }

        try {
            var saved = sessionStorage.getItem(storageKey);
            if (saved) {
                embedUrlCache[animeId] = saved;
                return Promise.resolve(saved);
            }
        } catch (e) {}

        if (pendingRequests[animeId]) {
            return pendingRequests[animeId];
        }

        pendingRequests[animeId] = fetch(trailerPageUrl, {
            method: 'GET',
            credentials: 'same-origin'
        }).then(function(res) {
            if (!res.ok) return '';
            return res.text();
        }).then(function(html) {
            var embedSrc = parseEmbedSrcFromHtml(html);
            if (embedSrc) return embedSrc;

            // Если страница серии трейлера содержит ссылку на конкретную озвучку (/ozvuchka-XXXX), переходим по ней
            if (html) {
                var doc = new DOMParser().parseFromString(html, 'text/html');
                var voiceLink = doc.querySelector('a[href*="/ozvuchka-"]');
                if (voiceLink) {
                    var voiceUrl = new URL(voiceLink.getAttribute('href'), window.location.origin).href;
                    return fetch(voiceUrl, {
                        method: 'GET',
                        credentials: 'same-origin'
                    }).then(function(r2) {
                        return r2.ok ? r2.text() : '';
                    }).then(function(html2) {
                        return parseEmbedSrcFromHtml(html2);
                    });
                }
            }
            return null;
        }).then(function(finalSrc) {
            delete pendingRequests[animeId];
            if (finalSrc) {
                embedUrlCache[animeId] = finalSrc;
                try { sessionStorage.setItem(storageKey, finalSrc); } catch (e) {}
            }
            return finalSrc || null;
        }).catch(function() {
            delete pendingRequests[animeId];
            return null;
        });

        return pendingRequests[animeId];
    }

    function ensureTrailerTabStyles() {
        if (document.getElementById('cr-franchise-trailer-style')) return;
        var st = document.createElement('style');
        st.id = 'cr-franchise-trailer-style';
        st.textContent =
            '.cr-ep-tabs-bar {' +
            '  display: flex !important; align-items: center !important; gap: 28px !important;' +
            '  border-bottom: 2px solid rgba(255, 255, 255, 0.14) !important;' +
            '  margin-bottom: 22px !important; padding: 0 !important;' +
            '}' +
            '.cr-ep-tab-btn, .cr-ep-tab-btn:focus, .cr-ep-tab-btn:active {' +
            '  position: relative !important; background: transparent !important; background-color: transparent !important;' +
            '  border: none !important; outline: none !important; box-shadow: none !important; border-radius: 0 !important;' +
            '  padding: 0 2px 12px 2px !important; margin: 0 0 -2px 0 !important;' +
            '  font-family: Lato, Roboto, Arial, sans-serif !important; font-size: 16px !important; font-weight: 700 !important;' +
            '  letter-spacing: 0.6px !important; text-transform: uppercase !important;' +
            '  color: #a0a0a0 !important; cursor: pointer !important;' +
            '  border-bottom: 3px solid transparent !important;' +
            '  transition: color 0.16s ease, border-color 0.16s ease !important;' +
            '}' +
            '.cr-ep-tab-btn:hover {' +
            '  background: transparent !important; background-color: transparent !important;' +
            '  color: #ffffff !important;' +
            '}' +
            '.cr-ep-tab-btn.is-active, .cr-ep-tab-btn.is-active:hover {' +
            '  background: transparent !important; background-color: transparent !important;' +
            '  color: #ffffff !important;' +
            '  border-bottom: 3px solid #f47521 !important;' +
            '}' +
            '.cr-ep-trailer-pane {' +
            '  display: block !important; width: 100% !important; background: #000000 !important;' +
            '}' +
            '.cr-ep-trailer-frame-wrap {' +
            '  position: relative !important; width: 100% !important; max-width: 960px !important;' +
            '  aspect-ratio: 16 / 9 !important; background: #0d0e12 !important; overflow: hidden !important;' +
            '}' +
            '.cr-ep-trailer-iframe {' +
            '  position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important;' +
            '  border: none !important; display: block !important; background: #000000 !important;' +
            '}' +
            '.cr-ep-trailer-status {' +
            '  padding: 28px 16px !important; font-size: 14px !important; color: #a0a0a0 !important;' +
            '}';
        document.head.appendChild(st);
    }
    function mountTrailerTabsIntoSection(sectionEl, animeId, trailerPageUrl) {
        if (!sectionEl || sectionEl.getAttribute('data-cr-trailer-mounted') === 'true') return;

        var headerEl = sectionEl.querySelector('.cr-ep-section-header');
        var gridEl = sectionEl.querySelector('.cr-ep-grid');
        if (!headerEl || !gridEl) return;

        ensureTrailerTabStyles();
        sectionEl.setAttribute('data-cr-trailer-mounted', 'true');

        // Создаём панель вкладок как в браузере: первая активная — «Трейлер», вторая — «Серии»
        var tabsBar = document.createElement('div');
        tabsBar.className = 'cr-ep-tabs-bar';

        var tabTrailer = document.createElement('button');
        tabTrailer.type = 'button';
        tabTrailer.className = 'cr-ep-tab-btn is-active';
        tabTrailer.textContent = 'Трейлер';

        var tabEpisodes = document.createElement('button');
        tabEpisodes.type = 'button';
        tabEpisodes.className = 'cr-ep-tab-btn';
        tabEpisodes.textContent = 'Серии';

        tabsBar.appendChild(tabTrailer);
        tabsBar.appendChild(tabEpisodes);

        // Контейнер для окна трейлера
        var trailerPane = document.createElement('div');
        trailerPane.className = 'cr-ep-trailer-pane';

        var frameWrap = document.createElement('div');
        frameWrap.className = 'cr-ep-trailer-frame-wrap';

        var statusBox = document.createElement('div');
        statusBox.className = 'cr-ep-trailer-status';
        statusBox.textContent = 'Загрузка плеера трейлера...';
        frameWrap.appendChild(statusBox);
        trailerPane.appendChild(frameWrap);

        // Заменяем обычный заголовок «Серии» на панель вкладок и вставляем вкладку трейлера первой
        headerEl.replaceWith(tabsBar);
        gridEl.insertAdjacentElement('beforebegin', trailerPane);

        // По умолчанию активна вкладка «Трейлер», поэтому сетка серий скрыта до переключения
        gridEl.style.setProperty('display', 'none', 'important');

        var loadedIframeSrc = null;

        function activateTab(tabName) {
            if (tabName === 'trailer') {
                tabTrailer.classList.add('is-active');
                tabEpisodes.classList.remove('is-active');
                trailerPane.style.setProperty('display', 'block', 'important');
                gridEl.style.setProperty('display', 'none', 'important');

                var existingIframe = frameWrap.querySelector('iframe');
                if (!existingIframe && loadedIframeSrc) {
                    var ifr = document.createElement('iframe');
                    ifr.className = 'cr-ep-trailer-iframe';
                    ifr.src = loadedIframeSrc;
                    ifr.setAttribute('allowfullscreen', '');
                    ifr.setAttribute('frameborder', '0');
                    frameWrap.innerHTML = '';
                    frameWrap.appendChild(ifr);
                }
            } else {
                tabEpisodes.classList.add('is-active');
                tabTrailer.classList.remove('is-active');
                trailerPane.style.setProperty('display', 'none', 'important');
                gridEl.style.removeProperty('display');

                // Выгружаем iframe при уходе на вкладку «Серии», чтобы не шёл фоновый звук
                var activeIframe = frameWrap.querySelector('iframe');
                if (activeIframe) {
                    activeIframe.remove();
                }
            }
        }

        tabTrailer.addEventListener('click', function(e) {
            e.preventDefault();
            activateTab('trailer');
        });

        tabEpisodes.addEventListener('click', function(e) {
            e.preventDefault();
            activateTab('episodes');
        });

        // Загружаем HTML-код вставки трейлера со страницы озвучки трейлера
        fetchTrailerEmbedUrl(animeId, trailerPageUrl).then(function(embedSrc) {
            if (getAnimeId() !== animeId) return;
            if (!embedSrc) {
                statusBox.textContent = 'Не удалось получить код плеера трейлера.';
                return;
            }
            loadedIframeSrc = embedSrc;
            if (tabTrailer.classList.contains('is-active')) {
                var ifr = document.createElement('iframe');
                ifr.className = 'cr-ep-trailer-iframe';
                ifr.src = embedSrc;
                ifr.setAttribute('allowfullscreen', '');
                ifr.setAttribute('frameborder', '0');
                frameWrap.innerHTML = '';
                frameWrap.appendChild(ifr);
            }
        });
    }

    function syncFranchiseTrailer() {
        var animeId = getAnimeId();
        if (!animeId) return;

        var sectionEl = document.getElementById('cr-franchise-episodes-section');
        if (!sectionEl || sectionEl.getAttribute('data-anime-id') !== animeId) return;
        if (sectionEl.getAttribute('data-cr-trailer-mounted') === 'true') return;

        var trailerUrl = findTrailerLinkOnPage(animeId);
        if (!trailerUrl) return;

        mountTrailerTabsIntoSection(sectionEl, animeId, trailerUrl);
    }

    window.addEventListener('cr-reset-page-cache', function(e) {
        var resetId = e && e.detail && e.detail.animeId;
        if (resetId) {
            delete embedUrlCache[resetId];
            try { sessionStorage.removeItem('cr_trailer_embed_' + resetId); } catch (err) {}
        }
    });

    window.addEventListener('popstate', syncFranchiseTrailer);
    setInterval(syncFranchiseTrailer, 400);
})();

// ==UserScript==
// @name         Anime 365 Crunchyroll Franchise Cleaner
// @namespace    http://tampermonkey.net
// @version      1.3
// @description  Скрывает все дублирующиеся блоки (жанры, Начать просмотр, Добавить перевод, В вашем списке, Telegram, порядок просмотра), оставляя #comments и .footer-copyright
// @match        *://*.smotret-anime.app/*
// @match        *://smotret-anime.app/*
// ==/UserScript==

(function() {
    'use strict';

    var HIDE_ATTR = 'data-cr-cleaner-hidden';
    var STYLE_ID = 'cr-franchise-cleaner-style';

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

    function ensureCleanerStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var st = document.createElement('style');
        st.id = STYLE_ID;
        st.textContent =
            '[' + HIDE_ATTR + '="1"] {' +
            '  display: none !important;' +
            '  visibility: hidden !important;' +
            '  height: 0 !important;' +
            '  min-height: 0 !important;' +
            '  margin: 0 !important;' +
            '  padding: 0 !important;' +
            '  border: none !important;' +
            '  overflow: hidden !important;' +
            '}' +
            'footer.page-footer.m-footer-genres {' +
            '  padding-top: 0 !important;' +
            '  background: transparent !important;' +
            '}';
        document.head.appendChild(st);
    }

    function isPageEligible(animeId) {
        if (!animeId) return false;

        var posterHost = document.getElementById('cr-poster-host');
        if (!posterHost || posterHost.getAttribute('data-anime-id') !== animeId) return false;
        if (posterHost.shadowRoot) {
            var canvas = posterHost.shadowRoot.querySelector('.bg-canvas');
            if (canvas && canvas.getAttribute('data-loaded') !== 'true') return false;
        }

        var franchiseSection = document.getElementById('cr-franchise-episodes-section');
        if (!franchiseSection || franchiseSection.getAttribute('data-anime-id') !== animeId) return false;

        return true;
    }

    function markHidden(el) {
        if (!el || el.nodeType !== 1) return;
        if (el.id === 'cr-poster-host' ||
            el.id === 'cr-franchise-episodes-section' ||
            el.id === 'comments' ||
            el.id === 'cr-share-modal-overlay' ||
            el.id === 'cr-hero-list-popover') return;
        if (el.classList.contains('footer-copyright')) return;
        if (el.closest('#cr-poster-host') ||
            el.closest('#cr-franchise-episodes-section') ||
            el.closest('#comments') ||
            el.closest('.footer-copyright') ||
            el.closest('#cr-share-modal-overlay') ||
            el.closest('#cr-hero-list-popover')) return;

        if (el.getAttribute(HIDE_ATTR) !== '1') {
            el.setAttribute(HIDE_ATTR, '1');
        }
    }

    function restoreAllHidden() {
        document.querySelectorAll('[' + HIDE_ATTR + '="1"]').forEach(function(el) {
            el.removeAttribute(HIDE_ATTR);
        });
    }
        function hideElementWithEmptyParentCard(el) {
        if (!el) return;
        markHidden(el);

        var cardContent = el.closest('.card-content');
        if (cardContent) {
            var visibleChildren = Array.from(cardContent.children).filter(function(ch) {
                return ch.getAttribute(HIDE_ATTR) !== '1' && ch.tagName !== 'SCRIPT' && ch.tagName !== 'STYLE';
            });
            if (visibleChildren.length === 0) {
                markHidden(cardContent);
            }
        }

        var card = el.closest('.card');
        if (card) {
            var visibleCardBlocks = Array.from(card.children).filter(function(ch) {
                return ch.getAttribute(HIDE_ATTR) !== '1' && ch.tagName !== 'SCRIPT' && ch.tagName !== 'STYLE';
            });
            if (visibleCardBlocks.length === 0) {
                markHidden(card);
            }
        }
    }

    function cleanCatalogBlocks() {
        ensureCleanerStyles();

        // 1. В футере жанров скрываем только список жанров (.container), оставляя .footer-copyright
        document.querySelectorAll('footer.page-footer.m-footer-genres > .container, .m-footer-genres > .container').forEach(function(footerGenresContainer) {
            if (!footerGenresContainer.classList.contains('footer-copyright')) {
                markHidden(footerGenresContainer);
            }
        });

        // 2. Блок жанров тайтла (.m-genres-list) вместе с родительским блоком
        document.querySelectorAll('.m-genres-list').forEach(function(genresList) {
            var parentBlock = genresList.closest('.card') || genresList.closest('.card-content') || genresList.parentElement;
            if (parentBlock && parentBlock.tagName !== 'BODY' && parentBlock.tagName !== 'MAIN' && !parentBlock.querySelector('#comments')) {
                hideElementWithEmptyParentCard(parentBlock);
            } else {
                hideElementWithEmptyParentCard(genresList);
            }
        });

        // 3. Большая кнопка «Начать просмотр» (.m-black-box-button) вместе со всем блоком
        document.querySelectorAll('.m-black-box-button').forEach(function(blackBtn) {
            var btnBlock = blackBtn.closest('.card') || blackBtn.closest('.card-content') || blackBtn.parentElement;
            if (btnBlock && btnBlock.tagName !== 'BODY' && btnBlock.tagName !== 'MAIN') {
                hideElementWithEmptyParentCard(btnBlock);
            } else {
                hideElementWithEmptyParentCard(blackBtn);
            }
        });

        // 4. Кнопка «Добавить перевод» (перенесена на флажок в постере)
        document.querySelectorAll('a[href*="/translations/create"]').forEach(function(addTransLink) {
            var transBlock = addTransLink.closest('.card') || addTransLink.closest('.card-content') || addTransLink.parentElement;
            if (transBlock && transBlock.tagName !== 'BODY' && transBlock.tagName !== 'MAIN') {
                hideElementWithEmptyParentCard(transBlock);
            } else {
                hideElementWithEmptyParentCard(addTransLink);
            }
        });

        // 5. Кнопка «Добавить в список» (button[name="yt1"]) и встроенная панель «В вашем списке:»
        document.querySelectorAll('button[name="yt1"]').forEach(function(addListBtn) {
            var listBlock = addListBtn.closest('form') || addListBtn.closest('.card') || addListBtn.closest('.card-content') || addListBtn.parentElement;
            if (listBlock && listBlock.tagName !== 'BODY' && listBlock.tagName !== 'MAIN') {
                hideElementWithEmptyParentCard(listBlock);
            } else {
                hideElementWithEmptyParentCard(addListBtn);
            }
        });

        var statusSelect = document.getElementById('UsersRates_status');
        if (statusSelect && !statusSelect.closest('#cr-hero-list-popover')) {
            var listFormBlock = statusSelect.closest('.card') || statusSelect.closest('.card-content') || statusSelect.parentElement.parentElement.parentElement;
            if (listFormBlock && listFormBlock.tagName !== 'BODY' && listFormBlock.tagName !== 'MAIN') {
                hideElementWithEmptyParentCard(listFormBlock);
            }
        }

        // 6. Блок «Наш Telegram» и кнопки поделиться (.m-translation-view__share, .ya-share2)
        document.querySelectorAll('.m-translation-view__share, .ya-share2').forEach(function(shareEl) {
            var shareBlock = shareEl.closest('.card') || shareEl.closest('.card-content') || shareEl;
            if (shareBlock && shareBlock.tagName !== 'BODY' && shareBlock.tagName !== 'MAIN') {
                hideElementWithEmptyParentCard(shareBlock);
            } else {
                hideElementWithEmptyParentCard(shareEl);
            }
        });

        // 7. Блок «Порядок просмотра:» (перенесён во вкладку «Хронология»)
        document.querySelectorAll('.card-content h3').forEach(function(h3) {
            if (h3.closest('#cr-franchise-episodes-section')) return;
            if (/порядок\s+просмотра/i.test(h3.textContent || '')) {
                var cardContent = h3.closest('.card-content');
                if (cardContent) {
                    hideElementWithEmptyParentCard(cardContent);
                } else {
                    hideElementWithEmptyParentCard(h3);
                }
            }
        });

        // 8. <h1 class="h3">Смотреть аниме ... онлайн</h1> вместе с блоком
        document.querySelectorAll('h1.h3').forEach(function(h1) {
            if (/смотреть\s+аниме/i.test(h1.textContent || '')) {
                var wrapper = h1.closest('.card') || h1.closest('.card-content') || h1.parentElement;
                if (wrapper && wrapper.tagName !== 'BODY' && wrapper.tagName !== 'MAIN') {
                    markHidden(wrapper);
                } else {
                    markHidden(h1);
                }
            }
        });

        // 9. Родные заголовки названия аниме (h2.line-1, h2.line-2)
        document.querySelectorAll('.card .card-content h2.line-1, .card .card-content h2.line-2').forEach(function(h2) {
            hideElementWithEmptyParentCard(h2);
        });

        // 10. Описание и альтернативное описание
        document.querySelectorAll('.m-catalog-item-description, .m-description, [class*="description"]').forEach(function(descEl) {
            if (descEl.closest('#comments')) return;
            var container = descEl.closest('.m-catalog-item-description') || descEl;
            hideElementWithEmptyParentCard(container);
        });

        // 11. Альтернативное описание / Другие названия / Студия / Поделиться аниме
        document.querySelectorAll('.card-content p, .card-content div, .card-content ul, .card-content dl, .card-content tr, .card-content li').forEach(function(node) {
            if (node.closest('#cr-poster-host') ||
                node.closest('#cr-franchise-episodes-section') ||
                node.closest('#comments') ||
                node.closest('#cr-hero-list-popover')) return;
            var txt = (node.textContent || '').trim();
            if (!txt) return;

            if (/^альтернативное\s+описание/i.test(txt)) {
                hideElementWithEmptyParentCard(node);
                if (node.nextElementSibling && node.nextElementSibling.tagName === 'P') {
                    hideElementWithEmptyParentCard(node.nextElementSibling);
                }
            }

            if (/^другие\s+названия/i.test(txt) && txt.length < 600) {
                hideElementWithEmptyParentCard(node);
                if (node.nextElementSibling && (node.nextElementSibling.tagName === 'UL' || node.nextElementSibling.tagName === 'P' || node.nextElementSibling.tagName === 'DIV')) {
                    hideElementWithEmptyParentCard(node.nextElementSibling);
                }
            }

            if (/^студия\s*:/i.test(txt) && txt.length < 250) {
                hideElementWithEmptyParentCard(node);
            }

            if (/^поделиться\s+аниме/i.test(txt) && txt.length < 120) {
                hideElementWithEmptyParentCard(node);
            }
        });

        document.querySelectorAll('.card-content a[href*="/studios/"]').forEach(function(stLink) {
            var row = stLink.closest('tr') || stLink.closest('p') || stLink.closest('li') || stLink.closest('div');
            if (row && !row.classList.contains('card-content')) {
                hideElementWithEmptyParentCard(row);
            } else {
                hideElementWithEmptyParentCard(stLink);
            }
        });
    }
    function syncFranchiseCleaner() {
        var animeId = getAnimeId();
        if (!isPageEligible(animeId)) {
            restoreAllHidden();
            return;
        }
        cleanCatalogBlocks();
    }

    window.addEventListener('popstate', function() {
        restoreAllHidden();
        setTimeout(syncFranchiseCleaner, 500);
    });

    window.addEventListener('cr-reset-page-cache', function() {
        restoreAllHidden();
    });

    setInterval(syncFranchiseCleaner, 450);
})();


// ==UserScript==
// @name         Anime 365 Crunchyroll Franchise Chronology
// @namespace    http://tampermonkey.net
// @version      1.0
// @description  Переносит «Порядок просмотра» во вкладку «Хронология» сразу за вкладкой «Серии»
// @match        *://*.smotret-anime.app/*
// @match        *://smotret-anime.app/*
// ==/UserScript==

(function() {
    'use strict';

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

    function findWatchOrderBlock() {
        var headers = Array.from(document.querySelectorAll('.card-content h3'));
        for (var i = 0; i < headers.length; i++) {
            var h3 = headers.at(i);
            if (h3.closest('#cr-franchise-episodes-section')) continue;
            if (/порядок\s+просмотра/i.test(h3.textContent || '')) {
                return h3.closest('.card-content') || h3.parentElement;
            }
        }
        return null;
    }

    function ensureChronologyStyles() {
        if (document.getElementById('cr-franchise-chronology-style')) return;
        var st = document.createElement('style');
        st.id = 'cr-franchise-chronology-style';
        st.textContent =
            '.cr-ep-tabs-bar {' +
            '  display: flex !important; align-items: center !important; gap: 28px !important;' +
            '  border-bottom: 2px solid rgba(255, 255, 255, 0.14) !important;' +
            '  margin-bottom: 22px !important; padding: 0 !important;' +
            '}' +
            '.cr-ep-tab-btn, .cr-ep-tab-btn:focus, .cr-ep-tab-btn:active {' +
            '  position: relative !important; background: transparent !important; background-color: transparent !important;' +
            '  border: none !important; outline: none !important; box-shadow: none !important; border-radius: 0 !important;' +
            '  padding: 0 2px 12px 2px !important; margin: 0 0 -2px 0 !important;' +
            '  font-family: Lato, Roboto, Arial, sans-serif !important; font-size: 16px !important; font-weight: 700 !important;' +
            '  letter-spacing: 0.6px !important; text-transform: uppercase !important;' +
            '  color: #a0a0a0 !important; cursor: pointer !important;' +
            '  border-bottom: 3px solid transparent !important;' +
            '  transition: color 0.16s ease, border-color 0.16s ease !important;' +
            '}' +
            '.cr-ep-tab-btn:hover {' +
            '  background: transparent !important; background-color: transparent !important;' +
            '  color: #ffffff !important;' +
            '}' +
            '.cr-ep-tab-btn.is-active, .cr-ep-tab-btn.is-active:hover {' +
            '  background: transparent !important; background-color: transparent !important;' +
            '  color: #ffffff !important;' +
            '  border-bottom: 3px solid #f47521 !important;' +
            '}' +
            '.cr-ep-chronology-pane {' +
            '  display: none; width: 100% !important; color: #e2e2e2 !important;' +
            '  font-family: Lato, Roboto, Arial, sans-serif !important;' +
            '}' +
            '.cr-ep-chronology-pane h3 {' +
            '  font-size: 18px !important; font-weight: 700 !important; color: #ffffff !important;' +
            '  margin: 0 0 14px 0 !important; padding: 0 !important;' +
            '}' +
            '.cr-ep-chronology-pane ul {' +
            '  list-style-type: disc !important; padding-left: 22px !important; margin: 6px 0 !important;' +
            '}' +
            '.cr-ep-chronology-pane li.m-connections-list__item {' +
            '  font-size: 15px !important; line-height: 1.7 !important; color: #d0d0d0 !important; margin: 4px 0 !important;' +
            '}' +
            '.cr-ep-chronology-pane li.m-connections-list__item_current > a {' +
            '  color: #f47521 !important; font-weight: 700 !important;' +
            '}' +
            '.cr-ep-chronology-pane a {' +
            '  color: #ffffff !important; text-decoration: none !important; transition: color 0.15s ease !important;' +
            '}' +
            '.cr-ep-chronology-pane a:hover {' +
            '  color: #f47521 !important; text-decoration: underline !important;' +
            '}' +
            '.cr-ep-chronology-pane .m-connections-list__type, .cr-ep-chronology-pane .m-connections-list__year {' +
            '  color: #9e9e9e !important;' +
            '}';
        document.head.appendChild(st);
    }
    function ensureTabsBarExists(sectionEl) {
        var existingBar = sectionEl.querySelector('.cr-ep-tabs-bar');
        var gridEl = sectionEl.querySelector('.cr-ep-grid');
        if (!gridEl) return null;

        if (existingBar) {
            return existingBar;
        }

        var headerEl = sectionEl.querySelector('.cr-ep-section-header');
        var tabsBar = document.createElement('div');
        tabsBar.className = 'cr-ep-tabs-bar';

        var tabEpisodes = document.createElement('button');
        tabEpisodes.type = 'button';
        tabEpisodes.className = 'cr-ep-tab-btn is-active';
        tabEpisodes.textContent = 'Серии';

        tabsBar.appendChild(tabEpisodes);

        if (headerEl) {
            headerEl.replaceWith(tabsBar);
        } else {
            gridEl.insertAdjacentElement('beforebegin', tabsBar);
        }

        return tabsBar;
    }

    function mountChronologyTab(sectionEl, watchOrderSource) {
        if (!sectionEl || !watchOrderSource) return;
        if (sectionEl.getAttribute('data-cr-chronology-mounted') === 'true') return;

        var gridEl = sectionEl.querySelector('.cr-ep-grid');
        if (!gridEl) return;

        ensureChronologyStyles();
        var tabsBar = ensureTabsBarExists(sectionEl);
        if (!tabsBar) return;

        sectionEl.setAttribute('data-cr-chronology-mounted', 'true');

        // Создаём панель Хронологии с точной копией исходной разметки «Порядок просмотра»
        var chronologyPane = document.createElement('div');
        chronologyPane.className = 'cr-ep-chronology-pane';

        var clonedContent = watchOrderSource.cloneNode(true);
        clonedContent.removeAttribute('data-cr-cleaner-hidden');
        clonedContent.querySelectorAll('[data-cr-cleaner-hidden]').forEach(function(el) {
            el.removeAttribute('data-cr-cleaner-hidden');
        });
        chronologyPane.innerHTML = clonedContent.innerHTML;

        // Вставляем панель Хронологии после сетки серий
        gridEl.insertAdjacentElement('afterend', chronologyPane);

        // Создаём кнопку вкладки «Хронология» строго за вкладкой «Серии»
        var tabChronology = document.createElement('button');
        tabChronology.type = 'button';
        tabChronology.className = 'cr-ep-tab-btn';
        tabChronology.setAttribute('data-cr-tab', 'chronology');
        tabChronology.textContent = 'Хронология';

        var allTabs = Array.from(tabsBar.querySelectorAll('.cr-ep-tab-btn'));
        var episodesTab = allTabs.find(function(b) {
            return /серии/i.test(b.textContent || '');
        }) || allTabs.at(-1);

        if (episodesTab) {
            episodesTab.insertAdjacentElement('afterend', tabChronology);
        } else {
            tabsBar.appendChild(tabChronology);
        }

        // Единый обработчик переключения между всеми вкладками панели (Трейлер / Серии / Хронология)
        tabsBar.addEventListener('click', function(e) {
            var clickedBtn = e.target.closest('.cr-ep-tab-btn');
            if (!clickedBtn) return;

            var trailerPane = sectionEl.querySelector('.cr-ep-trailer-pane');

            if (clickedBtn === tabChronology) {
                e.preventDefault();
                e.stopImmediatePropagation();

                tabsBar.querySelectorAll('.cr-ep-tab-btn').forEach(function(b) {
                    b.classList.remove('is-active');
                });
                tabChronology.classList.add('is-active');

                gridEl.style.setProperty('display', 'none', 'important');
                if (trailerPane) {
                    trailerPane.style.setProperty('display', 'none', 'important');
                    var activeIframe = trailerPane.querySelector('iframe');
                    if (activeIframe) activeIframe.remove();
                }
                chronologyPane.style.setProperty('display', 'block', 'important');
            } else {
                // При клике на «Трейлер» или «Серии» скрываем вкладку «Хронология»
                tabChronology.classList.remove('is-active');
                chronologyPane.style.setProperty('display', 'none', 'important');

                // Если это была единственная вкладка «Серии» (без модуля трейлера), показываем сетку серий
                if (!trailerPane) {
                    clickedBtn.classList.add('is-active');
                    gridEl.style.removeProperty('display');
                }
            }
        }, true);
    }
    function syncFranchiseChronology() {
        var animeId = getAnimeId();
        if (!animeId) return;

        var sectionEl = document.getElementById('cr-franchise-episodes-section');
        if (!sectionEl || sectionEl.getAttribute('data-anime-id') !== animeId) return;
        if (sectionEl.getAttribute('data-cr-chronology-mounted') === 'true') return;

        var watchOrderBlock = findWatchOrderBlock();
        if (!watchOrderBlock) return;

        mountChronologyTab(sectionEl, watchOrderBlock);
    }

    window.addEventListener('popstate', syncFranchiseChronology);
    setInterval(syncFranchiseChronology, 400);
})();
// ==UserScript==
// @name         Anime 365 Crunchyroll Franchise Links
// @namespace    http://tampermonkey.net
// @version      1.2
// @description  Кнопки Crunchyroll с серыми тултипами, оранжевым флажком, встроенной панелью списка и окном соцсетей из ya-share2
// @match        *://*.smotret-anime.app/*
// @match        *://smotret-anime.app/*
// ==/UserScript==

(function() {
    'use strict';

    var STYLE_ID = 'cr-franchise-links-modal-style';
    var MODAL_ID = 'cr-share-modal-overlay';
    var LIST_POPOVER_ID = 'cr-hero-list-popover';
    var isListPanelOpen = false;
    var parkedListPanel = null;
    var parkedListPlaceholder = null;

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

    function ensureGlobalStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var st = document.createElement('style');
        st.id = STYLE_ID;
        st.textContent =
            /* Большое модальное окно «Поделиться сериалом» с заголовком по центру */
            '#' + MODAL_ID + ' {' +
            '  position: fixed !important; inset: 0 !important; z-index: 2147483646 !important;' +
            '  background: rgba(0, 0, 0, 0.85) !important; display: none; align-items: center !important; justify-content: center !important;' +
            '  font-family: Lato, Roboto, Arial, sans-serif !important; padding: 20px !important; box-sizing: border-box !important;' +
            '}' +
            '#' + MODAL_ID + '.is-open { display: flex !important; }' +
            '.cr-share-dialog {' +
            '  position: relative !important; width: 100% !important; max-width: 660px !important;' +
            '  background: #23252b !important; color: #ffffff !important; padding: 34px 36px 30px 36px !important;' +
            '  box-shadow: 0 22px 56px rgba(0, 0, 0, 0.96) !important; border-radius: 0 !important; box-sizing: border-box !important;' +
            '}' +
            '.cr-share-close, .cr-share-close:focus, .cr-share-close:active {' +
            '  position: absolute !important; top: 16px !important; right: 18px !important;' +
            '  background: transparent !important; border: none !important; outline: none !important; box-shadow: none !important;' +
            '  color: #a0a0a0 !important; font-size: 26px !important; line-height: 1 !important; cursor: pointer !important; padding: 4px !important;' +
            '}' +
            '.cr-share-close:hover { color: #ffffff !important; background: transparent !important; }' +
            '.cr-share-title {' +
            '  font-size: 24px !important; font-weight: 700 !important; color: #ffffff !important;' +
            '  margin: 0 0 28px 0 !important; padding: 0 !important; text-align: center !important; width: 100% !important;' +
            '}' +
            '.cr-share-options {' +
            '  display: flex !important; flex-wrap: wrap !important; align-items: flex-start !important; justify-content: center !important;' +
            '  gap: 24px 28px !important; margin-bottom: 26px !important;' +
            '}' +
            '.cr-share-option, .cr-share-option:focus, .cr-share-option:active {' +
            '  display: flex !important; flex-direction: column !important; align-items: center !important; gap: 10px !important;' +
            '  background: transparent !important; border: none !important; outline: none !important; box-shadow: none !important;' +
            '  text-decoration: none !important; color: #ffffff !important; cursor: pointer !important; padding: 0 !important; min-width: 76px !important;' +
            '}' +
            '.cr-share-option:hover .cr-share-opt-label { color: #f47521 !important; }' +
            '.cr-share-circle {' +
            '  width: 64px !important; height: 64px !important; border-radius: 50% !important;' +
            '  display: flex !important; align-items: center !important; justify-content: center !important;' +
            '  color: #ffffff !important; transition: transform 0.16s ease !important; box-shadow: 0 4px 12px rgba(0,0,0,0.45) !important;' +
            '}' +
            '.cr-share-option:hover .cr-share-circle { transform: scale(1.07); }' +
            '.cr-share-circle svg { width: 30px !important; height: 30px !important; fill: #ffffff !important; display: block !important; }' +
            '.cr-share-opt-label { font-size: 14px !important; font-weight: 700 !important; color: #ffffff !important; text-align: center !important; transition: color 0.15s ease !important; }' +

            '.cr-share-tg-box {' +
            '  border-top: 1px solid rgba(255, 255, 255, 0.14) !important;' +
            '  padding-top: 18px !important; margin-top: 4px !important; text-align: center !important;' +
            '  font-size: 14px !important; line-height: 1.6 !important; color: #dcdcdc !important;' +
            '}' +
            '.cr-share-tg-box .m-small-title {' +
            '  font-size: 15px !important; font-weight: 700 !important; color: #ffffff !important; margin-bottom: 6px !important;' +
            '}' +
            '.cr-share-tg-box a {' +
            '  color: #f47521 !important; font-weight: 700 !important; text-decoration: none !important;' +
            '}' +
            '.cr-share-tg-box a:hover { text-decoration: underline !important; }' +

            /* Серая панель «В вашем списке:» со всем встроенным функционалом */
            '#' + LIST_POPOVER_ID + ' {' +
            '  position: fixed !important; z-index: 2147483640 !important;' +
            '  width: 340px !important; max-width: calc(100vw - 24px) !important;' +
            '  background: #2b2e36 !important; color: #ffffff !important;' +
            '  border: 1px solid #454954 !important; border-radius: 0 !important;' +
            '  padding: 18px 20px 14px 20px !important; box-shadow: 0 14px 36px rgba(0, 0, 0, 0.92) !important;' +
            '  font-family: Lato, Roboto, Arial, sans-serif !important; display: none; box-sizing: border-box !important;' +
            '}' +
            '#' + LIST_POPOVER_ID + '.is-open { display: block !important; }' +
            '#' + LIST_POPOVER_ID + ' .m-small-title {' +
            '  font-size: 16px !important; font-weight: 700 !important; color: #ffffff !important; margin-bottom: 12px !important;' +
            '}' +
            '#' + LIST_POPOVER_ID + ' .input-field { margin-top: 12px !important; margin-bottom: 12px !important; }' +
            '#' + LIST_POPOVER_ID + ' label { color: #b8bcc6 !important; font-size: 12px !important; }' +
            '#' + LIST_POPOVER_ID + ' input.select-dropdown, #' + LIST_POPOVER_ID + ' input[type="number"], #' + LIST_POPOVER_ID + ' textarea {' +
            '  color: #ffffff !important; border-bottom-color: #6c7280 !important; background: transparent !important;' +
            '}' +
            '#' + LIST_POPOVER_ID + ' .caret { color: #ffffff !important; }' +
            '#' + LIST_POPOVER_ID + ' ul.dropdown-content {' +
            '  background: #23252b !important; border: 1px solid #454954 !important;' +
            '}' +
            '#' + LIST_POPOVER_ID + ' ul.dropdown-content li > span { color: #ffffff !important; font-size: 14px !important; }' +
            '#' + LIST_POPOVER_ID + ' ul.dropdown-content li:hover, #' + LIST_POPOVER_ID + ' ul.dropdown-content li.selected {' +
            '  background: #3a3e49 !important;' +
            '}';
        document.head.appendChild(st);
    }
    function findNativeListPanel() {
        var statusSelect = document.getElementById('UsersRates_status');
        if (statusSelect) {
            var block = statusSelect.closest('.card-content > div') || statusSelect.closest('form > div') || statusSelect.parentElement.parentElement.parentElement;
            if (block) return block;
        }
        var titles = Array.from(document.querySelectorAll('.m-small-title'));
        for (var i = 0; i < titles.length; i++) {
            if (/в\s+вашем\s+списке/i.test(titles.at(i).textContent || '')) {
                return titles.at(i).parentElement;
            }
        }
        return null;
    }

    function returnParkedListPanel() {
        if (parkedListPanel && parkedListPlaceholder && parkedListPlaceholder.parentNode) {
            parkedListPlaceholder.parentNode.insertBefore(parkedListPanel, parkedListPlaceholder);
            parkedListPlaceholder.remove();
            parkedListPlaceholder = null;
            parkedListPanel = null;
        }
        var pop = document.getElementById(LIST_POPOVER_ID);
        if (pop) pop.classList.remove('is-open');
        isListPanelOpen = false;
    }

    function toggleListPanel(anchorBtn) {
        ensureGlobalStyles();
        var pop = document.getElementById(LIST_POPOVER_ID);

        if (isListPanelOpen) {
            returnParkedListPanel();
            return;
        }

        var nativePanel = parkedListPanel || findNativeListPanel();
        if (!nativePanel) {
            // Если аниме ещё не в списке — нажимаем родную кнопку «Добавить в список» (button[name="yt1"])
            var addBtn = document.querySelector('button[name="yt1"]');
            if (addBtn) addBtn.click();
            return;
        }

        if (!pop) {
            pop = document.createElement('div');
            pop.id = LIST_POPOVER_ID;
            document.body.appendChild(pop);
        }

        if (!parkedListPanel) {
            parkedListPanel = nativePanel;
            parkedListPlaceholder = document.createComment('cr-list-placeholder');
            nativePanel.parentNode.insertBefore(parkedListPlaceholder, nativePanel);
        }

        // Снимаем атрибуты скрытия клинера на время отображения внутри панели
        nativePanel.removeAttribute('data-cr-cleaner-hidden');
        nativePanel.querySelectorAll('[data-cr-cleaner-hidden]').forEach(function(el) {
            el.removeAttribute('data-cr-cleaner-hidden');
        });

        pop.innerHTML = '';
        pop.appendChild(nativePanel);

        if (anchorBtn) {
            var rect = anchorBtn.getBoundingClientRect();
            var leftPos = Math.max(12, Math.min(window.innerWidth - 352, rect.left - 140));
            var topPos = Math.min(window.innerHeight - 360, rect.bottom + 12);
            pop.style.left = Math.round(leftPos) + 'px';
            pop.style.top = Math.round(topPos) + 'px';
        }

        pop.classList.add('is-open');
        isListPanelOpen = true;
    }

    function getServiceVisual(serviceClass, title) {
        var s = (serviceClass + ' ' + title).toLowerCase();
        if (s.indexOf('vkontakte') !== -1 || s.indexOf('вконтакте') !== -1) {
            return {
                bg: '#0077FF',
                label: 'ВКонтакте',
                svg: '<svg viewBox="0 0 24 24"><path d="M13.16 18.92c-5.47 0-8.59-3.75-8.72-9.99h2.74c.09 4.58 2.11 6.52 3.71 6.92V8.93h2.58v3.95c1.58-.17 3.24-1.97 3.8-3.95h2.58c-.43 2.44-2.23 4.24-3.51 4.98 1.28.6 3.33 2.17 4.11 5.01h-2.84c-.61-1.9-2.13-3.37-4.14-3.57v3.57h-.31z"/></svg>'
            };
        }
        if (s.indexOf('odnoklassniki') !== -1 || s.indexOf('одноклассники') !== -1) {
            return {
                bg: '#EE8208',
                label: 'Одноклассники',
                svg: '<svg viewBox="0 0 24 24"><path d="M12 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5zm0-5.3a1.55 1.55 0 1 1 0 3.1 1.55 1.55 0 0 1 0-3.1zm4.6 6.4c-.4-.7-1.4-.9-2.1-.4-.8.5-1.6.7-2.5.7s-1.7-.2-2.5-.7c-.7-.5-1.7-.3-2.1.4-.4.7-.2 1.6.5 2.1.9.6 2 1 3.1 1.1l-2.6 2.6c-.6.6-.6 1.5 0 2.1.3.3.7.4 1.1.4.4 0 .8-.1 1.1-.4l2.4-2.4 2.4 2.4c.6.6 1.5.6 2.1 0 .6-.6.6-1.5 0-2.1l-2.6-2.6c1.1-.1 2.2-.5 3.1-1.1.7-.5.9-1.4.5-2.1z"/></svg>'
            };
        }
        if (s.indexOf('twitter') !== -1 || s.indexOf('x') !== -1) {
            return {
                bg: '#000000',
                label: 'X',
                svg: '<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>'
            };
        }
        if (s.indexOf('facebook') !== -1) {
            return {
                bg: '#3C5A9A',
                label: 'Facebook',
                svg: '<svg viewBox="0 0 24 24"><path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.557-.14-2.857-.14C11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4v-8.5z"/></svg>'
            };
        }
        if (s.indexOf('telegram') !== -1) {
            return {
                bg: '#26A5E4',
                label: 'Telegram',
                svg: '<svg viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>'
            };
        }
        if (s.indexOf('skype') !== -1) {
            return {
                bg: '#00AFF0',
                label: 'Skype',
                svg: '<svg viewBox="0 0 24 24"><path d="M12.069 18.874c-4.023 0-5.82-1.979-5.82-3.464 0-.765.561-1.296 1.333-1.296 1.723 0 1.273 2.477 4.487 2.477 1.641 0 2.55-.895 2.55-1.811 0-.551-.269-1.16-1.354-1.429l-3.576-.895c-2.88-.724-3.403-2.286-3.403-3.751 0-3.047 2.861-4.191 5.549-4.191 2.471 0 5.393 1.373 5.393 3.199 0 .784-.688 1.24-1.453 1.24-1.469 0-1.198-2.037-4.164-2.037-1.469 0-2.292.664-2.292 1.617s1.153 1.258 2.157 1.487l2.637.587c2.891.649 3.624 2.346 3.624 3.944 0 2.476-1.902 4.324-5.722 4.324m11.084-4.882l-.029.135-.044-.24c.015.045.044.074.059.12.12-.675.181-1.363.181-2.052 0-1.529-.301-3.012-.898-4.42-.569-1.348-1.395-2.562-2.427-3.596-1.049-1.033-2.247-1.856-3.595-2.426-1.318-.631-2.801-.93-4.328-.93-.72 0-1.444.07-2.143.204l.119.06-.239-.033.119-.025C8.91.274 7.829 0 6.731 0c-1.789 0-3.47.698-4.736 1.967C.729 3.235.032 4.923.032 6.716c0 1.143.292 2.265.844 3.258l.085.124-.071-.253c-.015.045-.029.089-.044.134-.118.675-.178 1.363-.178 2.052 0 1.529.299 3.012.896 4.42.57 1.348 1.394 2.562 2.427 3.596 1.049 1.033 2.247 1.856 3.595 2.426 1.395.598 2.878.898 4.407.898.689 0 1.377-.06 2.051-.179l.135-.045-.241-.044.12.06c1.004.576 2.128.878 3.283.878 1.789 0 3.47-.698 4.736-1.967 1.266-1.268 1.963-2.956 1.963-4.749 0-1.156-.299-2.294-.872-3.301"/></svg>'
            };
        }
        return {
            bg: '#4b505c',
            label: title || 'Поделиться',
            svg: '<svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>'
        };
    }

    function openShareModal() {
        ensureGlobalStyles();
        var existing = document.getElementById(MODAL_ID);
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = MODAL_ID;

        var dialog = document.createElement('div');
        dialog.className = 'cr-share-dialog';

        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'cr-share-close';
        closeBtn.innerHTML = '&#10005;';
        closeBtn.onclick = function() { overlay.classList.remove('is-open'); };

        var heading = document.createElement('h2');
        heading.className = 'cr-share-title';
        heading.textContent = 'Поделиться сериалом';

        var optionsWrap = document.createElement('div');
        optionsWrap.className = 'cr-share-options';

        // Берём реальные ссылки из ya-share2 сайта и преобразуем в большие круги с названиями
        var yaLinks = Array.from(document.querySelectorAll('.ya-share2__list a.ya-share2__link'));
        yaLinks.forEach(function(a) {
            var li = a.closest('.ya-share2__item');
            var serviceCls = li ? li.className : '';
            var title = a.getAttribute('title') || (a.querySelector('.ya-share2__title') ? a.querySelector('.ya-share2__title').textContent.trim() : '');
            var vis = getServiceVisual(serviceCls, title);

            var itemLink = document.createElement('a');
            itemLink.className = 'cr-share-option';
            itemLink.href = a.getAttribute('href') || '#';
            itemLink.target = '_blank';
            itemLink.rel = 'nofollow noopener';

            var circle = document.createElement('span');
            circle.className = 'cr-share-circle';
            circle.style.backgroundColor = vis.bg;
            circle.innerHTML = vis.svg;

            var lbl = document.createElement('span');
            lbl.className = 'cr-share-opt-label';
            lbl.textContent = title || vis.label;

            itemLink.appendChild(circle);
            itemLink.appendChild(lbl);
            optionsWrap.appendChild(itemLink);
});
// Кнопка копирования ссылки на страницу
var copyBtn = document.createElement('button');
copyBtn.type = 'button';
copyBtn.className = 'cr-share-option';
var copyCircle = document.createElement('span');
copyCircle.className = 'cr-share-circle';
copyCircle.style.backgroundColor = '#3a3d46';
copyCircle.innerHTML = '';
var copyLabel = document.createElement('span');
copyLabel.className = 'cr-share-opt-label';
copyLabel.textContent = 'Копировать';
copyBtn.appendChild(copyCircle);
copyBtn.appendChild(copyLabel);
copyBtn.onclick = function() {
if (navigator.clipboard && navigator.clipboard.writeText) {
navigator.clipboard.writeText(window.location.href);
}
copyLabel.textContent = 'Скопировано';
setTimeout(function() { copyLabel.textContent = 'Копировать'; }, 1400);
};
optionsWrap.appendChild(copyBtn);
dialog.appendChild(closeBtn);
dialog.appendChild(heading);
dialog.appendChild(optionsWrap);
// Переносим содержимое .m-translation-view__share (Наш Telegram) без текста «Поделиться аниме»
var shareBlocks = Array.from(document.querySelectorAll('.m-translation-view__share'));
if (shareBlocks.length > 0) {
var tgBox = document.createElement('div');
tgBox.className = 'cr-share-tg-box';
shareBlocks.forEach(function(sb) {
var clone = sb.cloneNode(true);
clone.removeAttribute('data-cr-cleaner-hidden');
clone.querySelectorAll('[data-cr-cleaner-hidden]').forEach(function(n) {
n.removeAttribute('data-cr-cleaner-hidden');
});
// Убираем блок ya-share2 и заголовок «Поделиться аниме», если он внутри
clone.querySelectorAll('.ya-share2').forEach(function(y) { y.remove(); });
Array.from(clone.querySelectorAll('*')).forEach(function(el) {
if (/^поделиться\s+аниме/i.test((el.textContent || '').trim()) && el.children.length === 0) {
el.remove();
}
});
tgBox.innerHTML += clone.innerHTML;
});
dialog.appendChild(tgBox);
}
overlay.appendChild(dialog);
overlay.addEventListener('click', function(e) {
if (e.target === overlay) overlay.classList.remove('is-open');
});
document.body.appendChild(overlay);
overlay.classList.add('is-open');
}
    function findWatchButtonInShadow(sr) {
        var candidates = Array.from(sr.querySelectorAll('a, button'));
        for (var i = 0; i < candidates.length; i++) {
            var el = candidates.at(i);
            if (el.closest('#cr-hero-links-bar')) continue;
            var txt = (el.textContent || '').trim();
            if (/смотреть|просмотр/i.test(txt)) {
                return el;
            }
        }
        return null;
    }

    function injectActionsNextToWatch(posterHost, animeId) {
        if (!posterHost || !posterHost.shadowRoot) return;
        var sr = posterHost.shadowRoot;

        if (!sr.getElementById('cr-links-shadow-style')) {
            var sStyle = document.createElement('style');
            sStyle.id = 'cr-links-shadow-style';
            sStyle.textContent =
                '.cr-watch-pill-btn {' +
                '  border-radius: 999px !important;' +
                '  padding-left: 24px !important;' +
                '  padding-right: 24px !important;' +
                '}' +
                '.cr-hero-actions-row {' +
                '  display: inline-flex !important;' +
                '  align-items: center !important;' +
                '  gap: 16px !important;' +
                '  vertical-align: middle !important;' +
                '}' +
                '.cr-hero-links-bar {' +
                '  display: inline-flex !important;' +
                '  align-items: center !important;' +
                '  gap: 16px !important;' +
                '  margin: 0 !important;' +
                '  padding: 0 !important;' +
                '}' +
                '.cr-hero-tip-wrap {' +
                '  position: relative !important;' +
                '  display: inline-flex !important;' +
                '  align-items: center !important;' +
                '  justify-content: center !important;' +
                '}' +
                /* Серые квадратные подсказки Crunchyroll строго по центру над иконкой с треугольником */
                '.cr-hero-tooltip {' +
                '  position: absolute !important;' +
                '  bottom: calc(100% + 12px) !important;' +
                '  left: 50% !important;' +
                '  transform: translateX(-50%) !important;' +
                '  background: #3b3e47 !important;' +
                '  color: #ffffff !important;' +
                '  font-family: Lato, Roboto, Arial, sans-serif !important;' +
                '  font-size: 14px !important;' +
                '  font-weight: 700 !important;' +
                '  line-height: 1.2 !important;' +
                '  padding: 9px 14px !important;' +
                '  border-radius: 0 !important;' +
                '  white-space: nowrap !important;' +
                '  pointer-events: none !important;' +
                '  opacity: 0;' +
                '  visibility: hidden;' +
                '  transition: opacity 0.14s ease !important;' +
                '  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.75) !important;' +
                '  z-index: 99 !important;' +
                '}' +
                '.cr-hero-tooltip::after {' +
                '  content: "" !important;' +
                '  position: absolute !important;' +
                '  top: 100% !important;' +
                '  left: 50% !important;' +
                '  transform: translateX(-50%) !important;' +
                '  border-width: 6px 6px 0 6px !important;' +
                '  border-style: solid !important;' +
                '  border-color: #3b3e47 transparent transparent transparent !important;' +
                '}' +
                '.cr-hero-tip-wrap:hover .cr-hero-tooltip {' +
                '  opacity: 1 !important;' +
                '  visibility: visible !important;' +
                '}' +

                /* 1. Флажок в круге: в неактивном режиме оранжевая заливка круга и чёрный флажок, при наведении/активном — прозрачный круг и оранжевый флажок */
                '.cr-hero-flag-btn {' +
                '  width: 44px !important; height: 44px !important; padding: 0 !important;' +
                '  background: #f47521 !important; border: 2px solid #f47521 !important;' +
                '  border-radius: 50% !important; color: #000000 !important;' +
                '  display: inline-flex !important; align-items: center !important; justify-content: center !important;' +
                '  cursor: pointer !important; text-decoration: none !important; box-sizing: border-box !important;' +
                '  transition: background-color 0.16s ease, color 0.16s ease !important;' +
                '}' +
                '.cr-hero-flag-btn:hover, .cr-hero-flag-btn.is-active {' +
                '  background: transparent !important;' +
                '  color: #f47521 !important;' +
                '}' +
                '.cr-hero-flag-btn svg {' +
                '  width: 24px !important; height: 24px !important; fill: currentColor !important; display: block !important;' +
                '}' +

                /* 2 и 3. Оранжевые плюсик и Поделиться без кружочков */
                '.cr-hero-plain-btn {' +
                '  width: 38px !important; height: 38px !important; padding: 0 !important;' +
                '  background: transparent !important; border: none !important; outline: none !important;' +
                '  box-shadow: none !important; border-radius: 0 !important;' +
                '  color: #f47521 !important;' +
                '  display: inline-flex !important; align-items: center !important; justify-content: center !important;' +
                '  cursor: pointer !important; transition: color 0.15s ease, transform 0.12s ease !important;' +
                '}' +
                '.cr-hero-plain-btn:hover {' +
                '  background: transparent !important;' +
                '  color: #ff944d !important;' +
                '  transform: scale(1.08);' +
                '}' +
                '.cr-hero-plain-btn svg {' +
                '  width: 26px !important; height: 26px !important; fill: currentColor !important; display: block !important;' +
                '}';
            sr.appendChild(sStyle);
        }

        var watchBtn = findWatchButtonInShadow(sr);
        var existingBar = sr.getElementById('cr-hero-links-bar');

        if (watchBtn && !watchBtn.classList.contains('cr-watch-pill-btn')) {
            watchBtn.classList.add('cr-watch-pill-btn');
        }

        if (existingBar && existingBar.getAttribute('data-anime-id') === animeId) {
            if (watchBtn && watchBtn.nextElementSibling !== existingBar) {
                watchBtn.insertAdjacentElement('afterend', existingBar);
            }
            return;
        }
        if (existingBar) existingBar.remove();

        var addTransLink = document.querySelector('a[href*="/translations/create?seriesId=' + animeId + '"]') ||
                           document.querySelector('a[href*="/translations/create"]');

        var bar = document.createElement('div');
        bar.id = 'cr-hero-links-bar';
        bar.className = 'cr-hero-links-bar';
        bar.setAttribute('data-anime-id', animeId);

        function wrapWithTooltip(el, tipText) {
            var wrap = document.createElement('div');
            wrap.className = 'cr-hero-tip-wrap';
            var tip = document.createElement('div');
            tip.className = 'cr-hero-tooltip';
            tip.textContent = tipText;
            wrap.appendChild(tip);
            wrap.appendChild(el);
            return wrap;
        }

        // 1. Флажок в круге (острые нижние края, открывает в новом окне)
        var flagBtn = document.createElement('a');
        flagBtn.className = 'cr-hero-flag-btn';
        flagBtn.target = '_blank';
        flagBtn.rel = 'noopener noreferrer';
        flagBtn.href = addTransLink
            ? addTransLink.getAttribute('href')
            : ('/translations/create?seriesId=' + animeId);
        flagBtn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M5 3h14v18l-7-4.5L5 21V3z"></path>' +
            '</svg>';
        bar.appendChild(wrapWithTooltip(flagBtn, 'Добавить перевод'));

        // 2. Оранжевый плюсик -> открывает серую панель «В вашем списке:»
        var plusBtn = document.createElement('button');
        plusBtn.type = 'button';
        plusBtn.className = 'cr-hero-plain-btn';
        plusBtn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M13 3v8h8v2h-8v8h-2v-8H3v-2h8V3z"></path>' +
            '</svg>';
        plusBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleListPanel(plusBtn);
        });
        bar.appendChild(wrapWithTooltip(plusBtn, 'Мой список'));

        // 3. Оранжевый значок «Поделиться» -> окно соцсетей
        var shareBtn = document.createElement('button');
        shareBtn.type = 'button';
        shareBtn.className = 'cr-hero-plain-btn';
        shareBtn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M18 2c2.21 0 4 1.79 4 4s-1.79 4-4 4c-1.385 0-2.606-.704-3.323-1.773l-5.02 2.151c.22.496.343 1.045.343 1.622 0 .577-.122 1.126-.342 1.622l5.019 2.151C15.394 14.703 16.615 14 18 14c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4c0-.113.005-.225.014-.335L8.35 15.238C7.69 15.718 6.878 16 6 16c-2.21 0-4-1.79-4-4s1.79-4 4-4c.878 0 1.69.283 2.35.762l5.664-2.427C14.004 6.225 14 6.113 14 6c0-2.21 1.79-4 4-4zm0 14c-1.105 0-2 .895-2 2s.895 2 2 2 2-.895 2-2-.895-2-2-2zM6 10c-1.105 0-2 .895-2 2s.895 2 2 2 2-.895 2-2-.895-2-2-2zm12-6c-1.105 0-2 .895-2 2s.895 2 2 2 2-.895 2-2-.895-2-2-2z"></path>' +
            '</svg>';
        shareBtn.addEventListener('click', function(e) {
e.preventDefault();
e.stopPropagation();
openShareModal();
});
bar.appendChild(wrapWithTooltip(shareBtn, 'Поделиться'));
if (watchBtn && watchBtn.parentElement) {
var parent = watchBtn.parentElement;
if (!parent.classList.contains('cr-hero-actions-row')) {
var rowWrap = document.createElement('div');
rowWrap.className = 'cr-hero-actions-row';
watchBtn.insertAdjacentElement('beforebegin', rowWrap);
rowWrap.appendChild(watchBtn);
rowWrap.appendChild(bar);
} else {
watchBtn.insertAdjacentElement('afterend', bar);
}
} else {
var gridTarget = sr.getElementById('cr-grid') || sr.querySelector('.content-wrap');
if (gridTarget) gridTarget.appendChild(bar);
}
}
document.addEventListener('click', function(e) {
if (!isListPanelOpen) return;
var pop = document.getElementById(LIST_POPOVER_ID);
var host = document.getElementById('cr-poster-host');
if (pop && pop.contains(e.target)) return;
if (host && e.target === host) return;
returnParkedListPanel();
});
function syncFranchiseLinks() {
var animeId = getAnimeId();
var posterHost = document.getElementById('cr-poster-host');
var franchiseSection = document.getElementById('cr-franchise-episodes-section');
if (!animeId || !posterHost || posterHost.getAttribute('data-anime-id') !== animeId || !franchiseSection) {
returnParkedListPanel();
return;
}
injectActionsNextToWatch(posterHost, animeId);
}
window.addEventListener('popstate', function() {
returnParkedListPanel();
setTimeout(syncFranchiseLinks, 450);
});
setInterval(syncFranchiseLinks, 450);
})();
