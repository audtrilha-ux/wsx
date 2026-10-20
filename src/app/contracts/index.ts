/**
 * 3EATCRU OS - Canonical Contracts Registry (Section 8.1)
 * Plataforma First · Apps Second
 */

export * from './apps/app-manifest.contract';
export * from './apps/app-instance.contract';
export * from './os/os-context.contract';
export * from './os/os-database.contract';

// Subsystem Contracts
export * from './storage/storage.contract';
export * from './network/network.contract';
export * from './auth/auth.contract';
export * from './events/events.contract';
export * from './device/device.contract';
export * from './printing/printing.contract';
export * from './sync/sync.contract';
export * from './diagnostics/diagnostics.contract';
export * from './updates/updates.contract';
export * from './storage/virtual-fs.contract';
export * from './platform/platform-host-bridge.contract';
