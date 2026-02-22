const { app, BrowserWindow, ipcMain, dialog, net, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { Client, Authenticator } = require('minecraft-launcher-core');
const https = require('https');
const nodeNet = require('net');

let currentServerIp = null;
let appTray = null;

function electronFetch(url) {
    return new Promise((resolve, reject) => {
        const request = net.request(url);
        request.on('response', (response) => {
            let data = '';
            response.on('data', (chunk) => data += chunk.toString());
            response.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
            });
        });
        request.on('error', (err) => { console.error(err); resolve(null); });
        request.end();
    });
}

function electronFetchText(url) {
    return new Promise((resolve, reject) => {
        const request = net.request(url);
        request.on('response', (response) => {
            let data = '';
            response.on('data', (chunk) => data += chunk.toString());
            response.on('end', () => {
                resolve(data);
            });
        });
        request.on('error', (err) => { console.error(err); resolve(null); });
        request.end();
    });
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const proto = url.startsWith('https') ? require('https') : require('http');
        proto.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                file.close();
                fs.unlink(dest, () => { });
                return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
            }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
            file.on('error', (err) => { file.close(); fs.unlink(dest, () => { }); reject(err); });
        }).on('error', (err) => { file.close(); fs.unlink(dest, () => { }); reject(err); });
    });
}


const DiscordRPC = require('discord-rpc');
let rpcCore = null;
let rpcReady = false;

function initDiscordRPC() {
    const settings = loadSettings().settings || {};
    if (!settings.discordRpc) {
        if (rpcCore) { rpcCore.destroy(); rpcCore = null; rpcReady = false; }
        return;
    }
    if (rpcCore) return;
    rpcCore = new DiscordRPC.Client({ transport: 'ipc' });
    rpcCore.on('ready', () => {
        rpcReady = true;
        setDiscordActivity("В лаунчере", "Готовится к игре");
    });
    rpcCore.on('error', (err) => {
        rpcReady = false;
    });
    try {
        rpcCore.login({ clientId: '1107380922849890425' }).catch(err => {
            rpcCore = null;
            rpcReady = false;
        });
    } catch (e) { }
}

function setDiscordActivity(details, state) {
    if (!rpcReady || !rpcCore) return;
    const settings = loadSettings().settings || {};
    if (!settings.discordRpc) return;

    rpcCore.setActivity({
        details: details,
        state: state,
        instance: false,
    }).catch(console.error);
}

app.on('ready', () => {
    initDiscordRPC();

    if (!appTray) {
        let iconPath = app.isPackaged ? path.join(process.resourcesPath, 'icon.ico') : path.join(__dirname, '..', 'build', 'icon.ico');
        if (fs.existsSync(iconPath)) {
            appTray = new Tray(iconPath);
            const ctxMenu = Menu.buildFromTemplate([
                { label: 'Развернуть', click: () => { if (mainWindow) mainWindow.show(); } },
                { label: 'Выход', click: () => { app.quit(); } }
            ]);
            appTray.setToolTip('FlowCross Launcher');
            appTray.setContextMenu(ctxMenu);
            appTray.on('click', () => { if (mainWindow) mainWindow.show(); });
        }
    }
});

ipcMain.on('save-settings', () => {
    initDiscordRPC();
});

function fetchJson(url) { return electronFetch(url); }

ipcMain.handle('fetch-news', async () => {
    const data = await electronFetch('https://launchercontent.mojang.com/v2/news.json');
    const result = (data && data.entries) ? data.entries.slice(0, 10) : [];
    return result.map(entry => {
        let imgUrl = entry.newsPageImage?.url || entry.playPageImage?.url || '';
        if (imgUrl.startsWith('/')) {
            imgUrl = 'https://launchercontent.mojang.com' + imgUrl;
        }
        return {
            title: entry.title,
            text: entry.text,
            newsPageImage: { url: imgUrl },
            readMoreLink: entry.readMoreLink
        };
    });
});

ipcMain.handle('fetch-patch-notes', async () => {
    try {
        const data = await electronFetch('https://launchercontent.mojang.com/v2/javaPatchNotes.json');
        const entries = (data && data.entries) ? data.entries : [];

        entries.sort((a, b) => new Date(b.date) - new Date(a.date));

        const result = entries.slice(0, 500);
        return result.map(entry => {
            let imgUrl = entry.image?.url || '';
            if (imgUrl.startsWith('/')) {
                imgUrl = 'https://launchercontent.mojang.com' + imgUrl;
            }

            let contentPath = entry.contentPath || '';
            if (contentPath && !contentPath.startsWith('http')) {
                if (contentPath.startsWith('/')) {
                    contentPath = 'https://launchercontent.mojang.com' + contentPath;
                } else {
                    contentPath = 'https://launchercontent.mojang.com/v2/' + contentPath;
                }
            }

            return {
                title: entry.title,
                version: entry.version,
                type: entry.type,
                date: entry.date,
                shortText: entry.shortText || '',
                image: imgUrl,
                contentPath: contentPath
            };
        });
    } catch (e) {
        console.error("fetch-patch-notes error:", e);
        return [];
    }
});

ipcMain.handle('fetch-content', async (event, url) => {
    if (!url) return null;
    try {
        const data = await electronFetchText(url);
        return data;
    } catch (e) {
        console.error("fetch-content error:", e);
        return null;
    }
});

ipcMain.handle('get-versions', async () => {
    const data = await electronFetch('https://launchermeta.mojang.com/mc/game/version_manifest.json');
    const result = (data && data.versions) ? data.versions : [];
    return result;
});

ipcMain.handle('get-fabric-versions', async () => {
    const data = await fetchJson('https://meta.fabricmc.net/v2/versions/game');

    const vanillaData = await electronFetch('https://launchermeta.mojang.com/mc/game/version_manifest.json');
    const stableVanillaIds = new Set((vanillaData && vanillaData.versions ? vanillaData.versions : [])
        .filter(v => v.type === 'release').map(v => v.id));

    const result = data ? data.map(v => ({
        id: v.version,
        type: (v.stable && stableVanillaIds.has(v.version)) ? 'release' : 'snapshot'
    })) : [];
    return result;
});

ipcMain.handle('get-forge-versions', async () => {
    const data = await electronFetch('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');

    const vanillaData = await electronFetch('https://launchermeta.mojang.com/mc/game/version_manifest.json');
    const stableVanillaIds = new Set((vanillaData && vanillaData.versions ? vanillaData.versions : [])
        .filter(v => v.type === 'release').map(v => v.id));

    if (data && data.promos) {
        const mcVersions = new Set();
        Object.keys(data.promos).forEach(key => {
            const mcVer = key.split('-')[0];
            if (mcVer) mcVersions.add(mcVer);
        });

        const result = Array.from(mcVersions)
            .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
            .map(v => ({ id: v, type: stableVanillaIds.has(v) ? 'release' : 'snapshot' }));

        return result;
    }
    return [];
});

ipcMain.handle('get-quilt-versions', async () => {
    const data = await fetchJson('https://meta.quiltmc.org/v3/versions/game');
    const result = data ? data.map(v => ({ id: v.version, type: 'release' })) : [];
    return result;
});

ipcMain.handle('get-neoforge-versions', async () => {
    const data = await fetchJson('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');

    if (data && data.versions) {
        const mcSet = new Set();
        data.versions.forEach(v => {
            let mc;
            if (v.startsWith('1.')) {
                mc = v.split('-')[0];
            } else {
                const parts = v.split('.');
                if (parts.length >= 2) {
                    mc = '1.' + parts[0] + (parts[1] !== '0' ? '.' + parts[1] : '');
                }
            }
            if (mc && !mc.includes('beta') && !mc.includes('alpha') && !mc.includes('snapshot') && !mc.includes('craftmine')) {
                mcSet.add(mc);
            }
        });
        const result = Array.from(mcSet)
            .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
            .map(v => ({ id: v, type: 'release' }));
        return result;
    }
    return [];
});



let isSettingsOpen = false;
ipcMain.on('update-settings-state', (event, state) => {
    isSettingsOpen = state;
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.settingsOpen = state;
    }
});

const launcher = new Client();

let mainWindow;
let splashWindow;
let licenseWindow;

let userDataPath = path.join(app.getPath('home'), '.flowcross');
app.setPath('userData', userDataPath);

const args = process.argv;
const customPathArg = args.find(arg => arg.startsWith('--launcher-path='));
if (customPathArg) {
    const newPath = customPathArg.split('=')[1];
    if (newPath && fs.existsSync(newPath)) {
        userDataPath = newPath;
        app.setPath('userData', userDataPath);
    }
}

const ICON_URL = 'https://zeta.elytra.ltd/storage/v1/object/public/FlowCross/ico.ico';
const localIconPath = path.join(userDataPath, 'icon.ico');
const bundledIconPath = path.join(__dirname, '../Assets/icon.ico');

const PKG_ICON_URL = 'https://zeta.elytra.ltd/storage/v1/object/public/FlowCross/Client/pkg.ico';
const localPkgIconPath = path.join(userDataPath, 'pkg.ico');

if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
}

const settingsPath = path.join(userDataPath, 'settings.json');

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        if (currentAbortController && currentAbortController.signal.aborted) {
            return reject(new Error('Aborted'));
        }

        const file = fs.createWriteStream(dest);
        const request = https.get(url, (response) => {
            if (response.statusCode !== 200) {
                fs.unlink(dest, () => { });
                return reject(new Error('Failed to download file: ' + response.statusCode));
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });

        if (currentAbortController) {
            currentAbortController.signal.addEventListener('abort', () => {
                request.destroy();
                file.close();
                fs.unlink(dest, () => { });
                reject(new Error('Aborted'));
            }, { once: true });
        }
    });
}

async function ensureIcon() {
    if (!fs.existsSync(localIconPath)) {
        try {
            await downloadFile(ICON_URL, localIconPath);
        } catch (e) {

        }
    }
    if (!fs.existsSync(localPkgIconPath)) {
        try {
            await downloadFile(PKG_ICON_URL, localPkgIconPath);
        } catch (e) {

        }
    }
}

function loadSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            if (!data.profiles) {
                return {
                    settings: {
                        ram: data.ram || 4096,
                        javaPath: '',
                        jvmArgs: '',
                        gameVersion: data.version || "1.20.1",
                        modloader: "none"
                    },
                    profiles: {
                        "default": {
                            name: data.username || "Player",
                            created: Date.now()
                        }
                    },
                    selectedProfile: "default"
                };
            }
            return data;
        }
    } catch (e) {

    }
    return {
        settings: {
            ram: 4096,
            javaPath: '',
            jvmArgs: '',
            gameVersion: "1.20.1",
            modloader: "none"
        },
        profiles: {
            "default": {
                name: "Player",
                created: Date.now()
            }
        },
        selectedProfile: "default"
    };
}

function saveSettings(data) {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(data, null, 4));
        return true;
    } catch (e) {
        return false;
    }
}

let overlayWindow;

function createOverlayWindow() {
    overlayWindow = new BrowserWindow({
        width: 800,
        height: 100,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        focusable: false,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    overlayWindow.setBounds({ x: 0, y: 0, width: width, height: height });

    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.loadFile(path.join(__dirname, '../Html/overlay.html'));

    overlayWindow.webContents.on('did-finish-load', () => {
        if (global.lastLaunchUsername) {
            overlayWindow.webContents.send('update-stats', { username: global.lastLaunchUsername });
        }
    });

    overlayWindow.on('closed', () => {
        overlayWindow = null;
    });
}

function createLicenseWindow() {
    return new Promise((resolve) => {
        licenseWindow = new BrowserWindow({
            width: 520,
            height: 640,
            frame: false,
            transparent: false,
            alwaysOnTop: true,
            resizable: false,
            center: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'license-preload.js')
            },
            icon: fs.existsSync(bundledIconPath) ? bundledIconPath : (fs.existsSync(localIconPath) ? localIconPath : undefined)
        });

        licenseWindow.loadFile(path.join(__dirname, '../Html/license.html'));

        ipcMain.handle('license-activate', async (event, key) => {
            const result = await license.validateKey(key, userDataPath);
            return result;
        });

        ipcMain.on('license-proceed', () => {
            if (licenseWindow && !licenseWindow.isDestroyed()) {
                licenseWindow.close();
            }
            resolve(true);
        });

        ipcMain.on('license-close', () => {
            app.quit();
        });

        licenseWindow.on('closed', () => {
            licenseWindow = null;
        });
    });
}

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 380,
        height: 560,
        frame: false,
        transparent: false,
        alwaysOnTop: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: fs.existsSync(bundledIconPath) ? bundledIconPath : (fs.existsSync(localIconPath) ? localIconPath : undefined)
    });

    splashWindow.loadFile(path.join(__dirname, '../Html/splash.html'));

    splashWindow.on('closed', () => {
        splashWindow = null;
    });
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 1024,
        minHeight: 600,
        frame: false,
        resizable: true,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: fs.existsSync(bundledIconPath) ? bundledIconPath : (fs.existsSync(localIconPath) ? localIconPath : undefined)
    });

    mainWindow.loadFile(path.join(__dirname, '../Html/app.html'));

    mainWindow.webContents.once('did-finish-load', () => {
        setTimeout(() => {
            if (app.isPackaged && typeof autoUpdater !== 'undefined' && autoUpdater) {
                autoUpdater.checkForUpdates().catch(() => { });
            } else {
                checkForUpdatesManual();
            }
        }, 3000);
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        if (splashWindow) {
            splashWindow.close();
        }
    });

    mainWindow.on('close', (e) => {
        const settings = loadSettings().settings || {};
        if (settings.minimizeToTray && !app.isQuitting) {
            e.preventDefault();
            mainWindow.hide();
            createTray();
        } else {
            mainWindow = null;
        }
    });
}

let tray = null;
function createTray() {
    if (tray) return;
    const trayIconPath = fs.existsSync(bundledIconPath) ? bundledIconPath : (fs.existsSync(localIconPath) ? localIconPath : undefined);
    if (!trayIconPath) return;

    tray = new Tray(trayIconPath);
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Развернуть', click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                } else {
                    createMainWindow();
                }
                if (tray) {
                    tray.destroy();
                    tray = null;
                }
            }
        },
        {
            label: 'Выход', click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);
    tray.setToolTip('FlowCross Launcher');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        } else {
            createMainWindow();
        }
        if (tray) {
            tray.destroy();
            tray = null;
        }
    });
    tray.on('click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            if (tray) {
                tray.destroy();
                tray = null;
            }
        }
    });
}

let pendingFlowFile = null;
let pendingLaunchVersion = null;

const flowFileArg = process.argv.find(arg => arg.endsWith('.flow') && fs.existsSync(arg));
if (flowFileArg) pendingFlowFile = flowFileArg;

const launchVersionArg = process.argv.find(arg => arg.startsWith('--launch-version='));
if (launchVersionArg) pendingLaunchVersion = launchVersionArg.split('=')[1];

app.on('second-instance', (event, argv) => {
    const flowArg = argv.find(arg => arg.endsWith('.flow') && fs.existsSync(arg));
    const lvArg = argv.find(arg => arg.startsWith('--launch-version='));
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        if (flowArg) {
            setTimeout(() => { mainWindow.webContents.send('import-flow-file', flowArg); }, 400);
        }
        if (lvArg) {
            const ver = lvArg.split('=')[1];
            setTimeout(() => { mainWindow.webContents.send('jump-launch-version', ver); }, 400);
        }
    }
});

app.whenReady().then(async () => {
    await ensureIcon();

    createSplashWindow();

    if (splashWindow) {
        splashWindow.setProgressBar(0.1);
        splashWindow.webContents.send('splash-progress', 0.1);
    }

    setTimeout(() => {
        loadSettings();
        if (splashWindow) {
            splashWindow.setProgressBar(0.3);
            splashWindow.webContents.send('splash-progress', 0.3);
        }

        setTimeout(() => {
            if (splashWindow) {
                splashWindow.setProgressBar(0.6);
                splashWindow.webContents.send('splash-progress', 0.6);
            }
            setTimeout(() => {
                if (splashWindow) {
                    splashWindow.setProgressBar(1.0);
                    splashWindow.webContents.send('splash-progress', 1.0);
                }
                setTimeout(() => {
                    createMainWindow();
                    mainWindow.webContents.once('did-finish-load', () => {
                        if (pendingFlowFile) {
                            const fp = pendingFlowFile;
                            pendingFlowFile = null;
                            setTimeout(() => { mainWindow.webContents.send('import-flow-file', fp); }, 1500);
                        }
                        if (pendingLaunchVersion) {
                            const ver = pendingLaunchVersion;
                            pendingLaunchVersion = null;
                            setTimeout(() => { mainWindow.webContents.send('jump-launch-version', ver); }, 2000);
                        }
                    });
                }, 200);
            }, 300);
        }, 300);
    }, 200);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null && splashWindow === null) {
        createMainWindow();
    }
});

ipcMain.on('window-control', (event, action) => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    if (!win) return;

    switch (action) {
        case 'minimize':
            win.minimize();
            break;
        case 'minimize-tray':
            win.hide();
            createTray();
            break;
        case 'maximize':
            if (win.isMaximized()) {
                win.unmaximize();
            } else {
                win.maximize();
            }
            break;
        case 'close':
            win.close();
            break;
    }
});

ipcMain.on('window-drag-move', (event, data) => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    if (win && !win.isDestroyed()) {
        const [x, y] = win.getPosition();
        win.setPosition(x + data.deltaX, y + data.deltaY);
    }
});

ipcMain.on('media-control', (event, action) => {
    if (process.platform === 'win32') {
        const mediaCmdPath = path.join(__dirname, '../src/scripts/media_cmd.ps1');
        const { execFile } = require('child_process');
        execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', mediaCmdPath, '-Command', action], { timeout: 5000 }, () => { });
    }
});

ipcMain.on('set-overlay-clickthrough', (event, ignore) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        if (ignore) {
            overlayWindow.setIgnoreMouseEvents(true, { forward: true });
        } else {
            overlayWindow.setIgnoreMouseEvents(false);
            overlayWindow.focus();
        }
    }
});

ipcMain.handle('get-settings', async () => {
    return loadSettings();
});

ipcMain.handle('save-settings', async (event, settings) => {
    const result = saveSettings(settings);
    updateJumpList(settings);
    return result;
});

function updateJumpList(settings) {
    if (process.platform !== 'win32') return;
    try {
        const recent = (settings.recentVersions || []).slice(0, 3);
        if (recent.length === 0) {
            app.setJumpList(null);
            return;
        }
        const tasks = recent.map(v => ({
            type: 'task',
            title: `Играть ${v}`,
            description: `Запустить Minecraft ${v}`,
            program: process.execPath,
            args: `--launch-version=${v}`,
            iconPath: process.execPath,
            iconIndex: 0
        }));
        app.setJumpList([
            { type: 'tasks', name: 'Последние версии', items: tasks }
        ]);
    } catch (e) { }
}

const overlayConfigPath = path.join(app.getPath('userData'), 'overlay-config.json');

ipcMain.handle('get-overlay-settings', async () => {
    try {
        if (fs.existsSync(overlayConfigPath)) {
            return JSON.parse(fs.readFileSync(overlayConfigPath, 'utf8'));
        }
    } catch (e) { }
    return { topOffset: 0, crosshair: false, crosshairImage: '', crosshairOpacity: 0.8, crosshairSize: 32 };
});

ipcMain.handle('save-overlay-settings', async (event, settings) => {
    try {
        fs.writeFileSync(overlayConfigPath, JSON.stringify(settings, null, 2));
    } catch (e) { }
});

ipcMain.handle('open-directory-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
});

ipcMain.handle('get-default-paths', () => {
    return {
        game: path.join(userDataPath, '.minecraft'),
        java: 'Автоматически (Azul Zulu)'
    };
});

ipcMain.handle('open-image-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Изображения', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'] },
            { name: 'Видео', extensions: ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi'] },
            { name: 'Все файлы', extensions: ['*'] }
        ]
    });
    if (result.canceled) return null;
    return result.filePaths[0];
});

ipcMain.handle('get-app-version', () => {
    let pkgPath;
    if (app.isPackaged) {
        pkgPath = path.join(process.resourcesPath, 'app', 'package.json');
        if (!fs.existsSync(pkgPath)) pkgPath = path.join(process.resourcesPath, 'package.json');
    } else {
        pkgPath = path.join(__dirname, '..', 'package.json');
    }
    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        return { version: pkg.version || app.getVersion(), isBeta: pkg.isBeta === true };
    } catch (e) {
        return { version: app.getVersion(), isBeta: false };
    }
});

ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Executables', extensions: ['exe', 'jar'] }, { name: 'All Files', extensions: ['*'] }]
    });
    if (result.canceled) return null;
    return result.filePaths[0];
});

ipcMain.handle('export-settings', async () => {
    const settings = loadSettings();
    const flowData = {
        _format: 'FlowCross Settings',
        _version: 1,
        _exportedAt: new Date().toISOString(),
        data: settings
    };
    const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Экспорт настроек',
        defaultPath: 'flowcross-settings.flow',
        filters: [{ name: 'FlowCross Settings', extensions: ['flow'] }]
    });
    if (result.canceled || !result.filePath) return { success: false };
    try {
        fs.writeFileSync(result.filePath, JSON.stringify(flowData, null, 4), 'utf8');
        return { success: true, path: result.filePath };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('import-settings', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Импорт настроек',
        properties: ['openFile'],
        filters: [{ name: 'FlowCross Settings', extensions: ['flow'] }]
    });
    if (result.canceled || !result.filePaths.length) return { success: false };
    try {
        const raw = fs.readFileSync(result.filePaths[0], 'utf8');
        const flowData = JSON.parse(raw);
        if (!flowData._format || flowData._format !== 'FlowCross Settings' || !flowData.data) {
            return { success: false, error: 'Неверный формат файла .flow' };
        }
        saveSettings(flowData.data);
        return { success: true, settings: flowData.data };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('import-settings-from-path', async (event, filePath) => {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const flowData = JSON.parse(raw);
        if (!flowData._format || flowData._format !== 'FlowCross Settings' || !flowData.data) {
            return { success: false, error: 'Неверный формат файла .flow' };
        }
        saveSettings(flowData.data);
        return { success: true, settings: flowData.data };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('open-folder', async (event, folderType) => {
    const settings = loadSettings().settings || {};
    let targetPath = '';

    switch (folderType) {
        case 'game':
            targetPath = settings.gamePath || path.join(userDataPath, '.minecraft');
            break;
        case 'mods':
            targetPath = path.join(settings.gamePath || path.join(userDataPath, '.minecraft'), 'mods');
            break;
        case 'launcher':
            targetPath = userDataPath;
            break;
        default:
            if (folderType.startsWith('modpack:')) {
                const mpId = folderType.split(':')[1];
                targetPath = path.join(settings.gamePath || path.join(userDataPath, '.minecraft'), 'modpacks', mpId);
            }
            break;
    }

    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }
    const { shell } = require('electron');
    await shell.openPath(targetPath);
});

ipcMain.handle('get-modpack-mods', async (event, modpackId) => {
    const settings = loadSettings().settings || {};
    const rootPath = settings.gamePath || path.join(userDataPath, '.minecraft');
    const modsDir = path.join(rootPath, 'modpacks', modpackId, 'mods');
    if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });
    try {
        const files = fs.readdirSync(modsDir);
        const metaPath = path.join(modsDir, 'mods_meta.json');
        let meta = {};
        if (fs.existsSync(metaPath)) {
            try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (e) { }
        }
        return files
            .filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'))
            .map(f => ({
                filename: f,
                enabled: f.endsWith('.jar'),
                size: fs.statSync(path.join(modsDir, f)).size,
                projectId: meta[f] ? meta[f].projectId : null,
                modTitle: meta[f] ? meta[f].modTitle : null,
                slug: meta[f] ? meta[f].slug : null
            }));
    } catch (e) {
        return [];
    }
});

ipcMain.handle('delete-mod', async (event, { modpackId, filename }) => {
    const settings = loadSettings().settings || {};
    const rootPath = settings.gamePath || path.join(userDataPath, '.minecraft');
    const filePath = path.join(rootPath, 'modpacks', modpackId, 'mods', filename);
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        const metaPath = path.join(rootPath, 'modpacks', modpackId, 'mods', 'mods_meta.json');
        if (fs.existsSync(metaPath)) {
            try {
                let meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                if (meta[filename]) { delete meta[filename]; fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2)); }
            } catch (e) { }
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('toggle-mod', async (event, { modpackId, filename, enabled }) => {
    const settings = loadSettings().settings || {};
    const rootPath = settings.gamePath || path.join(userDataPath, '.minecraft');
    const modsDir = path.join(rootPath, 'modpacks', modpackId, 'mods');
    const oldPath = path.join(modsDir, filename);
    let newFilename, newPath;
    if (enabled) {
        newFilename = filename.replace('.jar.disabled', '.jar');
    } else {
        newFilename = filename.endsWith('.jar.disabled') ? filename : filename + '.disabled';
    }
    newPath = path.join(modsDir, newFilename);
    try {
        fs.renameSync(oldPath, newPath);
        const metaPath = path.join(modsDir, 'mods_meta.json');
        if (fs.existsSync(metaPath)) {
            try {
                let meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                if (meta[filename]) {
                    meta[newFilename] = meta[filename];
                    delete meta[filename];
                    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
                }
            } catch (e) { }
        }
        return { success: true, newFilename };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('download-mod', async (event, { modpackId, url, filename, projectId, modTitle, slug }) => {
    const settings = loadSettings().settings || {};
    const rootPath = settings.gamePath || path.join(userDataPath, '.minecraft');
    const modsDir = path.join(rootPath, 'modpacks', modpackId, 'mods');
    if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });
    const dest = path.join(modsDir, filename);
    try {
        await downloadFile(url, dest);
        if (projectId) {
            const metaPath = path.join(modsDir, 'mods_meta.json');
            let meta = {};
            if (fs.existsSync(metaPath)) {
                try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (e) { }
            }
            meta[filename] = { projectId, modTitle, slug };
            fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        }
        return { success: true, filename };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('modrinth-search', async (event, { query, gameVersion, loader, limit = 20, offset = 0 }) => {
    try {
        const facets = [];
        const searchLoader = loader === 'flowcross' ? 'fabric' : loader;
        if (gameVersion) facets.push(`["versions:${gameVersion}"]`);
        if (searchLoader) facets.push(`["categories:${searchLoader}"]`);
        const facetsStr = facets.length ? `&facets=[${facets.join(',')}]` : '';
        const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query || '')}&limit=${limit}&offset=${offset}${facetsStr}&project_types=["mod"]`;
        const data = await fetchJson(url);
        return data;
    } catch (e) {
        return { hits: [], total_hits: 0 };
    }
});

ipcMain.handle('modrinth-versions', async (event, { projectId, gameVersion, loader }) => {
    try {
        const searchLoader = loader === 'flowcross' ? 'fabric' : loader;
        let url = `https://api.modrinth.com/v2/project/${projectId}/version?`;
        const params = [];
        if (gameVersion) params.push(`game_versions=["${gameVersion}"]`);
        if (searchLoader) params.push(`loaders=["${searchLoader}"]`);
        url += params.join('&');
        const data = await fetchJson(url);
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
    }
});

ipcMain.handle('reset-settings', () => {

    try {
        if (fs.existsSync(settingsPath)) {
            fs.unlinkSync(settingsPath);
        }
        return true;
    } catch (e) {
        return false;
    }
});

ipcMain.handle('repair-client', async () => {
    return new Promise(resolve => setTimeout(() => resolve(true), 2000));
});

async function ensureVanilla(gameVersion, rootPath) {
    const versionDir = path.join(rootPath, 'versions', gameVersion);
    const versionJson = path.join(versionDir, gameVersion + '.json');
    if (fs.existsSync(versionJson)) return true;

    const msg1 = `[Vanilla] Загрузка метаданных для ${gameVersion}...`;
    console.log(msg1);
    logToFile(msg1);
    if (mainWindow) mainWindow.webContents.send('game-log', msg1);
    try {
        const manifest = await fetchJson('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
        if (!manifest || !manifest.versions) return false;

        const v = manifest.versions.find(x => x.id === gameVersion);
        if (!v) return false;

        if (mainWindow) mainWindow.webContents.send('game-log', `[Vanilla] Загрузка профиля версии ${gameVersion}...`);
        const json = await fetchJson(v.url);
        if (!json) return false;

        if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });
        fs.writeFileSync(versionJson, JSON.stringify(json, null, 2));
        const msg2 = `[Vanilla] Профиль ${gameVersion} установлен.`;
        console.log(msg2);
        logToFile(msg2);
        if (mainWindow) mainWindow.webContents.send('game-log', msg2);
        return true;
    } catch (e) {
        const errMsg = `[Vanilla] Ошибка: ${e}`;
        console.error(errMsg);
        logToFile(errMsg);
        if (mainWindow) mainWindow.webContents.send('game-log', errMsg);
        return false;
    }
}

async function installFabric(gameVersion, rootPath) {
    try {
        const msg0 = `[Fabric] Получение метаданных для ${gameVersion}...`;
        console.log(msg0);
        logToFile(msg0);
        if (mainWindow) mainWindow.webContents.send('game-log', msg0);

        const loaderMeta = await fetchJson('https://meta.fabricmc.net/v2/versions/loader/' + gameVersion);
        if (!loaderMeta || !loaderMeta.length) {
            const errMsg = `[Fabric] Загрузчик не найден для ${gameVersion}`;
            console.error(errMsg);
            if (mainWindow) mainWindow.webContents.send('game-log', errMsg);
            return null;
        }

        const loaderVersion = loaderMeta[0].loader.version;
        const msg1 = `[Fabric] Загрузчик: ${loaderVersion}`;
        console.log(msg1);
        logToFile(msg1);
        if (mainWindow) mainWindow.webContents.send('game-log', msg1);

        const versionId = `fabric-loader-${loaderVersion}-${gameVersion}`;
        const versionDir = path.join(rootPath, 'versions', versionId);
        const versionJsonPath = path.join(versionDir, `${versionId}.json`);

        let profileJson = null;
        let needsSave = false;

        if (fs.existsSync(versionJsonPath)) {
            try {
                profileJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
                console.log(`[Fabric] Loaded existing profile for ${versionId}`);
            } catch (e) { console.error("Corrupt JSON, refetching"); }
        }

        if (!profileJson) {
            console.log(`[Fabric] Downloading profile JSON...`);
            profileJson = await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}/${loaderVersion}/profile/json`);
            needsSave = true;
        }

        if (profileJson) {

            if (!profileJson.downloads) {
                console.log(`[Fabric] Missing 'downloads'. Patching from Vanilla...`);
                await ensureVanilla(gameVersion, rootPath);
                try {
                    const vanillaJsonPath = path.join(rootPath, 'versions', gameVersion, gameVersion + '.json');
                    if (fs.existsSync(vanillaJsonPath)) {
                        const vanilla = JSON.parse(fs.readFileSync(vanillaJsonPath, 'utf8'));
                        if (vanilla.downloads) {
                            profileJson.downloads = vanilla.downloads;
                            console.log(`[Fabric] Patched 'downloads'.`);
                        }
                    }
                } catch (err) {
                    console.error(`[Fabric] Failed to inject downloads: ${err}`);
                }
            }

            if (!profileJson.assetIndex) {
                console.log(`[Fabric] Missing 'assetIndex'. Patching from Vanilla...`);
                try {
                    const vanillaJsonPath = path.join(rootPath, 'versions', gameVersion, gameVersion + '.json');
                    if (fs.existsSync(vanillaJsonPath)) {
                        const vanilla = JSON.parse(fs.readFileSync(vanillaJsonPath, 'utf8'));
                        if (vanilla.assetIndex) {
                            profileJson.assetIndex = vanilla.assetIndex;
                            needsSave = true;
                            console.log(`[Fabric] Patched 'assetIndex'.`);
                        }
                    }
                } catch (err) {
                    console.error(`[Fabric] Failed to inject assetIndex: ${err}`);
                }
            }

            if (needsSave || !fs.existsSync(versionJsonPath)) {
                if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });
                fs.writeFileSync(versionJsonPath, JSON.stringify(profileJson, null, 2));
                console.log(`[Fabric] Saved profile JSON.`);
            }
            return versionId;
        } else {
            console.error(`[Fabric] Failed to fetch profile.`);
            return null;
        }
    } catch (e) {
        console.error("Fabric install failed:", e);
        return null;
    }
}

async function installQuilt(gameVersion, rootPath) {
    try {
        const msg0 = `[Quilt] Получение метаданных для ${gameVersion}...`;
        console.log(msg0);
        logToFile(msg0);
        if (mainWindow) mainWindow.webContents.send('game-log', msg0);

        const loaderMeta = await fetchJson('https://meta.quiltmc.org/v3/versions/loader/' + gameVersion);
        if (!loaderMeta || !loaderMeta.length) {
            const errMsg = `[Quilt] Загрузчик не найден для ${gameVersion}`;
            console.error(errMsg);
            if (mainWindow) mainWindow.webContents.send('game-log', errMsg);
            return null;
        }

        const loaderVersion = loaderMeta[0].loader.version;
        const msg1 = `[Quilt] Загрузчик: ${loaderVersion}`;
        console.log(msg1);
        logToFile(msg1);
        if (mainWindow) mainWindow.webContents.send('game-log', msg1);

        const versionId = `quilt-loader-${loaderVersion}-${gameVersion}`;
        const versionDir = path.join(rootPath, 'versions', versionId);
        const versionJsonPath = path.join(versionDir, `${versionId}.json`);

        let profileJson = null;
        let needsSave = false;

        if (fs.existsSync(versionJsonPath)) {
            try {
                profileJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
                console.log(`[Quilt] Loaded existing profile for ${versionId}`);
            } catch (e) { console.error("Corrupt JSON, refetching"); }
        }

        if (!profileJson) {
            console.log(`[Quilt] Downloading profile JSON...`);
            profileJson = await fetchJson(`https://meta.quiltmc.org/v3/versions/loader/${gameVersion}/${loaderVersion}/profile/json`);
            needsSave = true;
        }

        if (profileJson) {
            if (!profileJson.downloads) {
                console.log(`[Quilt] Missing 'downloads'. Patching from Vanilla...`);
                await ensureVanilla(gameVersion, rootPath);
                try {
                    const vanillaJsonPath = path.join(rootPath, 'versions', gameVersion, gameVersion + '.json');
                    if (fs.existsSync(vanillaJsonPath)) {
                        const vanilla = JSON.parse(fs.readFileSync(vanillaJsonPath, 'utf8'));
                        if (vanilla.downloads) {
                            profileJson.downloads = vanilla.downloads;
                        }
                    }
                } catch (err) { }
            }
            if (!profileJson.assetIndex) {
                console.log(`[Quilt] Missing 'assetIndex'. Patching from Vanilla...`);
                try {
                    const vanillaJsonPath = path.join(rootPath, 'versions', gameVersion, gameVersion + '.json');
                    if (fs.existsSync(vanillaJsonPath)) {
                        const vanilla = JSON.parse(fs.readFileSync(vanillaJsonPath, 'utf8'));
                        if (vanilla.assetIndex) {
                            profileJson.assetIndex = vanilla.assetIndex;
                            needsSave = true;
                        }
                    }
                } catch (err) { }
            }
            if (needsSave || !fs.existsSync(versionJsonPath)) {
                if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });
                fs.writeFileSync(versionJsonPath, JSON.stringify(profileJson, null, 2));
            }
            return versionId;
        } else {
            console.error(`[Quilt] Failed to fetch profile.`);
            return null;
        }
    } catch (e) {
        console.error("Quilt install failed:", e);
        return null;
    }
}

async function getForgeVersion(mcVer) {
    try {
        const json = await fetchJson('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
        if (!json || !json.promos) return null;
        const rec = json.promos[`${mcVer}-recommended`];
        const lat = json.promos[`${mcVer}-latest`];
        return rec || lat;
    } catch (e) {
        console.error("Failed to fetch forge promos:", e);
        return null;
    }
}

async function installForge(gameVersion, rootPath) {
    const msg = `[Forge] Подготовка запуска Forge для ${gameVersion}...`;
    console.log(msg);
    logToFile(msg);
    if (mainWindow) mainWindow.webContents.send('game-log', msg);

    try {
        const forgeVer = await getForgeVersion(gameVersion);
        if (!forgeVer) {
            const err = `[Forge] Не удалось найти версию Forge для ${gameVersion}`;
            console.error(err);
            if (mainWindow) mainWindow.webContents.send('game-log', err);
            return null;
        }

        const fullVersionId = `${gameVersion}-forge-${forgeVer}`;
        console.log(`[Forge] Целевая версия: ${fullVersionId}`);

        const versionDir = path.join(rootPath, 'versions', fullVersionId);
        const versionJson = path.join(versionDir, `${fullVersionId}.json`);

        if (fs.existsSync(versionJson)) {
            console.log(`[Forge] Версия уже установлена.`);
            if (mainWindow) mainWindow.webContents.send('game-log', `[Forge] Версия ${fullVersionId} найдена.`);
            return { id: fullVersionId, installed: true };
        }

        const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${gameVersion}-${forgeVer}/forge-${gameVersion}-${forgeVer}-installer.jar`;
        const installerPath = path.join(userDataPath, `forge-${gameVersion}-${forgeVer}-installer.jar`);

        const dlMsg = `[Forge] Скачивание установщика...`;
        console.log(dlMsg);
        if (mainWindow) mainWindow.webContents.send('game-log', dlMsg);

        try {
            await downloadFile(installerUrl, installerPath);
        } catch (e) {
            throw e;
        }

        console.log(`[Forge] Установщик скачан: ${installerPath}`);
        if (mainWindow) mainWindow.webContents.send('game-log', `[Forge] Установщик готов.`);

        return { id: fullVersionId, installer: installerPath, installed: false };

    } catch (e) {
        console.error(`[Forge] Ошибка установки: ${e}`);
        if (mainWindow) mainWindow.webContents.send('game-log', `[Forge] Ошибка: ${e.message}`);
        return null;
    }
}

async function getNeoForgeVersion(mcVer) {
    try {
        const json = await fetchJson('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
        if (!json || !json.versions) return null;
        const parts = mcVer.split('.');
        let neoPrefix = '';
        if (parts.length >= 2 && parts[0] === '1' && parseInt(parts[1]) >= 20) {
            neoPrefix = parts[1] + '.' + (parts[2] || '0') + '.';
        }

        let vers = json.versions.filter(v => v.startsWith(mcVer + '-') || (neoPrefix && v.startsWith(neoPrefix)));
        if (!vers.length) vers = json.versions.filter(v => v.startsWith(mcVer));
        if (vers.length > 0) return vers[vers.length - 1]; // latest
        return null;
    } catch (e) {
        console.error("Failed to fetch neoforge versions:", e);
        return null;
    }
}

async function installNeoForge(gameVersion, rootPath) {
    const msg = `[NeoForge] Подготовка запуска NeoForge для ${gameVersion}...`;
    console.log(msg);
    logToFile(msg);
    if (mainWindow) mainWindow.webContents.send('game-log', msg);

    try {
        const neoVer = await getNeoForgeVersion(gameVersion);
        if (!neoVer) {
            const err = `[NeoForge] Не удалось найти версию NeoForge для ${gameVersion}`;
            console.error(err);
            if (mainWindow) mainWindow.webContents.send('game-log', err);
            return null;
        }

        const fullVersionId = `neoforge-${neoVer}`;
        console.log(`[NeoForge] Целевая версия: ${fullVersionId}`);

        const versionDir = path.join(rootPath, 'versions', fullVersionId);
        const versionJson = path.join(versionDir, `${fullVersionId}.json`);

        if (fs.existsSync(versionJson)) {
            console.log(`[NeoForge] Версия уже установлена.`);
            if (mainWindow) mainWindow.webContents.send('game-log', `[NeoForge] Версия ${fullVersionId} найдена.`);
            return { id: fullVersionId, installed: true };
        }

        const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoVer}/neoforge-${neoVer}-installer.jar`;
        const installerPath = path.join(userDataPath, `neoforge-${neoVer}-installer.jar`);

        const dlMsg = `[NeoForge] Скачивание установщика...`;
        console.log(dlMsg);
        if (mainWindow) mainWindow.webContents.send('game-log', dlMsg);

        try {
            await downloadFile(installerUrl, installerPath);
        } catch (e) {
            throw e;
        }

        console.log(`[NeoForge] Установщик скачан: ${installerPath}`);
        if (mainWindow) mainWindow.webContents.send('game-log', `[NeoForge] Установщик готов.`);

        return { id: fullVersionId, installer: installerPath, installed: false };

    } catch (e) {
        console.error(`[NeoForge] Ошибка установки: ${e}`);
        if (mainWindow) mainWindow.webContents.send('game-log', `[NeoForge] Ошибка: ${e.message}`);
        return null;
    }
}

async function ensureJava(userDataPath, gameVersion) {
    const runtimeDir = path.join(userDataPath, 'runtime');
    const isWin = process.platform === 'win32';
    const isLinux = process.platform === 'linux';
    const isMac = process.platform === 'darwin';

    let javaVer = 8;
    const parts = gameVersion.split('.');
    if (parts.length >= 2) {
        const minor = parseInt(parts[1]);
        if (minor >= 21) {
            javaVer = 21;
        } else if (minor >= 17) {
            javaVer = 17;
        }
    }

    if (gameVersion === '1.20.6') javaVer = 21;

    const folderName = `zulu${javaVer}`;
    const javaDir = path.join(runtimeDir, folderName);
    const javaExecName = isWin ? 'java.exe' : 'java';

    const javaExec = path.join(javaDir, 'bin', javaExecName);

    if (fs.existsSync(javaExec)) {
        return javaExec;
    }

    if (mainWindow) mainWindow.webContents.send('game-log', `Downloading Azul Zulu Java ${javaVer}...`);
    console.log(`Downloading Java ${javaVer}...`);

    let url = "";

    if (isWin) {
        if (javaVer === 21) url = "https://cdn.azul.com/zulu/bin/zulu21.32.17-ca-jdk21.0.2-win_x64.zip";
        else if (javaVer === 17) url = "https://cdn.azul.com/zulu/bin/zulu17.56.15-ca-jdk17.0.14-win_x64.zip";
        else url = "https://cdn.azul.com/zulu/bin/zulu8.84.0.15-ca-jdk8.0.442-win_x64.zip";
    } else if (isLinux) {
        if (javaVer === 21) url = "https://cdn.azul.com/zulu/bin/zulu21.32.17-ca-jdk21.0.2-linux_x64.tar.gz";
        else if (javaVer === 17) url = "https://cdn.azul.com/zulu/bin/zulu17.56.15-ca-jdk17.0.14-linux_x64.tar.gz";
        else url = "https://cdn.azul.com/zulu/bin/zulu8.84.0.15-ca-jdk8.0.442-linux_x64.tar.gz";
    } else if (isMac) {

        if (javaVer === 21) url = "https://cdn.azul.com/zulu/bin/zulu21.32.17-ca-jdk21.0.2-macosx_x64.tar.gz";
        else if (javaVer === 17) url = "https://cdn.azul.com/zulu/bin/zulu17.56.15-ca-jdk17.0.14-macosx_x64.tar.gz";
        else url = "https://cdn.azul.com/zulu/bin/zulu8.84.0.15-ca-jdk8.0.442-macosx_x64.tar.gz";
    }

    const archiveName = isWin ? 'java.zip' : 'java.tar.gz';
    const archivePath = path.join(userDataPath, archiveName);

    try {
        if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });

        await downloadFile(url, archivePath);

        if (mainWindow) mainWindow.webContents.send('game-log', `Extracting Java ${javaVer}...`);
        console.log("Extracting Java...");

        const { execSync } = require('child_process');
        if (isWin) {
            execSync(`powershell -command "Expand-Archive -Path '${archivePath}' -DestinationPath '${runtimeDir}' -Force"`);
        } else {

            execSync(`tar -xzf "${archivePath}" -C "${runtimeDir}"`);
        }

        const entries = fs.readdirSync(runtimeDir);
        const candidates = entries.filter(e => e.startsWith('zulu') && e !== 'zulu8' && e !== 'zulu17' && e !== 'zulu21');

        const targetPrefix = `zulu${javaVer}`;
        const extractedFolder = candidates.find(c => c.startsWith(targetPrefix));

        if (extractedFolder) {
            const extractedPath = path.join(runtimeDir, extractedFolder);
            try {
                if (fs.existsSync(javaDir)) {

                }
                fs.renameSync(extractedPath, javaDir);

                if (!isWin) {
                    try {
                        const binJava = path.join(javaDir, 'bin', 'java');
                        fs.chmodSync(binJava, 0o755);
                    } catch (e) { console.error("Failed to chmod java", e); }
                }

                return javaExec;
            } catch (e) {

                const fallbackExec = path.join(extractedPath, 'bin', javaExecName);
                if (!isWin) {
                    try { fs.chmodSync(fallbackExec, 0o755); } catch (ex) { }
                }
                return fallbackExec;
            }
        }

        if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);

        if (fs.existsSync(javaExec)) return javaExec;

        return null;
    } catch (e) {
        console.error("Java download failed:", e);
        if (mainWindow) mainWindow.webContents.send('game-log', 'Error downloading Java: ' + e.message);
        return null;
    }
}

let isLaunching = false;
let gameProcess = null;
let currentAbortController = null;

ipcMain.handle('check-version-installed', async (event, versionId) => {
    const stored = loadSettings();
    const globalSettings = stored.settings || {};
    const rootPath = globalSettings.gamePath || path.join(userDataPath, '.minecraft');

    const versionDir = path.join(rootPath, 'versions', versionId);
    return fs.existsSync(versionDir);
});

ipcMain.handle('abort-launch', () => {
    console.log("Aborting launch...");
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
    }
    logToFile("Launch aborted by user.");
    isLaunching = false;

    if (gameProcess) {
        try {
            console.log("Killing game process:", gameProcess.pid);
            if (process.platform === 'win32') {
                require('child_process').exec(`taskkill /pid ${gameProcess.pid} /f /t`);
            } else {
                gameProcess.kill('SIGKILL');
            }
            gameProcess = null;
        } catch (e) { console.error(e); }
    } else {

    }

    if (global.monitorProcess) {
        try { global.monitorProcess.kill(); } catch (e) { }
        global.monitorProcess = null;
    }

    launcher.removeAllListeners('debug');
    launcher.removeAllListeners('data');
    launcher.removeAllListeners('progress');
    launcher.removeAllListeners('close');

    if (mainWindow) {
        mainWindow.webContents.send('game-log', 'Запуск отменён пользователем.');
        mainWindow.webContents.send('game-exit', -1);
        mainWindow.setProgressBar(-1);
    }
    return true;
});

function logToFile(msg) {
    if (!msg) return;
    try {
        const stored = loadSettings();
        if (stored.settings && stored.settings.saveLogs === false) return;

        const logPath = path.join(userDataPath, 'launcher.log');
        const timestamp = new Date().toISOString();
        const line = `[${timestamp}] ${msg}\n`;
        fs.appendFileSync(logPath, line);
    } catch (e) {
        console.error("Failed to write log file:", e);
    }
}

ipcMain.handle('launch-game', async (event, launchData) => {
    currentAbortController = new AbortController();
    const stored = loadSettings();
    const globalSettings = stored.settings || {};

    let versionId = launchData.version || '1.20.1';
    let versionType = 'FlowCross';
    const modloader = launchData.modloader || 'none';
    const rootPath = globalSettings.gamePath || path.join(userDataPath, '.minecraft');
    let forgeInstaller = undefined;

    if (modloader === 'fabric' || modloader === 'flowcross') {
        const fabricId = await installFabric(versionId, rootPath);
        if (fabricId) {
            versionId = fabricId;

            if (modloader === 'flowcross') {
                const baseVersion = launchData.version || '1.20.1';
                const instanceDir = path.join(rootPath, `flowcross-${baseVersion}`);
                const modsDir = path.join(instanceDir, 'mods');
                if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });


                const FLOWCROSS_MODS = {
                    '1.21.1': [
                        { url: 'https://zeta.elytra.ltd/storage/v1/object/public/FlowCross/Client/requirements/fabric-api-0.116.8-1.21.1.jar', filename: 'fabric-api-0.116.8-1.21.1.jar' },
                        { url: 'https://zeta.elytra.ltd/storage/v1/object/public/FlowCross/Client/Mod/Jar/1.21.1/flowcross.jar', filename: 'flowcross.jar' },
                        { url: 'https://zeta.elytra.ltd/storage/v1/object/public/FlowCross/Client/requirements/owo-lib-0.12.15+1.21.jar', filename: 'owo-lib-0.12.15+1.21.jar' }
                    ]
                };

                const modsForVersion = FLOWCROSS_MODS[baseVersion];
                if (modsForVersion) {
                    for (const mod of modsForVersion) {
                        const dest = path.join(modsDir, mod.filename);
                        const isMainMod = mod.filename === 'flowcross.jar';
                        if (!isMainMod && fs.existsSync(dest)) {
                            if (mainWindow) mainWindow.webContents.send('game-log', `⚡ ${mod.filename} уже установлен`);
                            continue;
                        }
                        try {
                            if (mainWindow) mainWindow.webContents.send('game-log', `Скачивание ${mod.filename}...`);
                            await downloadFile(mod.url, dest);
                            if (mainWindow) mainWindow.webContents.send('game-log', `✅ ${mod.filename} установлен`);
                        } catch (e) {
                            console.error(`Failed to download ${mod.filename}:`, e);
                            if (mainWindow) mainWindow.webContents.send('game-log', `❌ Ошибка скачивания ${mod.filename}: ${e.message}`);
                        }
                    }
                } else {
                    let modJarSrc;
                    if (app.isPackaged) {
                        modJarSrc = path.join(process.resourcesPath, 'flowcross-client.jar');
                    } else {
                        modJarSrc = path.join(__dirname, '..', 'flowcross-mod', 'build', 'libs', 'flowcross-1.0.0.jar');
                    }

                    if (fs.existsSync(modJarSrc)) {
                        const dest = path.join(modsDir, 'flowcross-client.jar');
                        fs.copyFileSync(modJarSrc, dest);
                        if (mainWindow) mainWindow.webContents.send('game-log', 'FlowCross mod installed.');
                    } else {
                        if (mainWindow) mainWindow.webContents.send('game-log', 'FlowCross mod JAR not found at: ' + modJarSrc);
                    }
                }
            }
        }
    } else if (modloader === 'forge') {
        const forgeInfo = await installForge(versionId, rootPath);
        if (forgeInfo) {
            if (forgeInfo.installer) {
                forgeInstaller = forgeInfo.installer;
                versionId = forgeInfo.id;
            } else if (forgeInfo.id) {
                versionId = forgeInfo.id;
            }
        } else {
            console.log("Forge preparation failed, launching vanilla fallback.");
            if (mainWindow) mainWindow.webContents.send('game-log', "Forge failed, fallback to Vanilla...");
        }
    } else if (modloader === 'quilt') {
        const quiltId = await installQuilt(versionId, rootPath);
        if (quiltId) versionId = quiltId;
        else {
            console.log("Quilt preparation failed, launching vanilla fallback.");
            if (mainWindow) mainWindow.webContents.send('game-log', "Quilt failed, fallback to Vanilla...");
        }
    } else if (modloader === 'neoforge') {
        const neoforgeInfo = await installNeoForge(versionId, rootPath);
        if (neoforgeInfo) {
            if (neoforgeInfo.installer) {
                forgeInstaller = neoforgeInfo.installer;
                versionId = neoforgeInfo.id;
            } else if (neoforgeInfo.id) {
                versionId = neoforgeInfo.id;
            }
        } else {
            console.log("NeoForge preparation failed, launching vanilla fallback.");
            if (mainWindow) mainWindow.webContents.send('game-log', "NeoForge failed, fallback to Vanilla...");
        }
    }

    const baseGameVersion = launchData.version || '1.20.1';
    const autoJavaPath = await ensureJava(userDataPath, baseGameVersion);
    console.log(`[Launch] Java for ${baseGameVersion}: ${autoJavaPath}`);

    let gameDirectory;
    if (launchData.modpackId) {
        gameDirectory = path.join(rootPath, "modpacks", launchData.modpackId);
        if (!fs.existsSync(gameDirectory)) fs.mkdirSync(gameDirectory, { recursive: true });
    } else if (modloader === 'flowcross') {
        gameDirectory = path.join(rootPath, `flowcross-${baseGameVersion}`);
    }

    const opts = {
        clientPackage: null,
        authorization: Authenticator.getAuth(launchData.username || "Player"),
        root: rootPath,
        version: {
            number: baseGameVersion,
            type: versionType,
            custom: (modloader !== 'none') ? versionId : undefined
        },
        memory: {
            max: globalSettings.ram || 4096,
            min: 512
        },
        javaPath: globalSettings.javaPath || autoJavaPath || undefined,
        overrides: {
            detached: false,
            gameDirectory: gameDirectory
        },
        window: {
            width: launchData.windowWidth || 854,
            height: launchData.windowHeight || 480,
            fullscreen: launchData.fullscreen || false,
            x: launchData.windowX,
            y: launchData.windowY
        },
        forge: forgeInstaller
    };

    if (globalSettings.jvmArgs) {
        opts.customArgs = globalSettings.jvmArgs.split(' ');
    }

    let agentJarPath;
    if (app.isPackaged) {
        agentJarPath = path.join(process.resourcesPath, 'GameStatsAgent.jar');
    } else {
        agentJarPath = path.join(__dirname, 'scripts', 'GameStatsAgent.jar');
    }

    logToFile(`Determined Agent Path: ${agentJarPath}`);
    const agentStatsPath = path.join(userDataPath, 'game_stats.json');
    let agentReady = false;

    if (fs.existsSync(agentJarPath)) {
        try {
            opts.customArgs = opts.customArgs || [];

            const versionParts = baseGameVersion.split('.').map(Number);
            const isNewerJava = (versionParts[0] === 1 && versionParts[1] >= 17) || (versionParts[0] > 1);

            if (isNewerJava) {
                opts.customArgs.push('--add-opens', 'java.base/java.lang=ALL-UNNAMED');
                opts.customArgs.push('--add-opens', 'java.base/java.lang.reflect=ALL-UNNAMED');
            }

            opts.customArgs.push(`-javaagent:${agentJarPath}=${agentStatsPath}`);
            logToFile("Agent found and attached.");
            agentReady = true;
        } catch (e) { logToFile("Error attaching agent: " + e); }
    } else {
        logToFile("Agent JAR not found at: " + agentJarPath);
    }

    try {
        isLaunching = true;

        if (!opts.javaPath) {
            if (mainWindow) mainWindow.webContents.send('game-log', 'Checking Java compatibility...');

            let versionStr = "1.20.1";
            if (opts.version && opts.version.number) versionStr = opts.version.number;

            const zuluPath = await ensureJava(userDataPath, versionStr);
            if (zuluPath) {
                opts.javaPath = zuluPath;
                if (mainWindow) mainWindow.webContents.send('game-log', `Using Azul Zulu Java for ${versionStr}`);
            }
        }

        const overlayEnabled = false;

        if (overlayEnabled) {
            global.lastLaunchUsername = launchData.username || 'Player';

            if (!overlayWindow) {
                createOverlayWindow();
            } else {
                overlayWindow.webContents.send('reset-timer');
            }

            if (overlayWindow && !overlayWindow.isDestroyed()) {
                overlayWindow.webContents.send('update-stats', { username: launchData.username || 'Player' });
            }
        }

        const statsInterval = setInterval(() => {
            if (overlayWindow && !overlayWindow.isDestroyed()) {
                let fps = 0;
                let coords = null;

                if (agentReady && fs.existsSync(agentStatsPath)) {
                    try {
                        const raw = fs.readFileSync(agentStatsPath, 'utf8');
                        const stats = JSON.parse(raw);
                        if (stats.fps >= 0) fps = stats.fps;
                        if (stats.x !== undefined) coords = { x: stats.x, y: stats.y, z: stats.z };
                    } catch (e) { }
                }

                if (currentServerIp) {
                    const start = Date.now();
                    const sock = new nodeNet.Socket();
                    sock.setTimeout(2000);
                    sock.connect(25565, currentServerIp, () => {
                        const p = Date.now() - start;
                        overlayWindow.webContents.send('update-stats', { ping: p, fps, coords });
                        sock.destroy();
                    });
                    sock.on('error', () => {
                        overlayWindow.webContents.send('update-stats', { ping: 999, fps, coords });
                        sock.destroy();
                    });
                    sock.on('timeout', () => {
                        overlayWindow.webContents.send('update-stats', { ping: 999, fps, coords });
                        sock.destroy();
                    });
                } else {
                    overlayWindow.webContents.send('update-stats', { ping: 0, fps, coords });
                }

            } else {
                clearInterval(statsInterval);
            }
        }, 1000);

        launcher.on('debug', (e) => {
            if (mainWindow) mainWindow.webContents.send('game-log', e);
            logToFile("[DEBUG] " + e);
            console.log(e);
        });
        launcher.on('data', (e) => {
            if (mainWindow) mainWindow.webContents.send('game-log', e);
            logToFile("[GAME] " + e);
            console.log(e);

            const logLine = String(e);
            const serverMatch = logLine.match(/Connecting to (.+?), (\d+)/);
            if (serverMatch) {
                currentServerIp = serverMatch[1];
                if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send('update-server', serverMatch[1]);
                setDiscordActivity(`Играет на сервере`, currentServerIp);
            } else if (logLine.match(/Starting integrated (minecraft )?server/i)) {
                currentServerIp = null;
                if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send('update-server', "Local World");
                setDiscordActivity(`В одиночной игре`, `Версия: ${baseGameVersion}`);
            } else if (logLine.includes("Stopping!") || logLine.includes("Quitting") || logLine.includes("Disconnected from server") || logLine.includes("Connection lost") || logLine.includes("Connection closed")) {
                currentServerIp = null;
                if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send('update-server', "Not in World");
                setDiscordActivity(`В главном меню`, `Версия: ${baseGameVersion}`);
            }
        });

        launcher.removeAllListeners('debug');
        launcher.removeAllListeners('data');
        launcher.removeAllListeners('progress');
        launcher.removeAllListeners('close');

        let gameRunningConfirmed = false;
        const hideCommand = launchData.hideLaunchCommand !== false;

        launcher.on('debug', (e) => {
            if (hideCommand && e.includes('Arguments:')) return;
            if (mainWindow) mainWindow.webContents.send('game-log', e);
            logToFile(`[MCLC Debug] ${e}`);
        });

        launcher.on('data', (e) => {
            if (hideCommand && e.includes('Arguments:')) return;
            if (mainWindow) mainWindow.webContents.send('game-log', e);

            if (!gameRunningConfirmed && isLaunching) {
                const lower = e.toLowerCase();
                if (lower.includes('backend library: lwjgl') ||
                    lower.includes('created: ') && lower.includes('atlas') ||
                    lower.includes('sound engine started') ||
                    lower.includes('openal initialized')) {

                    gameRunningConfirmed = true;
                    if (mainWindow) {
                        mainWindow.webContents.send('game-started');
                        mainWindow.setProgressBar(-1);
                        setTimeout(() => {
                            if (!globalSettings.keepLauncherOpen) {
                                mainWindow.close();
                            }
                        }, 2000);
                    }
                    logToFile("Game running confirmed via logs.");
                }
            }
        });

        launcher.on('progress', (e) => {
            if (mainWindow) {
                let percent = 0;
                if (e.total > 0) percent = (e.task / e.total) * 100;
                if (percent > 100) percent = 100;
                if (percent < 0) percent = 0;

                mainWindow.webContents.send('download-progress', percent);
                mainWindow.setProgressBar(percent / 100);
            }
        });

        launcher.on('close', (code) => {
            console.log(`Game exited with code ${code}`);
            clearInterval(statsInterval);
            try { if (fs.existsSync(agentStatsPath)) fs.unlinkSync(agentStatsPath); } catch (e) { }

            if (mainWindow) {
                mainWindow.webContents.send('game-exit', code);
                mainWindow.setProgressBar(-1);
            }
            isLaunching = false;
            setDiscordActivity("В лаунчере", "Готовится к игре");
        });

        const scriptPath = path.join(__dirname, '../src/scripts/monitor_game.ps1');
        const { spawn } = require('child_process');

        if (global.monitorProcess) {
            try { global.monitorProcess.kill(); } catch (e) { }
        }

        if (process.platform === 'win32') {
            global.monitorProcess = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath]);

            global.monitorProcess.on('error', (err) => {
                console.error('Monitor spawn error:', err);
            });

            global.monitorProcess.on('exit', (code) => {
                console.log('Monitor exited with code:', code);
            });

            global.monitorProcess.stderr.on('data', (data) => {
                console.error('Monitor stderr:', data.toString());
            });
        }

        let lastToggleTime = 0;

        if (global.monitorProcess) {
            global.monitorProcess.stdout.on('data', (data) => {
                try {
                    const str = data.toString().trim();
                    const lines = str.split('\n');
                    lines.forEach(line => {
                        const cleanLine = line.trim();
                        if (cleanLine.startsWith('{') && cleanLine.endsWith('}')) {
                            const info = JSON.parse(cleanLine);
                            if (info.heartbeat) console.log("[Monitor] Heartbeat");
                            if (info.key_debug) {
                                console.log("[Monitor] KEY DEBUG: RSHIFT DETECTED");
                                logToFile("[Monitor] KEY DEBUG: RSHIFT DETECTED");
                            }

                            if (overlayWindow && !overlayWindow.isDestroyed()) {
                                if (info.found) {
                                    if (info.minimized) {
                                        if (overlayWindow.isVisible()) overlayWindow.hide();
                                    } else {
                                        const isGracePeriod = (Date.now() - lastToggleTime < 1000);
                                        if (info.foreground || isSettingsOpen || isGracePeriod) {
                                            if (!overlayWindow.isVisible()) overlayWindow.showInactive();
                                            overlayWindow.setAlwaysOnTop(true, 'screen-saver');
                                        } else {
                                            if (overlayWindow.isVisible()) overlayWindow.hide();
                                        }

                                        overlayWindow.webContents.send('update-position', { x: info.x, y: info.y, w: info.w, h: info.h });

                                        if (info.key === 'rshift' && (info.foreground || isSettingsOpen)) {
                                            const now = Date.now();
                                            if (now - lastToggleTime > 500) {
                                                lastToggleTime = now;
                                                overlayWindow.webContents.send('toggle-settings');
                                            }
                                        }
                                        if (info.music !== undefined) {
                                            overlayWindow.webContents.send('update-music', info.music);
                                        }
                                        if (info.cpu !== undefined) {
                                            overlayWindow.webContents.send('update-stats', { cpu: info.cpu });
                                        }
                                    }
                                } else {
                                    if (overlayWindow.isVisible()) overlayWindow.hide();
                                }
                            }
                        }
                    });
                } catch (e) { }
            });
        }

        const res = await launcher.launch(opts);
        if (!isLaunching) {
            console.log("Launch aborted during critical phase. Killing spawned process immediately.");
            if (res && res.kill) res.kill();
            gameProcess = null;
            return;
        }

        if (res && res.kill) {
            gameProcess = res;
            console.log("Game process captured:", gameProcess.pid);
        } else {
            console.log("Launcher returned:", res);
        }

    } catch (error) {
        if (mainWindow) mainWindow.webContents.send('game-log', `Error: ${error.message}`);
        isLaunching = false;
        if (global.monitorProcess) global.monitorProcess.kill();
    }
});

let autoUpdater;
try {
    const updaterModule = require('electron-updater');
    autoUpdater = updaterModule.autoUpdater;
} catch (e) { }

if (autoUpdater) {
    autoUpdater.logger = null;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('error', (error) => {
        if (mainWindow) mainWindow.webContents.send('update-error', error == null ? "unknown" : (error.stack || error).toString());
    });

    autoUpdater.on('update-available', (info) => {
        if (mainWindow) mainWindow.webContents.send('update-available', info);
    });

    autoUpdater.on('update-not-available', () => { });

    autoUpdater.on('update-downloaded', (info) => {
        if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
    });

    autoUpdater.on('download-progress', (progressObj) => {
        if (mainWindow) mainWindow.webContents.send('update-progress', progressObj);
    });

    ipcMain.handle('check-for-updates', () => {
        if (app.isPackaged) {
            autoUpdater.checkForUpdates().catch(() => { });
        } else {
            checkForUpdatesManual();
        }
    });

    ipcMain.handle('download-update', () => {
        return autoUpdater.downloadUpdate();
    });

    ipcMain.handle('quit-and-install', () => {
        autoUpdater.quitAndInstall();
    });
} else {
    ipcMain.handle('check-for-updates', () => { checkForUpdatesManual(); });
    ipcMain.handle('download-update', () => { });
    ipcMain.handle('quit-and-install', () => { });
}

function checkForUpdatesManual() {
    const currentVersion = app.getVersion();

    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    let useBetaChannel = false;
    try {
        if (fs.existsSync(settingsPath)) {
            const settingsData = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            if (settingsData && settingsData.settings && settingsData.settings.updateChannel === 'beta') {
                useBetaChannel = true;
            }
        }
    } catch (e) {
        console.error('Error reading settings for update channel', e);
    }

    let ymlUrl = 'https://github.com/lowfreez/FlowCross/releases/latest/download/latest.yml';

    if (useBetaChannel) {
        ymlUrl = 'https://github.com/lowfreez/FlowCross/releases/download/v0.2.1-beta/latest-beta.yml';
    }

    if (autoUpdater && app.isPackaged) {
        autoUpdater.allowPrerelease = useBetaChannel;
    }

    electronFetchText(ymlUrl).then(text => {
        if (!text) {
            if (useBetaChannel) {
                ymlUrl = 'https://github.com/lowfreez/FlowCross/releases/latest/download/latest.yml';
                return electronFetchText(ymlUrl).then(processYmlText).catch(err => {
                    if (mainWindow) mainWindow.webContents.send('update-error', 'fetch error: ' + err.message);
                });
            }
            if (mainWindow) mainWindow.webContents.send('update-error', 'latest.yml not found');
            return;
        }

        processYmlText(text);

        function processYmlText(textData) {
            const match = textData.match(/^version:\s*(.+)$/m);
            if (!match) {
                if (mainWindow) mainWindow.webContents.send('update-error', 'Cannot parse latest.yml: ' + textData.slice(0, 100));
                return;
            }

            const latestVersion = match[1].trim();
            const cleanVer = v => v.split('-')[0].split('.').map(Number);

            const [maj, min, pat] = cleanVer(latestVersion);
            const [cmaj, cmin, cpat] = cleanVer(currentVersion);

            let isNewer = false;
            if (maj > cmaj) isNewer = true;
            else if (maj === cmaj && min > cmin) isNewer = true;
            else if (maj === cmaj && min === cmin && pat > cpat) isNewer = true;
            else if (maj === cmaj && min === cmin && pat === cpat && latestVersion.includes('beta') && !currentVersion.includes('beta')) isNewer = true;

            if (mainWindow) mainWindow.webContents.send('update-error', `[DEV] channel=${useBetaChannel ? 'beta' : 'stable'} current=${currentVersion} latest=${latestVersion} isNewer=${isNewer}`);


            if (isNewer && mainWindow) {
                mainWindow.webContents.send('update-available', { version: latestVersion });
            }
        }
    }).catch(err => {
        if (mainWindow) mainWindow.webContents.send('update-error', 'fetch error: ' + err.message);
    });
}

