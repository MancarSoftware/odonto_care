/// <reference types="vite/client" />

interface Window {
  odontoCare?: {
    platform: string;
    versions: {
      chrome: string;
      electron: string;
    };
  };
}
