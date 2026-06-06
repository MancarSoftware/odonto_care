/// <reference types="vite/client" />

interface Window {
  odontoCare?: {
    apiBaseUrl: string;
    chooseBackupDirectory: () => Promise<string | null>;
    platform: string;
    versions: {
      chrome: string;
      electron: string;
    };
  };
}
