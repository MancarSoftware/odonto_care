import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("odontoCare", {
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});
