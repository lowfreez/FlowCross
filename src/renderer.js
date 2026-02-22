
window.showToast = (msg, type = 'info') => {
};

document.querySelectorAll('.window-controls button').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (e.currentTarget.id === 'window-menu-btn') return;
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
let selectedAccount = null;

function getSelectedAccount() {
    if (!currentSettings.profiles || !currentSettings.selectedProfile) return null;
    const profile = currentSettings.profiles[currentSettings.selectedProfile];
    if (!profile) return null;
    return {
        username: profile.name,
        uuid: profile.uuid || profile.name,
        accessToken: profile.accessToken || 'offline_t',
        clientToken: profile.clientToken || 'client_t',
        type: profile.type || 'offline',
        id: currentSettings.selectedProfile
    };
}

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
        selectedAccount = getSelectedAccount();
        await updateVersionList();

        setupCustomSelects();

        window.addEventListener('languageChanged', (e) => {
            populateAccountsGrid();

        });

    } catch (e) {
        console.error("Init error:", e);
        logToConsole('Error initializing launcher: ' + e.message);
    }
}

async function updateVersionList() {
    const loader = (currentSettings.settings?.modloader || (modloaderSelect ? modloaderSelect.value : 'none'));

    try {
        if (loader === 'fabric' || loader === 'flowcross') {
            availableVersions = await window.launcher.getFabricVersions();
        } else if (loader === 'forge') {
            availableVersions = await window.launcher.getForgeVersions();
        } else if (loader === 'neoforge') {
            availableVersions = await window.launcher.getNeoForgeVersions();
        } else if (loader === 'quilt') {
            availableVersions = await window.launcher.getQuiltVersions();
        } else {
            availableVersions = await window.launcher.getVersions();
        }

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

async function launchGame() {
    if (isLaunching) {
        try { await window.launcher.abortLaunch(); } catch (e) { }
        isLaunching = false;
        const currentVer = currentSettings.settings?.gameVersion || '1.20.1';
        launchBtn.textContent = `ИГРАТЬ ${currentVer}`;
        launchBtn.classList.remove('disabled');
        launchBtn.classList.remove('loading');
        launchBtn.classList.remove('cancel-mode');

        const btnContainer = launchBtn.closest('.split-launch-btn');
        if (btnContainer) {
            btnContainer.classList.remove('loading');
            btnContainer.style.setProperty('--progress', '0%');
        }

        const arrowBtn = document.getElementById('version-picker-btn');
        if (arrowBtn) {
            arrowBtn.style.background = '';
            arrowBtn.style.boxShadow = '';
        }
        consoleOutput.innerHTML += '<div style="color: #ff5555;">> Запуск отменен пользователем.</div>';
        return;
    }

    if (!selectedAccount) {
        showNotification(window.i18n ? window.i18n.t('error_no_profile') : 'Выберите или создайте профиль для игры', 'error');
        switchPage('accounts');
        return;
    }

    const settings = currentSettings.settings || {};
    let launchVer = settings.gameVersion || '1.20.1';
    let launchLoader = settings.modloader || 'none';
    let launchModpackId = undefined;

    const mp = (settings.modpacks || []).find(m => m.id === launchVer);
    if (mp) {
        launchVer = mp.version;
        launchLoader = mp.loader;
        launchModpackId = mp.id;
        if (launchLoader === 'vanilla') launchLoader = 'none';
    }

    if (!settings.recentVersions) settings.recentVersions = [];
    settings.recentVersions = [launchVer, ...settings.recentVersions.filter(v => v !== launchVer)].slice(0, 3);
    await window.launcher.saveSettings(currentSettings);

    const profileId = currentSettings.selectedProfile;
    if (!currentSettings.profiles[profileId]) {
        consoleOutput.innerHTML += '<div style="color: #ff5555;">> Ошибка: Профиль не найден.</div>';
        return;
    }
    const profile = currentSettings.profiles[profileId];

    isLaunching = true;
    launchBtn.classList.remove('disabled');
    launchBtn.textContent = 'ЗАПУСК...';
    launchBtn.classList.add('loading');
    const btnContainer = launchBtn.closest('.split-launch-btn');
    if (btnContainer) btnContainer.classList.add('loading');
    consoleOutput.innerHTML = '';

    const ram = settings.ram || 4096;
    const javaPath = settings.javaPath || '';
    const jvmArgs = settings.jvmArgs || '';
    const fullscreen = settings.fullscreen || false;
    const windowWidth = settings.windowWidth || 854;
    const windowHeight = settings.windowHeight || 480;

    let auth = {
        access_token: selectedAccount.accessToken || 'offline_t',
        client_token: selectedAccount.clientToken || 'client_t',
        uuid: selectedAccount.uuid || selectedAccount.id,
        name: selectedAccount.username,
        user_properties: '{}',
        meta: selectedAccount.type === 'microsoft' ? { type: 'msa', demo: false } : { type: 'offline', demo: false }
    };

    try {
        await window.launcher.launch({
            username: profile.name,
            version: launchVer,
            type: 'release',
            modloader: launchLoader,
            modpackId: launchModpackId,
            ram: ram,
            javaPath: javaPath,
            jvmArgs: jvmArgs,
            auth: auth,
            fullscreen: fullscreen,
            windowWidth: windowWidth,
            windowHeight: windowHeight,
            hideLaunchCommand: settings.hideLaunchCommand !== false,
            saveLogs: settings.saveLogs || false
        });
        sendDownloadNotification(true, launchVer);
        window.showNotifySuggestBanner();
        if (settings.autoLaunchAfterDownload === false) {
            isLaunching = false;
            launchBtn.textContent = `ИГРАТЬ ${launchVer}`;
            launchBtn.classList.remove('loading');
        }
    } catch (e) {
        console.error("Launch failed:", e);
    }
}

if (launchBtn) {
    launchBtn.addEventListener('click', launchGame);
}

if (window.launcher.onJumpLaunchVersion) {
    window.launcher.onJumpLaunchVersion(async (ver) => {
        if (!currentSettings.settings) currentSettings.settings = {};
        currentSettings.settings.gameVersion = ver;
        await window.launcher.saveSettings(currentSettings);
        refreshVersionPicker();
        launchGame();
    });
}

window.launcher.onGameExit((code) => {
    isLaunching = false;
    launchBtn.textContent = 'ИГРАТЬ';
    launchBtn.classList.remove('disabled');
    launchBtn.classList.remove('cancel-mode');
    launchBtn.style.background = '';
    launchBtn.style.background = '';
    launchBtn.classList.remove('loading');
    launchBtn.style.background = '';
    launchBtn.style.boxShadow = '';
    const arrowBtn = document.getElementById('version-picker-btn');
    if (arrowBtn) {
        arrowBtn.style.background = '';
        arrowBtn.style.boxShadow = '';
    }
    hideTitlebarProgress();

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
            < div style = "background:#1a1a1a;border:1px solid #ef4444;border-radius:16px;padding:32px;max-width:480px;width:90%;color:var(--text-color, #fff);text-align:center;" >
                <div style="font-size:48px;margin-bottom:16px;">❌</div>
                <div style="font-size:18px;font-weight:700;margin-bottom:8px;">Игра завершилась с ошибкой</div>
                <div style="font-size:14px;color:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.6);margin-bottom:16px;">Код выхода: ${code}</div>
                ${lastErrors ? `<div style="background:#0d0d0d;border-radius:8px;padding:12px;text-align:left;font-size:11px;color:#ef4444;max-height:120px;overflow-y:auto;margin-bottom:16px;white-space:pre-wrap;word-break:break-all;">${lastErrors.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
                <div style="font-size:12px;color:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.4);margin-bottom:20px;">Перейдите на страницу Логов для подробностей. Логи сохранены в папку лаунчера.</div>
                <button onclick="this.closest('div[style*=fixed]').remove()" style="padding:10px 32px;background:var(--accent-color, var(--accent-color));border:none;border-radius:8px;color:var(--text-color, #fff);cursor:pointer;font-size:14px;font-weight:600;">Закрыть</button>
            </div >
            `;
        document.body.appendChild(errorModal);
    }

    consoleOutput.innerHTML += `< div style = "color: #ffff55;" >> Игра закрыта(Код: ${code})</div > `;
    consoleOutput.innerHTML += `< div style = "color: #ffff55;" >> Игра закрыта(Код: ${code})</div > `;
});

window.launcher.onGameStarted(() => {
    launchBtn.textContent = 'ЗАКРЫТЬ';
    launchBtn.style.background = '#ff5555';
    launchBtn.style.boxShadow = '0 0 15px rgba(255, 85, 85, 0.6)';
    launchBtn.style.borderRadius = '14px 0 0 14px';
    const arrowBtn = document.getElementById('version-picker-btn');
    if (arrowBtn) {
        arrowBtn.style.background = '#ff5555';
        arrowBtn.style.boxShadow = '0 0 15px rgba(255, 85, 85, 0.6)';
    }
    hideTitlebarProgress();
});

const updateLaunchUI = (percent, text) => {
    if (!isLaunching || launchBtn.textContent === 'ЗАКРЫТЬ') return;

    launchBtn.textContent = text;
    const btnContainer = launchBtn.closest('.split-launch-btn');
    if (btnContainer) {
        btnContainer.classList.add('loading');
        btnContainer.style.setProperty('--progress', `${Math.min(100, Math.max(0, percent))}%`);
    }
    showTitlebarProgress(percent);
};

window.launcher.onDownloadProgress((progress) => {
    updateLaunchUI(progress, `ЗАГРУЗКА ${Math.round(progress)}%`);
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
    updateLaunchUI(percent, text);
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
        const btnContainer = launchBtn.closest('.split-launch-btn');
        if (btnContainer) {
            btnContainer.classList.remove('loading');
            btnContainer.style.setProperty('--progress', '0%');
        }
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

    const updateChannelSelect = document.getElementById('settings-modal-update-channel-select');
    if (updateChannelSelect) {
        const selectedOption = updateChannelSelect.querySelector('.custom-option.selected');
        if (selectedOption) {
            currentSettings.settings.updateChannel = selectedOption.getAttribute('data-value');
        }
    }

    currentSettings.settings.showSnapshots = document.getElementById('settings-show-snapshots')?.checked || false;
    currentSettings.settings.showBeta = document.getElementById('settings-show-beta')?.checked || false;
    currentSettings.settings.showAlpha = document.getElementById('settings-show-alpha')?.checked || false;
    currentSettings.settings.fullscreen = document.getElementById('settings-fullscreen')?.checked || false;
    currentSettings.settings.windowWidth = document.getElementById('settings-window-width')?.value || 854;
    currentSettings.settings.windowHeight = document.getElementById('settings-window-height')?.value || 480;
    currentSettings.settings.fontFamily = document.getElementById('settings-font-family')?.value || 'axiforma';
    currentSettings.settings.borderRadius = document.getElementById('settings-border-radius')?.value || 12;
    currentSettings.settings.bgBlur = document.getElementById('settings-bg-blur')?.value || 0;
    currentSettings.settings.bgDarken = document.getElementById('settings-bg-darken')?.value || 20;
    currentSettings.settings.layout = document.getElementById('settings-layout')?.value || 'left';
    currentSettings.settings.saveLogs = document.getElementById('settings-save-logs')?.checked || false;
    currentSettings.settings.hideLaunchCommand = document.getElementById('settings-hide-launch-command')?.checked ?? true;

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

        let rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
        if (rgb) {
            root.style.setProperty('--accent-r', parseInt(rgb[1], 16));
            root.style.setProperty('--accent-g', parseInt(rgb[2], 16));
            root.style.setProperty('--accent-b', parseInt(rgb[3], 16));
        }
    }

    if (settings.fontFamily) {
        const font = settings.fontFamily;
        let fontSheet = document.getElementById('dynamic-font');
        if (!fontSheet) {
            fontSheet = document.createElement('style');
            fontSheet.id = 'dynamic-font';
            document.head.appendChild(fontSheet);
        }
        fontSheet.innerHTML = `* { font-family: "${font}", "Inter", "Segoe UI", sans-serif !important; }`;
        if (font !== 'monospace' && font !== 'sans-serif' && font.toLowerCase() !== 'axiforma') {
            const linkId = 'dynamic-font-link';
            let link = document.getElementById(linkId);
            if (!link) {
                link = document.createElement('link');
                link.id = linkId;
                link.rel = 'stylesheet';
                document.head.appendChild(link);
            }
            link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@300;400;500;600;700&display=swap`;
        }
    }
    if (settings.layout) {
        const mc = document.querySelector('.main-content');
        if (mc) {
            mc.classList.remove('layout-left', 'layout-right', 'layout-center');
            if (settings.layout !== 'left') {
                mc.classList.add('layout-' + settings.layout);
            }
        }
    }
    if (settings.borderRadius) {
        root.style.setProperty('--border-radius', settings.borderRadius + 'px');
        let sheet = document.getElementById('dynamic-radius');
        if (!sheet) {
            sheet = document.createElement('style');
            sheet.id = 'dynamic-radius';
            document.head.appendChild(sheet);
        }
        sheet.innerHTML = `
            .btn:not(#launch-game-btn), button:not(#launch-game-btn, .split-launch-main, .split-launch-version), input:not([type="checkbox"]), select, .custom-select, .modal-content, .mod-card, .layout-item, .nav-btn, .action-btn, .modpack-card, .news-slide {
                border-radius: var(--border-radius) !important;
            }
        `;
    }
    let bgFilters = [];
    if (settings.bgBlur > 0) {
        bgFilters.push(`blur(${settings.bgBlur}px)`);
    }
    if (settings.bgDarken !== undefined && settings.bgDarken > 0) {
        bgFilters.push(`brightness(${100 - settings.bgDarken}%)`);
    }
    let el = document.getElementById('bg-image-overlay');
    if (el) {
        if (bgFilters.length > 0) {
            el.style.filter = bgFilters.join(' ');
            el.style.webkitFilter = bgFilters.join(' ');
        } else {
            el.style.filter = 'none';
            el.style.webkitFilter = 'none';
        }
    }

    if (settings.theme === 'light') {
        if (!document.getElementById('light-theme-style')) {
            const style = document.createElement('style');
            style.id = 'light-theme-style';
            style.innerHTML = `
                .container { filter: invert(0.9) hue-rotate(180deg); }
                .container img, .container svg, .container canvas, .container .skinview3d-canvas { filter: invert(1) hue-rotate(180deg); }
                .container .cl-card-img, .container .news-slide, .container #changelog-featured-img { filter: invert(1) hue-rotate(180deg); }
                #launcher-logo { filter: invert(1) hue-rotate(180deg); }
            `;
            document.head.appendChild(style);
        }
    } else {
        const style = document.getElementById('light-theme-style');
        if (style) style.remove();
    }
}

window.previewAccentColor = (color) => {
    document.documentElement.style.setProperty('--accent-color', color);
    let rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    if (rgb) {
        document.documentElement.style.setProperty('--accent-r', parseInt(rgb[1], 16));
        document.documentElement.style.setProperty('--accent-g', parseInt(rgb[2], 16));
        document.documentElement.style.setProperty('--accent-b', parseInt(rgb[3], 16));
    }
};

window.resetAccentColor = () => {
    const defaultColor = '#0335fc';
    window.previewAccentColor(defaultColor);
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
                slide.style.backgroundPosition = 'center center';
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
            grid.innerHTML = '<div style="color: rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.3); text-align: center; grid-column: 1 / -1; padding: 40px;">Нет данных об изменениях</div>';
        }
    } catch (e) {
        grid.innerHTML = '<div style="color: rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.3); text-align: center; grid-column: 1 / -1; padding: 40px;">Ошибка загрузки: ' + e.message + '</div>';
    }
};

function renderFeatured(note) {
    let featured = document.getElementById('changelog-featured');
    if (!featured) {
        featured = document.createElement('div');
        featured.id = 'changelog-featured';
        featured.innerHTML = `
            <div id="changelog-featured-img"></div>
            <div id="changelog-featured-gradient"></div>
            <div id="changelog-featured-content">
                <div class="featured-badge">Последнее обновление</div>
                <div class="featured-title" id="featured-title"></div>
                <div class="featured-sub">
                    <span id="featured-version"></span>
                    <div class="featured-dot"></div>
                    <span id="featured-date"></span>
                    <div class="featured-dot"></div>
                    <span id="featured-type"></span>
                </div>
            </div>
        `;
        const container = document.getElementById('changelog-container');
        if (container) container.prepend(featured);
    }

    const imgEl = document.getElementById('changelog-featured-img');
    if (note.image) {
        imgEl.style.backgroundImage = `url('${note.image}')`;
    } else {
        imgEl.style.background = 'linear-gradient(135deg, rgba(var(--accent-r, 3), var(--accent-g, 53), var(--accent-b, 252), 0.25) 0%, rgba(77,127,255,0.1) 50%, rgba(var(--bg-r, 8), var(--bg-g, 8), var(--bg-b, 8), 1) 100%)';
    }

    document.getElementById('featured-title').textContent = note.title || note.version;
    document.getElementById('featured-version').textContent = note.version;
    document.getElementById('featured-date').textContent = note.date
        ? new Date(note.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';
    document.getElementById('featured-type').textContent = note.type === 'release' ? 'Релиз' : 'Снапшот';

    featured.onclick = () => openChangelogDetails(note);
}

function renderPatchNotes(notes) {
    const grid = document.getElementById('changelog-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (notes.length > 0) {
        renderFeatured(notes[0]);
    }

    notes.forEach((note, idx) => {
        if (idx === 0) return;

        const isRelease = note.type === 'release';
        const badgeClass = isRelease ? 'cl-badge-release' : 'cl-badge-snapshot';
        const badgeText = isRelease ? 'Релиз' : 'Снапшот';
        const dateStr = note.date
            ? new Date(note.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
            : '';

        const fallbackBg = 'linear-gradient(135deg, rgba(var(--accent-r, 3), var(--accent-g, 53), var(--accent-b, 252), 0.18) 0%, rgba(var(--bg-r, 8), var(--bg-g, 8), var(--bg-b, 8), 1) 100%)';
        const imgStyle = note.image
            ? `background-image: url('${note.image}')`
            : `background: ${fallbackBg}`;

        const card = document.createElement('div');
        card.className = 'cl-card';
        card.innerHTML = `
            <div class="cl-card-img" style="${imgStyle}"></div>
                <div class="cl-card-body">
                    <div class="cl-card-meta">
                        <span class="cl-badge ${badgeClass}">${badgeText}</span>
                        <span class="cl-card-date">${dateStr}</span>
                    </div>
                    <div class="cl-card-title">${note.title || note.version}</div>
                    <div class="cl-card-version">${note.version}</div>
                    ${note.shortText ? `<div class="cl-card-desc">${note.shortText}</div>` : ''}
                </div>
        `;
        card.onclick = () => openChangelogDetails(note);
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
    version.textContent = `Версия: ${note.version} `;

    meta.innerHTML = `
        <span style="padding: 4px 10px; background: ${badgeBg}; color: ${badgeColor}; border-radius: 6px; font-size: 12px; font-weight: 600;">${badgeText}</span>
        <span style="padding: 4px 10px; background: rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.1); color: rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.6); border-radius: 6px; font-size: 12px;">${dateStr}</span>
    `;

    if (note.image) {
        banner.style.backgroundImage = `url('${note.image}')`;
    } else {
        banner.style.backgroundImage = `linear-gradient(135deg, var(--accent-color) 0%, #4d7fff 100%)`;
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
                    } catch (e) {}
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
        @keyframes spin { 100 % { transform: rotate(360deg); } }
        #changelog - details - content h1 { font - size: 24px; margin - top: 24px; margin - bottom: 12px; color: var(--text-color, #fff); }
        #changelog - details - content h2 { font - size: 20px; margin - top: 20px; margin - bottom: 10px; color: var(--text-color, #fff); }
        #changelog - details - content h3 { font - size: 18px; margin - top: 16px; margin - bottom: 8px; color: #eee; }
        #changelog - details - content p { margin - bottom: 12px; color: #ccc; }
        #changelog - details - content ul, #changelog - details - content ol { margin - left: 20px; margin - bottom: 16px; color: #ccc; }
        #changelog - details - content li { margin - bottom: 6px; }
        #changelog - details - content code { background: rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.1); padding: 2px 4px; border - radius: 4px; font - family: monospace; font - size: 0.9em; }
        `;
document.head.appendChild(style);

window.filterChangelog = (filter) => {
    const buttons = document.querySelectorAll('.changelog-filter-btn');
    buttons.forEach(btn => {
        const isActive = btn.getAttribute('data-filter') === filter;
        btn.style.background = isActive ? 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.08)' : 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.03)';
        btn.style.borderColor = isActive ? 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.15)' : 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.08)';
        btn.style.color = isActive ? 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.7)' : 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.5)';
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
    selectedAccount = getSelectedAccount();
    await window.launcher.saveSettings(currentSettings);
    updateUIFromSettings();
    populateProfileDropdown();
    populateAccountsGrid();
    closeModal('create-profile-modal');
    nameInput.value = '';
};
window.startMicrosoftAuth = async () => {
    try {
        const btn = document.querySelector('#profile-microsoft-content .btn-primary');
        const oldText = btn.innerHTML;
        btn.innerHTML = `<span data-i18n="loading">Ожидание...</span>`;
        btn.style.pointerEvents = 'none';

        const result = await window.launcher.microsoftLogin();
        if (result && result.name) {
            const profileId = Date.now().toString();
            if (!currentSettings.profiles) currentSettings.profiles = {};
            currentSettings.profiles[profileId] = {
                name: result.name,
                created: Date.now(),
                type: 'microsoft',
                uuid: result.uuid,
                accessToken: result.access_token
            };
            currentSettings.selectedProfile = profileId;
            selectedAccount = getSelectedAccount();
            await window.launcher.saveSettings(currentSettings);
            updateUIFromSettings();
            populateProfileDropdown();
            populateAccountsGrid();
            showToast('Профиль Microsoft успешно добавлен!');
        } else {
            showToast('Ошибка авторизации Microsoft');
        }
    } catch (e) {
        showToast('Ошибка: ' + (e.message || e));
    } finally {
        const btn = document.querySelector('#profile-microsoft-content .btn-primary');
        if (btn) {
            btn.innerHTML = `
            < svg width = "20" height = "20" viewBox = "0 0 21 21" >
                        <path fill="#f25022" d="M1 1h9v9H1z" />
                        <path fill="#00a4ef" d="M1 11h9v9H1z" />
                        <path fill="#7fba00" d="M11 1h9v9H11z" />
                        <path fill="#ffb900" d="M11 11h9v9H11z" />
                    </svg >
            <span data-i18n="microsoft_login_btn">Войти через Microsoft</span>
        `;
            btn.style.pointerEvents = 'auto';
        }
        closeModal('create-profile-modal');
    }
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
    const grid = document.getElementById('accounts-list') || document.getElementById('accounts-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const profiles = currentSettings.profiles || {};
    const selectedId = currentSettings.selectedProfile;

    Object.entries(profiles).forEach(([id, profile]) => {
        const card = document.createElement('div');
        card.style.cssText = 'background: #0d0d0d; border: 1px solid ' + (id === selectedId ? 'var(--accent-color, var(--accent-color))' : '#1a1a1a') + '; border-radius: 16px; padding: 16px 20px; display: flex; align-items: center; gap: 16px; cursor: pointer; transition: all 0.2s;';
        card.onmouseenter = () => { card.style.borderColor = 'var(--accent-color, var(--accent-color))'; card.style.transform = 'translateY(-2px)'; };
        card.onmouseleave = () => { if (id !== currentSettings.selectedProfile) card.style.borderColor = '#1a1a1a'; card.style.transform = ''; };

        const avatar = document.createElement('div');
        avatar.style.cssText = 'width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-color, var(--accent-color)), #667eea); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: white; flex-shrink: 0;';
        avatar.textContent = profile.name.charAt(0).toUpperCase();

        const info = document.createElement('div');
        info.style.cssText = 'flex: 1; min-width: 0;';
        const nameEl = document.createElement('div');
        nameEl.style.cssText = 'font-size: 15px; font-weight: 600; color: var(--text-color, #fff); margin-bottom: 3px;';
        nameEl.textContent = profile.name;
        const statusEl = document.createElement('div');
        statusEl.style.cssText = 'font-size: 11px; color: ' + (id === selectedId ? 'var(--accent-color,var(--accent-color))' : 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.4)') + ';';
        statusEl.textContent = id === selectedId ? 'Активный' : 'Неактивный';
        info.appendChild(nameEl);
        info.appendChild(statusEl);

        const actions = document.createElement('div');
        actions.style.cssText = 'display: flex; gap: 8px; flex-shrink: 0;';

        if (id !== selectedId) {
            const selectBtn = document.createElement('button');
            selectBtn.style.cssText = 'padding: 5px 12px; background: rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.05); border: 1px solid rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.1); border-radius: 8px; color: var(--text-color, #fff); cursor: pointer; font-size: 12px; transition: all 0.2s;';
            selectBtn.textContent = window.i18n ? window.i18n.t('select_btn') : 'Выбрать';
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
        delBtn.style.cssText = 'padding: 5px 10px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; color: #ef4444; cursor: pointer; font-size: 12px; transition: all 0.2s;';
        delBtn.textContent = 'x';
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

    const totalStat = document.getElementById('accounts-total-stat');
    if (totalStat) totalStat.textContent = Object.keys(profiles).length;
    const countEl = document.getElementById('accounts-count');
    if (countEl) countEl.textContent = Object.keys(profiles).length;
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

    if (pageId === 'home') {
        hideTitlebarProgress();
    } else if (isLaunching && _tbCurrentPct > 0) {
        _tbSetGradient(_tbCurrentPct);
        _tbWrap && _tbWrap.classList.add('visible');
    }

    if (pageId === 'modpacks') {
        if (typeof window.renderModpacksList === 'function') window.renderModpacksList();
    }
    if (pageId === 'mods-browser') {
        updateModsBrowserModpackSelect();
        populateModsFilterVersions();
        const grid = document.getElementById('mods-browser-grid');
        if (grid && grid.children.length === 0) window.searchMods(true);
    }

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
    if (!modal) return;
    modal.style.display = 'flex';
    modal.classList.remove('closing');
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });
    modal._outsideHandler = (e) => {
        if (e.target === modal) window.closeModal(modalId);
    };
    modal.addEventListener('mousedown', modal._outsideHandler);
};

window.closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    if (modal._outsideHandler) {
        modal.removeEventListener('mousedown', modal._outsideHandler);
        modal._outsideHandler = null;
    }
    modal.classList.add('closing');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('closing');
    }, 220);
};

const _tbWrap = document.getElementById('titlebar-progress-wrap');
const _tbBar = document.getElementById('titlebar-progress-bar');
let _tbHideTimer = null;
let _tbCurrentPct = 0;

function _tbSetGradient(pct) {
    if (!_tbBar) return;
    const p = Math.min(100, Math.max(0, pct));
    _tbBar.style.background = `linear-gradient(90deg, rgba(var(--accent-r, 3), var(--accent-g, 53), var(--accent-b, 252), 0.9) ${p}%, rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.1) ${p}%)`;
    _tbBar.style.boxShadow = p > 2
        ? `0 0 8px rgba(3, 53, 252, ${0.3 + p * 0.003}), 0 0 0 1px rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.06), inset 0 1px 3px rgba(0, 0, 0, 0.35)`
        : '0 0 0 1px rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.06), inset 0 1px 3px rgba(0,0,0,0.35)';
}

function showTitlebarProgress(pct) {
    if (!_tbWrap) return;
    if (_tbHideTimer) { clearTimeout(_tbHideTimer); _tbHideTimer = null; }
    _tbCurrentPct = pct;
    _tbSetGradient(pct);
    _tbWrap.classList.add('visible');
}

function hideTitlebarProgress() {
    if (!_tbWrap) return;
    _tbSetGradient(100);
    _tbHideTimer = setTimeout(() => {
        _tbWrap.classList.remove('visible');
        setTimeout(() => { _tbSetGradient(0); _tbCurrentPct = 0; }, 350);
    }, 500);
}

window.minimizeWindow = () => window.launcher.windowControl('minimize');
window.maximizeWindow = () => window.launcher.windowControl('maximize');
window.closeWindow = () => window.launcher.windowControl('close');

window.minimizeToTray = () => {
    window.launcher.windowControl('minimize-tray');
    if (Notification.permission === 'granted') {
        new Notification('FlowCross Launcher', {
            body: '\u041b\u0430\u0443\u043d\u0447\u0435\u0440 \u0441\u0432\u0451\u0440\u043d\u0443\u0442 \u0432 \u0442\u0440\u0435\u0439. \u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u043d\u0430 \u0438\u043a\u043e\u043d\u043a\u0443 \u0434\u043b\u044f \u0432\u043e\u0437\u0432\u0440\u0430\u0442\u0430.',
            icon: '../Assets/icon.ico'
        });
    }
};

function sendDownloadNotification(success, versionName) {
    const settings = currentSettings.settings || {};
    if (!settings.notifyDownload) return;
    if (Notification.permission !== 'granted') return;
    if (success) {
        new Notification('\u0421\u043a\u0430\u0447\u0438\u0432\u0430\u043d\u0438\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u043e', {
            body: `\u0412\u0435\u0440\u0441\u0438\u044f ${versionName} \u0443\u0441\u043f\u0435\u0448\u043d\u043e \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u0430`,
            icon: '../Assets/icon.ico'
        });
    } else {
        new Notification('\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438', {
            body: `\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0432\u0435\u0440\u0441\u0438\u044e ${versionName}`,
            icon: '../Assets/icon.ico'
        });
    }
}

window.showNotifySuggestBanner = () => {
    const dismissed = localStorage.getItem('notify-suggest-dismissed');
    if (dismissed === 'forever') return;
    const settings = currentSettings.settings || {};
    if (settings.notifyDownload) return;
    if (Notification.permission === 'denied') return;
    const banner = document.getElementById('notify-suggest-banner');
    if (banner) banner.style.display = 'block';
};

window.dismissNotifySuggest = (permanently) => {
    const banner = document.getElementById('notify-suggest-banner');
    if (banner) banner.style.display = 'none';
    const noMore = document.getElementById('notify-suggest-no-more');
    if (permanently || (noMore && noMore.checked)) {
        localStorage.setItem('notify-suggest-dismissed', 'forever');
    }
};

window.enableNotifyAndClose = async () => {
    try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
            if (!currentSettings.settings) currentSettings.settings = {};
            currentSettings.settings.notifyDownload = true;
            await window.launcher.saveSettings(currentSettings);
            const el = document.getElementById('settings-notify-download');
            if (el) el.checked = true;
        }
    } catch (e) { }
    window.dismissNotifySuggest(true);
};

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
            container.innerHTML = '<div style="color: rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.3);">Логи очищены.</div>';
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

    let color = 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.7)';
    if (text.toLowerCase().includes('error') || text.toLowerCase().includes('exception')) {
        color = '#ef4444';
    } else if (text.toLowerCase().includes('warn')) {
        color = '#f59e0b';
    } else if (text.toLowerCase().includes('done') || text.toLowerCase().includes('success')) {
        color = '#10b981';
    }

    const htmlContent = `<span style="color: rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.3); margin-right: 8px;">[${time}]</span> ${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')} `;

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
    await updateVersionList();
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
    if (document.getElementById('minimize-to-tray')) currentSettings.settings.minimizeToTray = document.getElementById('minimize-to-tray').checked;
    if (document.getElementById('settings-show-snapshots')) currentSettings.settings.showSnapshots = document.getElementById('settings-show-snapshots').checked;
    if (document.getElementById('settings-show-beta')) currentSettings.settings.showBeta = document.getElementById('settings-show-beta').checked;
    if (document.getElementById('settings-show-alpha')) currentSettings.settings.showAlpha = document.getElementById('settings-show-alpha').checked;

    if (document.getElementById('settings-fullscreen')) currentSettings.settings.fullscreen = document.getElementById('settings-fullscreen').checked;
    if (document.getElementById('settings-window-width')) currentSettings.settings.windowWidth = document.getElementById('settings-window-width').value;
    if (document.getElementById('settings-window-height')) currentSettings.settings.windowHeight = document.getElementById('settings-window-height').value;
    if (document.getElementById('settings-font-family')) currentSettings.settings.fontFamily = document.getElementById('settings-font-family').value;
    if (document.getElementById('settings-layout')) currentSettings.settings.layout = document.getElementById('settings-layout').value;
    if (document.getElementById('settings-page-language-select')) {
        currentSettings.settings.language = document.getElementById('settings-page-language-select').value;
        if (window.i18n && window.i18n.setLang) window.i18n.setLang(currentSettings.settings.language);
    }
    if (document.getElementById('settings-page-theme-select')) currentSettings.settings.theme = document.getElementById('settings-page-theme-select').value;
    if (document.getElementById('settings-border-radius')) currentSettings.settings.borderRadius = document.getElementById('settings-border-radius').value;
    if (document.getElementById('settings-bg-blur')) currentSettings.settings.bgBlur = document.getElementById('settings-bg-blur').value;
    if (document.getElementById('settings-bg-darken')) currentSettings.settings.bgDarken = document.getElementById('settings-bg-darken').value;
    if (document.getElementById('settings-save-logs')) currentSettings.settings.saveLogs = document.getElementById('settings-save-logs').checked;
    if (document.getElementById('settings-hide-launch-command')) currentSettings.settings.hideLaunchCommand = document.getElementById('settings-hide-launch-command').checked;
    if (document.getElementById('settings-notify-download')) currentSettings.settings.notifyDownload = document.getElementById('settings-notify-download').checked;
    if (document.getElementById('settings-auto-launch-after-download')) currentSettings.settings.autoLaunchAfterDownload = document.getElementById('settings-auto-launch-after-download').checked;
    if (document.getElementById('settings-page-accent-color')) {
        currentSettings.settings.accentColor = document.getElementById('settings-page-accent-color').value;
    }

    window.launcher.saveSettings(currentSettings);

    applyThemeSettings();
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

const minimizeToTrayToggle = document.getElementById('minimize-to-tray');
if (minimizeToTrayToggle) minimizeToTrayToggle.addEventListener('change', autoSaveSettings);

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
        showToast('Настройки импортированы');
    } else if (result.error) {
        showToast('Ошибка импорта: ' + result.error);
    }
};

window.exportSettings = async () => {
    const result = await window.launcher.exportSettings();
    if (result.success) {
        showToast('Настройки экспортированы');
    } else if (result.error) {
        showToast('Ошибка экспорта: ' + result.error);
    }
};

if (window.launcher.onImportFlowFile) {
    window.launcher.onImportFlowFile(async (filePath) => {
        showFlowImportDialog(filePath);
    });
}

function showFlowImportDialog(filePath) {
    const existing = document.getElementById('flow-import-dialog');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'flow-import-dialog';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);';

    const box = document.createElement('div');
    box.style.cssText = 'background:var(--card-color, #0e0e0e);border:1px solid rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.08);border-radius:20px;padding:32px;max-width:420px;width:90%;box-shadow:0 24px 80px rgba(0,0,0,0.8);';

    const name = filePath.split(/[\\/]/).pop();
    box.innerHTML = `
            < div style = "font-size:13px;color:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.4);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;" > Импорт конфига</div >
        <div style="font-size:18px;font-weight:700;color:var(--text-color, #fff);margin-bottom:8px;">${name}</div>
        <div style="font-size:13px;color:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.5);margin-bottom:28px;">Применить этот конфиг? Текущие настройки будут заменены.</div>
        <div style="display:flex;gap:10px;">
            <button id="fid-cancel" style="flex:1;padding:11px;background:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.05);border:1px solid rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.1);border-radius:10px;color:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.7);cursor:pointer;font-size:14px;">Отмена</button>
            <button id="fid-apply" style="flex:1;padding:11px;background:linear-gradient(135deg,rgba(var(--accent-r, 3), var(--accent-g, 53), var(--accent-b, 252), 0.9),rgba(77,127,255,0.8));border:none;border-radius:10px;color:var(--text-color, #fff);cursor:pointer;font-size:14px;font-weight:600;">Применить</button>
        </div>
        `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    overlay.querySelector('#fid-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#fid-apply').onclick = async () => {
        overlay.remove();
        const result = await window.launcher.importSettingsFromPath(filePath);
        if (result && result.success) {
            currentSettings = result.settings;
            updateUIFromSettings();
            applyThemeSettings();
            populateProfileDropdown();
            populateAccountsGrid();
            showToast('Конфиг применён');
        } else {
            showToast('Ошибка применения конфига: ' + (result?.error || 'неизвестно'));
        }
    };

    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

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
        btn.innerHTML = window.i18n ? window.i18n.t('please_wait') : '⏳ Please wait...';
        btn.disabled = true;

        await window.launcher.repairClient();

        btn.innerHTML = window.i18n ? window.i18n.t('done') : '✅ Done';
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
    window.showModal('about-modal');
};

window.browseBackground = async () => {
    const filePath = await window.launcher.openImage();
    if (!filePath) return;
    if (!currentSettings.settings) currentSettings.settings = {};
    currentSettings.settings.backgroundImage = filePath;
    await window.launcher.saveSettings(currentSettings);
    applyBackground(filePath);
    showToast('✅ Фон установлен');
};

window.promptBackgroundUrl = () => {
    const input = document.getElementById('bg-url-input');
    if (input) input.value = '';
    window.showModal('url-prompt-modal');
};

window.applyPromptBackground = async () => {
    const input = document.getElementById('bg-url-input');
    if (!input) return;
    const url = input.value.trim();
    if (!url) return;

    if (!currentSettings.settings) currentSettings.settings = {};
    currentSettings.settings.backgroundImage = url;
    await window.launcher.saveSettings(currentSettings);
    applyBackground(url);
    window.closeModal('url-prompt-modal');
    showToast('✅ Фон установлен');
};

window.removeBackground = async () => {
    if (!currentSettings.settings) currentSettings.settings = {};
    currentSettings.settings.backgroundImage = '';
    await window.launcher.saveSettings(currentSettings);
    applyBackground('');
    showToast('Фон удалён');
};

const VIDEO_EXTS = ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi'];
function isVideoFile(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    return VIDEO_EXTS.includes(ext);
}

function applyBackground(filePath) {
    const body = document.body;
    const overlay = document.getElementById('bg-image-overlay');

    let bgVideoEl = document.getElementById('bg-video-overlay');

    if (filePath) {
        const src = filePath.replace(/\\/g, '/');
        const isUrl = src.startsWith('http://') || src.startsWith('https://');
        const finalUrl = isUrl ? src : `file:///${src}`;

        body.classList.add('has-custom-bg');

        if (isVideoFile(filePath) || (isUrl && (src.includes('.mp4') || src.includes('.webm')))) {
            if (overlay) { overlay.style.opacity = '0'; overlay.style.backgroundImage = ''; }
            if (!bgVideoEl) {
                bgVideoEl = document.createElement('video');
                bgVideoEl.id = 'bg-video-overlay';
                bgVideoEl.autoplay = true;
                bgVideoEl.loop = true;
                bgVideoEl.muted = true;
                bgVideoEl.playsInline = true;
                bgVideoEl.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none;opacity:1;';
                document.body.insertBefore(bgVideoEl, document.body.firstChild);
            }
            bgVideoEl.src = finalUrl;
            bgVideoEl.style.display = 'block';
            bgVideoEl.play().catch(() => { });

            const preview = document.getElementById('bg-preview-img');
            if (preview) { preview.src = ''; preview.style.display = 'none'; }
            const previewPlaceholder = document.querySelector('.bg-preview-placeholder');
            if (previewPlaceholder) previewPlaceholder.style.display = 'none';
            const previewBox = document.querySelector('.bg-preview-box');
            if (previewBox) {
                let vp = previewBox.querySelector('.bg-video-preview');
                if (!vp) {
                    vp = document.createElement('video');
                    vp.className = 'bg-video-preview';
                    vp.autoplay = true; vp.loop = true; vp.muted = true; vp.playsInline = true;
                    vp.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;';
                    previewBox.appendChild(vp);
                }
                vp.src = finalUrl;
                vp.play().catch(() => { });
            }
        } else {
            if (bgVideoEl) { bgVideoEl.style.display = 'none'; bgVideoEl.src = ''; }
            const previewVid = document.querySelector('.bg-video-preview');
            if (previewVid) { previewVid.style.display = 'none'; previewVid.src = ''; }

            if (overlay) {
                overlay.style.backgroundImage = `url("${finalUrl}")`;
                overlay.style.opacity = '1';
            }
            const preview = document.getElementById('bg-preview-img');
            if (preview) { preview.src = finalUrl; preview.style.display = 'block'; }
        }

        const removeBtn = document.getElementById('bg-remove-btn');
        if (removeBtn) removeBtn.style.display = 'flex';
    } else {
        body.classList.remove('has-custom-bg');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => { overlay.style.backgroundImage = ''; }, 400);
        }
        if (bgVideoEl) { bgVideoEl.style.display = 'none'; bgVideoEl.src = ''; }
        const preview = document.getElementById('bg-preview-img');
        if (preview) { preview.src = ''; preview.style.display = 'none'; }
        const previewVid = document.querySelector('.bg-video-preview');
        if (previewVid) { previewVid.style.display = 'none'; previewVid.src = ''; }
        const removeBtn = document.getElementById('bg-remove-btn');
        if (removeBtn) removeBtn.style.display = 'none';
    }
}


window.checkForUpdates = async () => {
    const btn = document.querySelector('button[onclick="checkForUpdates()"]');
    if (btn) {
        const orig = btn.innerHTML;
        btn.textContent = 'Проверка...';
        btn.disabled = true;
        try { await window.launcher.checkForUpdates(); } catch (e) { }
        setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 3000);
    } else {
        try { await window.launcher.checkForUpdates(); } catch (e) { }
    }
};

const _ub = {
    get banner() { return document.getElementById('update-banner'); },
    get title() { return document.getElementById('update-banner-title'); },
    get sub() { return document.getElementById('update-banner-sub'); },
    get progWrap() { return document.getElementById('update-banner-progress-wrap'); },
    get progBar() { return document.getElementById('update-banner-progress-bar'); },
    get btnLater() { return document.getElementById('update-btn-later'); },
    get btnInst() { return document.getElementById('update-btn-install'); },
    state: 'idle',
};

function _ubShow() {
    if (_ub.banner) {
        _ub.banner.classList.add('visible');
    }
}

function _ubHide() {
    if (_ub.banner) {
        _ub.banner.classList.remove('visible');
    }
}

document.addEventListener('click', async (e) => {
    if (e.target.id === 'update-btn-later') {
        _ubHide();
    } else if (e.target.id === 'update-btn-install') {
        if (_ub.state === 'available') {
            _ub.state = 'downloading';
            const btn = _ub.btnInst;
            const btnL = _ub.btnLater;
            if (btn) { btn.textContent = 'Загрузка...'; btn.disabled = true; }
            if (btnL) btnL.disabled = true;
            if (_ub.progWrap) _ub.progWrap.classList.add('active');
            await window.launcher.downloadUpdate();
        } else if (_ub.state === 'downloaded') {
            const btn = _ub.btnInst;
            if (btn) { btn.textContent = 'Перезапуск...'; btn.disabled = true; }
            await window.launcher.quitAndInstall();
        }
    }
});

window.launcher.onUpdateAvailable((info) => {
    _ub.state = 'available';
    if (_ub.title) _ub.title.textContent = `Обновление ${info.version}`;
    if (_ub.sub) _ub.sub.textContent = 'Новая версия FlowCross готова к загрузке';
    if (_ub.btnInst) _ub.btnInst.textContent = 'Установить';
    if (_ub.btnInst) _ub.btnInst.disabled = false;
    if (_ub.btnLater) _ub.btnLater.disabled = false;
    if (_ub.progWrap) _ub.progWrap.classList.remove('active');
    _ubShow();
});

window.launcher.onUpdateProgress && window.launcher.onUpdateProgress((pct) => {
    if (_ub.progBar) _ub.progBar.style.width = pct + '%';
    if (_ub.sub) _ub.sub.textContent = `Загрузка... ${pct}%`;
});((info) => {
    _ub.state = 'downloaded';
    if (_ub.title) _ub.title.textContent = `v${info.version} готова`;
    if (_ub.sub) _ub.sub.textContent = 'Перезапустите лаунчер для установки';
    if (_ub.progBar) _ub.progBar.style.width = '100%';
    if (_ub.btnInst) { _ub.btnInst.textContent = 'Перезапустить'; _ub.btnInst.disabled = false; }
    if (_ub.btnLater) _ub.btnLater.disabled = false;
    _ubShow();
});

window.launcher.onUpdateError((err) => {
    _ubHide();
});

if (window.launcher.onUpdateProgress) {
    window.launcher.onUpdateProgress((pct) => {
        if (_ub.progBar) _ub.progBar.style.width = (pct.percent || pct) + '%';
        if (_ub.sub) _ub.sub.textContent = `Загрузка... ${Math.round(pct.percent || pct)}%`;
    });
}

function populateVersionSelects() {
    if (!versionSelect) return;

    versionSelect.innerHTML = '';

    const showSnapshots = currentSettings.settings?.showSnapshots || false;
    const showBeta = currentSettings.settings?.showBeta || false;
    const showAlpha = currentSettings.settings?.showAlpha || false;

    const loader = (currentSettings.settings?.modloader || (modloaderSelect ? modloaderSelect.value : 'none'));

    let filtered = availableVersions.filter(v => {
        if (loader === 'flowcross') return v.id === '1.21.1';
        if (v.type === 'release') return true;
        if (v.type === 'snapshot' && showSnapshots) return true;
        if (v.type === 'old_beta' && showBeta) return true;
        if (v.type === 'old_alpha' && showAlpha) return true;
        return false;
    });

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

    const cmpVersion = document.getElementById('create-modpack-version');
    if (cmpVersion) {
        cmpVersion.innerHTML = '';
        availableVersions.filter(v => v.type === 'release').forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = v.id;
            cmpVersion.appendChild(opt);
        });
    }

    if (typeof refreshVersionPicker === 'function') refreshVersionPicker();
}

function populateVersionsGrid() {
    if (!versionsGrid) return;
    versionsGrid.innerHTML = '';

    const showSnapshots = currentSettings.settings?.showSnapshots || false;
    const loader = (currentSettings.settings?.modloader || (modloaderSelect ? modloaderSelect.value : 'none'));

    let filtered = availableVersions.filter(v => {
        if (loader === 'flowcross') return v.id === '1.21.1';
        if (v.type === 'release') return true;
        if (v.type === 'snapshot' && showSnapshots) return true;
        return false;
    });

    for (const v of filtered) {
        const note = allPatchNotes.find(n => n.version === v.id);
        const imageUrl = note ? note.image : null;

        const div = document.createElement('div');
        div.className = 'version-card';
        div.style.cssText = 'background: rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.03); border: 1px solid rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.06); border-radius: 12px; overflow: hidden; transition: all 0.2s; cursor: pointer; display: flex; flex-direction: column; height: 200px;';
        div.onmouseenter = () => { div.style.background = 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.06)'; div.style.borderColor = 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.12)'; div.style.transform = 'translateY(-2px)'; };
        div.onmouseleave = () => { div.style.background = 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.03)'; div.style.borderColor = 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.06)'; div.style.transform = 'translateY(0)'; };

        let bannerHtml = '';
        if (imageUrl) {
            bannerHtml = `<div style="height: 120px; background-image: url('${imageUrl}'); background-size: cover; background-position: center;"></div>`;
        } else {
            bannerHtml = `
            <div style="height: 120px; background: linear-gradient(135deg, rgba(20,20,20,1) 0%, rgba(40,40,40,1) 100%); display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;">
                <img src="https://raw.githubusercontent.com/PrismLauncher/meta/main/img/versions/${v.id}.png" 
                     style="height: 64px; image-rendering: pixelated; z-index: 10; position: relative;"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                <div style="display: none; font-size: 24px; font-weight: 700; color: rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.1);">${v.id}</div>
                <div style="position: absolute; inset: 0; background-image: url('https://raw.githubusercontent.com/PrismLauncher/meta/main/img/versions/${v.id}.png'); background-size: cover; background-position: center; filter: blur(20px) brightness(0.3); opacity: 0.5;"></div>
            </div>`;
        }

        const dateStr = v.releaseTime ? new Date(v.releaseTime).toLocaleDateString('ru-RU') : '';

        div.innerHTML = `
            ${bannerHtml}
            <div style="padding: 12px; flex: 1; display: flex; flex-direction: column; justify-content: center;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-weight: 600; font-size: 14px; color: var(--text-color, #fff);">${v.id}</span>
                    <span style="font-size: 11px; padding: 2px 6px; background: rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.1); border-radius: 4px; color: rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.6);">${v.type}</span>
                </div>
                <div style="font-size: 11px; color: rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.3);">${dateStr}</div>
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

        const versionsProfName = document.getElementById('versions-page-profile-name');
        const versionsProfInitial = document.getElementById('versions-page-profile-initial');
        if (versionsProfName) versionsProfName.textContent = profile.name;
        if (versionsProfInitial) versionsProfInitial.textContent = profile.name.charAt(0).toUpperCase();

        loadSkinViewer(profile.name);

        const launchBtnEl = document.getElementById('launch-game-btn');
        if (launchBtnEl && !launchBtnEl.classList.contains('loading')) {
            const ver = settings.gameVersion || '';
            launchBtnEl.textContent = ver ? `ИГРАТЬ ${ver}` : 'ИГРАТЬ';
        }

        if (modloaderSelect) modloaderSelect.value = settings.modloader || 'none';

        if (ramInput) ramInput.value = settings.ram || 4096;
        if (document.getElementById('settings-global-ram-display'))
            document.getElementById('settings-global-ram-display').textContent = (settings.ram || 4096) + ' MB';

        if (javaPathInput) {
            javaPathInput.value = settings.javaPath || '';
            if (!settings.javaPath && window.launcher.getDefaultPaths) {
                window.launcher.getDefaultPaths().then(paths => {
                    javaPathInput.placeholder = paths.java;
                }).catch(() => { });
            }
        }
        if (jvmArgsInput) jvmArgsInput.value = settings.jvmArgs || '';

        const gamePathEl = document.getElementById('settings-game-path');
        if (gamePathEl) {
            gamePathEl.value = settings.gamePath || '';
            if (!settings.gamePath && window.launcher.getDefaultPaths) {
                window.launcher.getDefaultPaths().then(paths => {
                    gamePathEl.placeholder = paths.game;
                }).catch(() => { });
            }
        }

        if (document.getElementById('auto-connect')) document.getElementById('auto-connect').checked = settings.autoConnect || false;
        if (document.getElementById('keep-launcher-open')) document.getElementById('keep-launcher-open').checked = settings.keepLauncherOpen || false;
        if (document.getElementById('discord-rpc')) document.getElementById('discord-rpc').checked = settings.discordRpc || false;
        if (document.getElementById('minimize-to-tray')) document.getElementById('minimize-to-tray').checked = settings.minimizeToTray || false;

        if (document.getElementById('settings-show-snapshots')) document.getElementById('settings-show-snapshots').checked = settings.showSnapshots || false;
        if (document.getElementById('settings-show-beta')) document.getElementById('settings-show-beta').checked = settings.showBeta || false;
        if (document.getElementById('settings-show-alpha')) document.getElementById('settings-show-alpha').checked = settings.showAlpha || false;

        if (document.getElementById('settings-fullscreen')) document.getElementById('settings-fullscreen').checked = settings.fullscreen || false;
        if (document.getElementById('settings-window-width')) document.getElementById('settings-window-width').value = settings.windowWidth || 854;
        if (document.getElementById('settings-window-height')) document.getElementById('settings-window-height').value = settings.windowHeight || 480;
        if (document.getElementById('settings-font-family')) document.getElementById('settings-font-family').value = settings.fontFamily || 'axiforma';
        if (document.getElementById('settings-layout')) document.getElementById('settings-layout').value = settings.layout || 'left';
        if (document.getElementById('settings-border-radius')) {
            const v = settings.borderRadius || 12;
            document.getElementById('settings-border-radius').value = v;
            if (document.getElementById('border-radius-val')) document.getElementById('border-radius-val').textContent = v;
        }
        if (document.getElementById('settings-bg-blur')) {
            const v = settings.bgBlur || 0;
            document.getElementById('settings-bg-blur').value = v;
            if (document.getElementById('bg-blur-val')) document.getElementById('bg-blur-val').textContent = v;
        }
        if (document.getElementById('settings-bg-darken')) {
            const v = settings.bgDarken !== undefined ? settings.bgDarken : 20;
            document.getElementById('settings-bg-darken').value = v;
            if (document.getElementById('bg-darken-val')) document.getElementById('bg-darken-val').textContent = v;
        }
        if (document.getElementById('settings-save-logs')) document.getElementById('settings-save-logs').checked = settings.saveLogs || false;
        if (document.getElementById('settings-hide-launch-command')) document.getElementById('settings-hide-launch-command').checked = settings.hideLaunchCommand !== false;
        if (document.getElementById('settings-notify-download')) document.getElementById('settings-notify-download').checked = settings.notifyDownload !== false;
        if (document.getElementById('settings-auto-launch-after-download')) document.getElementById('settings-auto-launch-after-download').checked = settings.autoLaunchAfterDownload !== false;

        if (document.getElementById('settings-page-accent-color')) {
            document.getElementById('settings-page-accent-color').value = settings.accentColor || 'var(--accent-color)';
        }

        if (settings.language && document.getElementById('settings-page-language-select')) {
            document.getElementById('settings-page-language-select').value = settings.language;
        }

        if (settings.theme && document.getElementById('settings-page-theme-select')) {
            document.getElementById('settings-page-theme-select').value = settings.theme;
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

        if (settings.updateChannel) {
            const channelSelects = [
                document.getElementById('settings-modal-update-channel-select'),
                document.getElementById('settings-page-update-channel-select')
            ];

            channelSelects.forEach(channelSelect => {
                if (channelSelect) {
                    const opt = channelSelect.querySelector(`.custom-option[data-value="${settings.updateChannel}"]`);
                    if (opt) {
                        channelSelect.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
                        opt.classList.add('selected');
                        const triggerSpan = channelSelect.querySelector('.custom-select-trigger span');
                        if (triggerSpan) triggerSpan.textContent = opt.textContent;
                    }
                }
            });
        }

        applyThemeSettings();
        applyBackground(settings.backgroundImage || '');
        populateProfileDropdown();
        populateAccountsGrid();
        if (typeof refreshProfileDropdown === 'function') refreshProfileDropdown();
        if (typeof refreshVersionPicker === 'function') refreshVersionPicker();
    }
}

let _skinViewer = null;
let _lastSkinName = null;

async function loadSkinViewer(username) {
    if (!window.skinview3d) return;
    if (username === _lastSkinName && _skinViewer) return;
    _lastSkinName = username;

    const canvas = document.getElementById('skin-canvas');
    const placeholder = document.getElementById('skin-viewer-placeholder');
    if (!canvas) return;

    canvas.classList.remove('loaded');
    if (placeholder) placeholder.classList.remove('hidden');

    try {
        const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`);
        if (!mojangRes.ok) throw new Error('User not found');
        const { id } = await mojangRes.json();

        const profileRes = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`);
        if (!profileRes.ok) throw new Error('Profile not found');
        const profileData = await profileRes.json();

        const texProp = profileData.properties?.find(p => p.name === 'textures');
        if (!texProp) throw new Error('No textures');

        const texData = JSON.parse(atob(texProp.value));
        const skinUrl = texData.textures?.SKIN?.url;
        if (!skinUrl) throw new Error('No skin URL');

        const wrap = document.getElementById('skin-viewer-wrap');
        const w = wrap ? wrap.clientWidth : 180;
        const h = wrap ? wrap.clientHeight : 320;

        if (_skinViewer) {
            _skinViewer.dispose();
            _skinViewer = null;
        }

        _skinViewer = new skinview3d.SkinViewer({
            canvas,
            width: w || 180,
            height: h || 320,
            skin: skinUrl,
        });

        _skinViewer.controls.enableRotate = true;
        _skinViewer.controls.enableZoom = false;
        _skinViewer.controls.enablePan = false;
        _skinViewer.autoRotate = false;
        _skinViewer.animation = null;
        _skinViewer.zoom = 0.65;
        _skinViewer.globalLight.intensity = 3;
        _skinViewer.cameraLight.intensity = 0.6;

        canvas.classList.add('loaded');
        if (placeholder) placeholder.classList.add('hidden');

        if (!_skinViewerResizeObserver && wrap) {
            _skinViewerResizeObserver = new ResizeObserver(() => {
                if (_skinViewer && wrap) {
                    _skinViewer.setSize(wrap.clientWidth, wrap.clientHeight);
                }
            });
            _skinViewerResizeObserver.observe(wrap);
        }
    } catch (e) {
        if (placeholder) placeholder.classList.remove('hidden');
        canvas.classList.remove('loaded');
    }
}

let _skinViewerResizeObserver = null;

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
                } else if (select.id === 'settings-modal-update-channel-select' || select.id === 'settings-page-update-channel-select') {
                    if (!currentSettings.settings) currentSettings.settings = {};
                    currentSettings.settings.updateChannel = val;
                    await window.launcher.saveSettings(currentSettings);
                    updateUIFromSettings();

                    if (window.checkForUpdates) {
                        try { window.checkForUpdates(); } catch (e) { }
                    }
                }
            });
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
    });

    const bindSlider = (id, suffix, callback) => {
        const el = document.getElementById(id);
        const valEl = document.getElementById(id + '-val');
        if (el) {
            el.addEventListener('input', (e) => {
                const v = e.target.value;
                if (valEl) valEl.textContent = v + suffix;
                if (callback) callback(v);
            });
        }
    };

    bindSlider('settings-border-radius', '', (v) => {
        document.documentElement.style.setProperty('--border-radius', v + 'px');
    });
    bindSlider('settings-bg-blur', '', (v) => {
        let el = document.getElementById('bg-image-overlay');
        if (el) {
            el.style.backdropFilter = `blur(${v}px)`;
            el.style.webkitBackdropFilter = `blur(${v}px)`;
        }
    });
    bindSlider('settings-bg-darken', '', (v) => {
        let el = document.getElementById('bg-image-overlay');
        if (el) el.style.backgroundColor = `rgba(0,0,0,${v / 100})`;
    });
}

init();

async function setAppVersionLabels() {
    try {
        if (window.launcher.getAppVersion) {
            const res = await window.launcher.getAppVersion();
            const ver = (res && res.version) ? res.version : (res || '?');
            const isBeta = res && res.isBeta === true;

            const logo = document.getElementById('launcher-logo');
            if (logo) logo.setAttribute('data-version', 'v' + ver);

            const aboutVersion = document.getElementById('about-version');
            if (aboutVersion) aboutVersion.textContent = ver;

            const bottomVersion = document.getElementById('launcher-version-display');
            if (bottomVersion) {
                bottomVersion.textContent = 'v' + ver;
                const existing = document.getElementById('beta-badge');
                if (isBeta && !existing) {
                    const badge = document.createElement('span');
                    badge.id = 'beta-badge';
                    badge.textContent = 'BETA';
                    badge.style.cssText = 'margin-left:8px;padding:2px 7px;background:rgba(245,158,11,0.18);color:#f59e0b;border:1px solid rgba(245,158,11,0.4);border-radius:5px;font-size:10px;font-weight:700;letter-spacing:0.8px;vertical-align:middle;';
                    bottomVersion.insertAdjacentElement('afterend', badge);
                } else if (!isBeta && existing) {
                    existing.remove();
                }
            }
        }
    } catch (e) { }
}
setAppVersionLabels();


let commandPaletteOpen = false;
function getCommands() {
    const t = window.i18n ? window.i18n.t : (k) => k;
    return [
        { id: 'page-home', label: t('cmd_home'), tag: 'home главная', action: () => switchPage('home') },
        { id: 'page-versions', label: t('cmd_versions'), tag: 'versions minecraft', action: () => switchPage('versions') },
        { id: 'page-settings', label: t('cmd_settings'), tag: 'settings настройки', action: () => switchPage('settings') },
        { id: 'page-accounts', label: t('cmd_accounts'), tag: 'accounts профиль profile', action: () => switchPage('accounts') },
        { id: 'page-logs', label: t('cmd_logs'), tag: 'logs логи консоль console', action: () => switchPage('logs') },
        { id: 'page-changelog', label: t('cmd_changelog'), tag: 'changelog changes', action: () => switchPage('changelog') },
        { id: 'action-repair', label: t('cmd_repair'), tag: 'repair fix восстановить', action: () => repairLauncherFiles() },
        { id: 'action-reset', label: t('cmd_reset'), tag: 'reset сбросить clear', action: () => showResetDialog() },
        { id: 'folder-game', label: t('cmd_open_game'), tag: 'game folder папка .minecraft', action: () => window.launcher.openFolder('game') },
        { id: 'folder-mods', label: t('cmd_open_mods'), tag: 'mods folder моды папка', action: () => window.launcher.openFolder('mods') },
        { id: 'folder-launcher', label: t('cmd_open_launcher'), tag: 'launcher folder папка', action: () => window.launcher.openFolder('launcher') },
        { id: 'export-settings', label: t('cmd_export'), tag: 'export save экспорт', action: () => window.exportSettings() },
        { id: 'import-settings', label: t('cmd_import'), tag: 'import load импорт', action: () => window.importSettings() },
        { id: 'action-clear-logs', label: t('clear') + ' ' + t('logs'), tag: 'clear logs очистить', action: () => clearLogs() },
        { id: 'action-copy-logs', label: t('copy') + ' ' + t('logs'), tag: 'copy logs скопировать', action: () => copyLogs() },
        { id: 'action-about', label: t('about'), tag: 'about программа info', action: () => showAboutModal() },
        { id: 'action-updates', label: t('update'), tag: 'update обновление', action: () => checkForUpdates() },
    ];
}

function toggleCommandPalette() {
    const overlay = document.getElementById('command-palette-overlay');
    const input = document.getElementById('cp-input');

    if (commandPaletteOpen) {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.style.display = 'none', 150);
        commandPaletteOpen = false;
    } else {
        overlay.style.display = 'flex';
        overlay.offsetHeight;
        overlay.classList.add('visible');
        renderCommandResults(getCommands());
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
        div.style.color = 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.3)';
        div.textContent = window.i18n ? window.i18n.t('nothing_found') : 'Ничего не найдено';
        container.appendChild(div);
        return;
    }

    results.forEach((cmd, index) => {
        const div = document.createElement('div');
        div.className = 'cp-item';
        if (index === 0) div.classList.add('selected');

        div.innerHTML = `
            <div style="display: flex; align-items: center;">
                <span class="cp-item-icon" style="width:18px;height:18px;margin-right:10px;opacity:0.6;display:flex;align-items:center;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
                        <circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                    </svg>
                </span>
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

window.toggleCommandPalette = toggleCommandPalette;
window.closeCommandPalette = closeCommandPalette;

setTimeout(() => {
    const cpInput = document.getElementById('cp-input');
    if (cpInput) {
        cpInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = getCommands().filter(c =>
                c.label.toLowerCase().includes(query) ||
                (c.tag && c.tag.toLowerCase().includes(query))
            );
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

                if (selectedIndex < 0) selectedIndex = 0;

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

document.addEventListener('click', (e) => {
    const nd = document.getElementById('profile-name-dropdown');
    const portal = document.getElementById('version-picker-portal');
    if (nd && !nd.contains(e.target)) nd.classList.remove('open');
    if (portal && portal.classList.contains('open') && !e.target.closest('#version-picker-btn') && !portal.contains(e.target)) {
        portal.classList.remove('open');
    }
});

document.addEventListener('click', (e) => {
    const nd = document.getElementById('profile-name-dropdown');
    if (nd && nd.contains(e.target) && !e.target.closest('.profile-dropdown-menu')) {
        nd.classList.toggle('open');
    }
});

document.addEventListener('click', (e) => {
    const btn = e.target.closest('#version-picker-btn');
    if (!btn) return;
    const portal = document.getElementById('version-picker-portal');
    if (!portal) return;
    if (portal.classList.contains('open')) {
        portal.classList.remove('open');
        return;
    }
    const rect = btn.getBoundingClientRect();
    portal.style.width = Math.max(240, rect.width + rect.width * 3) + 'px';
    portal.style.left = rect.right - parseInt(portal.style.width) + 'px';
    portal.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
    portal.style.top = 'auto';
    portal.classList.add('open');
    refreshVersionPickerList();
});

document.addEventListener('click', (e) => {
    const item = e.target.closest('.profile-dropdown-item');
    if (!item) return;
    const profileId = item.dataset.profileId;
    if (!profileId || !currentSettings.profiles?.[profileId]) return;
    currentSettings.selectedProfile = profileId;
    selectedAccount = getSelectedAccount();
    window.launcher.saveSettings(currentSettings).then(() => {
        updateUIFromSettings();
        document.getElementById('profile-name-dropdown')?.classList.remove('open');
    });
});

document.addEventListener('click', (e) => {
    const item = e.target.closest('.vpm-item');
    if (!item) return;
    const version = item.dataset.version;
    if (!version) return;
    if (!currentSettings.settings) currentSettings.settings = {};
    currentSettings.settings.gameVersion = version;
    if (versionSelect) {
        let opt = Array.from(versionSelect.options).find(o => o.value === version);
        if (!opt) {
            opt = document.createElement('option');
            opt.value = version;
            opt.textContent = item.dataset.isModpack === 'true' ? item.dataset.name : version;
            versionSelect.appendChild(opt);
        }
        versionSelect.value = version;
    }
    const launchBtnEl = document.getElementById('launch-game-btn');
    if (launchBtnEl && !launchBtnEl.classList.contains('loading')) {
        const displayName = item.dataset.isModpack === 'true' ? item.dataset.name : version;
        launchBtnEl.textContent = `ИГРАТЬ ${displayName}`;
    }
    document.getElementById('version-picker-portal')?.classList.remove('open');
    window.launcher.saveSettings(currentSettings);
});

document.addEventListener('click', (e) => {
    const tab = e.target.closest('.vpm-tab');
    if (!tab) return;
    document.querySelectorAll('.vpm-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const loader = tab.dataset.loader;
    if (!currentSettings.settings) currentSettings.settings = {};
    currentSettings.settings.modloader = loader;
    if (modloaderSelect) modloaderSelect.value = loader;
    window.launcher.saveSettings(currentSettings);
    updateVersionList().then(() => refreshVersionPickerList());
});

function refreshProfileDropdown() {
    const menu = document.getElementById('profile-dropdown-menu');
    if (!menu || !currentSettings.profiles) return;
    menu.innerHTML = '';
    const selected = currentSettings.selectedProfile;
    Object.entries(currentSettings.profiles).forEach(([id, p]) => {
        const div = document.createElement('div');
        div.className = 'profile-dropdown-item' + (id === selected ? ' active' : '');
        div.dataset.profileId = id;
        div.innerHTML = `<span class="pdi-dot"></span><span>${p.name}</span>`;
        menu.appendChild(div);
    });
}

function refreshVersionPickerList() {
    const list = document.getElementById('vpm-list');
    if (!list) return;
    list.innerHTML = '';
    const current = currentSettings.settings?.gameVersion || '';
    const currentLoader = currentSettings.settings?.modloader || 'none';

    document.querySelectorAll('.vpm-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.loader === currentLoader);
    });

    const showSnapshots = currentSettings.settings?.showSnapshots || false;
    const showBeta = currentSettings.settings?.showBeta || false;
    const showAlpha = currentSettings.settings?.showAlpha || false;

    let filtered = availableVersions.filter(v => {
        if (currentLoader === 'flowcross') return v.id === '1.21.1';
        if (v.type === 'release') return true;
        if (v.type === 'snapshot' && showSnapshots) return true;
        if (v.type === 'old_beta' && showBeta) return true;
        if (v.type === 'old_alpha' && showAlpha) return true;
        return false;
    });

    const mps = (currentSettings.settings?.modpacks || []).filter(m => m.loader === currentLoader || (currentLoader === 'none' && m.loader === 'vanilla'));
    mps.forEach(m => {
        const div = document.createElement('div');
        div.className = 'vpm-item modpack-item' + (m.id === current ? ' active' : '');
        div.dataset.version = m.id;
        div.dataset.isModpack = 'true';
        div.dataset.name = m.name;
        div.dataset.realVersion = m.version;
        div.innerHTML = `<span style="color: var(--accent-light, #638aff); margin-right: 5px;">★</span>${m.name}<span style="opacity: 0.5; font-size: 11px; margin-left: auto;">${m.version}</span>`;
        list.appendChild(div);
    });

    filtered.forEach(v => {
        const id = v.id || v;

        const div = document.createElement('div');
        div.className = 'vpm-item' + (id === current ? ' active' : '');
        div.dataset.version = id;
        div.textContent = id;
        list.appendChild(div);
    });
}

function refreshVersionPicker() {
    refreshVersionPickerList();
    const current = currentSettings.settings?.gameVersion || '';
    const launchBtnEl = document.getElementById('launch-game-btn');
    if (launchBtnEl && !launchBtnEl.classList.contains('loading') && current) {
        let displayName = current;
        const mp = (currentSettings.settings?.modpacks || []).find(m => m.id === current);
        if (mp) displayName = mp.name;
        launchBtnEl.textContent = `ИГРАТЬ ${displayName}`;
    }
}

// ================= MODPACKS =================

window.createModpack = async () => {
    const name = document.getElementById('create-modpack-name').value.trim();
    const version = document.getElementById('create-modpack-version').value;
    const loader = document.getElementById('create-modpack-loader').value;
    if (!name || !version || !loader) return;
    if (!currentSettings.settings) currentSettings.settings = {};
    if (!currentSettings.settings.modpacks) currentSettings.settings.modpacks = [];
    const id = 'mp_' + Date.now();
    currentSettings.settings.modpacks.push({ id, name, version, loader });
    await window.launcher.saveSettings(currentSettings);
    closeModal('create-modpack-modal');
    document.getElementById('create-modpack-name').value = '';
    window.renderModpacksList();
    if (typeof refreshVersionPickerList === 'function') refreshVersionPickerList();
};

window.renderModpacksList = () => {
    const list = document.getElementById('modpacks-list');
    if (!list) return;
    list.innerHTML = '';
    const mps = currentSettings.settings?.modpacks || [];
    if (mps.length === 0) {
        list.innerHTML = `<div style="color:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.3);text-align:center;grid-column:1/-1;padding:60px 0;display:flex;flex-direction:column;align-items:center;gap:12px;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity:0.4;"><path d="M12 21L3 16V8L12 3L21 8V16L12 21Z"/><path d="M3 8L12 13L21 8"/><path d="M12 13V21"/></svg>
            <div>Нет сборок. Создайте первую!</div></div>`;
        return;
    }
    mps.forEach(mp => {
        const loaderColor = { fabric: '#daa520', forge: '#d4673a', vanilla: '#7ec845', neoforge: '#e07830', quilt: '#8a4ca1' }[mp.loader] || 'var(--accent-light, #638aff)';
        const card = document.createElement('div');
        card.style.cssText = 'background:linear-gradient(135deg,rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.03),rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.01));border:1px solid rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.08);border-radius:16px;overflow:hidden;cursor:pointer;transition:all 0.22s;display:flex;flex-direction:column;';
        card.innerHTML = `
            <div style="height:5px;background:linear-gradient(90deg,${loaderColor}88,${loaderColor}11);"></div>
            <div style="padding:18px;display:flex;flex-direction:column;gap:12px;flex:1;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
                    <div style="font-size:17px;font-weight:700;color:var(--text-color, #fff);line-height:1.3;">${mp.name}</div>
                    <button onclick="event.stopPropagation();deleteModpack('${mp.id}')" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:8px;color:#ef4444;width:29px;height:29px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <span style="background:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.07);padding:3px 10px;border-radius:20px;font-size:12px;color:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.7);">${mp.version}</span>
                    <span style="background:${loaderColor}22;color:${loaderColor};padding:3px 10px;border-radius:20px;font-size:12px;text-transform:capitalize;">${mp.loader}</span>
                </div>
                <div style="display:flex;gap:8px;padding-top:10px;border-top:1px solid rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.05);">
                    <button onclick="event.stopPropagation();viewModpack('${mp.id}')" style="flex:1;background:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.05);border:1px solid rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.1);border-radius:10px;color:var(--text-color, #fff);padding:8px;cursor:pointer;font-size:13px;transition:0.2s;">Открыть</button>
                    <button onclick="event.stopPropagation();launchModpack('${mp.id}')" style="flex:1;background:rgba(var(--accent-r, 3), var(--accent-g, 53), var(--accent-b, 252), 0.15);border:1px solid rgba(var(--accent-r, 3), var(--accent-g, 53), var(--accent-b, 252), 0.3);border-radius:10px;color:var(--accent-light, #638aff);padding:8px;cursor:pointer;font-size:13px;transition:0.2s;">▶ Играть</button>
                </div>
            </div>`;
        card.onmouseenter = () => { card.style.borderColor = 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.18)'; card.style.transform = 'translateY(-2px)'; card.style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)'; };
        card.onmouseleave = () => { card.style.borderColor = 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.08)'; card.style.transform = ''; card.style.boxShadow = ''; };
        card.onclick = () => viewModpack(mp.id);
        list.appendChild(card);
    });
    updateModsBrowserModpackSelect();
};

window.deleteModpack = async (id) => {
    if (!currentSettings.settings?.modpacks) return;
    currentSettings.settings.modpacks = currentSettings.settings.modpacks.filter(m => m.id !== id);
    if (currentSettings.settings.gameVersion === id) currentSettings.settings.gameVersion = '';
    await window.launcher.saveSettings(currentSettings);
    window.renderModpacksList();
    if (typeof refreshVersionPickerList === 'function') refreshVersionPickerList();
};

window.launchModpack = (id) => {
    if (!currentSettings.settings) currentSettings.settings = {};
    currentSettings.settings.gameVersion = id;
    window.launcher.saveSettings(currentSettings).then(() => { switchPage('home'); setTimeout(launchGame, 200); });
};

let currentViewedModpack = null;

window.viewModpack = async (id) => {
    const mp = (currentSettings.settings?.modpacks || []).find(m => m.id === id);
    if (!mp) return;
    currentViewedModpack = id;
    const t = document.getElementById('modpack-details-title');
    const v = document.getElementById('modpack-details-version');
    const l = document.getElementById('modpack-details-loader');
    if (t) t.textContent = mp.name;
    if (v) v.textContent = mp.version;
    if (l) l.textContent = mp.loader;
    switchPage('modpack-details');
    await loadModpackMods(id);
};

async function loadModpackMods(id) {
    const list = document.getElementById('modpack-mods-list');
    const countEl = document.getElementById('modpack-mods-count');
    if (!list) return;
    list.innerHTML = '<div style="color:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.3);padding:30px;text-align:center;">Загрузка...</div>';
    const mods = await window.launcher.getModpackMods(id);
    if (countEl) countEl.textContent = `${mods.length} ${mods.length === 1 ? 'мод' : mods.length < 5 ? 'мода' : 'модов'}`;
    if (mods.length === 0) {
        list.innerHTML = `<div style="color:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.3);text-align:center;padding:60px 0;display:flex;flex-direction:column;align-items:center;gap:12px;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity:0.4;"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
            <div>Нет модов. <span style="color:var(--accent-light, #638aff);cursor:pointer;" onclick="switchPage('mods-browser')">Найти в Modrinth →</span></div></div>`;
        return;
    }
    list.innerHTML = '';
    mods.forEach(mod => {
        const name = mod.modTitle || mod.filename.replace('.jar.disabled', '').replace('.jar', '');
        const row = document.createElement('div');
        row.className = 'mod-row-item';
        row.style.cssText = `display:flex;align-items:center;gap:12px;background:rgba(10,10,12,0.8);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 16px;transition:0.2s;`;
        row.innerHTML = `
            <div style="width:8px;height:8px;border-radius:50%;background:${mod.enabled ? '#22c55e' : 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.2)'};flex-shrink:0;"></div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:14px;font-weight:500;color:${mod.enabled ? 'var(--text-color, #fff)' : 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.45)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
                <div style="font-size:11px;color:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.3);margin-top:2px;">${(mod.size / 1024).toFixed(1)} KB</div>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
                <button onclick="window.toggleMod('${id}','${mod.filename}',${!mod.enabled})" style="background:${mod.enabled ? 'rgba(34,197,94,0.12)' : 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.06)'};border:1px solid ${mod.enabled ? 'rgba(34,197,94,0.3)' : 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.1)'};border-radius:8px;color:${mod.enabled ? '#22c55e' : 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.4)'};padding:5px 11px;cursor:pointer;font-size:12px;">${mod.enabled ? 'Вкл' : 'Выкл'}</button>
                <button onclick="window.deleteMod('${id}','${mod.filename}')" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;color:#ef4444;padding:5px 9px;cursor:pointer;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                </button>
            </div>`;
        list.appendChild(row);
    });
}

window.toggleMod = async (modpackId, filename, enable) => {
    await window.launcher.toggleMod({ modpackId, filename, enabled: enable });
    await loadModpackMods(modpackId);
};
window.deleteMod = async (modpackId, filename) => {
    await window.launcher.deleteMod({ modpackId, filename });
    await loadModpackMods(modpackId);
};

window.checkModpackUpdates = async () => {
    if (!currentViewedModpack) return;
    const btn = document.getElementById('modpack-check-updates-btn');
    if (btn) { btn.textContent = '⏳ Проверяем...'; btn.disabled = true; }
    const mods = await window.launcher.getModpackMods(currentViewedModpack);
    const mp = (currentSettings.settings?.modpacks || []).find(m => m.id === currentViewedModpack);
    let found = 0;
    for (const mod of mods) {
        const name = mod.filename.replace('.jar.disabled', '').replace('.jar', '').replace(/-[\d.]+$/, '');
        const res = await window.launcher.modrinthSearch({ query: name, gameVersion: mp?.version, loader: mp?.loader, limit: 1 });
        if (res.hits?.length) found++;
    }
    if (btn) { btn.textContent = found > 0 ? `⬆ ${found} обновл.` : '✓ Актуально'; btn.disabled = false; }
};

let _modrinthOffset = 0;
let _modrinthSearchTimer = null;



function populateModsFilterVersions() {
    const sel = document.getElementById('mods-filter-version');
    if (!sel || sel.options.length > 1) return;
    availableVersions.filter(v => v.type === 'release').forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.id;
        sel.appendChild(opt);
    });
}

function updateModsBrowserModpackSelect() {
    const sel = document.getElementById('mods-browser-modpack-select');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">Выбрать сборку...</option>';
    (currentSettings.settings?.modpacks || []).forEach(mp => {
        const opt = document.createElement('option');
        opt.value = mp.id;
        opt.textContent = `${mp.name} (${mp.version} / ${mp.loader})`;
        sel.appendChild(opt);
    });
    if (prev) sel.value = prev;
    if (currentViewedModpack && !prev) sel.value = currentViewedModpack;
}

window.clearModsBrowserTarget = () => {
    const sel = document.getElementById('mods-browser-modpack-select');
    if (sel) sel.value = '';
    window.onModpackSelectChange();
};

window._installedProjectIds = new Set();
window.onModpackSelectChange = async () => {
    const sel = document.getElementById('mods-browser-modpack-select');
    window._installedProjectIds.clear();
    if (sel && sel.value) {
        const mods = await window.launcher.getModpackMods(sel.value);
        mods.forEach(m => {
            if (m.projectId) window._installedProjectIds.add(m.projectId);
        });
    }
    document.querySelectorAll('[id^="ibtn-"]').forEach(btn => {
        const pid = btn.id.split('-')[1];
        if (window._installedProjectIds.has(pid)) {
            btn.textContent = '✓ Установлен';
            btn.style.background = 'rgba(34,197,94,0.12)';
            btn.style.borderColor = 'rgba(34,197,94,0.3)';
            btn.style.color = '#22c55e';
            btn.disabled = true;
        } else {
            btn.textContent = '⬇ Установить';
            btn.style.background = 'rgba(var(--accent-r, 3), var(--accent-g, 53), var(--accent-b, 252), 0.18)';
            btn.style.borderColor = 'rgba(var(--accent-r, 3), var(--accent-g, 53), var(--accent-b, 252), 0.3)';
            btn.style.color = 'var(--accent-light, #638aff)';
            btn.disabled = false;
        }
    });
};

window.debouncedModSearch = () => {
    clearTimeout(_modrinthSearchTimer);
    _modrinthSearchTimer = setTimeout(() => window.searchMods(true), 400);
};

window.searchMods = async (reset = true) => {
    if (reset) _modrinthOffset = 0;
    const query = document.getElementById('mods-search-input')?.value || '';
    const version = document.getElementById('mods-filter-version')?.value || '';
    const loader = document.getElementById('mods-filter-loader')?.value || '';
    const grid = document.getElementById('mods-browser-grid');
    const loadingEl = document.getElementById('mods-browser-loading');
    const emptyEl = document.getElementById('mods-browser-empty');
    const loadMoreEl = document.getElementById('mods-browser-load-more');
    if (reset && grid) grid.innerHTML = '';
    if (loadingEl) loadingEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (loadMoreEl) loadMoreEl.style.display = 'none';
    const data = await window.launcher.modrinthSearch({ query, gameVersion: version, loader, limit: 20, offset: _modrinthOffset });
    if (loadingEl) loadingEl.style.display = 'none';
    const hits = data?.hits || [];
    if (hits.length === 0 && _modrinthOffset === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
    hits.forEach(mod => renderModCard(mod, grid));
    _modrinthOffset += hits.length;
    if (_modrinthOffset < (data?.total_hits || 0) && loadMoreEl) loadMoreEl.style.display = 'block';
};

window.loadMoreMods = () => window.searchMods(false);

function renderModCard(mod, grid) {
    if (!grid) return;
    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.03);border:1px solid rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.07);border-radius:14px;padding:14px;display:flex;gap:12px;transition:0.2s;';

    const icon = mod.icon_url
        ? `<img src="${mod.icon_url}" style="width:48px;height:48px;border-radius:10px;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">`
        : `<div style="width:48px;height:48px;border-radius:10px;background:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.04);flex-shrink:0;display:flex;align-items:center;justify-content:center;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.15)" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/></svg></div>`;

    const cats = (mod.categories || []).slice(0, 2).map(c => `<span style="background:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.06);padding:2px 7px;border-radius:10px;font-size:10px;color:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.4);">${c}</span>`).join('');

    const loaders = (mod.client_side !== 'unsupported' ? (mod.loaders || []) : []).map(l => `<span class="mod-badge mod-badge-${l.toLowerCase()}">${l}</span>`).join('');

    const dl = mod.downloads > 1e6 ? (mod.downloads / 1e6).toFixed(1) + 'M' : mod.downloads > 1e3 ? Math.round(mod.downloads / 1e3) + 'K' : mod.downloads;
    const safeName = (mod.title || '').replace(/'/g, "\\'");
    const isInstalled = window._installedProjectIds.has(mod.project_id);
    const btnStyle = isInstalled
        ? 'margin-top:auto;padding:7px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);border-radius:8px;color:#22c55e;font-size:12px;font-weight:500;width:100%;'
        : 'margin-top:auto;padding:7px;background:rgba(var(--accent-r, 3), var(--accent-g, 53), var(--accent-b, 252), 0.18);border:1px solid rgba(var(--accent-r, 3), var(--accent-g, 53), var(--accent-b, 252), 0.3);border-radius:8px;color:var(--accent-light, #638aff);cursor:pointer;font-size:12px;font-weight:500;width:100%;';
    const btnText = isInstalled ? '✓ Установлен' : '⬇ Установить';
    const disabled = isInstalled ? 'disabled' : '';

    card.innerHTML = `${icon}
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div style="font-size:14px;font-weight:600;color:var(--text-color, #fff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${mod.title}</div>
                <div style="font-size:11px;color:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.3);flex-shrink:0;">↓ ${dl}</div>
            </div>
            <div style="font-size:11px;color:rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.4);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${mod.description}</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:2px;">
                <div class="mod-badges">${loaders}</div>
                ${cats}
            </div>
            <button id="ibtn-${mod.project_id}" onclick="window.installMod('${mod.project_id}','${safeName}','${mod.slug || ''}')" style="${btnStyle}" ${disabled}>
                ${btnText}
            </button>
        </div>`;
    card.onmouseenter = () => { card.style.borderColor = 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.14)'; card.style.background = 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.05)'; };
    card.onmouseleave = () => { card.style.borderColor = 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.07)'; card.style.background = 'rgba(var(--text-r, 255), var(--text-g, 255), var(--text-b, 255), 0.03)'; };
    grid.appendChild(card);
}

window.installMod = async (projectId, modTitle, slug) => {
    const sel = document.getElementById('mods-browser-modpack-select');
    const modpackId = sel?.value;
    const btn = document.getElementById(`ibtn-${projectId}`);

    if (!modpackId) {
        if (btn) { const orig = btn.textContent; btn.textContent = '⚠ Выберите сборку'; setTimeout(() => { btn.textContent = orig; }, 2000); }
        if (sel) { sel.style.outline = '2px solid rgba(239,68,68,0.6)'; setTimeout(() => { sel.style.outline = ''; }, 2000); }
        return;
    }

    const mp = (currentSettings.settings?.modpacks || []).find(m => m.id === modpackId);
    if (!mp) return;

    if (btn) { btn.textContent = '⏳ Поиск...'; btn.disabled = true; }

    try {
        const versions = await window.launcher.modrinthVersions({ projectId, gameVersion: mp.version, loader: mp.loader });

        if (!versions || !versions.length) {
            if (btn) { btn.textContent = '✗ Нет версий'; btn.disabled = false; }
            return;
        }

        const modalTitle = document.getElementById('mod-version-modal-title');
        if (modalTitle) modalTitle.textContent = modTitle || 'Выбор версии';

        const autoContainer = document.getElementById('mod-version-auto-container');
        const listContainer = document.getElementById('mod-version-list');

        if (listContainer) {
            listContainer.innerHTML = '';

            // Auto button
            if (autoContainer) {
                autoContainer.innerHTML = `
                    <div class="mod-version-auto-btn" onclick="window.confirmInstallMod('${projectId}', '${modTitle}', '${slug}', '${modpackId}', 'auto')">
                        Установить автоматически (лучшая версия)
                    </div>
                `;
            }

            versions.slice(0, 15).forEach(v => {
                const item = document.createElement('div');
                item.className = 'mod-version-item';
                const file = v.files?.find(f => f.primary) || v.files?.[0];
                if (!file) return;

                const date = new Date(v.date_published).toLocaleDateString();
                const vLoaders = (v.loaders || []).join(', ');

                item.innerHTML = `
                    <div class="mod-version-info">
                        <div class="mod-version-name">${v.version_number}</div>
                        <div class="mod-version-meta">
                            <span>📅 ${date}</span>
                            <span>📦 ${vLoaders}</span>
                        </div>
                    </div>
                    <div class="mod-version-dl">Выбрать</div>
                `;
                item.onclick = () => window.confirmInstallMod(projectId, modTitle, slug, modpackId, v.id);
                listContainer.appendChild(item);
            });
        }

        if (btn) { btn.textContent = '⬇ Выбор версии'; btn.disabled = false; }
        window.showModal('mod-version-selector-modal');

    } catch (e) {
        console.error("Install mod error:", e);
        if (btn) { btn.textContent = '✗ Ошибка'; btn.disabled = false; }
    }
};

window.confirmInstallMod = async (projectId, modTitle, slug, modpackId, versionId) => {
    window.closeModal('mod-version-selector-modal');
    const btn = document.getElementById(`ibtn-${projectId}`);
    if (btn) { btn.textContent = '⏳ Загрузка...'; btn.disabled = true; }

    const mp = (currentSettings.settings?.modpacks || []).find(m => m.id === modpackId);
    if (!mp) return;

    try {
        let selectedVersion;
        const versions = await window.launcher.modrinthVersions({ projectId, gameVersion: mp.version, loader: mp.loader });

        if (versionId === 'auto') {
            selectedVersion = versions[0];
        } else {
            selectedVersion = versions.find(v => v.id === versionId);
        }

        if (!selectedVersion) throw new Error("Version not found");

        const file = selectedVersion.files?.find(f => f.primary) || selectedVersion.files?.[0];
        if (!file) throw new Error("File not found");

        const res = await window.launcher.downloadMod({
            modpackId,
            url: file.url,
            filename: file.filename,
            projectId,
            modTitle,
            slug
        });

        if (res.success) {
            window._installedProjectIds.add(projectId);
            if (btn) {
                btn.textContent = '✓ Установлен';
                btn.style.background = 'rgba(34,197,94,0.12)';
                btn.style.borderColor = 'rgba(34,197,94,0.3)';
                btn.style.color = '#22c55e';
                btn.disabled = true;
            }
            if (currentViewedModpack === modpackId) await loadModpackMods(modpackId);
        } else {
            throw new Error("Download failed");
        }
    } catch (e) {
        console.error("Confirm install error:", e);
        if (btn) { btn.textContent = '✗ Ошибка'; btn.disabled = false; }
    }
};

window.toggleWindowMenu = (e) => {
    e.stopPropagation();
    const menu = document.getElementById('window-dropdown-menu');
    if (!menu) return;
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
};

document.addEventListener('click', (e) => {
    if (e.target.id === 'window-menu-btn' || e.target.closest('#window-menu-btn')) return;
    const menu = document.getElementById('window-dropdown-menu');
    if (menu) menu.style.display = 'none';
});

document.addEventListener('DOMContentLoaded', () => {
    init();
    if (Notification.permission === 'default') {
    }
});
