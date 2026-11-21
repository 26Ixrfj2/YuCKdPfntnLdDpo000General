// ==UserScript==
// @name         Anime 365 Crunchyroll Dark Theme Combined
// @namespace    http://tampermonkey.net
// @version      16.0
// @description  Конфигурация Б1: Полная темная тема со скрытием оригинального логотипа, размещением текстового логотипа правее (шрифт Trebuchet MS) и фиксацией блока ссылок
// @author       You
// @match        *://*.smotret-anime.app/*
// @match        *://*.smotret-anime.org/*
// @match        *://*.smotretanime.ru/*
// @match        *://*/*
// @grant        GM_addStyle
// @allFrames    true
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';

  const cssString = `
    html, body, body > div.full-background {
      background-color: #1a1b1e !important;
      background-image: none !important;
      -webkit-font-smoothing: antialiased !important; 
      -moz-osx-font-smoothing: grayscale !important;
    }
    body > div.body-container {
      background-color: #1a1b1e !important;
    }
    
    /* ПОЛНАЯ ИЗОЛЯЦИЯ ПОСТЕРОВ */
    .m-catalog-item__poster, 
    .m-catalog-item__poster a,
    .card-image, 
    .card-image a,
    [class*="poster"], 
    [class*="poster"] a,
    img {
      background-color: transparent !important;
      background-image: inherit !important;
      background-size: cover !important;
      background-position: center center !important;
      display: block !important;
      opacity: 1 !important;
    }
    
    #footer > div.container {
      display: none !important;
    }
    #footer > div.footer-copyright a[href="/translations/recent"] {
      display: none !important;
    }
    #footer, #footer > div.footer-copyright {
      background-color: #1a1b1e !important;
      border-top: none !important;
      box-shadow: none !important;
    }
    #footer > div.footer-copyright, #footer > div.footer-copyright > div, #footer > div.footer-copyright a.orange-text, #footer > div.footer-copyright a.jss-year-link {
      font-weight: normal !important; 
      color: #a0a0a5 !important; 
      transition: all 0.25s ease-in-out !important; 
      text-decoration: none !important;
      text-shadow: none !important;
      filter: none !important;
    }
    #footer > div.footer-copyright > div:hover a.orange-text, #footer > div.footer-copyright > div:hover a.jss-year-link {
      color: #ffffff !important;
      text-shadow: 0 0 6px rgba(255, 255, 255, 0.7), 0 0 12px rgba(255, 255, 255, 0.4) !important;
    }
    /* Цвет тела блоков, верхнего меню, заголовков на главной и комментариев: #35363a */
    .body-container .card, .body-container .card-panel, .body-container .collection, .body-container .collection-item, .body-container .m-custom-tabs, input, textarea, select, .side-nav, .m-group-pop-box, .m-pop-box, .tag, div[class*="m-news-box"], div[class*="card-content"], #comments > div.collection-header, .collection-header,
    body > nav, body nav.white, nav, 
    #yw0, #yw0 > li, #yw0 div,
    #yw1, #yw1 > li, #yw1 div,
    #yw2, #yw2 > li, #yw2 div,
    #yw3, #yw3 > li, #yw3 div {
      background-color: #35363a !important; 
      color: #eeeeee !important; 
      border: none !important;
      box-shadow: none !important;
      text-shadow: none !important; 
      border-bottom: none !important;
    }
    
    .body-container .collection .collection-item, table, td, th, tr:hover, .body-container .divider {
      border-bottom: none !important;
      border-top: none !important;
      background-color: #35363a !important;
      box-shadow: none !important;
    }

    /* Глобальное перекрашивание оценки серии в обычный цвет текста */
    .body-container p, .body-container h1, .body-container h2, .body-container h3, .body-container h4, .body-container h5, .body-container h6, .body-container span:not(.material-icons), .body-container div, .body-container label, .body-container input, .body-container textarea,
    [class*="m-series-score__value"], .m-series-score__value, .m-series-score__value span, .red-text.text-darken-1, .yellow-text.text-darken-4 {
      color: #eeeeee !important;
      font-weight: normal !important; 
      text-shadow: none !important; 
      filter: none !important;
      box-shadow: none !important;
    }
    
    /* Базовые стили для ВСЕХ обычных текстовых ссылок верхних панелей */
    .body-container a:not(.btn):not([class*="btn"]), 
    .body-container h2 a, 
    .body-container h2 a span,
    #yw0 > li > a, #yw1 > li > a, #yw2 > li > a, #yw3 > li > a {
      color: #eeeeee !important; 
      font-weight: normal !important; 
      text-decoration: none !important;
      transition: all 0.25s ease-in-out !important;
      text-shadow: none !important; 
      filter: none !important;
      box-shadow: none !important;
      background: transparent !important;
      background-image: none !important;
    }
    
    .m-catalog-item__poster a, .card-image a, [class*="poster"] a {
      color: transparent !important;
      background: transparent !important;
      text-shadow: none !important;
    }
    
    .body-container a:not(.btn):not([class*="btn"]):hover, 
    .body-container h2 a:hover,
    .body-container h2 a:hover span,
    #yw0 > li > a:hover, #yw1 > li > a:hover, #yw2 > li > a:hover, #yw3 > li > a:hover,
    nav ul li a:hover {
      color: #ffffff !important;
      background-color: transparent !important;
      text-shadow: 0 0 6px rgba(255, 255, 255, 1), 0 0 12px rgba(255, 255, 255, 0.8) !important;
      box-shadow: none !important;
    }
    
    #yw0 > li:hover > a.dropdown-button, #yw0 > li > a.dropdown-button.active,
    #yw1 > li:hover > a.dropdown-button, #yw1 > li > a.dropdown-button.active,
    #yw2 > li:hover > a.dropdown-button, #yw2 > li > a.dropdown-button.active,
    #yw3 > li:hover > a.dropdown-button, #yw3 > li > a.dropdown-button.active {
      color: #ffffff !important;
      background-color: transparent !important;
      text-shadow: 0 0 6px rgba(255, 255, 255, 1), 0 0 12px rgba(255, 255, 255, 0.8) !important;
    }
    
    /* Иконка Sparkle в покое бледная, а при ховере становится сильно белее БЕЗ эффекта глоу */
    #yw0 > li > a i.green-text, #yw0 > li > a i.material-icons,
    #yw1 > li > a i.green-text, #yw1 > li > a i.material-icons,
    #yw2 > li > a i.green-text, #yw2 > li > a i.material-icons,
    #yw3 > li > a i.green-text, #yw3 > li > a i.material-icons, i.material-icons.green-text {
      color: #eeeeee !important;
      opacity: 0.45 !important;
      text-shadow: none !important;
      filter: none !important;
      transition: all 0.25s ease-in-out !important;
    }
    #yw0 > li:hover > a i.green-text, #yw0 > li:hover > a i.material-icons, #yw0 > li > a.dropdown-button.active i.material-icons,
    #yw1 > li:hover > a i.green-text, #yw1 > li:hover > a i.material-icons, #yw1 > li > a.dropdown-button.active i.material-icons,
    #yw2 > li:hover > a i.green-text, #yw2 > li:hover > a i.material-icons, #yw2 > li > a.dropdown-button.active i.material-icons,
    #yw3 > li:hover > a i.green-text, #yw3 > li:hover > a i.material-icons, #yw3 > li > a.dropdown-button.active i.material-icons {
      color: #ffffff !important; 
      opacity: 1 !important;
      filter: brightness(1.6) !important;
      text-shadow: none !important;
    }
    
    /* Белый цвет для всех звезд в блоках оценок каталога */
    .body-container i.material-icons,
    [id*="yw"] .m-series-score i.material-icons,
    .m-series-score i, .m-series-score .material-icons {
      color: #ffffff !important;
    }
    
    /* Плей на моментах плавно и медленно растворяется */
    .m-moment__play-button.material-icons {
      transition: all 0.5s ease-in-out !important; 
    }
    a:hover > .m-moment__play-button.material-icons, .m-moment__play-button.material-icons:hover {
      color: #000000 !important;
      background-color: transparent !important;
      text-shadow: 0 0 8px rgba(255, 255, 255, 1), 0 0 16px rgba(255, 255, 255, 0.9) !important;
      filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.8)) !important;
    }
    /* Логика отображения блока вариантов перевода */
    .m-select-translation-variant a, .m-select-translation-variant .truncate {
      background: transparent !important;
      background-image: none !important;
      border: none !important;
      box-shadow: none !important;
      color: #eeeeee !important;
      opacity: 0.55 !important; 
      transition: all 0.25s ease-in-out !important;
    }
    .m-select-translation-variant a:hover, .m-select-translation-variant .truncate:hover {
      color: #ffffff !important;
      opacity: 1 !important;
      text-shadow: 0 0 4px rgba(255, 255, 255, 0.9) !important; 
    }
    .m-select-translation-variant .current, .m-select-translation-variant a.current.truncate {
      color: #ffffff !important;
      opacity: 1 !important;
      background: transparent !important;
      text-shadow: 0 0 5px rgba(255, 255, 255, 0.85) !important;
    }
    .m-select-translation-variant .current:hover, .m-select-translation-variant a.current.truncate:hover {
      color: #ffffff !important;
      text-shadow: 0 0 6px rgba(255, 255, 255, 1), 0 0 12px rgba(255, 255, 255, 0.7) !important;
    }
    
    /* Стилизация НАСТОЯЩИХ кнопок и КНОПОК ПЕРАМОТКИ МОМЕНТОВ */
    body div.body-container a.btn, body div.body-container .btn, body div.body-container [class*="btn"]:not(div):not(a:not(.btn)),
    .m-genres-list__item, .m-genres-list a, .green.darken-4, .orange.accent-4, .orange.darken-4, .m-block-title a.btn, .vjs-default-skin .vjs-slider, .m-select-view a.active,
    [id*="yw_moments"] a.btn-floating, .slick-arrow, .slick-next, .slick-prev {
      background-color: #404146 !important;
      background-image: none !important;
      border: none !important;
      border-bottom: none !important;
      box-sizing: border-box !important;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4) !important; 
      transition: all 0.25s ease-in-out !important;
    }
    body div.body-container a.btn:hover, body div.body-container .btn:hover, body div.body-container [class*="btn"]:not(div):not(a:not(.btn)):hover,
    .m-genres-list__item:hover, .m-genres-list a:hover, .green.darken-4:hover, .orange.accent-4:hover, .orange.darken-4:hover,
    .btn.green.darken-4:hover, .btn.orange.accent-4:hover,
    [id*="yw_moments"] a.btn-floating:hover, .slick-arrow:hover, .slick-next:hover, .slick-prev:hover {
      color: #ffffff !important;
      background-color: #38393d !important; 
      background-image: none !important;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4) !important; 
      text-shadow: 0 0 6px rgba(255, 255, 255, 1), 0 0 12px rgba(255, 255, 255, 0.8) !important;
      border: none !important;
    }
    
    .m-select-translation-type .btn:hover, .m-select-translation-type .btn.active, .m-select-translation-type .btn.active:hover,
    .m-select-translation-type a.waves-effect.waves-light.btn.green.darken-4.white-text.active,
    .m-select-translation-type a.waves-effect.waves-light.btn.green.darken-4.white-text.active:hover {
      color: #ffffff !important;
      background-color: #38393d !important;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4) !important;
      text-shadow: 0 0 6px rgba(255, 255, 255, 1), 0 0 12px rgba(255, 255, 255, 0.8) !important;
      border: none !important;
    }
    
    .light-blue.darken-4, div.light-blue.darken-4, a.light-blue.darken-4 {
      background-color: transparent !important;
      background: transparent !important;
      box-shadow: none !important;
    }
    
    div.m-genres-icons, .m-genres-icons, form.m-catalog-item__genres, .m-catalog-item__genres {
      background-color: transparent !important;
      background: transparent !important;
      overflow: visible !important; 
      box-shadow: none !important;
      border: none !important;
    }
    
    [class*="m-genres-icons__item"], .m-genres-icons__item {
      background-color: transparent !important;
      background: transparent !important;
      color: #ffffff !important; 
      padding: 6px !important;
      border-radius: 0 !important;
      border: none !important;
      box-shadow: none !important;
      display: inline-block !important;
      position: relative !important; 
      overflow: visible !important;
    }
    [class*="m-genres-icons__item"] *, .m-genres-icons__item * {
      color: #ffffff !important; 
      background-color: transparent !important;
      transition: all 0.25s ease-in-out !important;
    }
    
    [class*="m-genres-icons__item"]:hover *, .m-genres-icons__item:hover * {
      color: #ffffff !important;
      background-color: transparent !important;
      text-shadow: 0 0 8px rgba(255, 255, 255, 1), 0 0 16px rgba(255, 255, 255, 0.8) !important;
    }
    [class*="m-genres-icons__item"]:hover, .m-genres-icons__item:hover {
      background-color: transparent !important;
      box-shadow: none !important;
      filter: none !important;
    }
    
    .material-tooltip {
      z-index: 2147483647 !important; 
      background-color: rgba(30, 30, 35, 0.95) !important;
      color: #ffffff !important;
      border-radius: 4px !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.6) !important;
    }

    #ccs div.m-select-view.right, .m-select-view.right, div[class*="m-select-view"] {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      gap: 10px !important;
    }

    .dropdown-content[id*="top-dropdown"] {
      background-color: #35363a !important; 
      box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
      border: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .dropdown-content[id*="top-dropdown"] li {
      background-color: transparent !important;
      border: none !important;
      min-height: auto !important; 
      height: auto !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .dropdown-content[id*="top-dropdown"] li a {
      color: #eeeeee !important; 
      background-color: transparent !important; 
      background-image: none !important;
      font-weight: normal !important;
      text-shadow: none !important; 
      border: none !important;               
      box-shadow: none !important;
      display: block !important;
      width: 100% !important;
      box-sizing: border-box !important;
      padding: 14px 16px !important; 
      line-height: 22px !important;  
      transition: all 0.2s ease-in-out !important;           
    }
    .dropdown-content[id*="top-dropdown"] li a:hover,
    .dropdown-content[id*="top-dropdown"] li:hover > a {
      background-color: transparent !important; 
      color: #ffffff !important;                
      text-shadow: 0 0 6px rgba(255, 255, 255, 1), 0 0 12px rgba(255, 255, 255, 0.7) !important; 
    }
    
    /* Изменение цвета точек перелистывания моментов */
    .slick-dots li button:before {
      color: #ffffff !important;
      opacity: 0.35 !important; 
      transition: all 0.2s ease-in-out !important;
    }
    .slick-dots li.slick-active button:before {
      color: #ffffff !important;
      opacity: 1 !important; 
      text-shadow: 0 0 6px rgba(255, 255, 255, 0.8), 0 0 12px rgba(255, 255, 255, 0.4) !important;
    }
    
    .progress, div.progress, [class*="progress"] {
      display: none !important;
      opacity: 0 !important;
      height: 0 !important;
    }
    
    #jss-global-wave-loader {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 4px !important;
      z-index: 2147483647 !important;
      background-color: #35363a !important;
      background-image: linear-gradient(to right, transparent 0%, rgba(255, 255, 255, 0.4) 25%, #ffffff 50%, rgba(255, 255, 255, 0.4) 75%, transparent 100%) !important;
      background-size: 200% 100% !important;
      box-shadow: 0 1px 12px rgba(255, 255, 255, 1), 0 0 25px rgba(255, 255, 255, 0.7) !important;
      animation: jssLinearWave 1.4s infinite linear !important;
      transition: opacity 0.5s ease-in-out, transform 0.4s ease !important;
      pointer-events: none !important;
      opacity: 1;
      transform: translateY(0);
    }
    @keyframes jssLinearWave {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    #jss-global-wave-loader.jss-hide {
      opacity: 0 !important;
      transform: translateY(-4px) !important;
    }
    
    /* Полное и бескомпромиссное скрытие оригинального контейнера логотипа */
    #logo-container, .brand-logo {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      width: 0 !important;
      height: 0 !important;
    }
    
    /* Ссылка-логотип размещена правее (left: 140px) и не зависит от старого контейнера */
    .jss-standalone-logo {
      position: absolute !important;
      top: 0 !important;
      left: 140px !important; 
      height: 64px !important; 
      display: flex !important;
      align-items: center !important;
      z-index: 2147483647 !important; 
      text-decoration: none !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      pointer-events: auto !important;
    }
    
    /* ИСПРАВЛЕНО ДЛЯ Б1: Замена шрифта на Trebuchet MS (менее жирный, аккуратный, доступен везде) */
    .jss-text-logo {
      font-family: "Trebuchet MS", "Lucida Grande", "Lucida Sans Unicode", sans-serif !important;
      color: #ffffff !important;
      font-size: 24px !important;
      font-weight: 700 !important; /* Умеренно-жирный вместо сверхмассивного 900 */
      letter-spacing: 2px !important; /* Легкое разряжение букв для стиля */
      text-shadow: 0 0 6px rgba(255, 255, 255, 1), 0 0 12px rgba(255, 255, 255, 0.8) !important;
      transition: all 0.25s ease-in-out !important;
    }
    .jss-standalone-logo:hover .jss-text-logo {
text-shadow: 0 0 8px rgba(255, 255, 255, 1), 0 0 20px rgba(255, 255, 255, 0.9) !important;
}
/* ИСПРАВЛЕНО ДЛЯ Б1: Изоляция перемещенного блока ссылок, защита от "вылетания" /
.m-translation-back-links {
display: flex !important;
flex-direction: column !important;
gap: 5px !important;
margin-top: 15px !important;
clear: both !important;
position: static !important;
}
form.animelist_mini { margin-top: 10px !important; margin-bottom: 5px !important; width: 100% !important; }
div[class="m-translation-view-download"] h3 { margin-top: 0px !important; margin-bottom: 15px !important; padding-bottom: 0px !important; }
div[class*="m-translation-view-download"] a.btn { display: inline-block !important; margin: 4px !important; }
`;
let observer;
  function modifyDOMStructure() {
    if (observer) observer.disconnect();
    
    let loader = document.getElementById('jss-global-wave-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'jss-global-wave-loader';
      document.body.appendChild(loader);
    }
    setTimeout(() => {
      const l = document.getElementById('jss-global-wave-loader');
      if (l) l.classList.add('jss-hide');
    }, 800);
    if (typeof window.jQuery !== 'undefined') {
      window.jQuery(document).off('ajaxStart.jss ajaxComplete.jss');
      window.jQuery(document).on('ajaxStart.jss', function() {
        const l = document.getElementById('jss-global-wave-loader');
        if (l) l.classList.remove('jss-hide');
      }).on('ajaxComplete.jss', function() {
        const l = document.getElementById('jss-global-wave-loader');
        if (l) setTimeout(() => l.classList.add('jss-hide'), 500);
      });
    }
    
    /* ИСПРАВЛЕНО ДЛЯ Б1: Точечный перенос формы и блока обратных ссылок строго в предназначенный правый блок */
    const rightSidebarContainer = document.querySelector('body > div.body-container > div > div > div > div.col.s12.m4.l3.col-even > div:nth-child(1) > div.card-content > div');
    if (rightSidebarContainer) {
      const fullFormBlock = document.querySelector('form#yw0.animelist_mini');
      const backLinksBlock = document.querySelector('.m-translation-back-links');
      if (fullFormBlock && fullFormBlock.parentNode !== rightSidebarContainer) {
        rightSidebarContainer.appendChild(fullFormBlock);
      }
      if (backLinksBlock && backLinksBlock.parentNode !== rightSidebarContainer) {
        rightSidebarContainer.appendChild(backLinksBlock);
      }
    }
    const downloadContainer = document.querySelector('div[class*="m-translation-view-download"]');
    if (downloadContainer) {
      const paragraphs = downloadContainer.querySelectorAll('p');
      paragraphs.forEach(p => p.remove());
    }
    const copyrightDiv = document.querySelector('#footer > div.footer-copyright > div');
    if (copyrightDiv && !document.getElementById('jss-clickable-year')) {
      const originalLink = copyrightDiv.querySelector('a.orange-text');
      const targetUrl = originalLink ? originalLink.getAttribute('href') : 'https://smotret-anime.org';
      const nodes = copyrightDiv.childNodes;
      for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        if (node.nodeType === Node.TEXT_NODE && /\b20\d{2}\b/.test(node.nodeValue)) {
          const textContent = node.nodeValue;
          const yearLink = document.createElement('a');
          yearLink.id = 'jss-clickable-year';
          yearLink.className = 'jss-year-link';
          yearLink.setAttribute('href', targetUrl);
          yearLink.innerText = textContent;
          copyrightDiv.replaceChild(yearLink, node);
          break;
        }
      }
    }
    
    /* Создание абсолютно независимого логотипа в корне панели навигации */
    const navigationBar = document.querySelector('body > nav') || document.querySelector('nav');
    if (navigationBar && !document.getElementById('jss-standalone-logo-id')) {
      if (!navigationBar.style.position || navigationBar.style.position === 'static') {
        navigationBar.style.position = 'relative';
      }
      
      const standaloneLogo = document.createElement('a');
      standaloneLogo.id = 'jss-standalone-logo-id';
      standaloneLogo.className = 'jss-standalone-logo';
      standaloneLogo.setAttribute('href', 'https://smotret-anime.app');
      
      const textLogo = document.createElement('span');
      textLogo.className = 'jss-text-logo';
      textLogo.innerText = 'ANIME 365';
      
      standaloneLogo.appendChild(textLogo);
      navigationBar.appendChild(standaloneLogo);
    }

    if (observer) {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }
  
  const tagId = 'crunchyroll-theme-combined';
  function injectStyles() {
    let styleTag = document.getElementById(tagId);
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = tagId;
      styleTag.type = 'text/css';
    }
    if (document.body && document.body.lastChild !== styleTag) {
      document.body.appendChild(styleTag);
    }
    styleTag.innerHTML = cssString;
    modifyDOMStructure();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStyles);
  } else {
    injectStyles();
  }
  observer = new MutationObserver(() => {
    if (!document.getElementById(tagId) || (document.body && document.body.lastChild !== document.getElementById(tagId))) {
      injectStyles();
    } else {
      modifyDOMStructure();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
(function() {
    'use strict';

    const targetCSS = `
        /* ========================================== */
        /* 1. СТИЛИ ПАНЕЛИ УПРАВЛЕНИЯ                 */
        /* ========================================== */
        .vjs-default-skin .vjs-control-bar,
        #main-video .vjs-control-bar,
        div.vjs-control-bar {
            background-color: #35363a !important;
            background: #35363a !important;
            color: #ffffff !important;
        }

        /* Полосы прогресса видео и уровня громкости — чистый белый цвет */
        .vjs-default-skin .vjs-play-progress, 
        .vjs-default-skin .vjs-volume-level,
        .video-js .vjs-play-progress,
        .video-js .vjs-volume-level {
            background: #ffffff !important;
            background-color: #ffffff !important;
        }

        /* Плавная подсветка (глоу) ТОЛЬКО для шкалы прогресса видео */
        .vjs-default-skin .vjs-play-progress,
        .video-js .vjs-play-progress {
            transition: box-shadow 0.4s ease, -webkit-box-shadow 0.4s ease !important;
        }

        #main-video:hover .vjs-play-progress,
        .video-js:hover .vjs-play-progress {
            -webkit-box-shadow: 0 0 10px rgba(255, 255, 255, 0.8) !important;
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.8) !important;
        }

        /* Убираем глоу со шкалы звука при любых условиях */
        #main-video:hover .vjs-volume-level,
        .video-js:hover .vjs-volume-level {
            -webkit-box-shadow: none !important;
            box-shadow: none !important;
        }

        /* ========================================== */
        /* 2. ОБЫЧНОЕ СОСТОЯНИЕ КНОПКИ ПЛЕЙ           */
        /* ========================================== */
        #main-video > div.vjs-big-play-button, 
        .vjs-default-skin .vjs-big-play-button,
        .video-js .vjs-big-play-button {
            background: transparent !important;
            background-color: transparent !important;
            border: none !important;
            border-color: transparent !important;
            -webkit-box-shadow: none !important;
            box-shadow: none !important;
            outline: none !important;
            outline-color: transparent !important;
            width: 2em !important;
            height: 2em !important;
            border-radius: 50% !important;
            font-size: 5em !important;
            transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), all 0.4s ease-in-out !important;
        }

        /* Белая стрелочка с черным глоу */
        #main-video > div.vjs-big-play-button:before, 
        .vjs-default-skin .vjs-big-play-button:before,
        .video-js .vjs-big-play-button:before {
            color: #ffffff !important;
            text-shadow: 0 0 12px rgba(0, 0, 0, 1), 
                         0 0 6px rgba(0, 0, 0, 1), 
                         0 0 2px rgba(0, 0, 0, 1) !important;
            transition: all 0.4s ease-in-out !important;
        }

        /* ========================================== */
        /* 3. УВЕЛИЧЕННЫЙ ПЛАВНЫЙ ХОВЕР КНОПКИ ПЛЕЙ   */
        /* ========================================== */
        #main-video:hover > div.vjs-big-play-button,
        .video-js:hover .vjs-big-play-button,
        .vjs-default-skin:hover .vjs-big-play-button,
        div.vjs-big-play-button:hover,
        div.vjs-big-play-button:focus {
            background: transparent !important;
            background-color: transparent !important;
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            transform: scale(1.25) !important; 
        }

        /* Черная стрелочка с белым глоу */
        #main-video:hover > div.vjs-big-play-button:before,
        .video-js:hover .vjs-big-play-button:before,
        .vjs-default-skin:hover .vjs-big-play-button:before,
        div.vjs-big-play-button:hover:before,
        div.vjs-big-play-button:focus:before {
            color: #000000 !important;
            text-shadow: 0 0 14px rgba(255, 255, 255, 1), 
                         0 0 8px rgba(255, 255, 255, 1), 
                         0 0 4px rgba(255, 255, 255, 1) !important;
        }
    `;

    function forceInject(doc) {
        if (!doc) return;
        try {
            let style = doc.querySelector('.custom-tm-player-style');
            if (!style) {
                style = doc.createElement('style');
                style.className = 'custom-tm-player-style';
                const target = doc.documentElement || doc.head || doc.body;
                if (target) {
                    target.appendChild(style);
                }
            }
            if (style.textContent !== targetCSS) {
                style.textContent = targetCSS;
            }
        } catch(e) {}
    }

    forceInject(document);

    setInterval(() => {
        forceInject(document);
    }, 100);

    if (window.top === window.self) {
        setInterval(() => {
            document.querySelectorAll('iframe').forEach(iframe => {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iframeDoc) forceInject(iframeDoc);
                } catch (err) {}
            });
        }, 250);
    }
})();
