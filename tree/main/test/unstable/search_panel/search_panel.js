// ==UserScript==
// @name         Anime 365 — Боковая панель фильтров
// @namespace    http://tampermonkey.net
// @version      7.0
// @description  Выдвижная панель фильтров и компактный режим постеров для каталога Anime 365
// @match        *://smotret-anime.app/*
// @match        *://smotret-anime.org/*
// @match        *://*.smotret-anime.app/*
// @grant        none
// ==/UserScript==
const Anime365Panel = {};
// === БЛОК 1 из 12: Базовая конфигурация, списки годов, типов и статусов ===
(function() {
    'use strict';
    const P = Anime365Panel;
    P.SAVED_CHANGES_KEY = 'anime365_my_filter_saved_changes';
    P.SECTIONS_STORAGE_KEY = 'anime365_panel_sections_state';
    P.DEFAULT_SETTINGS = { side: 'right', posters: 'small', seasons: 'show' };
    P.CURRENT_YEAR = new Date().getFullYear();
    P.MIN_YEAR = 1958;
    P.allYearsDesc = [];
    for (let y = P.CURRENT_YEAR; y >= P.MIN_YEAR; y--) {
        P.allYearsDesc.push(String(y));
    }
    P.recentFiveYears = [];
    for (let i = 0; i < 5; i++) {
        P.recentFiveYears.push(String(P.CURRENT_YEAR - i));
    }
    P.extraYearItems = [
        { label: String(P.CURRENT_YEAR - 5), slug: String(P.CURRENT_YEAR - 5) },
        { label: '2010ые', slug: '2011-2020' },
        { label: '2000ые', slug: '2001-2010' },
        { label: '1990ые', slug: '1991-2000' },
        { label: '1980ые', slug: '1981-1990' },
        { label: '1970ые', slug: '1971-1980' },
        { label: 'Более старые', slug: '1958-1970' }
    ];
    P.filterData = [
        { title: 'Страна', items: ['Япония', 'Китай'] },
        { title: 'Тип', items: ['ТВ сериал', 'Фильм', 'OVA', 'ONA', 'Спешл'] },
        { title: 'Статус', items: ['Онгоинг', 'Доступен'] },
        { title: 'Год', items: P.recentFiveYears },
        { title: 'Жанры', items: [] }
    ];
    P.extraTypeItems = ['Клип', 'ТВ Спешл', 'Реклама'];
    P.myListItems = ['Есть в моем списке', 'Смотрел', 'Запланированно', 'Смотрю', 'Просмотрено', 'Отложено', 'Брошено'];
    P.typeSlugMap = new Map([
        ['ТВ сериал', 'tv'], ['Фильм', 'movie'], ['OVA', 'ova'], ['ONA', 'ona'],
        ['Спешл', 'special'], ['Клип', 'music'], ['ТВ Спешл', 'tv_special'], ['Реклама', 'cm']
    ]);
    P.statusSlugMap = new Map([
        ['Есть в моем списке', '-1'], ['Смотрел', '-2'], ['Запланированно', '0'],
        ['Смотрю', '1'], ['Просмотрено', '2'], ['Отложено', '3'], ['Брошено', '4']
    ]);
})();

// === БЛОК 2 из 12: Подгруппы и полная таблица ID всех жанров ===
(function() {
    'use strict';
    const P = Anime365Panel;
    P.demographyGenres = ['Сёнен', 'Сейнен', 'Сёдзе', 'Дзёсей', 'Детское'];
    P.mainGenres = ['Драма', 'Комедия', 'Романтика', 'Триллер', 'Экшен', 'Ужасы', 'Детектив'];
    P.eroticaGenres = ['Эротика', 'Хентай', 'Сёдзе Ай', 'Сёнен Ай', 'Юри', 'Яой'];
    P.genreSlugMap = new Map([
        ['Экшен', '1'], ['Приключения', '2'], ['Машины', '3'], ['Комедия', '4'],
        ['Безумие', '5'], ['Демоны', '6'], ['Детектив', '7'], ['Драма', '8'],
        ['Этти', '9'], ['Фэнтези', '10'], ['Видеоигры', '11'], ['Хентай', '12'],
        ['Исторический', '13'], ['Ужасы', '14'], ['Детское', '15'], ['Магия', '16'],
        ['Боевые искусства', '17'], ['Меха', '18'], ['Музыка', '19'], ['Пародия', '20'],
        ['Самураи', '21'], ['Романтика', '22'], ['Школа', '23'], ['Фантастика', '24'],
        ['Сёдзе', '25'], ['Сёдзе Ай', '26'], ['Сёнен', '27'], ['Сёнен Ай', '28'],
        ['Космос', '29'], ['Спорт', '30'], ['Супер сила', '31'], ['Вампиры', '32'],
        ['Яой', '33'], ['Юри', '34'], ['Гарем', '35'], ['Повседневность', '36'],
        ['Сверхъестественное', '37'], ['Военное', '38'], ['Полиция', '39'], ['Психологическое', '40'],
        ['Триллер', '41'], ['Сейнен', '42'], ['Дзёсей', '43'], ['Удостоено наград', '46'],
        ['Гурман', '47'], ['Работа', '48'], ['Эротика', '49'], ['Взрослые персонажи', '50'],
        ['Антропоморфизм', '51'], ['CGDCT', '52'], ['Уход за детьми', '53'],
        ['Спортивные единоборства', '54'], ['Правонарушители', '55'], ['Образовательное', '56'],
        ['Гэг юмор', '57'], ['Кровь', '58'], ['Игра с высокими ставками', '59'],
        ['Идолы (девушки)', '60'], ['Идолы (парни)', '61'], ['Исекай', '62'], ['Ияшикей', '63'],
        ['Любовный многоугольник', '64'], ['Смена пола', '65'], ['Махо-сёдзё', '66'], ['Медицина', '67'],
        ['Организованная преступность', '68'], ['Культура отаку', '69'], ['Исполнительское искусство', '70'],
        ['Питомцы', '71'], ['Реинкарнация', '72'], ['Обратный гарем', '73'], ['Романтический подтекст', '74'],
        ['Шоу-бизнес', '75'], ['Выживание', '76'], ['Командный спорт', '77'], ['Путешествие во времени', '78'],
        ['Изобразительное искусство', '80'], ['Кроссдрессинг', '81'], ['Городское фэнтези', '82'],
        ['Злодейки', '83']
    ]);
    const excludedFromThemes = new Set([...P.demographyGenres, ...P.mainGenres, ...P.eroticaGenres]);
    P.themeGenres = Array.from(P.genreSlugMap.keys())
        .filter(name => !excludedFromThemes.has(name))
        .sort((a, b) => a.localeCompare(b, 'ru'));
})();

// === БЛОК 3 из 13: CSS Часть 1 (Каркас панели, скроллбар, заголовки) ===
(function() {
    'use strict';
    const P = Anime365Panel;
    P.cssPart1 = `
        #custom-left-genre-panel-wrapper {
            position: fixed; left: 0; right: auto; width: 306px;
            z-index: 999999 !important; transition: transform 0.3s ease;
            opacity: 1 !important; visibility: visible !important;
        }
        #custom-left-genre-panel-wrapper.collapsed { transform: translateX(-306px); }
        #custom-left-genre-panel-wrapper.side-right { left: auto; right: 0; }
        #custom-left-genre-panel-wrapper.side-right.collapsed { transform: translateX(306px); }
        #custom-left-genre-panel-inner {
            width: 100%; height: 100%; background-color: #1a1a1a; color: #ffffff;
            box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3); overflow-y: auto;
            padding: 15px 16px 60px 6px !important; box-sizing: border-box;
            opacity: 1 !important; visibility: visible !important;
            direction: rtl;
            scrollbar-width: auto; scrollbar-color: transparent transparent;
        }
        #custom-left-genre-panel-inner > * { direction: ltr; }
        #custom-left-genre-panel-wrapper.side-right #custom-left-genre-panel-inner {
            box-shadow: -2px 0 8px rgba(0, 0, 0, 0.3);
            padding: 15px 6px 60px 16px !important;
            direction: ltr;
        }
        #custom-left-genre-panel-inner:hover { scrollbar-color: #666666 transparent; }
        #custom-left-genre-panel-inner::-webkit-scrollbar { width: 18px; }
        #custom-left-genre-panel-inner::-webkit-scrollbar-track { background: transparent; }
        #custom-left-genre-panel-inner::-webkit-scrollbar-thumb {
            background-color: transparent; border-radius: 9px;
            border: 5px solid transparent; background-clip: padding-box;
        }
        #custom-left-genre-panel-inner:hover::-webkit-scrollbar-thumb {
            background-color: #666666; border: 5px solid transparent; background-clip: padding-box;
        }
        .custom-panel-main-title {
            font-size: 16px !important; font-weight: bold !important; text-transform: uppercase !important;
            letter-spacing: 2px !important; color: #b3b3b3 !important; margin: 0 0 12px 5px !important;
            transition: color 0.25s ease, text-shadow 0.25s ease !important;
        }
        #custom-left-genre-panel-inner:hover .custom-panel-main-title {
            color: #ffffff !important; text-shadow: 0 0 8px rgba(255, 255, 255, 0.95), 0 0 16px rgba(255, 255, 255, 0.6) !important;
        }
        .custom-my-filter-header, .custom-my-list-sub-header {
            position: relative !important; display: flex !important; align-items: center !important;
            justify-content: space-between !important; padding: 7px 10px !important;
            background-color: #252525 !important; color: #cccccc !important; border-radius: 4px !important;
            font-size: 15px !important; font-weight: bold !important; text-transform: uppercase !important;
            cursor: pointer !important; user-select: none !important; margin-bottom: 4px !important;
            transition: background-color 0.2s, color 0.2s, text-shadow 0.2s !important;
        }
        .custom-my-list-sub-header.is-collapsed { margin-bottom: 14px !important; }
        .custom-my-filter-header span:first-child, .custom-my-list-sub-header span:first-child {
            font-size: 15px !important; font-weight: bold !important; text-transform: uppercase !important;
        }
        .custom-my-filter-header:not(.is-collapsed), .custom-my-list-sub-header:not(.is-collapsed) { background-color: transparent !important; }
        .custom-my-filter-header:hover, .custom-my-filter-header:not(.is-collapsed):has(+ .custom-my-filter-body:hover),
        .custom-my-list-sub-header:hover, .custom-my-list-sub-header:not(.is-collapsed):has(+ .custom-my-list-sub-body:hover) {
            color: #ffffff !important; text-shadow: 0 0 6px rgba(255, 255, 255, 0.9), 0 0 12px rgba(255, 255, 255, 0.5) !important;
        }
        .custom-my-filter-header.is-collapsed:hover, .custom-my-list-sub-header.is-collapsed:hover { background-color: #333333 !important; }
        .custom-my-filter-arrow, .custom-my-list-sub-arrow {
            font-size: 10px !important; color: #ffffff !important; opacity: 0 !important;
            transition: opacity 0.3s ease, transform 0.25s ease !important; pointer-events: none !important;
        }
        .custom-my-filter-header:hover .custom-my-filter-arrow, .custom-my-list-sub-header:hover .custom-my-list-sub-arrow { opacity: 1 !important; }
        .custom-my-filter-header.is-collapsed .custom-my-filter-arrow, .custom-my-list-sub-header.is-collapsed .custom-my-list-sub-arrow { transform: rotate(180deg) !important; }
    `;
})();
// === БЛОК 4 из 12: CSS Часть 2 (Мой фильтр, Настройки панели, Года, Диапазоны) ===
(function() {
    'use strict';
    const P = Anime365Panel;
    P.cssPart2 = `
        .custom-my-filter-tooltip {
            position: fixed !important; background-color: rgba(15, 15, 15, 0.95) !important; color: #ffffff !important;
            padding: 4px 9px !important; border-radius: 4px !important; font-size: 12px !important; font-weight: normal !important;
            text-shadow: none !important; white-space: nowrap !important; border: 1px solid #444444 !important;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6) !important; z-index: 1000020 !important; pointer-events: none !important;
            opacity: 0 !important; visibility: hidden !important; transition: opacity 0.2s ease, visibility 0.2s ease !important;
        }
        .custom-my-filter-tooltip.show { opacity: 1 !important; visibility: visible !important; }
        .custom-my-filter-body { display: flex !important; flex-direction: column !important; gap: 5px !important; margin-bottom: 4px !important; }
        .custom-my-list-sub-body { display: flex !important; flex-direction: column !important; gap: 5px !important; margin-bottom: 14px !important; }
        .custom-my-filter-body.hidden, .custom-my-list-sub-body.hidden, .custom-view-mode-sub.hidden, .custom-changes-body.hidden,
        .custom-genres-list.hidden, .custom-type-extra-list.hidden, .custom-type-expand-btn.hidden, .custom-section-collapse-btn.hidden,
        .custom-show-changes-btn.hidden, .custom-year-dropdown.hidden, .custom-year-action-row.hidden,
        .custom-range-box.hidden, .custom-range-action-row.hidden, .custom-range-select-list.hidden,
        .custom-year-selected-label.hidden, .custom-year-pick-other-btn.hidden, .custom-year-inline-cancel.hidden,
        .custom-erotica-body.hidden, .custom-subgroup-body.hidden,
        .custom-themes-floating-collapse.hidden { display: none !important; }
        .custom-my-filter-btn {
            padding: 6px 10px !important; background-color: #2a2a2a !important; color: #b3b3b3 !important;
            border-radius: 4px !important; font-size: 14px !important; font-weight: normal !important;
            cursor: pointer !important; user-select: none !important; transition: background-color 0.2s, color 0.2s, text-shadow 0.2s, box-shadow 0.2s !important;
        }
        .custom-my-filter-btn:hover { background-color: #3a3a3a !important; color: #ffffff !important; text-shadow: 0 0 6px rgba(255, 255, 255, 0.9), 0 0 12px rgba(255, 255, 255, 0.5) !important; }
        .custom-my-filter-btn.save-btn {
            text-align: center !important; font-weight: bold !important; letter-spacing: 0.5px !important;
            background-color: #23282e !important; color: #7e8d9c !important; text-shadow: none !important;
        }
        .custom-my-filter-btn.save-btn:hover { background-color: #2f363e !important; color: #ffffff !important; text-shadow: none !important; }
        .custom-my-filter-btn.save-btn.needs-save {
            background-color: #264866 !important; color: #ffffff !important;
            text-shadow: 0 0 6px rgba(255, 255, 255, 0.85) !important;
            box-shadow: 0 0 10px rgba(74, 144, 226, 0.55) !important;
        }
        .custom-my-filter-btn.save-btn.needs-save:hover { background-color: #315d85 !important; color: #ffffff !important; text-shadow: none !important; }
        .custom-show-changes-btn { text-align: center !important; font-weight: bold !important; letter-spacing: 0.5px !important; background-color: #22303c !important; color: #dceeff !important; }
        .custom-show-changes-btn:hover { background-color: #2c4254 !important; color: #ffffff !important; }
        .custom-changes-body {
            display: flex !important; flex-direction: column !important; gap: 5px !important;
            padding: 8px !important; background-color: #222222 !important; border: 1px solid #333333 !important; border-radius: 4px !important;
        }
        .custom-change-row {
            display: flex !important; align-items: center !important; justify-content: space-between !important;
            padding: 5px 8px !important; background-color: #2b2b2b !important; color: #e0e0e0 !important; border-radius: 4px !important; font-size: 13px !important;
        }
        .custom-change-cancel-x {
            display: inline-flex !important; align-items: center !important; justify-content: center !important;
            width: 20px !important; height: 20px !important; border-radius: 3px !important;
            background-color: #1a1a1a !important; color: #e74c3c !important; font-weight: bold !important;
            font-size: 12px !important; cursor: pointer !important; user-select: none !important; transition: background-color 0.2s, color 0.2s !important;
        }
        .custom-change-cancel-x:hover { background-color: #e74c3c !important; color: #ffffff !important; }
        .custom-reset-all-btn {
            align-self: center !important; margin-top: 6px !important; padding: 6px 14px !important;
            background-color: #6b1d24 !important; color: #ffd6da !important; border-radius: 4px !important;
            font-size: 12px !important; font-weight: bold !important; letter-spacing: 0.5px !important;
            cursor: pointer !important; user-select: none !important; text-align: center !important; transition: background-color 0.2s, color 0.2s !important;
        }
        .custom-reset-all-btn:hover { background-color: #8c242e !important; color: #ffffff !important; }
        .custom-view-mode-sub {
            display: flex !important; flex-direction: column !important; gap: 4px !important;
            padding: 6px 6px 6px 10px !important; background-color: #202020 !important; border-radius: 4px !important;
        }
        .custom-view-sub-heading {
            font-size: 12px !important; font-weight: bold !important; color: #8c9ba5 !important;
            margin: 4px 0 2px 2px !important; letter-spacing: 0.3px !important;
        }
        .custom-view-mode-option {
            display: flex !important; align-items: center !important; justify-content: space-between !important;
            padding: 5px 10px !important; background-color: #262626 !important; color: #999999 !important;
            border-radius: 4px !important; font-size: 13px !important; cursor: pointer !important; user-select: none !important;
            transition: background-color 0.2s, color 0.2s, text-shadow 0.2s !important;
        }
        .custom-view-mode-option:hover { background-color: #333333 !important; color: #ffffff !important; text-shadow: 0 0 6px rgba(255, 255, 255, 0.85) !important; }
        .custom-view-mode-option.active {
            background-color: #202020 !important; color: #ffffff !important;
            text-shadow: 0 0 6px rgba(255, 255, 255, 0.85), 0 0 12px rgba(255, 255, 255, 0.45) !important;
        }
        .custom-view-option-check {
            display: inline-flex !important; align-items: center !important; justify-content: center !important;
            width: 18px !important; height: 18px !important; border-radius: 3px !important;
            background-color: #2ecc71 !important; color: #ffffff !important; font-size: 11px !important; font-weight: bold !important;
            text-shadow: none !important; opacity: 0 !important;
        }
        .custom-view-mode-option.active .custom-view-option-check { opacity: 1 !important; }
        .custom-year-selected-label { font-size: 12px !important; color: #999999 !important; margin: 2px 0 -2px 4px !important; }
        .custom-year-action-row, .custom-range-action-row {
            display: flex !important; align-items: stretch !important; gap: 5px !important; width: 100% !important;
        }
        .custom-year-action-row > .custom-genre-item,
        .custom-range-action-row > .custom-genre-item,
        .custom-range-action-row > .custom-range-update-btn {
            flex: 1 !important; min-width: 0 !important;
        }
        .custom-year-pick-item, .custom-range-apply-item {
            background-color: #2f363e !important; color: #dceeff !important;
        }
        .custom-year-pick-item:hover, .custom-range-apply-item:hover {
            background-color: #3c4550 !important; color: #ffffff !important;
        }
        .custom-year-pick-item.active, .custom-year-pick-item.state-check,
        .custom-range-apply-item.active, .custom-range-apply-item.state-check {
            background-color: #26313c !important; color: #ffffff !important;
        }
        .custom-wide-trash-btn {
            display: inline-flex !important; align-items: center !important; justify-content: center !important;
            width: 38px !important; min-width: 38px !important; background-color: #3a1f22 !important; color: #ff6b6b !important;
            border-radius: 4px !important; font-size: 16px !important; cursor: pointer !important; user-select: none !important;
            transition: background-color 0.2s, color 0.2s, box-shadow 0.2s !important;
        }
        .custom-wide-trash-btn:hover {
            background-color: #6b1d24 !important; color: #ffffff !important;
            box-shadow: 0 0 8px rgba(255, 107, 107, 0.65) !important;
        }
        .custom-wide-trash-btn.hidden { display: none !important; }
        .custom-year-inline-cancel {
            position: absolute !important; right: 8px !important; top: 50% !important; transform: translateY(-50%) !important;
            padding: 2px 7px !important; background-color: #6b1d24 !important; color: #ffd6da !important;
            border-radius: 3px !important; font-size: 11px !important; font-weight: bold !important;
            text-shadow: none !important; cursor: pointer !important; z-index: 2 !important;
        }
        .custom-year-inline-cancel:hover { background-color: #8c242e !important; color: #ffffff !important; }
        .custom-year-pick-other-btn {
        align-self: flex-start !important; padding: 3px 9px !important; font-size: 12px !important;
color: #cccccc !important; background-color: #252525 !important; border-radius: 3px !important;
cursor: pointer !important; user-select: none !important;
}
.custom-year-pick-other-btn:hover { background-color: #343434 !important; color: #ffffff !important; }
.custom-year-dropdown {
max-height: 155px !important; overflow-y: auto !important; background-color: #222222 !important;
border: 1px solid #383838 !important; border-radius: 4px !important; padding: 4px !important;
display: flex !important; flex-direction: column !important; gap: 2px !important;
}
.custom-year-dropdown::-webkit-scrollbar { width: 5px; }
.custom-year-dropdown::-webkit-scrollbar-thumb { background-color: #555555; border-radius: 3px; }
.custom-year-option {
padding: 4px 8px !important; border-radius: 3px !important; font-size: 13px !important;
color: #bbbbbb !important; cursor: pointer !important; user-select: none !important;
transition: background-color 0.15s, color 0.15s !important;
}
.custom-year-option:hover { background-color: #353535 !important; color: #ffffff !important; }
.custom-year-option.selected { background-color: #2c4a66 !important; color: #ffffff !important; font-weight: bold !important; text-shadow: 0 0 6px rgba(255, 255, 255, 0.8) !important; }
.custom-range-toggle-btn {
padding: 6px 10px !important; background-color: #2f363e !important; color: #dceeff !important;
border-radius: 4px !important; font-size: 13px !important; cursor: pointer !important;
user-select: none !important; text-align: center !important; transition: background-color 0.2s, color 0.2s, text-shadow 0.2s !important;
}
.custom-range-toggle-btn:hover { background-color: #3c4550 !important; color: #ffffff !important; text-shadow: 0 0 6px rgba(255, 255, 255, 0.85) !important; }
.custom-range-box {
display: flex !important; flex-direction: column !important; gap: 6px !important;
padding: 8px !important; background-color: #222222 !important; border: 1px solid #353535 !important; border-radius: 4px !important;
}
.custom-range-row { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 8px !important; }
.custom-range-label { font-size: 13px !important; color: #bbbbbb !important; min-width: 24px !important; }
.custom-range-select-btn {
flex: 1 !important; padding: 5px 8px !important; background-color: #2c2c2c !important; color: #e0e0e0 !important;
border: 1px solid #444444 !important; border-radius: 4px !important; font-size: 13px !important;
cursor: pointer !important; user-select: none !important; text-align: left !important;
display: flex !important; align-items: center !important; justify-content: space-between !important;
}
.custom-range-select-btn:hover { background-color: #383838 !important; color: #ffffff !important; }
.custom-range-select-list {
max-height: 130px !important; overflow-y: auto !important; background-color: #1c1c1c !important;
border: 1px solid #444444 !important; border-radius: 4px !important; padding: 3px !important;
display: flex !important; flex-direction: column !important; gap: 2px !important;
}
.custom-range-select-list::-webkit-scrollbar { width: 5px; }
.custom-range-select-list::-webkit-scrollbar-thumb { background-color: #555555; border-radius: 3px; }
.custom-range-update-btn {
padding: 6px 10px !important; background-color: #264866 !important; color: #ffffff !important;
border-radius: 4px !important; font-size: 13px !important; font-weight: bold !important;
cursor: pointer !important; user-select: none !important; text-align: center !important;
display: flex !important; align-items: center !important; justify-content: center !important;
}
.custom-range-update-btn:hover { background-color: #315d85 !important; }
`;
})();

// === БЛОК 5 из 12: CSS Часть 3 (Вертикальное выравнивание заголовков, Темы, 18+, Корзина) ===
(function() {
    'use strict';
    const P = Anime365Panel;
    P.cssPart3 = `
        .custom-heading-controls { display: inline-flex !important; align-items: center !important; gap: 8px !important; line-height: 1 !important; }
        .custom-heading-controls .custom-heading-state-label { order: 1 !important; }
        .custom-heading-controls .custom-trash-btn { order: 2 !important; }
        .custom-heading-state-label {
            display: inline-flex !important; align-items: center !important; line-height: 1 !important;
            font-size: 11px !important; font-weight: normal !important; text-transform: uppercase !important;
            color: #d0dce6 !important; opacity: 0 !important; letter-spacing: 0.4px !important;
            transition: opacity 0.2s ease, color 0.2s ease !important; pointer-events: none !important;
        }
        .custom-genre-heading.has-collapse-control:hover .custom-heading-state-label,
        .custom-genre-subgroup-header:hover .custom-heading-state-label,
        .custom-erotica-header:hover .custom-heading-state-label { opacity: 1 !important; color: #ffffff !important; }
        .custom-trash-btn {
            display: none !important; align-items: center !important; justify-content: center !important;
            width: 24px !important; height: 24px !important; border-radius: 4px !important; line-height: 1 !important;
            font-size: 16px !important; color: inherit !important; cursor: pointer !important;
            text-shadow: none !important;
            transition: color 0.2s ease, background-color 0.2s ease, text-shadow 0.2s ease, transform 0.15s ease !important;
        }
        .custom-trash-btn.has-active { display: inline-flex !important; }
        .custom-trash-btn.has-active:hover {
            background-color: #4a1c20 !important; color: #ff5252 !important; transform: scale(1.08) !important;
            text-shadow: 0 0 8px rgba(255, 82, 82, 0.9) !important;
        }
        .custom-subgroup-wrapper { display: flex !important; flex-direction: column !important; margin-top: 4px !important; }
        .custom-genre-subgroup-header, .custom-erotica-header {
            display: flex !important; align-items: center !important; justify-content: space-between !important;
            min-height: 32px !important; box-sizing: border-box !important; line-height: 1 !important;
            padding: 6px 10px !important; margin: 2px 0 !important; border-radius: 4px !important;
            background-color: #2f363e !important; color: #ffffff !important;
            font-size: 13px !important; font-weight: bold !important;
            letter-spacing: 0.4px !important; text-transform: uppercase !important;
            cursor: pointer !important; user-select: none !important;
            transition: background-color 0.2s ease, color 0.2s ease, text-shadow 0.2s ease !important;
        }
        .custom-genre-subgroup-header > span:first-child,
        .custom-erotica-header > span:first-child,
        .custom-genre-heading > span:first-child {
            display: inline-flex !important; align-items: center !important; line-height: 1 !important;
        }
        .custom-genre-subgroup-header:hover,
        .custom-subgroup-wrapper:has(> .custom-subgroup-body:hover) > .custom-genre-subgroup-header,
        .custom-erotica-header:hover,
        .custom-subgroup-wrapper:has(> .custom-erotica-body:hover) > .custom-erotica-header {
            background-color: #3c4550 !important; color: #ffffff !important;
            text-shadow: 0 0 6px rgba(255, 255, 255, 0.85) !important;
        }
        .custom-subgroup-body, .custom-erotica-body { display: flex !important; flex-direction: column !important; gap: 5px !important; margin-top: 4px !important; }
        .custom-themes-scroll-box {
            max-height: 306px !important; overflow-y: auto !important;
            display: flex !important; flex-direction: column !important; gap: 5px !important;
            padding-right: 3px !important; position: relative !important;
        }
        .custom-themes-scroll-box.expanded-all { max-height: none !important; overflow-y: visible !important; }
        .custom-themes-scroll-box::-webkit-scrollbar { width: 5px; }
        .custom-themes-scroll-box::-webkit-scrollbar-thumb { background-color: #555555; border-radius: 3px; }
        .custom-themes-sticky-footer {
            position: sticky !important; bottom: 0 !important; z-index: 4 !important;
            background-color: #1f1f1f !important; border-top: 1px solid #333333 !important;
            padding: 8px 10px !important; text-align: center !important;
            font-size: 13px !important; font-weight: normal !important; text-transform: uppercase !important;
            letter-spacing: 0.5px !important; color: #cccccc !important;
            border-radius: 0 0 4px 4px !important; cursor: pointer !important; user-select: none !important;
            transition: background-color 0.2s, color 0.2s, text-shadow 0.2s !important;
        }
        .custom-themes-scroll-box:hover .custom-themes-sticky-footer,
        .custom-themes-sticky-footer:hover {
            background-color: #264866 !important; color: #ffffff !important;
            text-shadow: 0 0 6px rgba(255, 255, 255, 0.85) !important;
        }
        .custom-themes-scroll-box.expanded-all .custom-themes-sticky-footer {
            position: static !important; border: 1px solid #355a7a !important; border-radius: 4px !important;
        }
        .custom-themes-scroll-box.expanded-all .custom-themes-sticky-footer.floating-bottom {
            position: fixed !important; bottom: 6px !important; z-index: 1000005 !important;
            background-color: #264866 !important; border: 1px solid #3c6c96 !important; color: #ffffff !important;
            box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.75) !important;
        }
        .custom-themes-floating-collapse.top {
            position: fixed !important; z-index: 1000005 !important;
            background-color: #264866 !important; border: 1px solid #3c6c96 !important;
            padding: 8px 10px !important; text-align: center !important;
            font-size: 13px !important; font-weight: normal !important; text-transform: uppercase !important;
            letter-spacing: 0.5px !important; color: #ffffff !important;
            border-radius: 4px !important; cursor: pointer !important; user-select: none !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.75) !important;
            transition: background-color 0.2s, text-shadow 0.2s !important;
        }
        .custom-themes-floating-collapse.top:hover {
            background-color: #315d85 !important;
            text-shadow: 0 0 6px rgba(255, 255, 255, 0.85) !important;
        }
        .custom-genre-section { margin-bottom: 4px !important; }
        .custom-genre-heading {
            min-height: 34px !important; box-sizing: border-box !important; line-height: 1 !important;
            font-size: 14px !important; text-transform: uppercase !important;
            background-color: #23282e !important; color: #ffffff !important;
            margin: 4px 0 4px 0 !important; padding: 7px 10px !important; border-radius: 4px !important;
            font-weight: bold !important; letter-spacing: 0.5px !important;
            transition: background-color 0.2s ease, color 0.2s ease, text-shadow 0.2s ease !important;
        }
        .custom-genre-heading.has-collapse-control { display: flex !important; align-items: center !important; justify-content: space-between !important; cursor: pointer !important; user-select: none !important; }
        .custom-genre-heading:hover,
        .custom-genre-section:has(> .custom-genres-list:hover) > .custom-genre-heading {
            background-color: #264866 !important; color: #ffffff !important;
            text-shadow: 0 0 6px rgba(255, 255, 255, 0.85) !important;
        }
        .custom-genres-list, .custom-type-extra-list { display: flex !important; flex-direction: column !important; gap: 5px !important; padding: 0; margin: 0 0 4px 0 !important; list-style: none; }
        .custom-genre-item {
            display: flex; align-items: center; justify-content: space-between; padding: 6px 60px 6px 10px;
            background-color: #2a2a2a; color: #b3b3b3; border-radius: 4px; font-size: 14px !important; font-weight: normal !important;
            cursor: pointer; transition: background 0.2s, color 0.2s, text-shadow 0.2s; user-select: none; position: relative; width: 100%; box-sizing: border-box;
        }
        .custom-genre-item.no-checks { padding-right: 10px !important; }
        .custom-genre-item.no-checks::before, .custom-genre-item.no-checks::after { display: none !important; }
        .custom-genre-item:hover { background-color: #3a3a3a; color: #ffffff !important; text-shadow: 0 0 6px rgba(255, 255, 255, 0.9), 0 0 12px rgba(255, 255, 255, 0.5) !important; }
        .custom-genre-item.active, .custom-genre-item.state-check {
            background-color: #202020; color: #ffffff; font-weight: normal !important;
            text-shadow: 0 0 6px rgba(255, 255, 255, 0.85), 0 0 12px rgba(255, 255, 255, 0.45); box-shadow: none;
        }
        .custom-genre-item::before, .custom-genre-item::after {
            position: absolute; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; background-color: #1a1a1a;
            color: #555; border-radius: 3px; display: flex; align-items: center; justify-content: center;
            font-size: 11px; font-weight: bold; text-shadow: none !important; transition: background 0.2s, color 0.2s;
        }
        .custom-genre-item::before { content: '✓'; right: 32px; }
        .custom-genre-item::after { content: '✗'; right: 8px; }
        .custom-genre-item.state-check::before { background-color: #2ecc71 !important; color: #fff !important; }
        .custom-genre-item.state-cross::after { background-color: #e74c3c !important; color: #fff !important; }
.genre-panel-toggle {
position: absolute; top: 50%; left: 306px; right: auto; transform: translateY(-50%); width: 40px; height: 40px;
background-color: rgba(0, 0, 0, 0) !important; border: none !important; border-radius: 50%; cursor: pointer;
display: flex; align-items: center; justify-content: center; z-index: 1000000;
box-shadow: 0 0 15px 5px rgba(0, 0, 0, 0) !important; padding: 0; opacity: 0.4;
transition: opacity 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease, visibility 0.3s ease;
}
#custom-left-genre-panel-wrapper.side-right .genre-panel-toggle { left: auto; right: 306px; }
.genre-panel-toggle:hover, .genre-panel-toggle.force-glow { opacity: 1 !important; background-color: rgba(0, 0, 0, 1) !important; box-shadow: 0 0 14px 6px rgba(0, 0, 0, 0.65) !important; }
.genre-panel-toggle::after {
content: ''; display: inline-block; width: 9px; height: 9px; border-top: 3px solid #b3b3b3; border-right: 3px solid #b3b3b3;
transform: rotate(225deg); transition: transform 0.3s ease, filter 0.2s ease, border-color 0.2s ease; margin-left: 5px;
}
#custom-left-genre-panel-wrapper.collapsed .genre-panel-toggle::after,
#custom-left-genre-panel-wrapper.side-right .genre-panel-toggle::after { transform: rotate(45deg); margin-left: -3px; }
#custom-left-genre-panel-wrapper.side-right.collapsed .genre-panel-toggle::after { transform: rotate(225deg); margin-left: 5px; }
.genre-panel-toggle:hover::after, .genre-panel-toggle.force-glow::after {
border-color: #ffffff !important; filter: drop-shadow(0 0 2px #fff) drop-shadow(0 0 6px #fff) drop-shadow(0 0 12px #fff) !important;
}
body.genre-panel-open > div.body-container { transition: padding-left 0.3s ease, padding-right 0.3s ease !important; padding-left: 306px !important; padding-right: 0px !important; box-sizing: border-box !important; }
body.genre-panel-open.genre-panel-is-collapsed > div.body-container { padding-left: 0px !important; }
body.genre-panel-open.genre-panel-side-right > div.body-container { padding-left: 0px !important; padding-right: 306px !important; }
body.genre-panel-open.genre-panel-side-right.genre-panel-is-collapsed > div.body-container { padding-right: 0px !important; }
#genre-panel-hover-zone { position: fixed; left: 0; right: auto; width: 18px; z-index: 999998; pointer-events: none; }
#genre-panel-hover-zone.side-right { left: auto; right: 0; }
#custom-left-genre-panel-wrapper.collapsed ~ #genre-panel-hover-zone { pointer-events: auto; }
.custom-type-expand-btn, .custom-section-collapse-btn {
display: flex !important; align-items: center !important; justify-content: flex-end !important; gap: 6px !important;
padding: 4px 10px !important; background-color: transparent !important; color: #777777 !important; border-radius: 4px !important;
font-size: 12px !important; font-weight: normal !important; cursor: pointer !important; user-select: none !important; transition: color 0.2s !important;
}
.custom-type-expand-label, .custom-section-collapse-label { opacity: 0 !important; font-weight: normal !important; transition: opacity 0.25s ease, color 0.2s ease !important; }
.custom-genre-section[data-section="Страна"]:hover .custom-section-collapse-label,
.custom-genre-section[data-section="Статус"]:hover .custom-section-collapse-label,
.custom-genre-section:hover .custom-type-expand-label,
.custom-type-expand-btn:hover .custom-type-expand-label,
.custom-my-filter-body:hover .custom-section-collapse-label,
.custom-my-list-sub-body:hover .custom-section-collapse-label,
.custom-subgroup-body:hover .custom-section-collapse-label,
.custom-erotica-body:hover .custom-section-collapse-label,
.custom-section-collapse-btn:hover .custom-section-collapse-label { opacity: 1 !important; }
.custom-type-expand-btn:hover, .custom-type-expand-btn:hover .custom-type-expand-label,
.custom-section-collapse-btn:hover, .custom-section-collapse-btn:hover .custom-section-collapse-label {
background-color: transparent !important; color: #cccccc !important; font-weight: normal !important; text-shadow: none !important;
}
.custom-type-expand-arrow, .custom-section-collapse-arrow { font-size: 10px !important; color: #cccccc !important; opacity: 0 !important; transition: opacity 0.3s ease, transform 0.25s ease !important; pointer-events: none !important; }
.custom-type-expand-btn:hover .custom-type-expand-arrow, .custom-section-collapse-btn:hover .custom-section-collapse-arrow { opacity: 1 !important; }
.custom-type-expand-btn.is-collapsed .custom-type-expand-arrow { transform: rotate(180deg) !important; }
body.anime365-hide-seasons .card-content .season,
body.anime365-hide-seasons .m-catalog-item .season,
body.anime365-hide-seasons .season-title {
display: none !important;
}
`;
})();

// === БЛОК 6 из 12: Хранилище состояний, режимы панели/постеров/сезонов, подсказки и хелперы DOM ===
(function() {
    'use strict';
    const P = Anime365Panel;
    P.loadSectionsState = function() {
        try {
            const raw = sessionStorage.getItem(P.SECTIONS_STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    };
    P.saveSectionState = function(key, isExpanded) {
        try {
            const current = P.loadSectionsState();
            current[key] = isExpanded;
            sessionStorage.setItem(P.SECTIONS_STORAGE_KEY, JSON.stringify(current));
        } catch (e) {}
    };
    P.getSavedChanges = function() {
        try {
            const raw = localStorage.getItem(P.SAVED_CHANGES_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    };
    P.setSavedChanges = function(changesObj) {
        try {
            if (!changesObj || Object.keys(changesObj).length === 0) {
                localStorage.removeItem(P.SAVED_CHANGES_KEY);
            } else {
                localStorage.setItem(P.SAVED_CHANGES_KEY, JSON.stringify(changesObj));
            }
        } catch (e) {}
    };
    P.getActivePanelSide = function() {
        const saved = P.getSavedChanges();
        if (saved.side === 'left' || saved.side === 'right') return saved.side;
        return P.DEFAULT_SETTINGS.side;
    };
    P.getActivePostersMode = function() {
        const saved = P.getSavedChanges();
        if (saved.posters === 'small' || saved.posters === 'normal') return saved.posters;
        return P.DEFAULT_SETTINGS.posters;
    };
    P.getActiveSeasonsMode = function() {
        const saved = P.getSavedChanges();
        if (saved.seasons === 'hide' || saved.seasons === 'show') return saved.seasons;
        return P.DEFAULT_SETTINGS.seasons;
    };
    P.applyPanelSide = function(side) {
        const isRight = side === 'right';
        const wrapperEl = document.getElementById('custom-left-genre-panel-wrapper');
        const hoverZoneEl = document.getElementById('genre-panel-hover-zone');
        if (wrapperEl) wrapperEl.classList.toggle('side-right', isRight);
        if (hoverZoneEl) hoverZoneEl.classList.toggle('side-right', isRight);
        document.body.classList.toggle('genre-panel-side-right', isRight);
    };
    P.applyPostersMode = function(mode) {
        const isSmall = mode === 'small';
        document.body.classList.toggle('anime365-small-posters', isSmall);
        window.dispatchEvent(new CustomEvent('anime365_posters_mode_change', { detail: { mode } }));
        if (typeof P.refreshSmallPosters === 'function') {
            P.refreshSmallPosters(isSmall);
        }
    };
    P.applySeasonsVisibility = function(mode) {
        document.body.classList.toggle('anime365-hide-seasons', mode === 'hide');
    };
    P.getOrCreateTooltip = function() {
        let tooltip = document.getElementById('custom-my-filter-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'custom-my-filter-tooltip';
            tooltip.className = 'custom-my-filter-tooltip';
            document.body.appendChild(tooltip);
        }
        return tooltip;
    };
    P.positionTooltipNearElement = function(targetEl, tooltip) {
        const rect = targetEl.getBoundingClientRect();
        const isRightSide = document.body.classList.contains('genre-panel-side-right');
        if (isRightSide) {
            tooltip.style.left = Math.max(8, rect.left - tooltip.offsetWidth - 10) + 'px';
        } else {
            tooltip.style.left = (rect.right + 10) + 'px';
        }
        tooltip.style.top = (rect.top + rect.height / 2 - tooltip.offsetHeight / 2) + 'px';
    };
    P.attachDelayedTooltip = function(targetEl, getTextFn) {
        const tooltip = P.getOrCreateTooltip();
        let localTimer = null;
        targetEl.addEventListener('mouseenter', () => {
            clearTimeout(localTimer);
            localTimer = setTimeout(() => {
                tooltip.textContent = getTextFn();
                P.positionTooltipNearElement(targetEl, tooltip);
                tooltip.classList.add('show');
            }, 500);
        });
        targetEl.addEventListener('mouseleave', () => {
            clearTimeout(localTimer);
            tooltip.classList.remove('show');
        });
        return () => {
            if (tooltip.classList.contains('show')) {
                tooltip.textContent = getTextFn();
                P.positionTooltipNearElement(targetEl, tooltip);
            }
        };
    };
    P.createCollapseGroupButton = function(onCollapseFn) {
        const btn = document.createElement('div');
        btn.className = 'custom-section-collapse-btn';
        const lbl = document.createElement('span');
        lbl.className = 'custom-section-collapse-label';
        lbl.textContent = 'Свернуть';
        const arr = document.createElement('span');
        arr.className = 'custom-section-collapse-arrow';
        arr.textContent = '▲';
        btn.appendChild(lbl);
        btn.appendChild(arr);
        btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onCollapseFn(); });
        return btn;
    };
})();
// === БЛОК 7 из 12: Синхронизация URL (genre= для демографии/основных, genre@= для тем и 18+, защита Эротики) ===
(function() {
    'use strict';
    const P = Anime365Panel;
    function normalizeGenreId(rawSlug) {
        return rawSlug === '49_erotica' ? '49' : rawSlug;
    }
    P.updateFilterUrl = function(innerPanel) {
        const includedTypes = [];
        const excludedTypes = [];
        const includedStatuses = [];
        const excludedStatuses = [];
        const includedYears = [];
        const excludedYears = [];
        const includedGenresOr = [];
        const includedGenresAnd = [];
        const excludedGenres = [];
        let airingParam = null;
        let activeParam = null;
        innerPanel.querySelectorAll('.custom-genre-item').forEach(el => {
            if (el.classList.contains('no-checks')) return;
            const typeSlug = el.dataset.typeSlug;
            const statusSlug = el.dataset.statusSlug;
            const yearSlug = el.dataset.yearSlug;
            const genreSlug = el.dataset.genreSlug;
            const isAndGenre = el.dataset.isTheme === '1';
            const role = el.dataset.filterRole;
            if (typeSlug) {
                if (el.classList.contains('state-check')) includedTypes.push(typeSlug);
                else if (el.classList.contains('state-cross')) excludedTypes.push(typeSlug);
            } else if (statusSlug) {
                if (el.classList.contains('state-check')) includedStatuses.push(statusSlug);
                else if (el.classList.contains('state-cross')) excludedStatuses.push(statusSlug);
            } else if (yearSlug) {
                if (el.classList.contains('state-check')) includedYears.push(yearSlug);
                else if (el.classList.contains('state-cross')) excludedYears.push(yearSlug);
            } else if (genreSlug) {
                const cleanId = normalizeGenreId(genreSlug);
                if (el.classList.contains('state-check')) {
                    if (isAndGenre) includedGenresAnd.push(cleanId);
                    else includedGenresOr.push(cleanId);
                } else if (el.classList.contains('state-cross')) {
                    excludedGenres.push(cleanId);
                }
            } else if (role === 'ongoing') {
                if (el.classList.contains('state-check')) airingParam = 'isAiring=1';
                else if (el.classList.contains('state-cross')) airingParam = 'isAiring=0';
            } else if (role === 'active') {
                if (el.classList.contains('state-check')) activeParam = 'isActive=1';
                else if (el.classList.contains('state-cross')) activeParam = 'isActive=0';
            }
        });
        const uniqueTypesIn = Array.from(new Set(includedTypes)).sort();
        const uniqueTypesEx = Array.from(new Set(excludedTypes)).sort();
        const uniqueStatusesIn = Array.from(new Set(includedStatuses));
        const uniqueStatusesEx = Array.from(new Set(excludedStatuses));
        const uniqueYearsIn = Array.from(new Set(includedYears));
        const uniqueYearsEx = Array.from(new Set(excludedYears));
        const uniqueGenresOr = Array.from(new Set(includedGenresOr));
        const uniqueGenresAnd = Array.from(new Set(includedGenresAnd));
        const uniqueGenresEx = Array.from(new Set(excludedGenres));
        const parts = [];
        if (uniqueTypesEx.length > 0) parts.push('type!=' + uniqueTypesEx.join(','));
        if (uniqueTypesIn.length > 0) parts.push('type=' + uniqueTypesIn.join(','));
        if (airingParam) parts.push(airingParam);
        if (activeParam) parts.push(activeParam);
        if (uniqueStatusesEx.length > 0) parts.push('status!=' + uniqueStatusesEx.join(','));
        if (uniqueStatusesIn.length > 0) parts.push('status=' + uniqueStatusesIn.join(','));
        if (uniqueYearsEx.length > 0) parts.push('yearseason!=' + uniqueYearsEx.join(','));
        if (uniqueYearsIn.length > 0) parts.push('yearseason=' + uniqueYearsIn.join(','));
        if (uniqueGenresEx.length > 0) parts.push('genre!=' + uniqueGenresEx.join(','));
        if (uniqueGenresOr.length > 0) parts.push('genre=' + uniqueGenresOr.join(','));
        if (uniqueGenresAnd.length > 0) parts.push('genre@=' + uniqueGenresAnd.join(','));
        if (typeof P.refreshAllTrashStates === 'function') {
            P.refreshAllTrashStates(innerPanel);
        }
        const targetUrl = parts.length > 0 ? '/catalog/filter/' + parts.join(';') : '/catalog/filter/';
        window.history.pushState(null, null, targetUrl);
        window.dispatchEvent(new Event('popstate'));
    };
    P.syncStatesFromUrl = function(innerPanel) {
        const path = decodeURIComponent(window.location.pathname);
        const includedTypes = new Set();
        const excludedTypes = new Set();
        const includedStatuses = new Set();
        const excludedStatuses = new Set();
        const includedYears = new Set();
        const excludedYears = new Set();
        const includedGenres = new Set();
        const excludedGenres = new Set();
        let airingState = null;
        let activeState = null;
        const filterMarker = '/catalog/filter/';
        const markerPos = path.indexOf(filterMarker);
        if (markerPos !== -1) {
            const rawQuery = path.slice(markerPos + filterMarker.length);
            rawQuery.split(';').forEach(seg => {
                const cleanSeg = seg.trim();
                if (cleanSeg.startsWith('type!=')) {
                    cleanSeg.slice(6).split(',').forEach(val => { if (val.trim()) excludedTypes.add(val.trim()); });
                } else if (cleanSeg.startsWith('type=')) {
                    cleanSeg.slice(5).split(',').forEach(val => { if (val.trim()) includedTypes.add(val.trim()); });
                } else if (cleanSeg.startsWith('status!=')) {
                    cleanSeg.slice(8).split(',').forEach(val => { if (val.trim()) excludedStatuses.add(val.trim()); });
                } else if (cleanSeg.startsWith('status=')) {
                    cleanSeg.slice(7).split(',').forEach(val => { if (val.trim()) includedStatuses.add(val.trim()); });
                } else if (cleanSeg.startsWith('yearseason!=')) {
                    cleanSeg.slice(12).split(',').forEach(val => { if (val.trim()) excludedYears.add(val.trim()); });
                } else if (cleanSeg.startsWith('yearseason=')) {
                    cleanSeg.slice(11).split(',').forEach(val => { if (val.trim()) includedYears.add(val.trim()); });
                } else if (cleanSeg.startsWith('genre!=')) {
                    cleanSeg.slice(7).split(',').forEach(val => { if (val.trim()) excludedGenres.add(val.trim()); });
                } else if (cleanSeg.startsWith('genre@=')) {
                    cleanSeg.slice(7).split(',').forEach(val => { if (val.trim()) includedGenres.add(val.trim()); });
                } else if (cleanSeg.startsWith('genre=')) {
                    cleanSeg.slice(6).split(',').forEach(val => { if (val.trim()) includedGenres.add(val.trim()); });
                } else if (cleanSeg === 'isAiring=1') airingState = '1';
                else if (cleanSeg === 'isAiring=0') airingState = '0';
                else if (cleanSeg === 'isActive=1') activeState = '1';
                else if (cleanSeg === 'isActive=0') activeState = '0';
            });
        }
        const bloodEl = innerPanel.querySelector('.custom-genre-item[data-genre-slug="49"]');
        const eroticaEl = innerPanel.querySelector('.custom-genre-item[data-genre-slug="49_erotica"]');
        const has49In = includedGenres.has('49');
        const has49Ex = excludedGenres.has('49');
        const eroticaAlreadyActive = eroticaEl && (eroticaEl.classList.contains('state-check') || eroticaEl.classList.contains('state-cross'));
        const bloodAlreadyActive = bloodEl && (bloodEl.classList.contains('state-check') || bloodEl.classList.contains('state-cross'));
        innerPanel.querySelectorAll('.custom-genre-item').forEach(el => {
            if (el.classList.contains('no-checks')) return;
            const typeSlug = el.dataset.typeSlug;
            const statusSlug = el.dataset.statusSlug;
            const yearSlug = el.dataset.yearSlug;
            const genreSlug = el.dataset.genreSlug;
            const role = el.dataset.filterRole;
            if (typeSlug) {
                el.classList.toggle('state-cross', excludedTypes.has(typeSlug));
                el.classList.toggle('state-check', !excludedTypes.has(typeSlug) && includedTypes.has(typeSlug));
                el.classList.toggle('active', !excludedTypes.has(typeSlug) && includedTypes.has(typeSlug));
            } else if (statusSlug) {
                el.classList.toggle('state-cross', excludedStatuses.has(statusSlug));
                el.classList.toggle('state-check', !excludedStatuses.has(statusSlug) && includedStatuses.has(statusSlug));
                el.classList.toggle('active', !excludedStatuses.has(statusSlug) && includedStatuses.has(statusSlug));
            } else if (yearSlug) {
                el.classList.toggle('state-cross', excludedYears.has(yearSlug));
                el.classList.toggle('state-check', !excludedYears.has(yearSlug) && includedYears.has(yearSlug));
                el.classList.toggle('active', !excludedYears.has(yearSlug) && includedYears.has(yearSlug));
            } else if (genreSlug === '49_erotica') {
                if (!has49In && !has49Ex) {
                    el.classList.remove('state-check', 'state-cross', 'active');
                } else if (eroticaAlreadyActive || !bloodAlreadyActive) {
                    el.classList.toggle('state-cross', has49Ex);
                    el.classList.toggle('state-check', !has49Ex && has49In);
                    el.classList.toggle('active', !has49Ex && has49In);
                }
            } else if (genreSlug === '49') {
                if (!has49In && !has49Ex) {
                	el.classList.remove('state-check', 'state-cross', 'active');
} else if (bloodAlreadyActive && !eroticaAlreadyActive) {
el.classList.toggle('state-cross', has49Ex);
el.classList.toggle('state-check', !has49Ex && has49In);
el.classList.toggle('active', !has49Ex && has49In);
} else if (eroticaAlreadyActive) {
el.classList.remove('state-check', 'state-cross', 'active');
}
} else if (genreSlug) {
el.classList.toggle('state-cross', excludedGenres.has(genreSlug));
el.classList.toggle('state-check', !excludedGenres.has(genreSlug) && includedGenres.has(genreSlug));
el.classList.toggle('active', !excludedGenres.has(genreSlug) && includedGenres.has(genreSlug));
} else if (role === 'ongoing') {
el.classList.toggle('state-cross', airingState === '0');
el.classList.toggle('state-check', airingState === '1');
el.classList.toggle('active', airingState === '1');
} else if (role === 'active') {
el.classList.toggle('state-cross', activeState === '0');
el.classList.toggle('state-check', activeState === '1');
el.classList.toggle('active', activeState === '1');
}
});
if (typeof P.refreshAllTrashStates === 'function') {
P.refreshAllTrashStates(innerPanel);
}
};
})();
// === БЛОК 8 из 12: Фабрика интерактивных пунктов списка createFilterItemElement ===
(function() {
    'use strict';
    const P = Anime365Panel;
    P.createFilterItemElement = function(text, innerPanel, customYearSlug, isAndGenre) {
        const item = document.createElement('li');
        item.className = 'custom-genre-item';
        item.textContent = text;
        if (isAndGenre) item.dataset.isTheme = '1';
        if (customYearSlug) item.dataset.yearSlug = customYearSlug;
        else if (P.typeSlugMap.has(text)) item.dataset.typeSlug = P.typeSlugMap.get(text);
        else if (P.statusSlugMap.has(text)) item.dataset.statusSlug = P.statusSlugMap.get(text);
        else if (P.genreSlugMap.has(text)) item.dataset.genreSlug = P.genreSlugMap.get(text);
        else if (text === 'Онгоинг') item.dataset.filterRole = 'ongoing';
        else if (text === 'Доступен') item.dataset.filterRole = 'active';
        item.addEventListener('click', (e) => {
            if (item.classList.contains('no-checks')) return;
            e.preventDefault();
            e.stopPropagation();
            const rect = item.getBoundingClientRect();
            const fromRight = rect.right - e.clientX;
            const ySlug = item.dataset.yearSlug;
            const isTrackedFilter = Boolean(item.dataset.typeSlug || item.dataset.statusSlug || ySlug || item.dataset.genreSlug || item.dataset.filterRole);
            if (fromRight >= 0 && fromRight <= 26) {
                item.classList.remove('state-check', 'active');
                const isCross = item.classList.toggle('state-cross');
                if (ySlug) {
                    innerPanel.querySelectorAll('.custom-genre-item').forEach(other => {
                        if (other !== item && other.dataset.yearSlug === ySlug) {
                            other.classList.remove('state-check', 'active');
                            other.classList.toggle('state-cross', isCross);
                        }
                    });
                }
                if (isTrackedFilter) P.updateFilterUrl(innerPanel);
            } else if ((fromRight > 26 && fromRight <= 54) || isTrackedFilter) {
                item.classList.remove('state-cross');
                const isChecked = item.classList.toggle('state-check');
                item.classList.toggle('active', isChecked);
                if (ySlug) {
                    innerPanel.querySelectorAll('.custom-genre-item').forEach(other => {
                        if (other !== item && other.dataset.yearSlug === ySlug) {
                            other.classList.remove('state-cross');
                            other.classList.toggle('state-check', isChecked);
                            other.classList.toggle('active', isChecked);
                        }
                    });
                }
                if (isTrackedFilter) P.updateFilterUrl(innerPanel);
            } else {
                item.classList.toggle('active');
            }
            if (!isTrackedFilter) {
                const isCrossClick = fromRight >= 0 && fromRight <= 26;
                document.querySelectorAll('.ccs-sugg, .ccs-sugges li').forEach(origLi => {
                    const origTextNode = origLi.querySelector('.primary-content') || origLi;
                    if (origTextNode && origTextNode.textContent.trim() === text) {
                        const targetBtn = origLi.querySelector(isCrossClick ? 'a.btn.red' : 'a.btn.green');
                        if (targetBtn) targetBtn.click();
                        else origLi.click();
                    }
                });
            }
        });
        return item;
    };
})();
// === БЛОК 9 из 12: Блок "МОЙ ФИЛЬТР" (с опцией "Размер постеров") и "В МОЕМ СПИСКЕ" ===
(function() {
    'use strict';
    const P = Anime365Panel;
    P.renderTopBlocks = function(innerPanel, savedState) {
        const myFilterHeader = document.createElement('div');
        myFilterHeader.className = 'custom-my-filter-header is-collapsed';
        const myFilterTitle = document.createElement('span');
        myFilterTitle.textContent = 'МОЙ ФИЛЬТР';
        const myFilterArrow = document.createElement('span');
        myFilterArrow.className = 'custom-my-filter-arrow';
        myFilterArrow.textContent = '▲';
        myFilterHeader.appendChild(myFilterTitle);
        myFilterHeader.appendChild(myFilterArrow);
        innerPanel.appendChild(myFilterHeader);
        const myFilterBody = document.createElement('div');
        myFilterBody.className = 'custom-my-filter-body hidden';
        const refreshMyFilterTooltip = P.attachDelayedTooltip(myFilterHeader, () => myFilterBody.classList.contains('hidden') ? 'Показать' : 'Скрыть');
        const savedSnapshot = P.getSavedChanges();
        const draftChanges = Object.assign({}, savedSnapshot);
        let isDirty = false;
        const saveBtnEl = document.createElement('div');
        saveBtnEl.className = 'custom-my-filter-btn save-btn';
        saveBtnEl.textContent = 'СОХРАНИТЬ';
        const showChangesBtnEl = document.createElement('div');
        showChangesBtnEl.className = 'custom-my-filter-btn custom-show-changes-btn hidden';
        showChangesBtnEl.textContent = 'ПОКАЗАТЬ ИЗМЕНЕНИЯ';
        const changesBodyEl = document.createElement('div');
        changesBodyEl.className = 'custom-changes-body hidden';
        let optLeftEl = null;
        let optRightEl = null;
        let optPostersSmallEl = null;
        let optPostersNormalEl = null;
        let optSeasonsShowEl = null;
        let optSeasonsHideEl = null;
        function updateSideOptionsUI(activeSide) {
            if (optLeftEl) optLeftEl.classList.toggle('active', activeSide === 'left');
            if (optRightEl) optRightEl.classList.toggle('active', activeSide === 'right');
        }
        function updatePostersOptionsUI(activePosters) {
            if (optPostersSmallEl) optPostersSmallEl.classList.toggle('active', activePosters === 'small');
            if (optPostersNormalEl) optPostersNormalEl.classList.toggle('active', activePosters === 'normal');
        }
        function updateSeasonsOptionsUI(activeSeasons) {
            if (optSeasonsShowEl) optSeasonsShowEl.classList.toggle('active', activeSeasons === 'show');
            if (optSeasonsHideEl) optSeasonsHideEl.classList.toggle('active', activeSeasons === 'hide');
        }
        function syncSaveHighlight() {
            const currentSaved = P.getSavedChanges();
            isDirty = JSON.stringify(draftChanges) !== JSON.stringify(currentSaved);
            saveBtnEl.classList.toggle('needs-save', isDirty);
        }
        function setMyFilterExpanded(expanded) {
            myFilterBody.classList.toggle('hidden', !expanded);
            myFilterHeader.classList.toggle('is-collapsed', !expanded);
            P.saveSectionState('myFilter', expanded);
            refreshMyFilterTooltip();
        }
        function createChangeRow(labelText, onCancelFn) {
            const row = document.createElement('div');
            row.className = 'custom-change-row';
            const labelSpan = document.createElement('span');
            labelSpan.textContent = labelText;
            const cancelBtn = document.createElement('span');
            cancelBtn.className = 'custom-change-cancel-x';
            cancelBtn.textContent = '✗';
            const tooltip = P.getOrCreateTooltip();
            let cancelTimer = null;
            cancelBtn.addEventListener('mouseenter', () => {
                clearTimeout(cancelTimer);
                cancelTimer = setTimeout(() => {
                    tooltip.textContent = 'Отменить';
                    P.positionTooltipNearElement(cancelBtn, tooltip);
                    tooltip.classList.add('show');
                }, 300);
            });
            cancelBtn.addEventListener('mouseleave', () => {
                clearTimeout(cancelTimer);
                tooltip.classList.remove('show');
            });
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                clearTimeout(cancelTimer);
                tooltip.classList.remove('show');
                onCancelFn();
            });
            row.appendChild(labelSpan);
            row.appendChild(cancelBtn);
            return row;
        }
        function renderSavedChangesList() {
            const currentSaved = P.getSavedChanges();
            const keys = Object.keys(currentSaved);
            showChangesBtnEl.classList.toggle('hidden', keys.length === 0);
            if (keys.length === 0) {
                changesBodyEl.classList.add('hidden');
                changesBodyEl.innerHTML = '';
                return;
            }
            changesBodyEl.innerHTML = '';
            if (currentSaved.side) {
                changesBodyEl.appendChild(createChangeRow(
                    currentSaved.side === 'left' ? 'Панель слева' : 'Панель справа',
                    () => {
                        delete draftChanges.side;
                        P.setSavedChanges(draftChanges);
                        const fallbackSide = P.getActivePanelSide();
                        P.applyPanelSide(fallbackSide);
                        updateSideOptionsUI(fallbackSide);
                        syncSaveHighlight();
                        renderSavedChangesList();
                    }
                ));
            }
            if (currentSaved.posters) {
                changesBodyEl.appendChild(createChangeRow(
                    currentSaved.posters === 'normal' ? 'Обычные постеры' : 'Маленькие постеры',
                    () => {
                        delete draftChanges.posters;
                        P.setSavedChanges(draftChanges);
                        const fallbackPosters = P.getActivePostersMode();
                        P.applyPostersMode(fallbackPosters);
                        updatePostersOptionsUI(fallbackPosters);
                        syncSaveHighlight();
                        renderSavedChangesList();
                    }
                ));
            }
            if (currentSaved.seasons) {
                changesBodyEl.appendChild(createChangeRow(
                    currentSaved.seasons === 'hide' ? 'Не отображать сезоны' : 'Отображать сезоны',
                    () => {
                        delete draftChanges.seasons;
                        P.setSavedChanges(draftChanges);
                        const fallbackSeasons = P.getActiveSeasonsMode();
                        P.applySeasonsVisibility(fallbackSeasons);
                        updateSeasonsOptionsUI(fallbackSeasons);
                        syncSaveHighlight();
                        renderSavedChangesList();
                    }
                ));
            }
            const resetAllBtn = document.createElement('div');
            resetAllBtn.className = 'custom-reset-all-btn';
            resetAllBtn.textContent = 'СБРОСИТЬ ВСЕ';
            resetAllBtn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                Object.keys(draftChanges).forEach(k => delete draftChanges[k]);
                P.applyPanelSide(P.DEFAULT_SETTINGS.side);
                updateSideOptionsUI(P.DEFAULT_SETTINGS.side);
                P.applyPostersMode(P.DEFAULT_SETTINGS.posters);
                updatePostersOptionsUI(P.DEFAULT_SETTINGS.posters);
                P.applySeasonsVisibility(P.DEFAULT_SETTINGS.seasons);
                updateSeasonsOptionsUI(P.DEFAULT_SETTINGS.seasons);
                changesBodyEl.classList.add('hidden');
                syncSaveHighlight();
            });
            changesBodyEl.appendChild(resetAllBtn);
        }
        const btnExclusions = document.createElement('div');
        btnExclusions.className = 'custom-my-filter-btn';
        btnExclusions.textContent = 'Исключения';
        btnExclusions.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
        myFilterBody.appendChild(btnExclusions);
        const btnPanelSettings = document.createElement('div');
        btnPanelSettings.className = 'custom-my-filter-btn';
        btnPanelSettings.textContent = 'Настройки панели';
        const viewSub = document.createElement('div');
        viewSub.className = 'custom-view-mode-sub hidden';
        const initialSide = P.getActivePanelSide();
        const initialPosters = P.getActivePostersMode();
        const initialSeasons = P.getActiveSeasonsMode();
        function createOptionWithCheck(label, isActive) {
            const opt = document.createElement('div');
            opt.className = isActive ? 'custom-view-mode-option active' : 'custom-view-mode-option';
            const lblSpan = document.createElement('span');
            lblSpan.textContent = label;
            const chkSpan = document.createElement('span');
            chkSpan.className = 'custom-view-option-check';
            chkSpan.textContent = '✓';
            opt.appendChild(lblSpan);
            opt.appendChild(chkSpan);
            return opt;
        }
        const sideSubTitle = document.createElement('div');
        sideSubTitle.className = 'custom-view-sub-heading';
        sideSubTitle.textContent = 'Расположение панели';
        viewSub.appendChild(sideSubTitle);
        optLeftEl = createOptionWithCheck('Панель слева', initialSide === 'left');
        optRightEl = createOptionWithCheck('Панель справа', initialSide === 'right');
        optLeftEl.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            updateSideOptionsUI('left');
P.applyPanelSide('left');
if (P.DEFAULT_SETTINGS.side === 'left') delete draftChanges.side;
else draftChanges.side = 'left';
syncSaveHighlight();
});
optRightEl.addEventListener('click', (e) => {
e.preventDefault(); e.stopPropagation();
updateSideOptionsUI('right');
P.applyPanelSide('right');
if (P.DEFAULT_SETTINGS.side === 'right') delete draftChanges.side;
else draftChanges.side = 'right';
syncSaveHighlight();
});
viewSub.appendChild(optLeftEl);
viewSub.appendChild(optRightEl);
const postersSubTitle = document.createElement('div');
postersSubTitle.className = 'custom-view-sub-heading';
postersSubTitle.textContent = 'Размер постеров';
viewSub.appendChild(postersSubTitle);
optPostersSmallEl = createOptionWithCheck('Маленькие', initialPosters === 'small');
optPostersNormalEl = createOptionWithCheck('Обычные', initialPosters === 'normal');
optPostersSmallEl.addEventListener('click', (e) => {
e.preventDefault(); e.stopPropagation();
updatePostersOptionsUI('small');
P.applyPostersMode('small');
if (P.DEFAULT_SETTINGS.posters === 'small') delete draftChanges.posters;
else draftChanges.posters = 'small';
syncSaveHighlight();
});
optPostersNormalEl.addEventListener('click', (e) => {
e.preventDefault(); e.stopPropagation();
updatePostersOptionsUI('normal');
P.applyPostersMode('normal');
if (P.DEFAULT_SETTINGS.posters === 'normal') delete draftChanges.posters;
else draftChanges.posters = 'normal';
syncSaveHighlight();
});
viewSub.appendChild(optPostersSmallEl);
viewSub.appendChild(optPostersNormalEl);
const seasonsSubTitle = document.createElement('div');
seasonsSubTitle.className = 'custom-view-sub-heading';
seasonsSubTitle.textContent = 'Отображение сезонов';
viewSub.appendChild(seasonsSubTitle);
optSeasonsShowEl = createOptionWithCheck('Отображать сезоны', initialSeasons === 'show');
optSeasonsHideEl = createOptionWithCheck('Не отображать сезоны', initialSeasons === 'hide');
optSeasonsShowEl.addEventListener('click', (e) => {
e.preventDefault(); e.stopPropagation();
updateSeasonsOptionsUI('show');
P.applySeasonsVisibility('show');
if (P.DEFAULT_SETTINGS.seasons === 'show') delete draftChanges.seasons;
else draftChanges.seasons = 'show';
syncSaveHighlight();
});
optSeasonsHideEl.addEventListener('click', (e) => {
e.preventDefault(); e.stopPropagation();
updateSeasonsOptionsUI('hide');
P.applySeasonsVisibility('hide');
if (P.DEFAULT_SETTINGS.seasons === 'hide') delete draftChanges.seasons;
else draftChanges.seasons = 'hide';
syncSaveHighlight();
});
viewSub.appendChild(optSeasonsShowEl);
viewSub.appendChild(optSeasonsHideEl);
btnPanelSettings.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); viewSub.classList.toggle('hidden'); });
myFilterBody.appendChild(btnPanelSettings);
myFilterBody.appendChild(viewSub);
const btnWindowSize = document.createElement('div');
btnWindowSize.className = 'custom-my-filter-btn';
btnWindowSize.textContent = 'Размер окон';
btnWindowSize.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
myFilterBody.appendChild(btnWindowSize);
saveBtnEl.addEventListener('click', (e) => {
e.preventDefault(); e.stopPropagation();
const hadChanges = isDirty;
P.setSavedChanges(draftChanges);
syncSaveHighlight();
renderSavedChangesList();
if (hadChanges) setMyFilterExpanded(false);
});
myFilterBody.appendChild(saveBtnEl);
showChangesBtnEl.addEventListener('click', (e) => {
e.preventDefault(); e.stopPropagation();
const willOpen = changesBodyEl.classList.contains('hidden');
if (willOpen) renderSavedChangesList();
changesBodyEl.classList.toggle('hidden', !willOpen);
});
myFilterBody.appendChild(showChangesBtnEl);
myFilterBody.appendChild(changesBodyEl);
renderSavedChangesList();
myFilterBody.appendChild(P.createCollapseGroupButton(() => setMyFilterExpanded(false)));
myFilterHeader.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setMyFilterExpanded(myFilterBody.classList.contains('hidden')); });
if (savedState.myFilter === true) setMyFilterExpanded(true);
innerPanel.appendChild(myFilterBody);
const myListHeader = document.createElement('div');
myListHeader.className = 'custom-my-list-sub-header is-collapsed';
const myListTitle = document.createElement('span');
myListTitle.textContent = 'В МОЕМ СПИСКЕ';
const myListArrow = document.createElement('span');
myListArrow.className = 'custom-my-list-sub-arrow';
myListArrow.textContent = '▲';
myListHeader.appendChild(myListTitle);
myListHeader.appendChild(myListArrow);
innerPanel.appendChild(myListHeader);
const myListBody = document.createElement('div');
myListBody.className = 'custom-my-list-sub-body hidden';
P.myListItems.forEach(listText => myListBody.appendChild(P.createFilterItemElement(listText, innerPanel)));
const refreshMyListTooltip = P.attachDelayedTooltip(myListHeader, () => myListBody.classList.contains('hidden') ? 'Показать' : 'Скрыть');
function setMyListExpanded(expanded) {
myListBody.classList.toggle('hidden', !expanded);
myListHeader.classList.toggle('is-collapsed', !expanded);
P.saveSectionState('myList', expanded);
refreshMyListTooltip();
}
myListBody.appendChild(P.createCollapseGroupButton(() => setMyListExpanded(false)));
myListHeader.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setMyListExpanded(myListBody.classList.contains('hidden')); });
if (savedState.myList === true) setMyListExpanded(true);
innerPanel.appendChild(myListBody);
return { myListBody, setMyListExpanded };
};
})();

        	

// === БЛОК 10 из 12: Секция ГОД (Указать год, Выбрать другой/Отменить, до/от, Обновить над диапазоном + корзины) ===
(function() {
    'use strict';
    const P = Anime365Panel;
    P.renderYearSection = function(innerPanel, currentList, items, savedState) {
        let pickedSingleYear = savedState.pickedSingleYear || null;
        const selectedYearLabel = document.createElement('div');
        selectedYearLabel.className = pickedSingleYear ? 'custom-year-selected-label' : 'custom-year-selected-label hidden';
        selectedYearLabel.textContent = 'Выбранный год:';
        const singleYearActionRow = document.createElement('div');
        singleYearActionRow.className = 'custom-year-action-row';
        const pickYearBtn = P.createFilterItemElement(pickedSingleYear || 'Указать год', innerPanel, pickedSingleYear || '');
        pickYearBtn.classList.add('custom-year-pick-item');
        if (!pickedSingleYear) {
            delete pickYearBtn.dataset.yearSlug;
            pickYearBtn.classList.add('no-checks');
        }
        const inlineCancelBtn = document.createElement('span');
        inlineCancelBtn.className = 'custom-year-inline-cancel hidden';
        inlineCancelBtn.textContent = 'Отменить';
        pickYearBtn.appendChild(inlineCancelBtn);
        const resetSingleYearTrashBtn = document.createElement('div');
        resetSingleYearTrashBtn.className = pickedSingleYear ? 'custom-wide-trash-btn' : 'custom-wide-trash-btn hidden';
        resetSingleYearTrashBtn.textContent = '🗑';
        singleYearActionRow.appendChild(pickYearBtn);
        singleYearActionRow.appendChild(resetSingleYearTrashBtn);
        const pickOtherYearBtn = document.createElement('div');
        pickOtherYearBtn.className = pickedSingleYear ? 'custom-year-pick-other-btn' : 'custom-year-pick-other-btn hidden';
        pickOtherYearBtn.textContent = 'Выбрать другой';
        const singleYearDropdown = document.createElement('div');
        singleYearDropdown.className = 'custom-year-dropdown hidden';
        function syncPickYearButtonView() {
            const existingCancel = pickYearBtn.querySelector('.custom-year-inline-cancel');
            pickYearBtn.textContent = pickedSingleYear || 'Указать год';
            if (existingCancel) pickYearBtn.appendChild(existingCancel);
        }
        function setSingleYearDropdownOpen(isOpen) {
            singleYearDropdown.classList.toggle('hidden', !isOpen);
            if (pickedSingleYear) {
                pickOtherYearBtn.textContent = isOpen ? 'Отменить' : 'Выбрать другой';
                inlineCancelBtn.classList.add('hidden');
            } else {
                inlineCancelBtn.classList.toggle('hidden', !isOpen);
            }
        }
        function clearDuplicateYearSlugs(slugToClear) {
            if (!slugToClear) return;
            currentList.querySelectorAll('.custom-genre-item').forEach(el => {
                if (el !== pickYearBtn && el.dataset.yearSlug === slugToClear) {
                    el.classList.remove('state-check', 'state-cross', 'active');
                }
            });
        }
        function renderSingleYearOptions() {
            singleYearDropdown.innerHTML = '';
            P.allYearsDesc.forEach(yr => {
                const opt = document.createElement('div');
                opt.className = yr === pickedSingleYear ? 'custom-year-option selected' : 'custom-year-option';
                opt.textContent = yr;
                opt.addEventListener('click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const prevYear = pickedSingleYear;
                    if (prevYear && prevYear !== yr) {
                        clearDuplicateYearSlugs(prevYear);
                    }
                    pickedSingleYear = yr;
                    P.saveSectionState('pickedSingleYear', yr);
                    pickYearBtn.classList.remove('no-checks', 'state-cross');
                    pickYearBtn.dataset.yearSlug = yr;
                    syncPickYearButtonView();
                    pickYearBtn.classList.add('state-check', 'active');
                    currentList.querySelectorAll('.custom-genre-item').forEach(el => {
                        if (el !== pickYearBtn && el.dataset.yearSlug === yr) {
                            el.classList.remove('state-cross');
                            el.classList.add('state-check', 'active');
                        }
                    });
                    selectedYearLabel.classList.remove('hidden');
                    pickOtherYearBtn.classList.remove('hidden');
                    resetSingleYearTrashBtn.classList.remove('hidden');
                    setSingleYearDropdownOpen(false);
                    P.updateFilterUrl(innerPanel);
                });
                singleYearDropdown.appendChild(opt);
            });
        }
        inlineCancelBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            setSingleYearDropdownOpen(false);
            if (!pickedSingleYear) {
                pickYearBtn.classList.add('no-checks');
                delete pickYearBtn.dataset.yearSlug;
                syncPickYearButtonView();
            }
        });
        pickYearBtn.addEventListener('click', (e) => {
            if (e.target === inlineCancelBtn) return;
            if (!pickedSingleYear) {
                e.preventDefault(); e.stopPropagation();
                const willOpen = singleYearDropdown.classList.contains('hidden');
                if (willOpen) renderSingleYearOptions();
                setSingleYearDropdownOpen(willOpen);
            }
        });
        pickOtherYearBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const willOpen = singleYearDropdown.classList.contains('hidden');
            if (willOpen) renderSingleYearOptions();
            setSingleYearDropdownOpen(willOpen);
        });
        resetSingleYearTrashBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const savedScrollTop = innerPanel.scrollTop;
            const oldSlug = pickedSingleYear;
            pickedSingleYear = null;
            P.saveSectionState('pickedSingleYear', null);
            delete pickYearBtn.dataset.yearSlug;
            pickYearBtn.classList.add('no-checks');
            pickYearBtn.classList.remove('state-check', 'state-cross', 'active');
            syncPickYearButtonView();
            selectedYearLabel.classList.add('hidden');
            pickOtherYearBtn.classList.add('hidden');
            pickOtherYearBtn.textContent = 'Выбрать другой';
            resetSingleYearTrashBtn.classList.add('hidden');
            setSingleYearDropdownOpen(false);
            clearDuplicateYearSlugs(oldSlug);
            P.updateFilterUrl(innerPanel);
            innerPanel.scrollTop = savedScrollTop;
        });
        currentList.appendChild(selectedYearLabel);
        currentList.appendChild(singleYearActionRow);
        currentList.appendChild(pickOtherYearBtn);
        currentList.appendChild(singleYearDropdown);
        items.forEach(yrText => {
            currentList.appendChild(P.createFilterItemElement(yrText, innerPanel, yrText));
        });
        const extraYearContainer = document.createElement('div');
        extraYearContainer.className = 'custom-type-extra-list hidden';
        P.extraYearItems.forEach(yObj => {
            extraYearContainer.appendChild(P.createFilterItemElement(yObj.label, innerPanel, yObj.slug));
        });
        const rangeToggleBtn = document.createElement('div');
        rangeToggleBtn.className = 'custom-range-toggle-btn';
        rangeToggleBtn.textContent = 'Выбрать диапазон';
        const rangeBox = document.createElement('div');
        rangeBox.className = 'custom-range-box hidden';
        let draftFrom = savedState.yearRangeFrom || null;
        let draftTo = savedState.yearRangeTo || null;
        let approvedFrom = savedState.approvedRangeFrom || null;
        let approvedTo = savedState.approvedRangeTo || null;
        const rowTo = document.createElement('div');
        rowTo.className = 'custom-range-row';
        const lblTo = document.createElement('span');
        lblTo.className = 'custom-range-label';
        lblTo.textContent = 'до';
        const btnTo = document.createElement('div');
        btnTo.className = 'custom-range-select-btn';
        btnTo.textContent = draftTo ? String(draftTo) : 'Выбрать';
        rowTo.appendChild(lblTo);
        rowTo.appendChild(btnTo);
        const listTo = document.createElement('div');
        listTo.className = 'custom-range-select-list hidden';
        const rowFrom = document.createElement('div');
        rowFrom.className = 'custom-range-row';
        const lblFrom = document.createElement('span');
        lblFrom.className = 'custom-range-label';
        lblFrom.textContent = 'от';
        const btnFrom = document.createElement('div');
        btnFrom.className = 'custom-range-select-btn';
        btnFrom.textContent = draftFrom ? String(draftFrom) : 'Выбрать';
        rowFrom.appendChild(lblFrom);
        rowFrom.appendChild(btnFrom);
        const listFrom = document.createElement('div');
        listFrom.className = 'custom-range-select-list hidden';
        const approvedSlugInitial = (approvedFrom && approvedTo)
            ? (Number(approvedFrom) === Number(approvedTo) ? String(approvedFrom) : (String(approvedFrom) + '-' + String(approvedTo)))
            : '';
        const updateRangeRow = document.createElement('div');
        updateRangeRow.className = 'custom-range-action-row hidden';
        const updateRangeBtn = document.createElement('div');
        updateRangeBtn.className = 'custom-range-update-btn';
        const cancelUpdateTrashBtn = document.createElement('div');
        cancelUpdateTrashBtn.className = 'custom-wide-trash-btn';
        cancelUpdateTrashBtn.textContent = '🗑';
P.attachDelayedTooltip(cancelUpdateTrashBtn, () => 'Вернуть исходный диапазон');
updateRangeRow.appendChild(updateRangeBtn);
updateRangeRow.appendChild(cancelUpdateTrashBtn);
const mainRangeRow = document.createElement('div');
mainRangeRow.className = 'custom-range-action-row hidden';
const mainRangeItem = P.createFilterItemElement(
approvedSlugInitial || 'Применить',
innerPanel,
approvedSlugInitial
);
mainRangeItem.classList.add('custom-range-apply-item');
if (!approvedSlugInitial) {
delete mainRangeItem.dataset.yearSlug;
mainRangeItem.classList.add('no-checks');
}
const resetApprovedTrashBtn = document.createElement('div');
resetApprovedTrashBtn.className = 'custom-wide-trash-btn';
resetApprovedTrashBtn.textContent = '🗑';
P.attachDelayedTooltip(resetApprovedTrashBtn, () => 'Сбросить диапазон');
mainRangeRow.appendChild(mainRangeItem);
mainRangeRow.appendChild(resetApprovedTrashBtn);
function buildSlug(f, t) {
return Number(f) === Number(t) ? String(f) : (String(f) + '-' + String(t));
}
function syncRangeControlsUI() {
btnTo.textContent = draftTo ? String(draftTo) : 'Выбрать';
btnFrom.textContent = draftFrom ? String(draftFrom) : 'Выбрать';
const hasApproved = Boolean(approvedFrom && approvedTo);
const hasDraftPair = Boolean(draftFrom && draftTo);
if (!hasApproved) {
updateRangeRow.classList.add('hidden');
if (hasDraftPair) {
const draftSlug = buildSlug(draftFrom, draftTo);
mainRangeItem.textContent = 'Применить (' + draftSlug + ')';
mainRangeItem.classList.add('no-checks');
mainRangeItem.classList.remove('state-check', 'state-cross', 'active');
delete mainRangeItem.dataset.yearSlug;
mainRangeRow.classList.remove('hidden');
} else {
mainRangeRow.classList.add('hidden');
}
} else {
const appSlug = buildSlug(approvedFrom, approvedTo);
mainRangeItem.textContent = appSlug;
mainRangeItem.dataset.yearSlug = appSlug;
mainRangeItem.classList.remove('no-checks');
mainRangeRow.classList.remove('hidden');
if (hasDraftPair && (Number(draftFrom) !== Number(approvedFrom) || Number(draftTo) !== Number(approvedTo))) {
const newDraftSlug = buildSlug(draftFrom, draftTo);
updateRangeBtn.textContent = 'Обновить (' + newDraftSlug + ')';
updateRangeRow.classList.remove('hidden');
} else {
updateRangeRow.classList.add('hidden');
}
}
}
mainRangeItem.addEventListener('click', (e) => {
if (!mainRangeItem.classList.contains('no-checks')) return;
e.preventDefault(); e.stopPropagation();
if (!draftFrom || !draftTo) return;
approvedFrom = draftFrom;
approvedTo = draftTo;
P.saveSectionState('approvedRangeFrom', approvedFrom);
P.saveSectionState('approvedRangeTo', approvedTo);
syncRangeControlsUI();
mainRangeItem.classList.remove('state-cross');
mainRangeItem.classList.add('state-check', 'active');
P.updateFilterUrl(innerPanel);
}, true);
updateRangeBtn.addEventListener('click', (e) => {
e.preventDefault(); e.stopPropagation();
if (!draftFrom || !draftTo) return;
const wasCross = mainRangeItem.classList.contains('state-cross');
approvedFrom = draftFrom;
approvedTo = draftTo;
P.saveSectionState('approvedRangeFrom', approvedFrom);
P.saveSectionState('approvedRangeTo', approvedTo);
syncRangeControlsUI();
if (wasCross) {
mainRangeItem.classList.remove('state-check', 'active');
mainRangeItem.classList.add('state-cross');
} else {
mainRangeItem.classList.remove('state-cross');
mainRangeItem.classList.add('state-check', 'active');
}
P.updateFilterUrl(innerPanel);
});
cancelUpdateTrashBtn.addEventListener('click', (e) => {
e.preventDefault(); e.stopPropagation();
draftFrom = approvedFrom;
draftTo = approvedTo;
P.saveSectionState('yearRangeFrom', draftFrom);
P.saveSectionState('yearRangeTo', draftTo);
listFrom.classList.add('hidden');
listTo.classList.add('hidden');
syncRangeControlsUI();
});
resetApprovedTrashBtn.addEventListener('click', (e) => {
e.preventDefault(); e.stopPropagation();
const savedScrollTop = innerPanel.scrollTop;
const hadApproved = Boolean(approvedFrom && approvedTo);
const hasDiffDraft = Boolean(
hadApproved && draftFrom && draftTo &&
(Number(draftFrom) !== Number(approvedFrom) || Number(draftTo) !== Number(approvedTo))
);
approvedFrom = null;
approvedTo = null;
P.saveSectionState('approvedRangeFrom', null);
P.saveSectionState('approvedRangeTo', null);
if (!hasDiffDraft) {
draftFrom = null;
draftTo = null;
P.saveSectionState('yearRangeFrom', null);
P.saveSectionState('yearRangeTo', null);
}
delete mainRangeItem.dataset.yearSlug;
mainRangeItem.classList.remove('state-check', 'state-cross', 'active');
listFrom.classList.add('hidden');
listTo.classList.add('hidden');
syncRangeControlsUI();
if (hadApproved) {
P.updateFilterUrl(innerPanel);
innerPanel.scrollTop = savedScrollTop;
}
});
function renderRangeToList() {
listTo.innerHTML = '';
const minAllowed = draftFrom ? Number(draftFrom) : P.MIN_YEAR;
for (let y = P.CURRENT_YEAR; y >= minAllowed; y--) {
const opt = document.createElement('div');
opt.className = Number(draftTo) === y ? 'custom-year-option selected' : 'custom-year-option';
opt.textContent = String(y);
opt.addEventListener('click', (e) => {
e.preventDefault(); e.stopPropagation();
draftTo = y;
P.saveSectionState('yearRangeTo', y);
listTo.classList.add('hidden');
syncRangeControlsUI();
});
listTo.appendChild(opt);
}
}
function renderRangeFromList() {
listFrom.innerHTML = '';
const maxAllowed = draftTo ? Number(draftTo) : P.CURRENT_YEAR;
for (let y = maxAllowed; y >= P.MIN_YEAR; y--) {
const opt = document.createElement('div');
opt.className = Number(draftFrom) === y ? 'custom-year-option selected' : 'custom-year-option';
opt.textContent = String(y);
opt.addEventListener('click', (e) => {
e.preventDefault(); e.stopPropagation();
draftFrom = y;
P.saveSectionState('yearRangeFrom', y);
listFrom.classList.add('hidden');
syncRangeControlsUI();
});
listFrom.appendChild(opt);
}
}
btnTo.addEventListener('click', (e) => {
e.preventDefault(); e.stopPropagation();
const willOpen = listTo.classList.contains('hidden');
listFrom.classList.add('hidden');
if (willOpen) renderRangeToList();
listTo.classList.toggle('hidden', !willOpen);
});
btnFrom.addEventListener('click', (e) => {
e.preventDefault(); e.stopPropagation();
const willOpen = listFrom.classList.contains('hidden');
listTo.classList.add('hidden');
if (willOpen) renderRangeFromList();
listFrom.classList.toggle('hidden', !willOpen);
});
rangeToggleBtn.addEventListener('click', (e) => {
e.preventDefault(); e.stopPropagation();
const willOpen = rangeBox.classList.contains('hidden');
rangeBox.classList.toggle('hidden', !willOpen);
P.saveSectionState('yearRangeBoxOpen', willOpen);
});
if (savedState.yearRangeBoxOpen === true) rangeBox.classList.remove('hidden');
syncRangeControlsUI();
rangeBox.appendChild(rowTo);
rangeBox.appendChild(listTo);
rangeBox.appendChild(rowFrom);
rangeBox.appendChild(listFrom);
rangeBox.appendChild(updateRangeRow);
rangeBox.appendChild(mainRangeRow);
extraYearContainer.appendChild(rangeToggleBtn);
extraYearContainer.appendChild(rangeBox);
const toggleExtraYearBtn = document.createElement('li');
toggleExtraYearBtn.className = 'custom-type-expand-btn is-collapsed';
const toggleExtraYearLabel = document.createElement('span');
toggleExtraYearLabel.className = 'custom-type-expand-label';
toggleExtraYearLabel.textContent = 'Показать все';
const toggleExtraYearArrow = document.createElement('span');
toggleExtraYearArrow.className = 'custom-type-expand-arrow';
toggleExtraYearArrow.textContent = '▲';
toggleExtraYearBtn.appendChild(toggleExtraYearLabel);
toggleExtraYearBtn.appendChild(toggleExtraYearArrow);
function setExtraYearsExpanded(expanded) {
extraYearContainer.classList.toggle('hidden', !expanded);
toggleExtraYearBtn.classList.toggle('is-collapsed', !expanded);
toggleExtraYearLabel.textContent = expanded ? 'Скрыть' : 'Показать все';
P.saveSectionState('extraYears', expanded);
}
toggleExtraYearBtn.addEventListener('click', (e) => {
e.preventDefault(); e.stopPropagation();
setExtraYearsExpanded(extraYearContainer.classList.contains('hidden'));
});
if (savedState.extraYears === true) setExtraYearsExpanded(true);
currentList.appendChild(extraYearContainer);
currentList.appendChild(toggleExtraYearBtn);
innerPanel._setExtraYearsExpanded = setExtraYearsExpanded;
};
})();

// === БЛОК 11 из 12: Главный сборщик buildStaticGenres (Блокировка скролла тем до видимости ПОКАЗАТЬ ВСЕ) ===
(function() {
    'use strict';
    const P = Anime365Panel;
    P.refreshAllTrashStates = function(innerPanel) {
        innerPanel.querySelectorAll('.custom-trash-btn[data-trash-target]').forEach(btn => {
            const targetKey = btn.dataset.trashTarget;
            let container = null;
            if (targetKey.startsWith('sec_')) {
                const secName = targetKey.slice(4);
                container = innerPanel.querySelector(`.custom-genre-section[data-section="${secName}"]`);
            } else if (targetKey.startsWith('sub_')) {
                const subName = targetKey.slice(4);
                container = innerPanel.querySelector(`.custom-subgroup-wrapper[data-subgroup="${subName}"]`);
            }
            if (!container) return;
            const hasSelected = Boolean(container.querySelector('.custom-genre-item.state-check, .custom-genre-item.state-cross'));
            btn.classList.toggle('has-active', hasSelected);
        });
    };
    P.createSectionTrashButton = function(targetKey, tooltipText, getContainerFn, innerPanel) {
        const trashBtn = document.createElement('span');
        trashBtn.className = 'custom-trash-btn';
        trashBtn.dataset.trashTarget = targetKey;
        trashBtn.textContent = '🗑';
        const tooltip = P.getOrCreateTooltip();
        let trashTimer = null;
        trashBtn.addEventListener('mouseenter', () => {
            if (!trashBtn.classList.contains('has-active')) return;
            clearTimeout(trashTimer);
            trashTimer = setTimeout(() => {
                tooltip.textContent = tooltipText;
                P.positionTooltipNearElement(trashBtn, tooltip);
                tooltip.classList.add('show');
            }, 300);
        });
        trashBtn.addEventListener('mouseleave', () => {
            clearTimeout(trashTimer);
            tooltip.classList.remove('show');
        });
        trashBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!trashBtn.classList.contains('has-active')) return;
            const savedScrollTop = innerPanel.scrollTop;
            clearTimeout(trashTimer);
            tooltip.classList.remove('show');
            const container = getContainerFn();
            if (container) {
                container.querySelectorAll('.custom-genre-item').forEach(el => {
                    el.classList.remove('state-check', 'state-cross', 'active');
                });
            }
            P.refreshAllTrashStates(innerPanel);
            P.updateFilterUrl(innerPanel);
            innerPanel.scrollTop = savedScrollTop;
        });
        return trashBtn;
    };
    P.buildStaticGenres = function(innerPanel) {
        const savedState = P.loadSectionsState();
        innerPanel.innerHTML = '';
        const mainTitle = document.createElement('div');
        mainTitle.className = 'custom-panel-main-title';
        mainTitle.textContent = 'ФИЛЬТРЫ';
        innerPanel.appendChild(mainTitle);
        const topRefs = P.renderTopBlocks(innerPanel, savedState);
        const sectionTrashTooltips = {
            'Страна': 'Очистить страну',
            'Тип': 'Очистить тип',
            'Статус': 'Очистить статус',
            'Год': 'Очистить год',
            'Жанры': 'Очистить все жанры'
        };
        P.filterData.forEach(section => {
            const sectionKey = 'section_' + section.title;
            const sectionWrapper = document.createElement('div');
            sectionWrapper.className = 'custom-genre-section';
            sectionWrapper.dataset.section = section.title;
            const heading = document.createElement('div');
            heading.className = 'custom-genre-heading has-collapse-control';
            const headingTitleSpan = document.createElement('span');
            headingTitleSpan.textContent = section.title;
            heading.appendChild(headingTitleSpan);
            const controlsBox = document.createElement('span');
            controlsBox.className = 'custom-heading-controls';
            const headingStateLabel = document.createElement('span');
            headingStateLabel.className = 'custom-heading-state-label';
            headingStateLabel.textContent = 'Свернуть';
            controlsBox.appendChild(headingStateLabel);
            if (sectionTrashTooltips[section.title]) {
                const trashBtn = P.createSectionTrashButton(
                    'sec_' + section.title,
                    sectionTrashTooltips[section.title],
                    () => sectionWrapper,
                    innerPanel
                );
                controlsBox.appendChild(trashBtn);
            }
            heading.appendChild(controlsBox);
            sectionWrapper.appendChild(heading);
            const currentList = document.createElement('ul');
            currentList.className = 'custom-genres-list';
            function setSectionExpanded(expanded) {
                currentList.classList.toggle('hidden', !expanded);
                heading.classList.toggle('is-collapsed', !expanded);
                headingStateLabel.textContent = expanded ? 'Свернуть' : 'Показать';
                P.saveSectionState(sectionKey, expanded);
                if (typeof innerPanel._updateThemesStickyState === 'function') {
                    requestAnimationFrame(innerPanel._updateThemesStickyState);
                }
            }
            heading.addEventListener('click', (e) => {
                if (e.target.closest('.custom-trash-btn')) return;
                e.preventDefault();
                e.stopPropagation();
                setSectionExpanded(currentList.classList.contains('hidden'));
            });
            if (section.title === 'Год') {
                P.renderYearSection(innerPanel, currentList, section.items, savedState);
            } else if (section.title === 'Жанры') {
                function createCollapsibleSubgroup(subTitleText, stateKey, trashTooltipText, buildBodyFn) {
                    const subWrap = document.createElement('div');
                    subWrap.className = 'custom-subgroup-wrapper';
                    subWrap.dataset.subgroup = stateKey;
                    const subHeader = document.createElement('div');
                    subHeader.className = 'custom-genre-subgroup-header';
                    const titleEl = document.createElement('span');
                    titleEl.textContent = subTitleText;
                    subHeader.appendChild(titleEl);
                    const subControls = document.createElement('span');
                    subControls.className = 'custom-heading-controls';
                    const subStateLabel = document.createElement('span');
                    subStateLabel.className = 'custom-heading-state-label';
                    subStateLabel.textContent = 'Свернуть';
                    subControls.appendChild(subStateLabel);
                    const subTrash = P.createSectionTrashButton('sub_' + stateKey, trashTooltipText, () => subWrap, innerPanel);
                    subControls.appendChild(subTrash);
                    subHeader.appendChild(subControls);
                    const subBody = document.createElement('div');
                    subBody.className = 'custom-subgroup-body';
                    buildBodyFn(subBody);
                    function setSubExpanded(expanded) {
                        subBody.classList.toggle('hidden', !expanded);
                        subHeader.classList.toggle('is-collapsed', !expanded);
                        subStateLabel.textContent = expanded ? 'Свернуть' : 'Показать';
                        P.saveSectionState('subgroup_' + stateKey, expanded);
                        if (typeof innerPanel._updateThemesStickyState === 'function') {
                            requestAnimationFrame(innerPanel._updateThemesStickyState);
                        }
                    }
                    subBody.appendChild(P.createCollapseGroupButton(() => setSubExpanded(false)));
                    subHeader.addEventListener('click', (e) => {
                        if (e.target.closest('.custom-trash-btn')) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setSubExpanded(subBody.classList.contains('hidden'));
                    });
                    if (savedState['subgroup_' + stateKey] === false) {
                        setSubExpanded(false);
                    }
                    subWrap.appendChild(subHeader);
                    subWrap.appendChild(subBody);
                    return subWrap;
                }
                const demoSub = createCollapsibleSubgroup('Демография', 'demography', 'Очистить демографию', (body) => {
                    P.demographyGenres.forEach(gName => {
                        body.appendChild(P.createFilterItemElement(gName, innerPanel));
                    });
                });
                currentList.appendChild(demoSub);
                const mainGenresSub = createCollapsibleSubgroup('Основные жанры', 'mainGenres', 'Очистить основные жанры', (body) => {
                    P.mainGenres.forEach(gName => {
                        body.appendChild(P.createFilterItemElement(gName, innerPanel));
                    });
                });
                currentList.appendChild(mainGenresSub);
                const themesWrap = document.createElement('div');
                themesWrap.className = 'custom-subgroup-wrapper';
                themesWrap.dataset.subgroup = 'themes';
                const themesHeader = document.createElement('div');
                themesHeader.className = 'custom-genre-subgroup-header';
                const themesTitleEl = document.createElement('span');
                themesTitleEl.textContent = 'Темы';
                themesHeader.appendChild(themesTitleEl);
const themesControls = document.createElement('span');
themesControls.className = 'custom-heading-controls';
const themesStateLabel = document.createElement('span');
themesStateLabel.className = 'custom-heading-state-label';
themesStateLabel.textContent = 'Свернуть';
themesControls.appendChild(themesStateLabel);
const themesTrash = P.createSectionTrashButton('sub_themes', 'Очистить темы', () => themesWrap, innerPanel);
themesControls.appendChild(themesTrash);
themesHeader.appendChild(themesControls);
const themesBody = document.createElement('div');
themesBody.className = 'custom-subgroup-body';
const themesScrollBox = document.createElement('div');
themesScrollBox.className = 'custom-themes-scroll-box';
const themesTopStickyBtn = document.createElement('div');
themesTopStickyBtn.className = 'custom-themes-floating-collapse top hidden';
themesTopStickyBtn.textContent = 'СВЕРНУТЬ';
themesScrollBox.appendChild(themesTopStickyBtn);
const themeItemsEls = [];
P.themeGenres.forEach(gName => {
const itemEl = P.createFilterItemElement(gName, innerPanel, null, true);
themeItemsEls.push(itemEl);
themesScrollBox.appendChild(itemEl);
});
const themesBottomBtn = document.createElement('div');
themesBottomBtn.className = 'custom-themes-sticky-footer';
themesBottomBtn.textContent = 'ПОКАЗАТЬ ВСЕ';
themesScrollBox.appendChild(themesBottomBtn);
themesScrollBox.addEventListener('wheel', (e) => {
if (themesScrollBox.classList.contains('expanded-all')) return;
const panelRect = innerPanel.getBoundingClientRect();
const btnRect = themesBottomBtn.getBoundingClientRect();
const isShowAllFullyVisible = btnRect.bottom <= panelRect.bottom + 1 && btnRect.top >= panelRect.top - 1;
if (!isShowAllFullyVisible) {
e.preventDefault();
innerPanel.scrollTop += e.deltaY;
}
}, { passive: false });
function updateThemesStickyState() {
const isExpandedAll = themesScrollBox.classList.contains('expanded-all');
if (!isExpandedAll || themesBody.classList.contains('hidden') || currentList.classList.contains('hidden')) {
themesTopStickyBtn.classList.add('hidden');
themesBottomBtn.classList.remove('floating-bottom');
themesBottomBtn.style.removeProperty('left');
themesBottomBtn.style.removeProperty('width');
return;
}
const panelRect = innerPanel.getBoundingClientRect();
const boxRect = themesScrollBox.getBoundingClientRect();
const firstItem = themeItemsEls;
const lastItem = themeItemsEls[themeItemsEls.length - 1];
let bottomIsInline = false;
if (lastItem) {
const lastRect = lastItem.getBoundingClientRect();
const bottomOutOfView = lastRect.bottom > panelRect.bottom - 4 && boxRect.top < panelRect.bottom - 40;
bottomIsInline = !bottomOutOfView;
themesBottomBtn.classList.toggle('floating-bottom', bottomOutOfView);
if (bottomOutOfView) {
themesBottomBtn.style.left = boxRect.left + 'px';
themesBottomBtn.style.width = boxRect.width + 'px';
} else {
themesBottomBtn.style.removeProperty('left');
themesBottomBtn.style.removeProperty('width');
}
}
if (firstItem) {
const firstRect = firstItem.getBoundingClientRect();
const topOutOfView = firstRect.top < panelRect.top + 4 && boxRect.bottom > panelRect.top + 40;
const showTopBtn = topOutOfView && !bottomIsInline;
themesTopStickyBtn.classList.toggle('hidden', !showTopBtn);
if (showTopBtn) {
themesTopStickyBtn.style.top = (panelRect.top + 4) + 'px';
themesTopStickyBtn.style.left = boxRect.left + 'px';
themesTopStickyBtn.style.width = boxRect.width + 'px';
}
}
}
innerPanel._updateThemesStickyState = updateThemesStickyState;
function setThemesExpandedAll(expanded) {
themesScrollBox.classList.toggle('expanded-all', expanded);
themesBottomBtn.textContent = expanded ? 'СВЕРНУТЬ' : 'ПОКАЗАТЬ ВСЕ';
P.saveSectionState('themesExpandedAll', expanded);
if (!expanded) {
themesTopStickyBtn.classList.add('hidden');
themesBottomBtn.classList.remove('floating-bottom');
themesBottomBtn.style.removeProperty('left');
themesBottomBtn.style.removeProperty('width');
} else {
setTimeout(updateThemesStickyState, 0);
requestAnimationFrame(updateThemesStickyState);
}
}
themesTopStickyBtn.addEventListener('click', (e) => {
e.preventDefault();
e.stopPropagation();
setThemesExpandedAll(false);
});
themesBottomBtn.addEventListener('click', (e) => {
e.preventDefault();
e.stopPropagation();
setThemesExpandedAll(!themesScrollBox.classList.contains('expanded-all'));
});
if (savedState.themesExpandedAll === true) {
setThemesExpandedAll(true);
}
themesBody.appendChild(themesScrollBox);
function setThemesSubExpanded(expanded) {
themesBody.classList.toggle('hidden', !expanded);
themesHeader.classList.toggle('is-collapsed', !expanded);
themesStateLabel.textContent = expanded ? 'Свернуть' : 'Показать';
P.saveSectionState('subgroup_themes', expanded);
requestAnimationFrame(updateThemesStickyState);
}
themesBody.appendChild(P.createCollapseGroupButton(() => setThemesSubExpanded(false)));
themesHeader.addEventListener('click', (e) => {
if (e.target.closest('.custom-trash-btn')) return;
e.preventDefault();
e.stopPropagation();
setThemesSubExpanded(themesBody.classList.contains('hidden'));
});
if (savedState['subgroup_themes'] === false) {
setThemesSubExpanded(false);
}
themesWrap.appendChild(themesHeader);
themesWrap.appendChild(themesBody);
currentList.appendChild(themesWrap);
const eroticaWrap = document.createElement('div');
eroticaWrap.className = 'custom-subgroup-wrapper';
eroticaWrap.dataset.subgroup = 'erotica';
const eroticaHeader = document.createElement('div');
eroticaHeader.className = 'custom-erotica-header is-collapsed';
const eroticaTitleSpan = document.createElement('span');
eroticaTitleSpan.textContent = '18+';
eroticaHeader.appendChild(eroticaTitleSpan);
const eroticaControls = document.createElement('span');
eroticaControls.className = 'custom-heading-controls';
const eroticaStateLabel = document.createElement('span');
eroticaStateLabel.className = 'custom-heading-state-label';
eroticaStateLabel.textContent = 'Показать';
eroticaControls.appendChild(eroticaStateLabel);
const eroticaTrash = P.createSectionTrashButton('sub_erotica', 'Очистить 18+', () => eroticaWrap, innerPanel);
eroticaControls.appendChild(eroticaTrash);
eroticaHeader.appendChild(eroticaControls);
const eroticaBody = document.createElement('div');
eroticaBody.className = 'custom-erotica-body hidden';
P.eroticaGenres.forEach(gName => {
eroticaBody.appendChild(P.createFilterItemElement(gName, innerPanel, null, true));
});
function setEroticaExpanded(expanded) {
eroticaBody.classList.toggle('hidden', !expanded);
eroticaHeader.classList.toggle('is-collapsed', !expanded);
eroticaStateLabel.textContent = expanded ? 'Свернуть' : 'Показать';
P.saveSectionState('eroticaExpanded', expanded);
requestAnimationFrame(updateThemesStickyState);
}
eroticaBody.appendChild(P.createCollapseGroupButton(() => setEroticaExpanded(false)));
eroticaHeader.addEventListener('click', (e) => {
if (e.target.closest('.custom-trash-btn')) return;
e.preventDefault();
e.stopPropagation();
setEroticaExpanded(eroticaBody.classList.contains('hidden'));
});
if (savedState.eroticaExpanded === true) {
setEroticaExpanded(true);
}
eroticaWrap.appendChild(eroticaHeader);
eroticaWrap.appendChild(eroticaBody);
currentList.appendChild(eroticaWrap);
innerPanel._setEroticaExpanded = setEroticaExpanded;
} else {
section.items.forEach(text => currentList.appendChild(P.createFilterItemElement(text, innerPanel)));
}
if (section.title === 'Тип') {
const extraContainer = document.createElement('div');
extraContainer.className = 'custom-type-extra-list hidden';
P.extraTypeItems.forEach(extraText => extraContainer.appendChild(P.createFilterItemElement(extraText, innerPanel)));
const toggleExtraBtn = document.createElement('li');
toggleExtraBtn.className = 'custom-type-expand-btn is-collapsed';
const toggleExtraLabel = document.createElement('span');
toggleExtraLabel.className = 'custom-type-expand-label';
toggleExtraLabel.textContent = 'Показать все';
const toggleExtraArrow = document.createElement('span');
toggleExtraArrow.className = 'custom-type-expand-arrow';
toggleExtraArrow.textContent = '▲';
toggleExtraBtn.appendChild(toggleExtraLabel);
toggleExtraBtn.appendChild(toggleExtraArrow);
function setExtraTypesExpanded(expanded) {
extraContainer.classList.toggle('hidden', !expanded);
toggleExtraBtn.classList.toggle('is-collapsed', !expanded);
toggleExtraLabel.textContent = expanded ? 'Скрыть' : 'Показать все';
P.saveSectionState('extraTypes', expanded);
}
toggleExtraBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setExtraTypesExpanded(extraContainer.classList.contains('hidden')); });
if (savedState.extraTypes === true) setExtraTypesExpanded(true);
currentList.appendChild(extraContainer);
currentList.appendChild(toggleExtraBtn);
innerPanel._setExtraTypesExpanded = setExtraTypesExpanded;
}
if (section.title === 'Страна' || section.title === 'Статус') {
currentList.appendChild(P.createCollapseGroupButton(() => setSectionExpanded(false)));
}
if (savedState[sectionKey] === false) setSectionExpanded(false);
sectionWrapper.appendChild(currentList);
innerPanel.appendChild(sectionWrapper);
});
innerPanel.addEventListener('scroll', () => {
if (typeof innerPanel._updateThemesStickyState === 'function') {
innerPanel._updateThemesStickyState();
}
}, { passive: true });
P.syncStatesFromUrl(innerPanel);
P.refreshAllTrashStates(innerPanel);
const extraContainerEl = innerPanel.querySelector('.custom-type-extra-list');
if (extraContainerEl && typeof innerPanel._setExtraTypesExpanded === 'function') {
if (savedState.extraTypes === undefined && extraContainerEl.querySelector('.state-check, .state-cross')) innerPanel._setExtraTypesExpanded(true);
}
const eroticaBodyEl = innerPanel.querySelector('.custom-erotica-body');
if (eroticaBodyEl && typeof innerPanel._setEroticaExpanded === 'function') {
if (savedState.eroticaExpanded === undefined && eroticaBodyEl.querySelector('.state-check, .state-cross')) innerPanel._setEroticaExpanded(true);
}
if (topRefs && topRefs.myListBody && savedState.myList === undefined && topRefs.myListBody.querySelector('.state-check, .state-cross')) {
topRefs.setMyListExpanded(true);
}
if (typeof innerPanel._updateThemesStickyState === 'function') {
setTimeout(innerPanel._updateThemesStickyState, 50);
}
};
})();
// === БЛОК 12 из 12: Монтирование панели, отслеживание pushState/replaceState сайта и инициализация ===
(function() {
    'use strict';
    const P = Anime365Panel;
    P.getHeaderBottomOffset = function() {
        const header = document.querySelector('header, nav, .navbar-fixed');
        if (header) {
            const rect = header.getBoundingClientRect();
            if (rect.height > 0 && rect.bottom > 0) return Math.round(rect.bottom);
        }
        return 64;
    };
    P.updatePanelVerticalBounds = function() {
        const wrapper = document.getElementById('custom-left-genre-panel-wrapper');
        const hoverZone = document.getElementById('genre-panel-hover-zone');
        if (!wrapper) return;
        const topOffset = P.getHeaderBottomOffset();
        wrapper.style.top = topOffset + 'px';
        wrapper.style.height = `calc(100vh - ${topOffset}px)`;
        if (hoverZone) {
            hoverZone.style.top = topOffset + 'px';
            hoverZone.style.height = `calc(100vh - ${topOffset}px)`;
        }
        const innerPanel = document.getElementById('custom-left-genre-panel-inner');
        if (innerPanel && typeof innerPanel._updateThemesStickyState === 'function') {
            innerPanel._updateThemesStickyState();
        }
    };
    P.syncMiniPagerPosition = function() {
        const pager = document.querySelector('#yw0 > div.mini-pager.card');
        if (!pager) return;
        const isPanelOpen = document.body.classList.contains('genre-panel-open');
        if (!isPanelOpen) {
            pager.style.removeProperty('left');
            pager.style.removeProperty('right');
            return;
        }
        const isRightSide = document.body.classList.contains('genre-panel-side-right');
        if (isRightSide) {
            pager.style.setProperty('left', '20px', 'important');
            pager.style.setProperty('right', 'auto', 'important');
        } else {
            pager.style.setProperty('right', '20px', 'important');
            pager.style.setProperty('left', 'auto', 'important');
        }
    };
    P.injectStyles = function() {
        if (document.getElementById('custom-genre-panel-styles')) return;
        const style = document.createElement('style');
        style.id = 'custom-genre-panel-styles';
        style.textContent = (P.cssPart1 || '') + (P.cssPart2 || '') + (P.cssPart3 || '');
        document.head.appendChild(style);
    };
    P.removeGenrePanel = function() {
        const wrapper = document.getElementById('custom-left-genre-panel-wrapper');
        const hoverZone = document.getElementById('genre-panel-hover-zone');
        const tooltip = document.getElementById('custom-my-filter-tooltip');
        if (wrapper) wrapper.remove();
        if (hoverZone) hoverZone.remove();
        if (tooltip) tooltip.remove();
        document.body.classList.remove('genre-panel-open', 'genre-panel-is-collapsed', 'genre-panel-side-right');
        P.syncMiniPagerPosition();
    };
    P.checkRouteAllowed = function() {
        let path = window.location.pathname;
        while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
        return path === '/anime' || path === '/ongoing' || path === '/catalog/filter' || path.indexOf('/catalog/filter/') === 0;
    };
    P.createGenrePanel = function() {
        if (!P.checkRouteAllowed()) {
            P.removeGenrePanel();
            return;
        }
        P.injectStyles();
        let wrapper = document.getElementById('custom-left-genre-panel-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'custom-left-genre-panel-wrapper';
            const innerPanel = document.createElement('div');
            innerPanel.id = 'custom-left-genre-panel-inner';
            wrapper.appendChild(innerPanel);
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'genre-panel-toggle';
            toggleBtn.type = 'button';
            wrapper.appendChild(toggleBtn);
            const hoverZone = document.createElement('div');
            hoverZone.id = 'genre-panel-hover-zone';
            document.body.appendChild(wrapper);
            document.body.appendChild(hoverZone);
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                const isCollapsed = wrapper.classList.toggle('collapsed');
                document.body.classList.toggle('genre-panel-is-collapsed', isCollapsed);
            });
            hoverZone.addEventListener('mouseenter', () => toggleBtn.classList.add('force-glow'));
            hoverZone.addEventListener('mouseleave', () => toggleBtn.classList.remove('force-glow'));
            P.buildStaticGenres(innerPanel);
        } else {
            const innerPanel = document.getElementById('custom-left-genre-panel-inner');
            if (innerPanel) {
                const prevScrollTop = innerPanel.scrollTop;
                P.buildStaticGenres(innerPanel);
                innerPanel.scrollTop = prevScrollTop;
            }
        }
        const isRightSide = P.getActivePanelSide() === 'right';
        wrapper.classList.toggle('side-right', isRightSide);
        const hz = document.getElementById('genre-panel-hover-zone');
        if (hz) hz.classList.toggle('side-right', isRightSide);
        document.body.classList.add('genre-panel-open');
        document.body.classList.toggle('genre-panel-side-right', isRightSide);
        document.body.classList.toggle('genre-panel-is-collapsed', wrapper.classList.contains('collapsed'));
        if (typeof P.applySeasonsVisibility === 'function' && typeof P.getActiveSeasonsMode === 'function') {
            P.applySeasonsVisibility(P.getActiveSeasonsMode());
        }
        P.updatePanelVerticalBounds();
        P.syncMiniPagerPosition();
    };
    P.hookHistoryChanges = function() {
        if (P._historyHooked) return;
        P._historyHooked = true;
        const origPush = window.history.pushState;
        const origReplace = window.history.replaceState;
        window.history.pushState = function() {
            const res = origPush.apply(this, arguments);
            window.dispatchEvent(new Event('anime365_urlchange'));
            return res;
        };
        window.history.replaceState = function() {
            const res = origReplace.apply(this, arguments);
            window.dispatchEvent(new Event('anime365_urlchange'));
            return res;
        };
    };
    P.init = function() {
        P.hookHistoryChanges();
        let lastUrl = window.location.href;
        function handleUrlChange() {
            if (window.location.href === lastUrl) return;
            lastUrl = window.location.href;
            const innerPanel = document.getElementById('custom-left-genre-panel-inner');
            if (innerPanel && P.checkRouteAllowed() && typeof P.syncStatesFromUrl === 'function') {
                P.syncStatesFromUrl(innerPanel);
            } else {
                P.createGenrePanel();
            }
        }
        P.createGenrePanel();
        window.addEventListener('popstate', handleUrlChange);
        window.addEventListener('anime365_urlchange', handleUrlChange);
        window.addEventListener('resize', P.updatePanelVerticalBounds);
        setInterval(() => {
            handleUrlChange();
            if (document.getElementById('custom-left-genre-panel-wrapper')) {
                document.body.classList.add('genre-panel-open');
                P.syncMiniPagerPosition();
            }
        }, 200);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', P.init);
    else P.init();
})();
// === ОТДЕЛЬНЫЙ МОДУЛЬ: Компактные постеры (изолированные ряды по 6 в ряд, нормальная пагинация и поиск) ===
(function() {
    'use strict';
    const SAVED_CHANGES_KEY = 'anime365_my_filter_saved_changes';
    const STYLE_ID = 'anime365-small-posters-style';
    const TYPE_LABELS = ['ТВ сериал', 'ТВ Спешл', 'Фильм', 'OVA', 'ONA', 'Спешл', 'Клип', 'Реклама'];
    function isCatalogRouteAllowed() {
        let path = window.location.pathname;
        while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
        return path === '/anime' || path === '/ongoing' || path === '/catalog/filter' || path.indexOf('/catalog/filter/') === 0;
    }
    function injectSmallPostersStyles() {
        const existing = document.getElementById(STYLE_ID);
        if (existing) existing.remove();
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            body.anime365-small-posters #yw0 > div.items.row.no-margin-bottom.m-catalog-list {
                display: flex !important;
                flex-wrap: wrap !important;
                align-items: stretch !important;
                clear: both !important;
                float: none !important;
                margin-left: -4px !important;
                margin-right: -4px !important;
                margin-bottom: 12px !important;
            }
            body.anime365-small-posters #yw0 > div.items.row.no-margin-bottom.m-catalog-list::before,
            body.anime365-small-posters #yw0 > div.items.row.no-margin-bottom.m-catalog-list::after,
            body.anime365-small-posters #yw0 > div.items.row.no-margin-bottom.m-catalog-list > div.clearfix {
                display: none !important;
                content: none !important;
            }
            body.anime365-small-posters #yw0 > div.items.row.no-margin-bottom.m-catalog-list > div.col {
                width: 16.666667% !important;
                max-width: 16.666667% !important;
                flex: 0 0 16.666667% !important;
                margin: 0 0 12px 0 !important;
                padding: 0 4px !important;
                box-sizing: border-box !important;
                float: none !important;
                clear: none !important;
            }
            @media (max-width: 1366px) {
                body.anime365-small-posters #yw0 > div.items.row.no-margin-bottom.m-catalog-list > div.col {
                    width: 20% !important;
                    max-width: 20% !important;
                    flex: 0 0 20% !important;
                }
            }
            @media (max-width: 1080px) {
                body.anime365-small-posters #yw0 > div.items.row.no-margin-bottom.m-catalog-list > div.col {
                    width: 25% !important;
                    max-width: 25% !important;
                    flex: 0 0 25% !important;
                }
            }
            body.anime365-small-posters #yw0 .m-catalog-item {
                margin: 0 auto !important;
                width: 100% !important;
                max-width: 162px !important;
                height: 100% !important;
            }
            body.anime365-small-posters #yw0 .m-catalog-item__poster a {
                padding-bottom: 142% !important;
                height: 0 !important;
                display: block !important;
                background-size: cover !important;
                background-position: center top !important;
            }
            body.anime365-small-posters #yw0 .m-catalog-item .card-content {
                padding: 6px 7px 7px 7px !important;
            }
            body.anime365-small-posters #yw0 .m-catalog-item .card-content > *:not(h5.line-1):not(.custom-compact-meta) {
                display: none !important;
            }
            body.anime365-small-posters #yw0 .m-catalog-item .card-content h5.line-1 {
                margin: 0 0 4px 0 !important;
                font-size: 13.5px !important;
                font-weight: 500 !important;
                line-height: 1.25 !important;
                height: auto !important;
                max-height: none !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                display: block !important;
            }
            body.anime365-small-posters #yw0 .m-catalog-item .card-content h5.line-1 a {
                display: inline !important;
                white-space: nowrap !important;
            }
            body.anime365-small-posters #yw0 .m-catalog-item .card-content h5.line-1 .online-h {
                display: none !important;
            }
            .custom-compact-meta {
                display: none !important;
            }
            body.anime365-small-posters .custom-compact-meta {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 5px !important;
                font-size: 12px !important;
                line-height: 1.2 !important;
                color: #9e9e9e !important;
            }
            body.anime365-small-posters .custom-compact-type {
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
            }
            body.anime365-small-posters .custom-compact-year {
                white-space: nowrap !important;
                flex-shrink: 0 !important;
                color: #b0bec5 !important;
            }
        `;
        document.head.appendChild(style);
    }
    function extractCardMeta(cardContent) {
        let detectedType = '';
        let detectedYear = '';
        cardContent.querySelectorAll('.tag, span, div').forEach(el => {
            if (el.classList.contains('custom-compact-meta') || el.closest('.custom-compact-meta')) return;
            const txt = el.textContent.trim();
            if (!txt) return;
            if (!detectedYear) {
                const yearMatch = txt.match(/\b(19\d{2}|20\d{2})\b/);
                if (yearMatch) detectedYear = yearMatch[1];
            }
            if (!detectedType) {
                const foundType = TYPE_LABELS.find(t => txt.toLowerCase() === t.toLowerCase());
                if (foundType) detectedType = foundType;
            }
        });
        if (!detectedType) detectedType = 'ТВ сериал';
        return { type: detectedType, year: detectedYear };
    }
    const observer = new MutationObserver(() => {
        if (!isCatalogRouteAllowed()) {
            document.body.classList.remove('anime365-small-posters');
            return;
        }
        if (document.body.classList.contains('anime365-small-posters')) {
            processCatalogCards();
        }
    });
    function startObserver() {
        observer.observe(document.body, { childList: true, subtree: true });
    }
    function processCatalogCards() {
        if (!isCatalogRouteAllowed()) return;
        const lists = document.querySelectorAll('#yw0 > div.items.row.no-margin-bottom.m-catalog-list');
        if (!lists.length) return;
        observer.disconnect();
        try {
            lists.forEach(list => {
                list.querySelectorAll('.m-catalog-item .card-content').forEach(content => {
                    const existingMeta = content.querySelector('.custom-compact-meta');
                    if (content.dataset.compactProcessed === '1' && existingMeta) return;
                    if (existingMeta) existingMeta.remove();
                    const { type, year } = extractCardMeta(content);
                    const titleLink = content.querySelector('h5.line-1 a');
                    if (titleLink && !titleLink.title) {
                        const clone = titleLink.cloneNode(true);
                        clone.querySelectorAll('.online-h').forEach(n => n.remove());
                        titleLink.title = clone.textContent.trim();
                    }
                    const metaRow = document.createElement('div');
                    metaRow.className = 'custom-compact-meta';
                    const typeSpan = document.createElement('span');
                    typeSpan.className = 'custom-compact-type';
                    typeSpan.textContent = type;
                    const yearSpan = document.createElement('span');
                    yearSpan.className = 'custom-compact-year';
                    yearSpan.textContent = year;
                    metaRow.appendChild(typeSpan);
                    metaRow.appendChild(yearSpan);
                    content.appendChild(metaRow);
                    content.dataset.compactProcessed = '1';
                });
            });
        } finally {
            startObserver();
        }
    }
    function isSmallPostersEnabled() {
        try {
            const raw = localStorage.getItem(SAVED_CHANGES_KEY);
            if (!raw) return true;
            const parsed = JSON.parse(raw);
            return parsed.posters !== 'normal';
        } catch (e) {
            return true;
        }
    }
    function syncSmallPostersState(forceState) {
        if (!isCatalogRouteAllowed()) {
            document.body.classList.remove('anime365-small-posters');
            return;
        }
        injectSmallPostersStyles();
        const enabled = typeof forceState === 'boolean' ? forceState : isSmallPostersEnabled();
        document.body.classList.toggle('anime365-small-posters', enabled);
        if (enabled) processCatalogCards();
    }
    if (typeof window.Anime365Panel === 'object' && window.Anime365Panel) {
        window.Anime365Panel.refreshSmallPosters = syncSmallPostersState;
    }
    window.addEventListener('anime365_posters_mode_change', (e) => {
        const mode = e && e.detail && e.detail.mode;
        syncSmallPostersState(mode === 'small');
    });
    window.addEventListener('popstate', () => syncSmallPostersState());
window.addEventListener('anime365_urlchange', () => syncSmallPostersState());
function initSmallPostersModule() {
syncSmallPostersState();
startObserver();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSmallPostersModule);
else initSmallPostersModule();
})();

