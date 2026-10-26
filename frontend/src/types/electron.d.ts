declare global {
  interface Window {
    electron?: {
      isElectron: boolean;
      platform: string;
    };
  }
}

export {};
