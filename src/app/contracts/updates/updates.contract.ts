/**
 * 3EATCRU OS - Updates Contracts (Section 8.1 & Section 19)
 * Gerenciador de atualizações, versões e compatibilidade de OS
 */

export interface IReleaseVersion {
  readonly version: string;
  readonly releaseDate: Date;
  readonly releaseNotes: string[];
  readonly minOsVersion?: string;
  readonly isMandatory?: boolean;
  readonly checksum?: string;
}

export interface ICompatibilityReport {
  readonly isCompatible: boolean;
  readonly currentOsVersion: string;
  readonly requiredOsVersion: string;
  readonly reason?: string;
}

export interface IUpdateManager {
  getCurrentVersion(): string;
  checkForUpdates(): Promise<IReleaseVersion | null>;
  applyUpdate(version: string): Promise<boolean>;
}

export interface ICompatibilityResolver {
  checkCompatibility(appManifestVersion: string): ICompatibilityReport;
}
