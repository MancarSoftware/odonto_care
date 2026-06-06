import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("odontoCare", {
  apiBaseUrl:
    process.env.ODONTOCARE_API_BASE_URL ?? "http://127.0.0.1:3333",
  chooseBackupDirectory: () =>
    ipcRenderer.invoke("backups:choose-directory") as Promise<string | null>,
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});
