/// <reference types="vite/client" />

interface Window {
  odontoCare?: {
    chooseBackupDirectory: () => Promise<string | null>;
    platform: string;
    versions: {
      chrome: string;
      electron: string;
    };
  };
}
