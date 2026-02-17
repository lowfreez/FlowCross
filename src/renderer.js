
document.querySelectorAll('.window-controls button').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (e.currentTarget.classList.contains('close-btn')) {
            window.launcher.windowControl('close');
        } else if (e.currentTarget.classList.contains('fullscreen-btn')) {
            window.launcher.windowControl('maximize');
        } else {
            window.launcher.windowControl('minimize');
        }
    });
});

const launchBtn = document.getElementById('launch-game-btn');
const progressBar = document.getElementById('launch-progress-bar');
const progressText = document.getElementById('launch-progress-text');
const progressContainer = document.getElementById('launch-progress-container');
const consoleOutput = document.getElementById('console-output');

const ramInput = document.getElementById('settings-global-ram');
const javaPathInput = document.getElementById('settings-java-path');
const jvmArgsInput = document.getElementById('settings-jvm-args');

const usernameDisplay = document.getElementById('home-profile-name');
const profileAvatar = document.getElementById('home-profile-avatar');
const profileInitial = document.getElementById('profile-initial');
const profileSelector = document.getElementById('profile-selector');
const versionSelect = document.getElementById('version-select');
const modloaderSelect = document.getElementById('modloader-select');
const versionsGrid = document.getElementById('versions-grid');

const btnOpenLauncher = document.getElementById('btn-open-launcher');
const btnOpenGame = document.getElementById('btn-open-game');
const btnOpenMods = document.getElementById('btn-open-mods');

let currentSettings = {};
let availableVersions = [];

async function init() {
    try {
        currentSettings = await window.launcher.getSettings();


        if (btnOpenLauncher) btnOpenLauncher.addEventListener('click', () => window.launcher.openFolder('launcher'));
        if (btnOpenGame) btnOpenGame.addEventListener('click', () => window.launcher.openFolder('game'));
        if (btnOpenMods) btnOpenMods.addEventListener('click', () => window.launcher.openFolder('mods'));

        const btnExport = document.getElementById('btn-export-settings');
        if (btnExport) btnExport.addEventListener('click', () => window.exportSettings());

        const btnImport = document.getElementById('btn-import-settings');
        if (btnImport) btnImport.addEventListener('click', () => window.importSettings());

        const btnExportAbout = document.getElementById('btn-export-about');
        if (btnExportAbout) btnExportAbout.addEventListener('click', () => window.exportSettings());

        const btnImportAbout = document.getElementById('btn-import-about');
        if (btnImportAbout) btnImportAbout.addEventListener('click', () => window.importSettings());

        if (versionSelect) {
            versionSelect.addEventListener('change', async (e) => {
                const version = e.target.value;
                if (!currentSettings.settings) currentSettings.settings = {};
                currentSettings.settings.gameVersion = version;
                await window.launcher.saveSettings(currentSettings);
            });
        }

        if (modloaderSelect) {
            modloaderSelect.addEventListener('change', async (e) => {
                const modloader = e.target.value;
                if (!currentSettings.settings) currentSettings.settings = {};
                currentSettings.settings.modloader = modloader;
                await window.launcher.saveSettings(currentSettings);

                await updateVersionList();
            });
        }

        loadNews();
        loadPatchNotes();


        const lang = currentSettings.settings?.language || 'ru';
        if (window.i18n) window.i18n.setLang(lang);

        updateUIFromSettings();
        await updateVersionList();

        setupCustomSelects();

    } catch (e) {
        console.error("Init error:", e);
        logToConsole('Error initializing launcher: ' + e.message);
    }
}

async function updateVersionList() {
    const loader = (currentSettings.settings?.modloader || (modloaderSelect ? modloaderSelect.value : 'none'));
    console.log("Updating versions for loader:", loader);




    try {
        if (loader === 'fabric') {
            availableVersions = await window.launcher.getFabricVersions();
        } else if (loader === 'forge') {
            availableVersions = await window.launcher.getForgeVersions();
        } else {
            availableVersions = await window.launcher.getVersions();
        }

        console.log(`Fetched ${availableVersions.length} versions for ${loader}`);
        populateVersionSelects();
        populateVersionsGrid();
    } catch (e) {
        console.error("Failed to update version list:", e);
        logToConsole("Failed to fetch versions for " + loader);
    }
}




const titleBar = document.querySelector('.title-bar');
if (titleBar) {
    let isDragging = false;
    let startX, startY;

    titleBar.addEventListener('mousedown', (e) => {
        if (e.target.closest('button') || e.target.closest('.logo')) return;
        isDragging = true;
        startX = e.screenX;
        startY = e.screenY;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.screenX - startX;
        const deltaY = e.screenY - startY;

        window.launcher.sendDragMove({ deltaX, deltaY });

        startX = e.screenX;
        startY = e.screenY;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}


let isLaunching = false;

launchBtn.addEventListener('click', async () => {
    if (isLaunching) {

        try {
            await window.launcher.abortLaunch();
        } catch (e) { console.error(e); }


        isLaunching = false;
        launchBtn.textContent = 'ИГРАТЬ';
        launchBtn.classList.remove('disabled');
        launchBtn.classList.remove('loading');
        launchBtn.classList.remove('cancel-mode');

        consoleOutput.innerHTML += '<div style="color: #ff5555;">> Запуск отменен пользователем.</div>';
        return;
    }


    isLaunching = true;
    launchBtn.classList.remove('disabled');
    launchBtn.textContent = 'ЗАПУСК...';
    launchBtn.classList.add('loading');

    consoleOutput.innerHTML = '';

    const profileId = currentSettings.selectedProfile;
    if (!currentSettings.profiles[profileId]) {
        consoleOutput.innerHTML += '<div style="color: #ff5555;">> Ошибка: Профиль не найден.</div>';
        isLaunching = false;
        launchBtn.textContent = 'ИГРАТЬ';
        launchBtn.style.background = '';
        return;
    }
    const profile = currentSettings.profiles[profileId];

    try {
        const settings = currentSettings.settings || {};
        await window.launcher.launch({
            username: profile.name,
            version: settings.gameVersion || '1.20.1',
            type: 'release',
            modloader: settings.modloader || 'none'
        });

    } catch (e) {
        console.error("Launch failed:", e);

    }
});


window.launcher.onGameExit((code) => {
    isLaunching = false;
    launchBtn.textContent = 'ИГРАТЬ';
    launchBtn.classList.remove('disabled');
    launchBtn.classList.remove('cancel-mode');
    launchBtn.style.background = '';
    launchBtn.classList.remove('loading');
    launchBtn.style.background = '';
    launchBtn.style.boxShadow = '';


    if (code === -1) {
        return;
    }

    if (code !== 0 && code !== null) {
        const logsContainer = document.getElementById('logs-container');
        let lastErrors = '';
        if (logsContainer) {
            const errorLines = Array.from(logsContainer.children)
                .filter(el => el.style.color === '#ef4444' || el.style.color === 'rgb(239, 68, 68)')
                .slice(-5)
                .map(el => el.textContent)
                .join('\n');
            if (errorLines) lastErrors = '\n\nПоследние ошибки:\n' + errorLines;
        }

        const errorModal = document.createElement('div');
        errorModal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;';
        errorModal.innerHTML = `
            <div style="background:#1a1a1a;border:1px solid #ef4444;border-radius:16px;padding:32px;max-width:480px;width:90%;color:#fff;text-align:center;">
                <div style="font-size:48px;margin-bottom:16px;">❌</div>
                <div style="font-size:18px;font-weight:700;margin-bottom:8px;">Игра завершилась с ошибкой</div>
                <div style="font-size:14px;color:rgba(255,255,255,0.6);margin-bottom:16px;">Код выхода: ${code}</div>
                ${lastErrors ? `<div style="background:#0d0d0d;border-radius:8px;padding:12px;text-align:left;font-size:11px;color:#ef4444;max-height:120px;overflow-y:auto;margin-bottom:16px;white-space:pre-wrap;word-break:break-all;">${lastErrors.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
                <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:20px;">Перейдите на страницу Логов для подробностей. Логи сохранены в папку лаунчера.</div>
                <button onclick="this.closest('div[style*=fixed]').remove()" style="padding:10px 32px;background:var(--accent-color, #0335fc);border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:14px;font-weight:600;">Закрыть</button>
            </div>
        `;
        document.body.appendChild(errorModal);
    }

    consoleOutput.innerHTML += `<div style="color: #ffff55;">> Игра закрыта (Код: ${code})</div>`;
    consoleOutput.innerHTML += `<div style="color: #ffff55;">> Игра закрыта (Код: ${code})</div>`;
});


window.launcher.onGameStarted(() => {
    launchBtn.textContent = 'ЗАКРЫТЬ';
    launchBtn.style.background = '#ff5555';
    launchBtn.style.boxShadow = '0 0 15px rgba(255, 85, 85, 0.6)';
    launchBtn.style.borderRadius = '12px';
});


window.launcher.onDownloadProgress((progress) => {

    let p = progress;
    if (p > 100) p = 100;
    if (p < 0) p = 0;


    if (isLaunching && launchBtn.textContent !== 'ЗАКРЫТЬ') {
        const progressColor = 'rgba(3, 53, 252, 0.8)';
        const emptyColor = 'rgba(255, 255, 255, 0.2)';
        launchBtn.style.background = `linear-gradient(90deg, ${progressColor} ${p}%, ${emptyColor} ${p}%)`;
        launchBtn.textContent = `ЗАГРУЗКА ${Math.round(p)}%`;
        launchBtn.style.borderRadius = '12px';
    }
});

window.launcher.onProgress((data) => {
    let percent = 0;
    let text = '';

    if (data.type === 'assets' || data.type === 'natives' || data.type === 'classes') {
        percent = (data.task / data.total) * 100;
        text = `РЕСУРСЫ: ${Math.round(percent)}%`;
    } else {
        text = 'ЗАГРУЗКА...';
    }


    if (isLaunching && launchBtn.textContent !== 'ЗАКРЫТЬ') {
        launchBtn.textContent = text;
        const progressColor = 'rgba(3, 53, 252, 0.8)';
        const emptyColor = 'rgba(255, 255, 255, 0.2)';
        launchBtn.style.background = `linear-gradient(90deg, ${progressColor} ${percent}%, ${emptyColor} ${percent}%)`;
    }
});

window.launcher.onLog((data) => {
    logToConsole(data);
    if (typeof data === 'string' && data.includes('Setting up game...')) {

        launchBtn.textContent = "НАСТРОЙКА...";
    }
    if (typeof data === 'string' && (data.includes('Launching with') || data.includes('Minecraft process exited'))) {
        launchBtn.textContent = 'ЗАПУЩЕНО';
        launchBtn.classList.remove('loading');
        launchBtn.classList.remove('cancel-mode');
    }
});


window.saveSettingsFromModal = async () => {
    if (!currentSettings.settings) currentSettings.settings = {};

    currentSettings.settings.ram = parseInt(ramInput.value);
    currentSettings.settings.javaPath = javaPathInput.value;
    currentSettings.settings.jvmArgs = jvmArgsInput.value;

    const overlayToggle = document.getElementById('settings-modal-overlay-enabled');
    if (overlayToggle) {
        currentSettings.settings.overlayEnabled = overlayToggle.checked;
    }

    const accentColorInput = document.getElementById('settings-modal-accent-color');
    if (accentColorInput) {
        currentSettings.settings.accentColor = accentColorInput.value;
    }

    await window.launcher.saveSettings(currentSettings);
    updateUIFromSettings();
    applyThemeSettings();
    closeModal('settings-modal');
};

function applyThemeSettings() {
    const settings = currentSettings.settings || {};
    const root = document.documentElement;

    if (settings.accentColor) {
        const color = settings.accentColor;
        root.style.setProperty('--accent-color', color);
        root.style.setProperty('--accent-light', color);
        root.style.setProperty('--accent-dark', color);
    }
}


window.previewAccentColor = (color) => {
    document.documentElement.style.setProperty('--accent-color', color);
};

window.resetAccentColor = () => {
    const defaultColor = '#0335fc';
    document.documentElement.style.setProperty('--accent-color', defaultColor);
    const input = document.getElementById('settings-modal-accent-color');
    if (input) input.value = defaultColor;
};

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

window.openFolder = (type) => {
    window.launcher.openFolder(type);
};

let currentBannerIndex = 0;
let newsItems = [];
let bannerInterval;

window.loadNews = async () => {
    const slidesContainer = document.getElementById('news-slides');
    if (!slidesContainer) return;

    try {
        const news = await window.launcher.fetchNews();
        if (news && news.length > 0) {
            newsItems = news.slice(0, 10);
            slidesContainer.innerHTML = '';

            newsItems.forEach((item, index) => {
                const slide = document.createElement('div');
                slide.className = 'news-slide';
                slide.style.flex = '0 0 100%';
                slide.style.height = '100%';
                slide.style.backgroundImage = `url('${item.newsPageImage?.url || ''}')`;
                slide.style.backgroundSize = 'cover';
                slide.style.backgroundPosition = 'center';
                slide.style.cursor = 'pointer';
                slide.onclick = () => window.launcher.openExternal('https://minecraft.net' + item.readMoreLink);
                slidesContainer.appendChild(slide);

                if (!item.newsPageImage?.url) {
                    slide.style.backgroundImage = `url('https://www.minecraft.net/content/dam/games/minecraft/key-art/Heroes-Key-Art-0-1080x1080.jpg')`;
                }
            });

            updateBanner();
            startBannerAutoPlay();
        } else {
            document.getElementById('banner-title').textContent = 'Нет новостей';
            document.getElementById('banner-text').textContent = 'Не удалось загрузить новости.';
        }
    } catch (e) {
        document.getElementById('banner-title').textContent = 'Ошибка';
        document.getElementById('banner-text').textContent = 'Ошибка загрузки новостей.';
        console.error("News load error:", e);
    }
};

let allPatchNotes = [];

window.loadPatchNotes = async () => {
    const grid = document.getElementById('changelog-grid');
    if (!grid) return;

    try {
        const notes = await window.launcher.fetchPatchNotes();
        if (notes && notes.length > 0) {
            allPatchNotes = notes;
            renderPatchNotes(allPatchNotes);
        } else {
            grid.innerHTML = '<div style="color: rgba(255,255,255,0.3); text-align: center; grid-column: 1 / -1; padding: 40px;">Нет данных об изменениях</div>';
        }
    } catch (e) {
        grid.innerHTML = `<div style="color: rgba(255,255,255,0.3); text-align: center; grid-column: 1 / -1; padding: 40px;">Ошибка загрузки: ${e.message}</div>`;
        console.error("Patch notes load error:", e);
    }
};

function renderPatchNotes(notes) {
    const grid = document.getElementById('changelog-grid');
    if (!grid) return;
    grid.innerHTML = '';

    notes.forEach(note => {
        const isRelease = note.type === 'release';
        const badgeColor = isRelease ? '#22c55e' : '#f59e0b';
        const badgeBg = isRelease ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)';
        const badgeText = isRelease ? 'Релиз' : 'Снапшот';

        const dateStr = note.date ? new Date(note.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

        const card = document.createElement('div');
        card.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; overflow: hidden; transition: all 0.2s; cursor: pointer;';
        card.onmouseenter = () => { card.style.background = 'rgba(255,255,255,0.06)'; card.style.borderColor = 'rgba(255,255,255,0.12)'; card.style.transform = 'translateY(-2px)'; };
        card.onmouseleave = () => { card.style.background = 'rgba(255,255,255,0.03)'; card.style.borderColor = 'rgba(255,255,255,0.06)'; card.style.transform = 'translateY(0)'; };
        card.onclick = () => openChangelogDetails(note);

        let imgHtml = '';
        if (note.image) {
            imgHtml = `<div style="width: 100%; height: 140px; background-image: url('${note.image}'); background-size: cover; background-position: center;"></div>`;
        } else {
            imgHtml = `<div style="width: 100%; height: 140px; background: linear-gradient(135deg, rgba(3,53,252,0.15) 0%, rgba(77,127,255,0.08) 100%); display: flex; align-items: center; justify-content: center;"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 14L11 16L15 12"/></svg></div>`;
        }

        card.innerHTML = `
            ${imgHtml}
            <div style="padding: 14px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span style="padding: 2px 8px; background: ${badgeBg}; color: ${badgeColor}; border-radius: 6px; font-size: 11px; font-weight: 600;">${badgeText}</span>
                    <span style="color: rgba(255,255,255,0.35); font-size: 11px;">${dateStr}</span>
                </div>
                <div style="font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 4px; line-height: 1.3;">${note.title || note.version}</div>
                <div style="font-size: 12px; color: rgba(255,255,255,0.5); font-weight: 500;">${note.version}</div>
                ${note.shortText ? `<div style="font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 8px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${note.shortText}</div>` : ''}
            </div>
        `;
        grid.appendChild(card);
    });
}

window.openChangelogDetails = async (note) => {
    const modal = document.getElementById('changelog-details-modal');
    const content = document.getElementById('changelog-modal-content');
    const banner = document.getElementById('changelog-details-banner');
    const title = document.getElementById('changelog-details-title');
    const meta = document.getElementById('changelog-details-meta');
    const version = document.getElementById('changelog-details-version');
    const contentArea = document.getElementById('changelog-details-content');
    const loading = document.getElementById('changelog-details-loading');

    if (!modal) return;

    modal.style.display = 'block';
    modal.offsetHeight;
    modal.style.opacity = '1';
    content.style.transform = 'translateY(0)';

    const isRelease = note.type === 'release';
    const badgeColor = isRelease ? '#22c55e' : '#f59e0b';
    const badgeBg = isRelease ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)';
    const badgeText = isRelease ? 'Релиз' : 'Снапшот';
    const dateStr = note.date ? new Date(note.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    title.textContent = note.title || note.version;
    version.textContent = `Версия: ${note.version}`;

    meta.innerHTML = `
        <span style="padding: 4px 10px; background: ${badgeBg}; color: ${badgeColor}; border-radius: 6px; font-size: 12px; font-weight: 600;">${badgeText}</span>
        <span style="padding: 4px 10px; background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); border-radius: 6px; font-size: 12px;">${dateStr}</span>
    `;

    if (note.image) {
        banner.style.backgroundImage = `url('${note.image}')`;
    } else {
        banner.style.backgroundImage = `linear-gradient(135deg, #0335fc 0%, #4d7fff 100%)`;
    }

    contentArea.innerHTML = '';
    loading.style.display = 'block';

    if (note.contentPath) {
        try {
            let data = await window.launcher.fetchContent(note.contentPath);
            loading.style.display = 'none';
            if (data) {
                let htmlContent = data;
                if (typeof data === 'string' && (data.trim().startsWith('{') || data.trim().startsWith('['))) {
                    try {
                        const json = JSON.parse(data);
                        if (json.body) htmlContent = json.body;
                    } catch (e) {

                    }
                } else if (typeof data === 'object' && data.body) {
                    htmlContent = data.body;
                }

                contentArea.innerHTML = htmlContent;

                const images = contentArea.querySelectorAll('img');
                images.forEach(img => {
                    img.style.maxWidth = '100%';
                    img.style.borderRadius = '8px';
                    img.style.marginTop = '20px';
                    img.style.marginBottom = '20px';
                    if (img.getAttribute('src').startsWith('/')) {
                        img.src = 'https://minecraft.net' + img.getAttribute('src');
                    }
                });

                const links = contentArea.querySelectorAll('a');
                links.forEach(a => {
                    a.style.color = '#4d7fff';
                    a.onclick = (e) => { e.preventDefault(); window.launcher.openExternal(a.href); };
                });

            } else {
                contentArea.innerHTML = '<div style="opacity: 0.5;">Не удалось загрузить подробности.</div>';
            }
        } catch (e) {
            loading.style.display = 'none';
            contentArea.innerHTML = '<div style="opacity: 0.5;">Ошибка загрузки.</div>';
            console.error(e);
        }
    } else {
        loading.style.display = 'none';
        contentArea.innerHTML = note.shortText || '<div style="opacity: 0.5;">Нет дополнительного описания.</div>';
    }
};

window.closeChangelogDetails = () => {
    const modal = document.getElementById('changelog-details-modal');
    const content = document.getElementById('changelog-modal-content');
    if (modal) {
        modal.style.opacity = '0';
        if (content) content.style.transform = 'translateY(20px)';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
};


const style = document.createElement('style');
style.textContent = `
@keyframes spin { 100% { transform: rotate(360deg); } }
#changelog-details-content h1 { font-size: 24px; margin-top: 24px; margin-bottom: 12px; color: #fff; }
#changelog-details-content h2 { font-size: 20px; margin-top: 20px; margin-bottom: 10px; color: #fff; }
#changelog-details-content h3 { font-size: 18px; margin-top: 16px; margin-bottom: 8px; color: #eee; }
#changelog-details-content p { margin-bottom: 12px; color: #ccc; }
#changelog-details-content ul, #changelog-details-content ol { margin-left: 20px; margin-bottom: 16px; color: #ccc; }
#changelog-details-content li { margin-bottom: 6px; }
#changelog-details-content code { background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
`;
document.head.appendChild(style);


window.filterChangelog = (filter) => {
    const buttons = document.querySelectorAll('.changelog-filter-btn');
    buttons.forEach(btn => {
        const isActive = btn.getAttribute('data-filter') === filter;
        btn.style.background = isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
        btn.style.borderColor = isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)';
        btn.style.color = isActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.5)';
        if (isActive) btn.classList.add('active'); else btn.classList.remove('active');
    });

    if (filter === 'all') {
        renderPatchNotes(allPatchNotes);
    } else {
        renderPatchNotes(allPatchNotes.filter(n => n.type === filter));
    }
};

function updateBanner() {
    const slidesContainer = document.getElementById('news-slides');
    const title = document.getElementById('banner-title');
    const text = document.getElementById('banner-text');

    if (!newsItems.length) return;

    slidesContainer.style.transform = `translateX(-${currentBannerIndex * 100}%)`;

    if (newsItems[currentBannerIndex]) {
        title.textContent = newsItems[currentBannerIndex].title;
        text.textContent = newsItems[currentBannerIndex].text;
    }
}

window.nextBanner = () => {
    if (!newsItems.length) return;
    currentBannerIndex = (currentBannerIndex + 1) % newsItems.length;
    updateBanner();
    resetBannerTimer();
};

window.prevBanner = () => {
    if (!newsItems.length) return;
    currentBannerIndex = (currentBannerIndex - 1 + newsItems.length) % newsItems.length;
    updateBanner();
    resetBannerTimer();
};

function startBannerAutoPlay() {
    clearInterval(bannerInterval);
    bannerInterval = setInterval(window.nextBanner, 5000);
}

function resetBannerTimer() {
    clearInterval(bannerInterval);
    startBannerAutoPlay();
}

window.createProfile = async () => {
    const nameInput = document.getElementById('create-profile-username');
    const name = nameInput.value || "Player";
    const id = generateUUID();

    if (!currentSettings.profiles) currentSettings.profiles = {};

    if (Object.keys(currentSettings.profiles).length >= 15) {
        alert("Достигнут лимит профилей (15). Удалите старый профиль, чтобы создать новый.");
        return;
    }

    currentSettings.profiles[id] = {
        name: name,
        created: Date.now()
    };

    currentSettings.selectedProfile = id;
    await window.launcher.saveSettings(currentSettings);
    updateUIFromSettings();
    populateProfileDropdown();
    populateAccountsGrid();
    closeModal('create-profile-modal');
    nameInput.value = '';
};

window.deleteProfile = async (profileId) => {
    if (!currentSettings.profiles || !currentSettings.profiles[profileId]) return;
    if (Object.keys(currentSettings.profiles).length <= 1) {
        alert("Нельзя удалить последний профиль.");
        return;
    }
    delete currentSettings.profiles[profileId];
    if (currentSettings.selectedProfile === profileId) {
        currentSettings.selectedProfile = Object.keys(currentSettings.profiles)[0];
    }
    await window.launcher.saveSettings(currentSettings);
    updateUIFromSettings();
    populateProfileDropdown();
    populateAccountsGrid();
};

function populateProfileDropdown() {
    const selector = document.getElementById('profile-selector');
    if (!selector) return;
    const optionsContainer = selector.querySelector('.custom-options');
    const triggerSpan = selector.querySelector('.custom-select-trigger span');
    if (!optionsContainer) return;

    optionsContainer.innerHTML = '';
    const profiles = currentSettings.profiles || {};
    const selectedId = currentSettings.selectedProfile;

    Object.entries(profiles).forEach(([id, profile]) => {
        const opt = document.createElement('div');
        opt.className = 'custom-option' + (id === selectedId ? ' selected' : '');
        opt.dataset.value = id;
        opt.textContent = profile.name;
        opt.addEventListener('click', async (e) => {
            e.stopPropagation();
            currentSettings.selectedProfile = id;
            await window.launcher.saveSettings(currentSettings);
            updateUIFromSettings();
            populateProfileDropdown();
            selector.classList.remove('open');
        });
        optionsContainer.appendChild(opt);
    });

    if (selectedId && profiles[selectedId]) {
        triggerSpan.textContent = profiles[selectedId].name;
    }

}

function populateAccountsGrid() {
    const grid = document.getElementById('accounts-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const profiles = currentSettings.profiles || {};
    const selectedId = currentSettings.selectedProfile;

    Object.entries(profiles).forEach(([id, profile]) => {
        const card = document.createElement('div');
        card.style.cssText = 'background: #0d0d0d; border: 1px solid ' + (id === selectedId ? 'var(--accent-color, #0335fc)' : '#1a1a1a') + '; border-radius: 16px; padding: 20px; display: flex; align-items: center; gap: 16px; cursor: pointer; transition: all 0.2s;';
        card.onmouseenter = () => { card.style.borderColor = 'var(--accent-color, #0335fc)'; card.style.transform = 'translateY(-2px)'; };
        card.onmouseleave = () => { if (id !== currentSettings.selectedProfile) card.style.borderColor = '#1a1a1a'; card.style.transform = ''; };

        const avatar = document.createElement('div');
        avatar.style.cssText = 'width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-color, #0335fc), #667eea); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; color: white; flex-shrink: 0;';
        avatar.textContent = profile.name.charAt(0).toUpperCase();

        const info = document.createElement('div');
        info.style.cssText = 'flex: 1; min-width: 0;';
        const nameEl = document.createElement('div');
        nameEl.style.cssText = 'font-size: 16px; font-weight: 600; color: #fff; margin-bottom: 4px;';
        nameEl.textContent = profile.name;
        const versionEl = document.createElement('div');
        versionEl.style.cssText = 'font-size: 12px; color: rgba(255,255,255,0.5);';
        versionEl.textContent = (id === selectedId ? 'Активный' : 'Неактивный');
        info.appendChild(nameEl);
        info.appendChild(versionEl);

        const actions = document.createElement('div');
        actions.style.cssText = 'display: flex; gap: 8px; flex-shrink: 0;';

        if (id !== selectedId) {
            const selectBtn = document.createElement('button');
            selectBtn.style.cssText = 'padding: 6px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; cursor: pointer; font-size: 12px; transition: all 0.2s;';
            selectBtn.textContent = 'Выбрать';
            selectBtn.onclick = async (e) => {
                e.stopPropagation();
                currentSettings.selectedProfile = id;
                await window.launcher.saveSettings(currentSettings);
                updateUIFromSettings();
                populateProfileDropdown();
                populateAccountsGrid();
            };
            actions.appendChild(selectBtn);
        }

        const delBtn = document.createElement('button');
        delBtn.style.cssText = 'padding: 6px 10px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; color: #ef4444; cursor: pointer; font-size: 12px; transition: all 0.2s;';
        delBtn.textContent = '✕';
        delBtn.onclick = (e) => { e.stopPropagation(); window.deleteProfile(id); };
        actions.appendChild(delBtn);

        card.appendChild(avatar);
        card.appendChild(info);
        card.appendChild(actions);

        card.addEventListener('click', async () => {
            currentSettings.selectedProfile = id;
            await window.launcher.saveSettings(currentSettings);
            updateUIFromSettings();
            populateProfileDropdown();
            populateAccountsGrid();
        });

        grid.appendChild(card);
    });
}

window.switchPage = (pageId) => {
    const currentPage = document.querySelector('.page.active');
    const newPage = document.getElementById('page-' + pageId);

    document.querySelectorAll('.page-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mini-sidebar-btn').forEach(b => b.classList.remove('active'));

    const btn = document.querySelector(`.page-btn[data-page="${pageId}"]`);
    if (btn) btn.classList.add('active');

    const miniBtn = document.querySelector(`.mini-sidebar-btn[data-page="${pageId}"]`);
    if (miniBtn) miniBtn.classList.add('active');

    if (currentPage && currentPage !== newPage) {
        currentPage.classList.add('leaving');
        currentPage.addEventListener('animationend', function handler() {
            currentPage.removeEventListener('animationend', handler);
            currentPage.classList.remove('active', 'leaving');
            if (newPage) newPage.classList.add('active');
        }, { once: true });
    } else {
        if (currentPage) currentPage.classList.remove('active');
        if (newPage) newPage.classList.add('active');
    }
};

window.showModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
};

window.closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
};

window.minimizeWindow = () => window.launcher.windowControl('minimize');
window.maximizeWindow = () => window.launcher.windowControl('maximize');
window.closeWindow = () => window.launcher.windowControl('close');

window.browseGamePath = async () => {
    const path = await window.launcher.openDirectory();
    if (path) {
        document.getElementById('settings-game-path').value = path;
        autoSaveSettings();
    }
};

window.browseJavaPath = async () => {
    const path = await window.launcher.openFile();
    if (path) {
        document.getElementById('settings-java-path').value = path;
        autoSaveSettings();
    }
};

window.copyLogs = () => {
    const logs = document.getElementById('logs-container');
    if (logs) {
        navigator.clipboard.writeText(logs.innerText).then(() => { });
    }
};

window.clearLogs = () => {
    const containers = [
        document.getElementById('logs-container'),
        document.getElementById('console-output')
    ];

    containers.forEach(container => {
        if (container) {
            container.innerHTML = '<div style="color: rgba(255,255,255,0.3);">Логи очищены.</div>';
        }
    });
};

function logToConsole(data) {
    const containers = [
        document.getElementById('logs-container'),
        document.getElementById('console-output')
    ];

    const time = new Date().toLocaleTimeString('ru-RU');
    const text = typeof data === 'string' ? data : JSON.stringify(data);

    let color = 'rgba(255,255,255,0.7)';
    if (text.toLowerCase().includes('error') || text.toLowerCase().includes('exception')) {
        color = '#ef4444';
    } else if (text.toLowerCase().includes('warn')) {
        color = '#f59e0b';
    } else if (text.toLowerCase().includes('done') || text.toLowerCase().includes('success')) {
        color = '#10b981';
    }

    const htmlContent = `<span style="color: rgba(255,255,255,0.3); margin-right: 8px;">[${time}]</span>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}`;

    containers.forEach(container => {
        if (!container) return;

        if (container.children.length === 1 && (container.textContent.includes('Ожидание') || container.textContent.includes('Консоль готова'))) {
            container.innerHTML = '';
        }

        const line = document.createElement('div');
        line.style.cssText = `color: ${color}; padding: 2px 0; word-break: break-all;`;
        line.innerHTML = htmlContent;
        container.appendChild(line);

        if (container.children.length > 5000) {
            container.removeChild(container.children[0]);
        }

        container.scrollTop = container.scrollHeight;
    });
}

window.updateVersionFilters = async () => {
    if (!currentSettings.settings) currentSettings.settings = {};

    currentSettings.settings.showSnapshots = document.getElementById('settings-show-snapshots')?.checked || false;
    currentSettings.settings.showBeta = document.getElementById('settings-show-beta')?.checked || false;
    currentSettings.settings.showAlpha = document.getElementById('settings-show-alpha')?.checked || false;

    await window.launcher.saveSettings(currentSettings);
    availableVersions = await window.launcher.getVersions();
    populateVersionSelects();
    populateVersionsGrid();
};

function autoSaveSettings() {
    if (!currentSettings.settings) currentSettings.settings = {};
    if (ramInput) currentSettings.settings.ram = parseInt(ramInput.value);
    if (javaPathInput) currentSettings.settings.javaPath = javaPathInput.value;
    if (document.getElementById('settings-game-path')) currentSettings.settings.gamePath = document.getElementById('settings-game-path').value;
    if (jvmArgsInput) currentSettings.settings.jvmArgs = jvmArgsInput.value;


    if (document.getElementById('auto-connect')) currentSettings.settings.autoConnect = document.getElementById('auto-connect').checked;
    if (document.getElementById('keep-launcher-open')) currentSettings.settings.keepLauncherOpen = document.getElementById('keep-launcher-open').checked;
    if (document.getElementById('discord-rpc')) currentSettings.settings.discordRpc = document.getElementById('discord-rpc').checked;
    if (document.getElementById('settings-show-snapshots')) currentSettings.settings.showSnapshots = document.getElementById('settings-show-snapshots').checked;

    window.launcher.saveSettings(currentSettings);


    populateVersionSelects();
    populateVersionsGrid();
}

if (ramInput) ramInput.addEventListener('change', autoSaveSettings);
if (javaPathInput) javaPathInput.addEventListener('change', autoSaveSettings);
if (jvmArgsInput) jvmArgsInput.addEventListener('change', autoSaveSettings);

const gamePathInput = document.getElementById('settings-game-path');
if (gamePathInput) gamePathInput.addEventListener('change', autoSaveSettings);

const autoConnectToggle = document.getElementById('auto-connect');
if (autoConnectToggle) autoConnectToggle.addEventListener('change', autoSaveSettings);

const keepLauncherOpenToggle = document.getElementById('keep-launcher-open');
if (keepLauncherOpenToggle) keepLauncherOpenToggle.addEventListener('change', autoSaveSettings);

const discordRpcToggle = document.getElementById('discord-rpc');
if (discordRpcToggle) discordRpcToggle.addEventListener('change', autoSaveSettings);

const showSnapshotsToggle = document.getElementById('settings-show-snapshots');
if (showSnapshotsToggle) showSnapshotsToggle.addEventListener('change', autoSaveSettings);





if (ramInput) {
    ramInput.addEventListener('input', (e) => {
        const display = document.getElementById('settings-global-ram-display');
        if (display) display.textContent = e.target.value + ' MB';
    });
}



window.importSettings = async () => {
    const result = await window.launcher.importSettings();
    if (result.success) {
        currentSettings = result.settings;
        updateUIFromSettings();
        applyThemeSettings();
        populateProfileDropdown();
        populateAccountsGrid();
        showToast('✅ Настройки успешно импортированы');
    } else if (result.error) {
        showToast('❌ Ошибка импорта: ' + result.error);
    }
};

window.exportSettings = async () => {
    const result = await window.launcher.exportSettings();
    if (result.success) {
        showToast('✅ Настройки экспортированы');
    } else if (result.error) {
        showToast('❌ Ошибка экспорта: ' + result.error);
    }
};

function showToast(message) {
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'notification success';
    toast.textContent = message;
    if (message.includes('❌')) {
        toast.className = 'notification error';
    }
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

window.launcher.onImportFlowFile(async (filePath) => {
    const result = await window.launcher.importSettingsFromPath(filePath);
    if (result.success) {
        currentSettings = result.settings;
        updateUIFromSettings();
        applyThemeSettings();
        populateProfileDropdown();
        populateAccountsGrid();
        showToast('✅ Настройки импортированы из файла');
    } else if (result.error) {
        showToast('❌ Ошибка импорта: ' + result.error);
    }
});

window.selectFlowCrossVersion = async () => {
    if (!currentSettings.settings) currentSettings.settings = {};
    currentSettings.settings.gameVersion = '1.21.1';
    currentSettings.settings.modloader = 'fabric';
    await window.launcher.saveSettings(currentSettings);

    if (versionSelect) versionSelect.value = '1.21.1';
    if (modloaderSelect) modloaderSelect.value = 'fabric';

    await updateVersionList();
    updateUIFromSettings();
    switchPage('home');
    showToast('⚡ FlowCross 1.21.1 выбран');
};

window.repairLauncherFiles = async () => {
    const btn = document.querySelector('button[onclick="repairLauncherFiles()"]');
    if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Пожалуйста, подождите...';
        btn.disabled = true;

        await window.launcher.repairClient();

        btn.innerHTML = '✅ Готово';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 2000);
    }
};

window.showResetDialog = async () => {
    if (confirm("Вы уверены? Это сбросит все настройки и удалит профили. Папка игры не будет затронута.")) {
        await window.launcher.resetSettings();
        location.reload();
    }
};

window.showAboutModal = () => {
    const modal = document.getElementById('about-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('visible');
    }
};

window.closeModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('visible');
    }
};



window.checkForUpdates = async () => {
    const btn = document.querySelector('button[onclick="checkForUpdates()"]');
    if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Проверка...';
        btn.disabled = true;

        try {
            const result = await window.launcher.checkForUpdates();
            if (result && result.message) {
                alert(result.message);
            }
        } catch (e) {
            console.error(e);
            alert("Ошибка проверки обновлений");
        }

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 2000);
    }
};


window.launcher.onUpdateAvailable((info) => {
    if (confirm(`Доступно обновление ${info.version}. Скачать сейчас?`)) {
        window.launcher.downloadUpdate();
    }
});

window.launcher.onUpdateDownloaded((info) => {
    if (confirm(`Обновление ${info.version} готово к установке. Перезапустить сейчас?`)) {
        window.launcher.quitAndInstall();
    }
});

window.launcher.onUpdateError((err) => {
    console.error("Update error:", err);
});

function populateVersionSelects() {
    if (!versionSelect) return;

    versionSelect.innerHTML = '';

    const showSnapshots = currentSettings.settings?.showSnapshots || false;
    const showBeta = currentSettings.settings?.showBeta || false;
    const showAlpha = currentSettings.settings?.showAlpha || false;

    let filtered = availableVersions;
    const loader = (currentSettings.settings?.modloader || (modloaderSelect ? modloaderSelect.value : 'none'));



    if (loader === 'none') {
        filtered = availableVersions.filter(v => {
            if (v.type === 'release') return true;
            if (v.type === 'snapshot' && showSnapshots) return true;
            if (v.type === 'old_beta' && showBeta) return true;
            if (v.type === 'old_alpha' && showAlpha) return true;
            return false;
        });
    }

    filtered.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.id + (v.type !== 'release' ? ` (${v.type})` : '');
        versionSelect.appendChild(opt);
    });

    const settings = currentSettings.settings || {};
    const savedVer = settings.gameVersion;

    if (savedVer && filtered.find(v => v.id === savedVer)) {
        versionSelect.value = savedVer;
    } else if (filtered.length > 0) {
        versionSelect.value = filtered[0].id;
    }
}

function populateVersionsGrid() {
    if (!versionsGrid) return;
    versionsGrid.innerHTML = '';

    const showSnapshots = currentSettings.settings?.showSnapshots || false;
    let filtered = availableVersions;
    const loader = (currentSettings.settings?.modloader || (modloaderSelect ? modloaderSelect.value : 'none'));
    if (loader === 'none') {
        filtered = availableVersions.filter(v => {
            if (v.type === 'release') return true;
            if (v.type === 'snapshot' && showSnapshots) return true;
            return false;
        });
    }

    for (const v of filtered) {
        const note = allPatchNotes.find(n => n.version === v.id);
        const imageUrl = note ? note.image : null;

        const div = document.createElement('div');
        div.className = 'version-card';
        div.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; overflow: hidden; transition: all 0.2s; cursor: pointer; display: flex; flex-direction: column; height: 200px;';
        div.onmouseenter = () => { div.style.background = 'rgba(255,255,255,0.06)'; div.style.borderColor = 'rgba(255,255,255,0.12)'; div.style.transform = 'translateY(-2px)'; };
        div.onmouseleave = () => { div.style.background = 'rgba(255,255,255,0.03)'; div.style.borderColor = 'rgba(255,255,255,0.06)'; div.style.transform = 'translateY(0)'; };

        let bannerHtml = '';
        if (imageUrl) {
            bannerHtml = `<div style="height: 120px; background-image: url('${imageUrl}'); background-size: cover; background-position: center;"></div>`;
        } else {
            bannerHtml = `
            <div style="height: 120px; background: linear-gradient(135deg, rgba(20,20,20,1) 0%, rgba(40,40,40,1) 100%); display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;">
                <img src="https://raw.githubusercontent.com/PrismLauncher/meta/main/img/versions/${v.id}.png" 
                     style="height: 64px; image-rendering: pixelated; z-index: 10; position: relative;"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                <div style="display: none; font-size: 24px; font-weight: 700; color: rgba(255,255,255,0.1);">${v.id}</div>
                <div style="position: absolute; inset: 0; background-image: url('https://raw.githubusercontent.com/PrismLauncher/meta/main/img/versions/${v.id}.png'); background-size: cover; background-position: center; filter: blur(20px) brightness(0.3); opacity: 0.5;"></div>
            </div>`;
        }

        const dateStr = v.releaseTime ? new Date(v.releaseTime).toLocaleDateString('ru-RU') : '';

        div.innerHTML = `
            ${bannerHtml}
            <div style="padding: 12px; flex: 1; display: flex; flex-direction: column; justify-content: center;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-weight: 600; font-size: 14px; color: #fff;">${v.id}</span>
                    <span style="font-size: 11px; padding: 2px 6px; background: rgba(255,255,255,0.1); border-radius: 4px; color: rgba(255,255,255,0.6);">${v.type}</span>
                </div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.3);">${dateStr}</div>
            </div>
        `;

        div.onclick = async () => {
            if (versionSelect) {
                versionSelect.value = v.id;
                versionSelect.dispatchEvent(new Event('change'));
            }
            switchPage('home');
        };

        versionsGrid.appendChild(div);
    }

}

function updateUIFromSettings() {
    if (!currentSettings) return;

    const profileId = currentSettings.selectedProfile;
    const profile = currentSettings.profiles ? currentSettings.profiles[profileId] : null;

    if (profile) {
        if (usernameDisplay) usernameDisplay.textContent = profile.name;
        if (profileInitial) profileInitial.textContent = profile.name.charAt(0).toUpperCase();

        const headerName = document.getElementById('header-profile-name');
        const headerVersion = document.getElementById('header-profile-version');
        const sidebarName = document.getElementById('sidebar-profile-name');
        const sidebarInitial = document.getElementById('sidebar-profile-initial');

        if (!currentSettings.settings) currentSettings.settings = {};
        if (!currentSettings.settings.gameVersion && profile.version) {
            currentSettings.settings.gameVersion = profile.version;
        }
        if (!currentSettings.settings.modloader && profile.modloader) {
            currentSettings.settings.modloader = profile.modloader;
        }

        const settings = currentSettings.settings || {};

        if (headerName) headerName.textContent = profile.name;
        if (headerVersion) headerVersion.textContent = settings.gameVersion || '1.20.1';
        if (sidebarName) sidebarName.textContent = profile.name;
        if (sidebarInitial) sidebarInitial.textContent = profile.name.charAt(0).toUpperCase();

        const avatarUrl = `https://mc-heads.net/avatar/${profile.name}/64`;
        if (profileAvatar) {
            profileAvatar.innerHTML = `<img src="${avatarUrl}" style="width: 100%; height: 100%; border-radius: 8px; object-fit: cover;">`;
        }

        if (modloaderSelect) modloaderSelect.value = settings.modloader || 'none';




        if (ramInput) ramInput.value = settings.ram || 4096;
        if (document.getElementById('settings-global-ram-display'))
            document.getElementById('settings-global-ram-display').textContent = (settings.ram || 4096) + ' MB';

        if (javaPathInput) javaPathInput.value = settings.javaPath || '';
        if (jvmArgsInput) jvmArgsInput.value = settings.jvmArgs || '';
        if (document.getElementById('settings-game-path')) document.getElementById('settings-game-path').value = settings.gamePath || '';

        if (document.getElementById('auto-connect')) document.getElementById('auto-connect').checked = settings.autoConnect || false;
        if (document.getElementById('keep-launcher-open')) document.getElementById('keep-launcher-open').checked = settings.keepLauncherOpen || false;
        if (document.getElementById('discord-rpc')) document.getElementById('discord-rpc').checked = settings.discordRpc || false;

        if (document.getElementById('settings-show-snapshots')) document.getElementById('settings-show-snapshots').checked = settings.showSnapshots || false;
        if (document.getElementById('settings-show-beta')) document.getElementById('settings-show-beta').checked = settings.showBeta || false;
        if (document.getElementById('settings-show-alpha')) document.getElementById('settings-show-alpha').checked = settings.showAlpha || false;

        if (document.getElementById('settings-modal-accent-color')) {
            document.getElementById('settings-modal-accent-color').value = settings.accentColor || '#0335fc';
        }

        const overlayToggle = document.getElementById('settings-modal-overlay-enabled');
        if (overlayToggle) {
            overlayToggle.checked = settings.overlayEnabled !== false;
        }

        if (settings.language) {
            const langSelect = document.getElementById('settings-modal-language-select');
            if (langSelect) {
                const opt = langSelect.querySelector(`.custom-option[data-value="${settings.language}"]`);
                if (opt) {
                    langSelect.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    const triggerSpan = langSelect.querySelector('.custom-select-trigger span');
                    if (triggerSpan) triggerSpan.textContent = opt.textContent;
                }
            }
        }


        applyThemeSettings();
        populateProfileDropdown();
        populateAccountsGrid();
    }
}


function setupCustomSelects() {
    document.querySelectorAll('.custom-select').forEach(select => {
        const trigger = select.querySelector('.custom-select-trigger');
        if (!trigger) return;

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-select.open').forEach(el => {
                if (el !== select) el.classList.remove('open');
            });
            select.classList.toggle('open');
        });

        select.querySelectorAll('.custom-option').forEach(option => {
            option.addEventListener('click', async (e) => {
                e.stopPropagation();

                select.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                select.classList.remove('open');

                const val = option.dataset.value;
                const text = option.textContent;
                const triggerSpan = trigger.querySelector('span');
                if (triggerSpan) triggerSpan.textContent = text;

                if (select.id === 'settings-modal-language-select') {
                    if (window.i18n) window.i18n.setLang(val);
                    if (!currentSettings.settings) currentSettings.settings = {};
                    currentSettings.settings.language = val;
                    await window.launcher.saveSettings(currentSettings);
                } else if (select.id === 'settings-modal-theme-select') {
                } else if (select.id === 'settings-modal-background-type-select') {
                    window.onBackgroundTypeChange && window.onBackgroundTypeChange(val);
                }
            });
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
    });
}

init();

/* Command Palette Implementation */
let commandPaletteOpen = false;
const commands = [
    { id: 'page-home', label: 'Главная', icon: '🏠', action: () => switchPage('home') },
    { id: 'page-versions', label: 'Версии', icon: '📦', action: () => switchPage('versions') },
    { id: 'page-settings', label: 'Настройки', icon: '⚙️', action: () => switchPage('settings') },
    { id: 'page-accounts', label: 'Аккаунты', icon: '👤', action: () => switchPage('accounts') },
    { id: 'page-logs', label: 'Логи', icon: '📝', action: () => switchPage('logs') },
    { id: 'page-changelog', label: 'Изменения', icon: '📜', action: () => switchPage('changelog') },
    { id: 'action-repair', label: 'Починить файлы', icon: '🔧', action: () => repairLauncherFiles() },
    { id: 'action-reset', label: 'Сброс настроек', icon: '🔄', action: () => showResetDialog() },
    { id: 'folder-game', label: 'Открыть папку игры', icon: '📁', action: () => window.launcher.openFolder('game') },
    { id: 'folder-mods', label: 'Открыть папку модов', icon: '🧩', action: () => window.launcher.openFolder('mods') },
    { id: 'folder-launcher', label: 'Открыть папку лаунчера', icon: '📂', action: () => window.launcher.openFolder('launcher') },
    { id: 'export-settings', label: 'Экспорт настроек', icon: '📤', action: () => window.exportSettings() },
    { id: 'import-settings', label: 'Импорт настроек', icon: '📥', action: () => window.importSettings() },
];

function toggleCommandPalette() {
    const overlay = document.getElementById('command-palette-overlay');
    const input = document.getElementById('cp-input');

    if (commandPaletteOpen) {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.style.display = 'none', 150);
        commandPaletteOpen = false;
    } else {
        overlay.style.display = 'flex';
        // Force reflow
        overlay.offsetHeight;
        overlay.classList.add('visible');
        renderCommandResults(commands);
        input.value = '';
        input.focus();
        commandPaletteOpen = true;
    }
}

function closeCommandPalette(e) {
    if (e.target.id === 'command-palette-overlay') {
        toggleCommandPalette();
    }
}

function renderCommandResults(results) {
    const container = document.getElementById('cp-results');
    container.innerHTML = '';

    if (results.length === 0) {
        const div = document.createElement('div');
        div.style.padding = '20px';
        div.style.textAlign = 'center';
        div.style.color = 'rgba(255,255,255,0.3)';
        div.textContent = 'Ничего не найдено';
        container.appendChild(div);
        return;
    }

    results.forEach((cmd, index) => {
        const div = document.createElement('div');
        div.className = 'cp-item';
        if (index === 0) div.classList.add('selected');

        div.innerHTML = `
            <div style="display: flex; align-items: center;">
                <span class="cp-item-icon">${cmd.icon}</span>
                <span>${cmd.label}</span>
            </div>
            <div style="font-size: 11px; opacity: 0.5;">Enter</div>
        `;

        div.onclick = () => {
            cmd.action();
            toggleCommandPalette();
        };

        container.appendChild(div);
    });
}

// Global hook
window.toggleCommandPalette = toggleCommandPalette;
window.closeCommandPalette = closeCommandPalette;

// Setup events
setTimeout(() => {
    const cpInput = document.getElementById('cp-input');
    if (cpInput) {
        cpInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = commands.filter(c => c.label.toLowerCase().includes(query));
            renderCommandResults(filtered);
        });

        cpInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const items = document.querySelectorAll('.cp-item');
                if (items.length === 0) return;

                let selectedIndex = Array.from(items).findIndex(i => i.classList.contains('selected'));
                if (selectedIndex >= 0) items[selectedIndex].classList.remove('selected');

                if (e.key === 'ArrowDown') {
                    selectedIndex = (selectedIndex + 1) % items.length;
                } else {
                    selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                }

                if (selectedIndex < 0) selectedIndex = 0; // Backup

                items[selectedIndex].classList.add('selected');
                items[selectedIndex].scrollIntoView({ block: 'nearest' });
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                const selected = document.querySelector('.cp-item.selected');
                if (selected) selected.click();
            }
        });
    }

    // Global toggle shortcut (Ctrl+K or Ctrl+P)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'p')) {
            e.preventDefault();
            toggleCommandPalette();
        }
        if (e.key === 'Escape' && commandPaletteOpen) {
            toggleCommandPalette();
        }
    });

}, 1000);
