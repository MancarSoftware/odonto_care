import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("odontoCare", {
  chooseBackupDirectory: () =>
    ipcRenderer.invoke("backups:choose-directory") as Promise<string | null>,
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});
