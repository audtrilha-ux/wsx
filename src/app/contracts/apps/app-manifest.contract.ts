import { Type } from '@angular/core';

export type AppCategory = 
  | 'SALES' 
  | 'MANAGEMENT' 
  | 'RESTAURANT' 
  | 'SYSTEM' 
  | 'MARKETING' 
  | 'FINANCE'
  | 'INVENTORY'
  | 'CRM'
  | 'PUBLIC_SPACE'
  | 'UTILITIES'
  | 'INTEGRATION'
  | 'DELIVERY'
  | 'MESSAGING';

export interface AppPermission {
  name: string;
  description: string;
}

export interface AppManifest {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly category: AppCategory;
  readonly icon: string;
  readonly developer: string;
  readonly publisher?: string;
  
  readonly permissions?: string[];
  readonly capabilities?: string[];
  readonly dependencies?: { id: string; versionRange: string }[];
  readonly osCompatibility?: string;
  readonly dataNamespace?: string;
  readonly syncPolicy?: 'append-only' | 'last-write-wins' | 'crdt' | 'per-entity';
  readonly settingsSchema?: Record<string, unknown>;
  readonly signature?: string;
  readonly defaultWindowSize?: { width: number; height: number };
  readonly isSystemApp?: boolean;
  
  // Componente raiz do aplicativo que será instanciado no runtime
  readonly entryPoint?: string;
  readonly loadComponent: () => Promise<Type<unknown>>;
}
