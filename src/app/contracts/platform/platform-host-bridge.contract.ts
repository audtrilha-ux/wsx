export type HostPlatformType = 'web' | 'windows' | 'android';

export interface HostBridgeCapabilities {
  supportsNativeSqlite: boolean;
  supportsComPorts: boolean;
  supportsRawPrinting: boolean;
  supportsHardwareScanner: boolean;
  supportsHardwareScale: boolean;
  supportsCashDrawerKick: boolean;
  supportsCustomerDisplay?: boolean;
}

export interface IPlatformHostBridge {
  readonly platform: HostPlatformType;
  readonly isNativeHost: boolean;
  readonly capabilities: HostBridgeCapabilities;
  
  executeNativeSql?(sql: string, params?: unknown[]): Promise<unknown>;
  sendRawPrinterData?(printerName: string, data: Uint8Array): Promise<boolean>;
  openCashDrawer?(port?: string): Promise<boolean>;
  readScaleWeight?(port?: string): Promise<{ weightKg: number; stable: boolean } | null>;
  sendCustomerDisplay?(port?: string, line1?: string, line2?: string): Promise<boolean>;
  getSystemDiagnostics?(): Promise<{ os: string; platformVersion: string; freeDiskBytes: number; memoryUsageBytes: number }>;
}

declare global {
  interface Window {
    __3EATCRU_NATIVE_BRIDGE__?: IPlatformHostBridge;
    electron?: {
      ipcRenderer: {
        invoke(channel: string, ...args: unknown[]): Promise<unknown>;
      };
    };
  }
}
