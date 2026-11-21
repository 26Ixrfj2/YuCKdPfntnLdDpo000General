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
// @name         Anime 365 Crunchyroll Franchise Episodes
// @namespace    http://tampermonkey.net
// @version      3.0
// @description  Полноширинный блок серий Crunchyroll под постером с Cache API, очередью загрузки и поддержкой episodes.json
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
    var FOLDER_CACHE_KEY = 'cr_franchise_folder_map_v3';
    var EXT_CACHE_KEY = 'cr_franchise_ext_map_v3';
    var THUMB_CACHE_NAME = 'cr-franchise-thumbs-v1';
    var CACHE_TTL = 1000 * 60 * 60 * 24; // 24 часа

    var PROTO = 'https' + '://';
    var GITHUB_ROOT_URL = PROTO + 'github' + '.com/' + USER + '/' + REPO + '/tree/main/Franchise';
    var BASE_STATICALLY = PROTO + 'cdn' + '.statically' + '.io/gh/' + USER + '/' + REPO + '/main/';
    var BASE_RAWGH = PROTO + 'raw' + '.githubusercontent' + '.com/' + USER + '/' + REPO + '/main/';

    var folderCache = null;
    var extCache = null;
    var metaCache = {};
    var searchingForId = {};
    var notFoundIds = {};
    var memBlobUrlCache = {};

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
                    if (parsed && parsed.ts && (Date.now() - parsed.ts < CACHE_TTL) && parsed.folders) {
                        folderCache = parsed.folders;
                        return folderCache;
                    }
                }
            }
        } catch (e) {}
        folderCache = {};
        return folderCache;
    }

    function saveFolderMapping(animeId, repoFolderPath) {
        var map = loadSavedFolders();
        map[animeId] = repoFolderPath;
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(FOLDER_CACHE_KEY, JSON.stringify({ ts: Date.now(), folders: map }));
            }
        } catch (e) {}
    }

    function getPreferredExt(animeId) {
        if (!extCache) {
            try {
                extCache = JSON.parse(GM_getValue(EXT_CACHE_KEY, '{}') || '{}');
            } catch (e) { extCache = {}; }
        }
        return extCache[animeId] || null;
    }

    function savePreferredExt(animeId, ext) {
        if (!extCache) extCache = {};
        if (extCache[animeId] === ext) return;
        extCache[animeId] = ext;
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(EXT_CACHE_KEY, JSON.stringify(extCache));
            }
        } catch (e) {}
    }

    function readThumbCache(cacheKey) {
        if (memBlobUrlCache[cacheKey]) return Promise.resolve(memBlobUrlCache[cacheKey]);
        if (!('caches' in window)) return Promise.resolve(null);
        return caches.open(THUMB_CACHE_NAME).then(function(cache) {
            return cache.match(cacheKey).then(function(resp) {
                if (!resp) return null;
                return resp.blob().then(function(blob) {
                    if (!blob || blob.size < 100) return null;
                    var url = URL.createObjectURL(blob);
                    memBlobUrlCache[cacheKey] = url;
                    return url;
                });
            });
        }).catch(function() { return null; });
    }

    function writeThumbCache(cacheKey, blob) {
        var url = URL.createObjectURL(blob);
        memBlobUrlCache[cacheKey] = url;
        if ('caches' in window) {
            caches.open(THUMB_CACHE_NAME).then(function(cache) {
                cache.put(cacheKey, new Response(blob, {
                    headers: { 'Content-Type': blob.type || 'image/png' }
                }));
            }).catch(function() {});
        }
        return url;
    }

    window.addEventListener('cr-reset-page-cache', function(e) {
        var resetId = e && e.detail && e.detail.animeId;
        folderCache = {};
        extCache = {};
        metaCache = {};
        searchingForId = {};
        notFoundIds = {};
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
                        if (r.url.indexOf('/' + resetId + '/') !== -1) {
                            cache.delete(r);
                        }
                    });
                });
            }).catch(function() {});
        }

        Object.keys(memBlobUrlCache).forEach(function(k) {
            if (!resetId || k.indexOf('/' + resetId + '/') !== -1) {
                URL.revokeObjectURL(memBlobUrlCache[k]);
                delete memBlobUrlCache[k];
            }
        });

        var oldBlock = document.getElementById('cr-franchise-episodes-section');
        if (oldBlock) oldBlock.remove();
    });

    function fetchText(url) {
        return new Promise(function(resolve) {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: 15000,
                onload: function(res) {
                    resolve(res.status === 200 ? (res.responseText || '') : '');
                },
                onerror: function() { resolve(''); },
                ontimeout: function() { resolve(''); }
            });
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
            var relEncoded = href.slice(idx + '/tree/main/'.length).split('?').at(0).split('#').at(0);
            try {
                var decoded = decodeURIComponent(relEncoded);
                if (links.indexOf(decoded) === -1) links.push(decoded);
            } catch (e) {}
        });
        return links;
    }

    function findTitleFolderInGitHub(animeId) {
        var saved = loadSavedFolders();
        if (saved[animeId]) return Promise.resolve(saved[animeId]);
        if (notFoundIds[animeId]) return Promise.resolve(null);
        if (searchingForId[animeId]) return searchingForId[animeId];

        searchingForId[animeId] = fetchText(GITHUB_ROOT_URL).then(function(rootHtml) {
            var franchiseDirs = extractTreeLinks(rootHtml).filter(function(p) {
                return p.split('/').length === 2;
            });

            if (!franchiseDirs.length) return null;

            var idx = 0;
            function scanNextFranchise() {
                if (idx >= franchiseDirs.length) return Promise.resolve(null);
                var fDir = franchiseDirs.at(idx++);
                var encodedUrl = PROTO + 'github' + '.com/' + USER + '/' + REPO + '/tree/main/' +
                    fDir.split('/').map(encodeURIComponent).join('/');

                return fetchText(encodedUrl).then(function(subHtml) {
                    var subPaths = extractTreeLinks(subHtml);
                    var matched = null;

                    subPaths.forEach(function(sp) {
                        var folderName = sp.split('/').pop() || '';
                        var m = folderName.match(/^(\d+)(?:\s|\[|$)/);
                        if (m) {
                            var foundId = m.at(1);
                            saveFolderMapping(foundId, sp);
                            if (foundId === animeId) matched = sp;
                        }
                    });

                    if (matched) return matched;
                    return scanNextFranchise();
                });
            }

            return scanNextFranchise();
        }).then(function(result) {
            delete searchingForId[animeId];
            if (!result) notFoundIds[animeId] = true;
            return result;
        });

        return searchingForId[animeId];
    }

    function loadEpisodesMetadata(animeId, folderPath) {
        if (metaCache[animeId]) return Promise.resolve(metaCache[animeId]);
        var encodedJson = folderPath.split('/').map(encodeURIComponent).join('/') + '/episodes.json';
        return fetchText(BASE_STATICALLY + encodedJson).then(function(txt) {
            if (!txt) return fetchText(BASE_RAWGH + encodedJson);
            return txt;
        }).then(function(txt) {
            try {
                if (txt && txt.trim().startsWith('{')) {
                    metaCache[animeId] = JSON.parse(txt);
                    return metaCache[animeId];
                }
            } catch (e) {}
            metaCache[animeId] = {};
            return {};
        });
    }
    function ensureFranchiseStyles() {
        if (document.getElementById('cr-franchise-ep-style')) return;
        var st = document.createElement('style');
        st.id = 'cr-franchise-ep-style';
        st.textContent =
            '#cr-franchise-episodes-section {' +
            '  display: block;' +
            '  width: 100%;' +
            '  background: #000000;' +
            '  color: #ffffff;' +
            '  padding: 28px 4.9% 44px 4.9%;' +
            '  margin: 0 0 24px 0;' +
            '  box-sizing: border-box;' +
            '  font-family: Roboto, Lato, sans-serif;' +
            '  border-bottom: 1px solid rgba(255, 255, 255, 0.12);' +
            '  clear: both;' +
            '}' +
            '.cr-ep-section-header {' +
            '  font-size: 22px;' +
            '  font-weight: 700;' +
            '  color: #ffffff;' +
            '  margin-bottom: 18px;' +
            '  letter-spacing: 0.2px;' +
            '}' +
            '.cr-ep-grid {' +
            '  display: grid;' +
            '  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));' +
            '  gap: 24px 18px;' +
            '  width: 100%;' +
            '}' +
            '.cr-ep-card {' +
            '  display: flex;' +
            '  flex-direction: column;' +
            '  text-decoration: none !important;' +
            '  color: #ffffff !important;' +
            '  background: #000000;' +
            '  border-radius: 2px;' +
            '}' +
            '.cr-ep-card:hover .cr-ep-thumb-wrap {' +
            '  outline: 2px solid #f47521;' +
            '}' +
            '.cr-ep-card:hover .cr-ep-title {' +
            '  color: #f47521;' +
            '}' +
            '.cr-ep-thumb-wrap {' +
            '  position: relative;' +
            '  width: 100%;' +
            '  aspect-ratio: 16 / 9;' +
            '  background: #141519;' +
            '  overflow: hidden;' +
            '  border-radius: 2px;' +
            '}' +
            '.cr-ep-thumb {' +
            '  display: block;' +
            '  width: 100%;' +
            '  height: 100%;' +
            '  object-fit: cover;' +
            '  opacity: 0;' +
            '  transition: opacity 0.22s ease, transform 0.25s ease;' +
            '}' +
            '.cr-ep-thumb.is-ready {' +
            '  opacity: 1;' +
            '}' +
            '.cr-ep-card:hover .cr-ep-thumb {' +
            '  transform: scale(1.03);' +
            '}' +
            '.cr-ep-duration {' +
            '  position: absolute;' +
            '  bottom: 6px;' +
            '  right: 6px;' +
            '  background: rgba(0, 0, 0, 0.82);' +
            '  color: #ffffff;' +
            '  font-size: 11px;' +
            '  font-weight: 600;' +
            '  padding: 2px 6px;' +
            '  border-radius: 2px;' +
            '}' +
            '.cr-ep-play-badge {' +
            '  position: absolute;' +
            '  inset: 0;' +
            '  display: flex;' +
            '  align-items: center;' +
            '  justify-content: center;' +
            '  background: rgba(0, 0, 0, 0.28);' +
            '  opacity: 0;' +
            '  transition: opacity 0.18s ease;' +
            '}' +
            '.cr-ep-card:hover .cr-ep-play-badge {' +
            '  opacity: 1;' +
            '}' +
            '.cr-ep-play-circle {' +
            '  width: 44px;' +
            '  height: 44px;' +
            '  border-radius: 50%;' +
            '  background: rgba(0, 0, 0, 0.78);' +
            '  border: 2px solid #f47521;' +
            '  color: #f47521;' +
            '  display: flex;' +
            '  align-items: center;' +
            '  justify-content: center;' +
            '  font-size: 16px;' +
            '  padding-left: 2px;' +
            '}' +
            '.cr-ep-meta {' +
            '  padding: 8px 2px 2px 2px;' +
            '  display: flex;' +
            '  flex-direction: column;' +
            '  gap: 4px;' +
            '}' +
            '.cr-ep-code {' +
            '  font-size: 11px;' +
            '  font-weight: 700;' +
            '  letter-spacing: 0.5px;' +
            '  text-transform: uppercase;' +
            '  color: #a0a0a0;' +
            '}' +
            '.cr-ep-title {' +
            '  font-size: 14px;' +
            '  font-weight: 600;' +
            '  line-height: 1.3;' +
            '  color: #ffffff;' +
            '  transition: color 0.15s ease;' +
            '}' +
            '.cr-ep-desc {' +
            '  font-size: 12px;' +
            '  line-height: 1.4;' +
            '  color: #9e9e9e;' +
            '  display: -webkit-box;' +
            '  -webkit-line-clamp: 2;' +
            '  -webkit-box-orient: vertical;' +
            '  overflow: hidden;' +
            '}';
        document.head.appendChild(st);
    }

    function detectEpisodeCode(labelText, href) {
        var clean = labelText.replace(/play_circle_filled/gi, '').trim();
        if (/трейлер|trailer/i.test(clean) || /treyler/i.test(href || '')) {
            return { code: null, cleanTitle: clean };
        }
        var numMatch = clean.match(/^(\d+)\s*серия/i) || (href || '').match(/\/(\d+)-seriya-/i);
        if (numMatch) {
            return { code: 'E' + numMatch.at(1), cleanTitle: clean };
        }
        return { code: null, cleanTitle: clean };
    }

    function runThumbQueue(tasks, concurrency) {
        var idx = 0;
        function worker() {
            if (idx >= tasks.length) return;
            var task = tasks.at(idx++);
            task().then(worker, worker);
        }
        for (var i = 0; i < Math.min(concurrency, tasks.length); i++) {
            worker();
        }
    }

    function createThumbLoaderTask(animeId, imgEl, cardEl, folderPath, fileCode) {
        return function() {
            var cacheKey = 'https://cr-ep-thumb.local' + animeId + '/' + fileCode;
            return readThumbCache(cacheKey).then(function(cachedUrl) {
                if (cachedUrl) {
                    imgEl.src = cachedUrl;
                    imgEl.classList.add('is-ready');
                    return;
                }

                var encodedBase = folderPath.split('/').map(encodeURIComponent).join('/') + '/episodes/' + encodeURIComponent(fileCode);
                var prefExt = getPreferredExt(animeId);
                var exts = ['.png', '.jpg', '.webp'];
                if (prefExt && exts.indexOf(prefExt) !== -1) {
                    exts = [prefExt].concat(exts.filter(function(x) { return x !== prefExt; }));
                }

                var candidates = [];
                exts.forEach(function(ext) {
                    candidates.push({ url: BASE_STATICALLY + encodedBase + ext, ext: ext });
                });
                exts.forEach(function(ext) {
                    candidates.push({ url: BASE_RAWGH + encodedBase + ext, ext: ext });
                });

                return new Promise(function(resolve) {
                    function tryNext(i) {
                        if (i >= candidates.length) {
                            cardEl.style.display = 'none';
                            resolve();
                            return;
                        }
                        var item = candidates.at(i);
                        GM_xmlhttpRequest({
                            method: 'GET',
                            url: item.url,
                            responseType: 'blob',
                            timeout: 15000,
                            onload: function(res) {
                                if (res.status === 200 && res.response && res.response.size > 100) {
                                    savePreferredExt(animeId, item.ext);
                                    imgEl.src = writeThumbCache(cacheKey, res.response);
                                    imgEl.classList.add('is-ready');
                                    resolve();
                                } else {
                                    tryNext(i + 1);
                                }
                            },
                            onerror: function() { tryNext(i + 1); },
                            ontimeout: function() { tryNext(i + 1); }
                        });
                    }
                    tryNext(0);
                });
            });
        };
    }

    function insertSectionBelowBanner(sectionEl) {
        var bannerHost = document.getElementById('cr-poster-host');
        if (bannerHost) {
            bannerHost.insertAdjacentElement('afterend', sectionEl);
            return;
        }
        var nav = document.querySelector('body > nav') || document.querySelector('nav');
        if (nav) {
            nav.insertAdjacentElement('afterend', sectionEl);
        } else {
            document.body.prepend(sectionEl);
        }
    }

    function renderFranchiseEpisodes(animeId, folderPath, epMeta) {
        var origEpCard = document.querySelector('.card-content.m-episode-list');
        if (!origEpCard) return;

        var links = Array.from(origEpCard.querySelectorAll('a.m-episode-item'));
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

        var tasks = [];

        links.forEach(function(a) {
            var href = a.getAttribute('href') || '#';
            var parsed = detectEpisodeCode(a.textContent, href);
if (!parsed.code) return;
var info = (epMeta && epMeta[parsed.code]) || {};
var displayTitle = info.title ? (parsed.cleanTitle + ' — ' + info.title) : parsed.cleanTitle;
var card = document.createElement('a');
card.className = 'cr-ep-card';
card.href = href;
var thumbWrap = document.createElement('div');
thumbWrap.className = 'cr-ep-thumb-wrap';
var img = document.createElement('img');
img.className = 'cr-ep-thumb';
img.alt = displayTitle;
thumbWrap.appendChild(img);
if (info.duration) {
var dur = document.createElement('div');
dur.className = 'cr-ep-duration';
dur.textContent = info.duration;
thumbWrap.appendChild(dur);
}
var playBadge = document.createElement('div');
playBadge.className = 'cr-ep-play-badge';
playBadge.innerHTML = '▶';
thumbWrap.appendChild(playBadge);
var meta = document.createElement('div');
meta.className = 'cr-ep-meta';
var codeEl = document.createElement('div');
codeEl.className = 'cr-ep-code';
codeEl.textContent = parsed.code;
meta.appendChild(codeEl);
var titleEl = document.createElement('div');
titleEl.className = 'cr-ep-title';
titleEl.textContent = displayTitle;
meta.appendChild(titleEl);
if (info.desc) {
var descEl = document.createElement('div');
descEl.className = 'cr-ep-desc';
descEl.textContent = info.desc;
meta.appendChild(descEl);
}
card.appendChild(thumbWrap);
card.appendChild(meta);
grid.appendChild(card);
tasks.push(createThumbLoaderTask(animeId, img, card, folderPath, parsed.code));
});
if (!tasks.length) return;
section.appendChild(grid);
insertSectionBelowBanner(section);
var parentCard = origEpCard.closest('.card');
if (parentCard) parentCard.style.display = 'none';
else origEpCard.style.display = 'none';
runThumbQueue(tasks, 4);
}
function syncFranchise() {
var animeId = getAnimeId();
var existingSection = document.getElementById('cr-franchise-episodes-section');
if (!animeId) {
if (existingSection) existingSection.remove();
return;
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
findTitleFolderInGitHub(animeId).then(function(folderPath) {
if (!folderPath || getAnimeId() !== animeId) return;
loadEpisodesMetadata(animeId, folderPath).then(function(epMeta) {
if (getAnimeId() !== animeId) return;
renderFranchiseEpisodes(animeId, folderPath, epMeta);
});
});
}
window.addEventListener('popstate', syncFranchise);
setInterval(syncFranchise, 400);
})();
