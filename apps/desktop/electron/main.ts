import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isDevelopment = process.env.NODE_ENV === "development";
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    title: "OdontoCare",
    backgroundColor: "#f7fafc",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(currentDir, "preload.js"),
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDevelopment && devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  void mainWindow.loadFile(path.join(currentDir, "../dist/index.html"));
}

app.setAppUserModelId("com.odontocare.desktop");

app.whenReady().then(() => {
  ipcMain.handle("backups:choose-directory", async () => {
    const selection = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Seleccionar carpeta de backups",
    });

    return selection.canceled ? null : (selection.filePaths[0] ?? null);
  });

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
