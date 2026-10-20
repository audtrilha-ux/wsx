import { OsDatabaseNamespace, OsDatabaseTransaction } from './os-database.contract';
import { IEventBus } from '../events/events.contract';
import { PrintPaperProfile } from '../printing/printing.contract';
import { IPeripheral } from '../device/device.contract';

/**
 * 3EATCRU OS - OS Context & SDK Contract
 * O OS fornece este contexto aos Apps em execução. 
 * O App nunca acessa diretamente detalhes internos do Kernel.
 */
export interface OsPrintOptions {
  profile?: PrintPaperProfile;
  copies?: number;
}

export interface OsHardwareClient {
  readScale(scaleId?: string): Promise<{ weightKg: number; isStable: boolean; tareKg: number; timestamp: Date }>;
  triggerCashDrawer(drawerId?: string): Promise<boolean>;
  sendCustomerDisplay(line1: string, line2?: string, displayId?: string): Promise<boolean>;
  listPeripherals(): Promise<IPeripheral[]>;
}

export interface OsSyncClient {
  isOnline: boolean;
  queueOperation(action: string, payload: unknown): Promise<void>;
  queueOperationTransacted(tx: OsDatabaseTransaction, action: string, payload: unknown): Promise<void>;
}

export interface OsLoggerClient {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: unknown, context?: Record<string, unknown>): void;
}

export interface OsContext {
  readonly appId: string;
  readonly companyId: string;
  readonly companyName: string;
  readonly branchId?: string;
  readonly branchName?: string;
  readonly operatorName?: string;
  readonly isOnline: boolean;
  
  // Storage com namespace isolado para o App (Ex: 'app.pos', 'app.crm')
  readonly storage: OsDatabaseNamespace;

  // Barramento de eventos seguro do OS
  readonly events: IEventBus;

  // Periféricos e hardware
  readonly hardware: OsHardwareClient;

  // Sincronização e Outbox
  readonly sync: OsSyncClient;

  // Conectividade e Rede (Isolado por App)
  readonly network: import('../network/network.contract').INetwork;

  // Telemetria e Logs
  readonly logger: OsLoggerClient;
  
  // Acesso seguro a configurações da empresa provido pelo OS
  readonly config: {
    get(key: string): unknown;
  };
  
  // Serviços de infraestrutura providos pelo OS
  print(title: string, content: string, options?: OsPrintOptions): Promise<boolean>;
  notify(title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
  openApp(targetAppId: string, title?: string): void;
}

