export type ProcessStatus = 'stopped' | 'starting' | 'running' | 'paused' | 'failed' | 'restarting';

export type ServiceType = 'system' | 'background_worker' | 'hardware' | 'network' | 'app_runtime' | 'app_instance';

export interface ProcessMetrics {
  cpuPercentage: number;
  memoryUsageMb: number;
  uptimeSeconds: number;
  heartbeatCount: number;
  lastHeartbeat: Date;
  peakCpuPercentage?: number;
}

export interface OsProcessInfo {
  id: string;
  name: string;
  type: ServiceType;
  status: ProcessStatus;
  autoRestart: boolean;
  maxRestarts: number;
  restartCount: number;
  lastError?: string;
  metrics: ProcessMetrics;
  startedAt: Date;
  pid?: number;
  appId?: string;
  isBackground?: boolean;
}

export interface ProcessMetricsSummary {
  totalCpuPercentage: number;
  totalMemoryMb: number;
  activeProcessesCount: number;
  backgroundAppsCount: number;
  foregroundAppsCount: number;
  peakCpuPercentage: number;
}

export interface IProcessSupervisor {
  listProcesses(): OsProcessInfo[];
  startProcess(id: string): Promise<boolean>;
  stopProcess(id: string): Promise<boolean>;
  restartProcess(id: string): Promise<boolean>;
  killProcess(id: string): Promise<boolean>;
  getProcessMetrics(id: string): ProcessMetrics | null;
  getMetricsSummary(): ProcessMetricsSummary;
  registerAppProcess?(appId: string, name: string, isBackground?: boolean): OsProcessInfo;
  unregisterAppProcess?(appId: string): void;
  setAppBackgroundState?(appId: string, isBackground: boolean): void;
}
