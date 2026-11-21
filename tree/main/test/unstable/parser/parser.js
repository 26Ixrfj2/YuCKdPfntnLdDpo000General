(function() {
    'use strict';

    function createButtons() {
        if (!window.location.pathname.includes('/series/')) return;
        if (document.getElementById('cr-parser-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'cr-parser-panel';
        Object.assign(panel.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '999999',
            display: 'flex',
            gap: '8px'
        });

        const btnStyle = {
            padding: '11px 14px',
            color: '#fff',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
        };

        const textBtn = document.createElement('button');
        textBtn.innerText = '📄 Скачать JS-данные';
        Object.assign(textBtn.style, btnStyle, { backgroundColor: '#2abdbb' });
        textBtn.addEventListener('click', downloadJsData);

        const hdBtn = document.createElement('button');
        hdBtn.innerText = '🖼️ Подготовить HD + .bat';
        Object.assign(hdBtn.style, btnStyle, { backgroundColor: '#f47521' });
        hdBtn.addEventListener('click', () => preparePageAndBat(false));

        const blurBtn = document.createElement('button');
        blurBtn.innerText = '🌫️ Подготовить Blur + .bat';
        Object.assign(blurBtn.style, btnStyle, { backgroundColor: '#6c757d' });
        blurBtn.addEventListener('click', () => preparePageAndBat(true));

        panel.appendChild(textBtn);
        panel.appendChild(hdBtn);
        panel.appendChild(blurBtn);
        document.body.appendChild(panel);
    }

    setInterval(createButtons, 1000);

    function collectEpisodesData() {
        const cards = Array.from(document.querySelectorAll('[data-t*="episode-card"]'));
        if (!cards.length) {
            alert('Карточки серий не найдены! Прокрутите страницу вниз до конца списка.');
            return null;
        }

        const seriesTitle = document.querySelector('h1')?.innerText.trim() || 'Crunchyroll_Series';
        const safeSeriesName = seriesTitle.replace(/[\\/:*?"<>|]/g, '').trim();

        const items = cards.map((card, index) => {
            const epCode = 'E' + (index + 1);

            // Ищем точный заголовок серии из h3[data-t="episode-title"]
            const titleEl =
                card.querySelector('[data-t="episode-title"]') ||
                card.querySelector('a[class*="title-link"]') ||
                card.querySelector('h4 a, h3 a');

            const rawTitle = titleEl ? titleEl.innerText.trim() : epCode;
            // Убираем "E1 - " в начале, чтобы оставить чистое название серии
            const cleanTitle = rawTitle.replace(/^E\d+\s*[-–—:]\s*/i, '').trim() || rawTitle;

            // Продолжительность
            const duration = card.querySelector('[data-t="duration-info"]')?.innerText.trim() || '';

            // Дата выхода из span[data-t="meta-info"]
            const date = card.querySelector('[data-t="meta-info"]')?.innerText.trim() || '';

            // Описание
            const description = card.querySelector('[data-t="description"]')?.innerText.trim() || '';

            // Чёткая картинка
            const clearImgEl =
                card.querySelector('picture:nth-child(2) img') ||
                card.querySelector('img[class*="original"]') ||
                Array.from(card.querySelectorAll('img[data-t="card-image"]')).find(img => !img.src.includes('blur=')) ||
                card.querySelector('img');

            let rawClearUrl = clearImgEl ? (clearImgEl.currentSrc || clearImgEl.src) : '';
            let hdUrl = rawClearUrl
                .replace(/%2Cblur=\d+/gi, '')
                .replace(/,blur=\d+/gi, '')
                .replace('width=320', 'width=1280')
                .replace('height=180', 'height=720');

            // Размытая картинка
            const blurImgEl =
                card.querySelector('picture:nth-child(1) img') ||
                card.querySelector('img[class*="preview"]') ||
                Array.from(card.querySelectorAll('img[data-t="card-image"]')).find(img => img.src.includes('blur='));

            let blurUrl = blurImgEl ? (blurImgEl.currentSrc || blurImgEl.src) : '';
            if (!blurUrl && rawClearUrl) {
                blurUrl = rawClearUrl.includes('height=180')
                    ? rawClearUrl.replace('height=180', 'height=180%2Cblur=30')
                    : rawClearUrl;
            }

            const urlForHash = hdUrl || blurUrl;
            const fileWithExt = urlForHash.split('/').pop().split('?').at(0);
            const serverHash = fileWithExt.includes('.')
                ? fileWithExt.slice(0, fileWithExt.lastIndexOf('.'))
                : fileWithExt;

            return { epCode, rawTitle, cleanTitle, duration, date, description, hdUrl, blurUrl, serverHash };
        });

        return { seriesTitle, safeSeriesName, items };
    }
    function saveBlob(blob, filename) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    // Сохранение данных в виде готового JS-объекта
    function downloadJsData() {
        const data = collectEpisodesData();
        if (!data) return;

        const episodesObj = {};

        data.items.forEach(item => {
            episodesObj[item.epCode] = {
                title: item.cleanTitle,
                desc: item.description,
                duration: item.duration,
                date: item.date
            };
        });

        // Форматируем в красивый читаемый JS-код с отступами в 2 пробела
        const jsContent = `const episodesData = ${JSON.stringify(episodesObj, null, 2)};\n`;

        saveBlob(
            new Blob([jsContent], { type: 'application/javascript;charset=utf-8' }),
            `${data.safeSeriesName}_episodes.js`
        );
    }

    function preparePageAndBat(isBlur) {
        const data = collectEpisodesData();
        if (!data) return;

        const modeName = isBlur ? 'BLUR' : 'HD';
        const accentColor = isBlur ? '#8e9aaf' : '#f47521';
        const targetSubdir = isBlur ? `${data.safeSeriesName}\\blur` : `${data.safeSeriesName}`;
        const batName = isBlur ? `2_собрать_Blur_${data.safeSeriesName}.bat` : `1_собрать_HD_${data.safeSeriesName}.bat`;

        const batLines = [
            '@echo off',
            'chcp 65001 > nul',
            'cd /d "%~dp0"',
            `set "OUT_DIR=%~dp0${targetSubdir}"`,
            'mkdir "%OUT_DIR%" 2>nul',
            'echo Ищу папку с сохранёнными файлами страницы (*_files)...',
            'for /d %%D in (*_files) do ('
        ];

        data.items.forEach(item => {
            if (item.serverHash && item.serverHash.length > 5) {
                batLines.push(`    for %%F in ("%%D\\${item.serverHash}*.*") do copy /Y "%%F" "%OUT_DIR%\\${item.epCode}%%~xF" >nul`);
            }
        });

        batLines.push(')');
        batLines.push('echo.');
        batLines.push(`echo Готово! Картинки скопированы и переименованы в папку: ${targetSubdir}`);
        batLines.push('pause');

        saveBlob(new Blob([batLines.join('\r\n')], { type: 'text/plain;charset=utf-8' }), batName);

        document.body.innerHTML = '';
        document.body.style.backgroundColor = '#141519';
        document.body.style.color = '#fff';
        document.body.style.fontFamily = 'sans-serif';
        document.body.style.margin = '20px';

        const header = document.createElement('div');
        header.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid ${accentColor}; padding-bottom:12px; margin-bottom:15px;">
                <h2 style="margin:0;">${data.seriesTitle} — ${modeName} (${data.items.length} шт.)</h2>
                <button onclick="location.reload()" style="background:#333; color:#fff; border:none; padding:10px 16px; border-radius:6px; cursor:pointer; font-weight:bold;">🔄 Вернуть страницу</button>
            </div>
            <div style="background:#23252b; border-left:4px solid #28a745; padding:14px; border-radius:6px; margin-bottom:20px; font-size:14px; color:#eee; line-height:1.6;">
                <b>Файл <code>${batName}</code> уже скачан в «Загрузки»! Теперь сделайте 2 шага:</b><br>
                1. Нажмите прямо сейчас <b>Ctrl + S</b> -> выберите тип <b>«Веб-страница, полностью»</b> -> сохраните в папку <b>«Загрузки»</b>.<br>
                2. Запустите скачанный <b><code>${batName}</code></b> — он сам достанет все картинки из сохранённой папки и переименует их в <b>E1, E2, E3...</b>
            </div>
        `;
        document.body.appendChild(header);

        const grid = document.createElement('div');
        Object.assign(grid.style, {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '14px'
        });

        data.items.forEach(item => {
            const url = isBlur ? item.blurUrl : item.hdUrl;
            if (!url) return;

            const box = document.createElement('div');
            box.style.cssText = 'background:#23252b; padding:10px; border-radius:8px;';

            const img = document.createElement('img');
            img.src = url;
            img.alt = item.epCode;
            img.style.cssText = 'width:100%; height:auto; border-radius:4px; display:block;';

            const label = document.createElement('div');
            label.innerText = `${item.epCode} — ${item.cleanTitle} (${item.date})`;
            label.style.cssText = `margin-top:8px; font-size:13px; color:${accentColor}; font-weight:bold;`;

            box.appendChild(img);
            box.appendChild(label);
            grid.appendChild(box);
        });

        document.body.appendChild(grid);
    }
})();
