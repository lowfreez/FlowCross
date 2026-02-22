const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
    launch: (options) => ipcRenderer.invoke('launch-game', options),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    getDefaultPaths: () => ipcRenderer.invoke('get-default-paths'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    windowControl: (action) => ipcRenderer.send('window-control', action),
    sendDragMove: (data) => ipcRenderer.send('window-drag-move', data),
    getVersions: () => ipcRenderer.invoke('get-versions'),
    getFabricVersions: () => ipcRenderer.invoke('get-fabric-versions'),
    getForgeVersions: () => ipcRenderer.invoke('get-forge-versions'),
    getNeoForgeVersions: () => ipcRenderer.invoke('get-neoforge-versions'),
    getQuiltVersions: () => ipcRenderer.invoke('get-quilt-versions'),
    openDirectory: () => ipcRenderer.invoke('open-directory-dialog'),
    openFile: () => ipcRenderer.invoke('open-file-dialog'),
    openImage: () => ipcRenderer.invoke('open-image-dialog'),
    fetchNews: () => ipcRenderer.invoke('fetch-news'),
    fetchPatchNotes: () => ipcRenderer.invoke('fetch-patch-notes'),
    fetchContent: (url) => ipcRenderer.invoke('fetch-content', url),

    onProgress: (callback) => ipcRenderer.on('game-progress', (event, data) => callback(data)),
    onLog: (callback) => ipcRenderer.on('game-log', (event, data) => callback(data)),
    onGameExit: (callback) => ipcRenderer.on('game-exit', (event, code) => callback(code)),
    onGameStarted: (callback) => ipcRenderer.on('game-started', (event) => callback()),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, progress) => callback(progress)),
    onSplashProgress: (callback) => ipcRenderer.on('splash-progress', (event, progress) => callback(progress)),

    abortLaunch: () => ipcRenderer.invoke('abort-launch'),
    checkInstalled: (version) => ipcRenderer.invoke('check-version-installed', version),

    openExternal: (url) => ipcRenderer.send('open-external', url),
    openFolder: (type) => ipcRenderer.invoke('open-folder', type),

    resetSettings: () => ipcRenderer.invoke('reset-settings'),
    repairClient: () => ipcRenderer.invoke('repair-client'),
    repairLauncherFiles: () => ipcRenderer.invoke('repair-launcher-files'),
    microsoftLogin: () => ipcRenderer.invoke('microsoft-login'),

    exportSettings: () => ipcRenderer.invoke('export-settings'),
    importSettings: () => ipcRenderer.invoke('import-settings'),
    importSettingsFromPath: (filePath) => ipcRenderer.invoke('import-settings-from-path', filePath),
    onImportFlowFile: (callback) => ipcRenderer.on('import-flow-file', (event, filePath) => callback(filePath)),

    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (e, info) => callback(info)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (e, info) => callback(info)),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (e, progress) => callback(progress)),
    onUpdateError: (callback) => ipcRenderer.on('update-error', (e, err) => callback(err)),
    onJumpLaunchVersion: (callback) => ipcRenderer.on('jump-launch-version', (e, ver) => callback(ver)),

    getModpackMods: (modpackId) => ipcRenderer.invoke('get-modpack-mods', modpackId),
    deleteMod: (args) => ipcRenderer.invoke('delete-mod', args),
    toggleMod: (args) => ipcRenderer.invoke('toggle-mod', args),
    downloadMod: (args) => ipcRenderer.invoke('download-mod', args),
    modrinthSearch: (args) => ipcRenderer.invoke('modrinth-search', args),
    modrinthVersions: (args) => ipcRenderer.invoke('modrinth-versions', args)

});
