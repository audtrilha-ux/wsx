/**
 * 3EATCRU OS - Device Contracts (Section 8.1 & Section 14)
 * Identidade do terminal, periféricos conectados e hardware
 */

export type DeviceTrustLevel = 'untrusted' | 'trusted' | 'verified_hardware';

export type StationType = 'pos' | 'kds' | 'spooler' | 'totem' | 'mobile' | 'manager';

export interface IDeviceIdentity {
  readonly deviceId?: string | null;
  readonly terminalName: string;
  readonly pairedCompanyId?: string | null;
  readonly platform: 'web' | 'android' | 'windows' | 'linux';
  readonly appVersion: string;
  readonly registeredAt: Date;
  readonly publicKeyPem?: string;
  readonly trustLevel?: DeviceTrustLevel;
  readonly stationType?: StationType;
  readonly deviceGroup?: string;
}

export type PeripheralType = 
  | 'printer' 
  | 'barcode_scanner' 
  | 'scanner'
  | 'cash_drawer'
  | 'scale' 
  | 'payment_pinpad' 
  | 'customer_display';

export type PeripheralStatus = 
  | 'connected' 
  | 'disconnected' 
  | 'online'
  | 'offline'
  | 'no_paper'
  | 'error' 
  | 'simulated';

export interface IPeripheral {
  readonly id: string;
  readonly name: string;
  readonly type: PeripheralType;
  readonly status: PeripheralStatus;
  readonly port?: string;
  readonly isDefault?: boolean;
}

export interface IDevice {
  getIdentity(): Promise<IDeviceIdentity>;
  listPeripherals(): Promise<IPeripheral[]>;
  getPeripheral(id: string): Promise<IPeripheral | null>;
  pingHardware(id: string): Promise<boolean>;
}
