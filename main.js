const { app, BrowserWindow } = require('electron');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,  // <--- ADICIONE ESTA LINHA
            allowRunningInsecureContent: true  // <--- ADICIONE ESTA LINHA (opcional)
        }
    });
    
    win.loadFile('index.html');
    // win.webContents.openDevTools(); // Descomente para debug
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});