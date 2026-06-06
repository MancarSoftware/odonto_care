import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  shell,
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ApiRuntime } from "./api-runtime.js";
import { errorMessage } from "./process-utils.js";
import {
  formatPostgresStartupError,
  PostgresRuntime,
} from "./postgres-runtime.js";
import {
  acknowledgeInitialAdmin,
  ensureProductionDirectories,
  loadOrCreateRuntimeConfig,
  resolveProductionPaths,
  type ProductionPaths,
  type RuntimeConfig,
} from "./runtime-config.js";

const isDevelopment = process.env.NODE_ENV === "development";
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
let apiRuntime: ApiRuntime | undefined;
let postgresRuntime: PostgresRuntime | undefined;
let productionPaths: ProductionPaths | undefined;
let runtimeConfig: RuntimeConfig | undefined;
let shutdownStarted = false;

function createMainWindow(): BrowserWindow {
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
    return mainWindow;
  }

  void mainWindow.loadFile(path.join(currentDir, "../dist/index.html"));
  return mainWindow;
}

function createStartupWindow() {
  const startupWindow = new BrowserWindow({
    width: 470,
    height: 270,
    resizable: false,
    frame: false,
    center: true,
    show: false,
    backgroundColor: "#f7fafc",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const html = `<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #f7fafc;
            color: #101828;
            font-family: Inter, "Segoe UI", sans-serif;
          }
          main { width: 100%; padding: 38px; text-align: center; }
          .mark {
            display: grid;
            width: 54px;
            height: 54px;
            margin: 0 auto 20px;
            place-items: center;
            border-radius: 10px;
            background: #eaf2ff;
            color: #3478f6;
            font-size: 26px;
            font-weight: 800;
          }
          h1 { margin: 0; font-size: 22px; letter-spacing: 0; }
          p { margin: 10px 0 24px; color: #667085; font-size: 14px; }
          .track {
            height: 4px;
            overflow: hidden;
            border-radius: 999px;
            background: #e4eaf2;
          }
          .bar {
            width: 42%;
            height: 100%;
            border-radius: inherit;
            background: #3478f6;
            animation: loading 1.15s ease-in-out infinite alternate;
          }
          @keyframes loading {
            from { transform: translateX(-10%); }
            to { transform: translateX(150%); }
          }
        </style>
      </head>
      <body>
        <main>
          <div class="mark">O</div>
          <h1>Preparando OdontoCare</h1>
          <p>Iniciando la base de datos y los servicios locales.</p>
          <div class="track"><div class="bar"></div></div>
        </main>
      </body>
    </html>`;

  void startupWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
  );
  startupWindow.once("ready-to-show", () => startupWindow.show());
  return startupWindow;
}

app.setAppUserModelId("com.odontocare.desktop");

app.whenReady().then(async () => {
  ipcMain.handle("backups:choose-directory", async () => {
    const selection = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Seleccionar carpeta de backups",
    });

    return selection.canceled ? null : (selection.filePaths[0] ?? null);
  });

  let startupWindow: BrowserWindow | undefined;

  try {
    if (!isDevelopment) {
      startupWindow = createStartupWindow();
      await startProductionRuntime();
    }

    const mainWindow = createMainWindow();
    startupWindow?.close();

    if (
      !isDevelopment &&
      productionPaths &&
      runtimeConfig?.initialAdminPending &&
      runtimeConfig.initialAdminPassword
    ) {
      clipboard.writeText(runtimeConfig.initialAdminPassword);
      await dialog.showMessageBox(mainWindow, {
        buttons: ["Entendido"],
        detail: [
          `Usuario: ${runtimeConfig.initialAdminEmail}`,
          `Contrasena: ${runtimeConfig.initialAdminPassword}`,
          "",
          "La contrasena ya fue copiada al portapapeles. Cambiala despues de iniciar sesion.",
        ].join("\n"),
        message: "Acceso inicial de administrador",
        noLink: true,
        title: "Primera configuracion",
        type: "info",
      });
      await acknowledgeInitialAdmin(productionPaths, runtimeConfig);
    }
  } catch (error) {
    startupWindow?.close();
    dialog.showErrorBox(
      "No se pudo iniciar OdontoCare",
      errorMessage(error),
    );
    await shutdownProductionRuntime();
    app.exit(1);
    return;
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("before-quit", (event) => {
  if (isDevelopment || shutdownStarted) {
    return;
  }

  event.preventDefault();
  shutdownStarted = true;
  void shutdownProductionRuntime().finally(() => app.exit(0));
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

async function startProductionRuntime() {
  productionPaths = resolveProductionPaths(
    process.resourcesPath,
    app.getPath("appData"),
  );
  await ensureProductionDirectories(productionPaths);
  runtimeConfig = await loadOrCreateRuntimeConfig(productionPaths);
  process.env.ODONTOCARE_API_BASE_URL =
    `http://127.0.0.1:${runtimeConfig.apiPort}`;

  postgresRuntime = new PostgresRuntime(productionPaths, runtimeConfig);
  try {
    await postgresRuntime.start();
  } catch (error) {
    throw new Error(formatPostgresStartupError(error), { cause: error });
  }

  apiRuntime = new ApiRuntime(productionPaths, runtimeConfig);
  await apiRuntime.start();
}

async function shutdownProductionRuntime() {
  await apiRuntime?.stop();
  await postgresRuntime?.stop();
}
