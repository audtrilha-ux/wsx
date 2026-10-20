import type { IPlatformHostBridge } from './app/contracts/platform/platform-host-bridge.contract';

declare global {
  interface Window {
    __3EATCRU_NATIVE_BRIDGE__?: IPlatformHostBridge;
    electron?: {
      ipcRenderer?: unknown;
    };
  }
}

export {};

declare module 'cookie-parser';
