export type AppCategory = 
  | 'SALES' 
  | 'OPERATIONS'
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
  | 'MESSAGING'
  | 'STOREFRONT';

export type StoreAppState = 
  | 'AVAILABLE' 
  | 'INSTALLED' 
  | 'UPDATE_AVAILABLE' 
  | 'INCOMPATIBLE' 
  | 'SUSPENDED' 
  | 'EXPIRED' 
  | 'REVOKED';

export type PricingModel = 
  | 'FREE' 
  | 'ONE_TIME' 
  | 'SUBSCRIPTION_MONTHLY' 
  | 'SUBSCRIPTION_ANNUAL' 
  | 'USAGE_BASED';

export type LifecycleStatus = 
  | 'DRAFT' 
  | 'IN_REVIEW' 
  | 'APPROVED' 
  | 'PUBLISHED' 
  | 'SUSPENDED' 
  | 'RETIRED' 
  | 'REJECTED';

export interface AppRelease {
  version: string;
  minOsVersion?: string;
  releaseChannel: 'stable' | 'beta' | 'canary';
  checksum?: string;
  releasedAt?: string;
}

export interface AppCatalogItem {
  id: string;
  name: string;
  description: string;
  developer: string;
  publisher?: string;
  category: AppCategory | string;
  icon: string;
  pricing: {
    model: PricingModel;
    amount: number;
    currency: 'BRL';
  };
  lifecycle: {
    status: LifecycleStatus;
    publishedAt?: string;
  };
  currentRelease?: AppRelease;
  permissions: string[];
  capabilities: string[];
  dependencies: {
    id: string;
    versionRange: string;
  }[];
  isSystemApp: boolean;
}

export interface AppEntitlementView {
  id: string;
  companyId: string;
  appId: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';
  pricingModel: PricingModel;
  amount: number;
  currency: 'BRL';
  createdAt: string;
  expiresAt?: string;
  licenseKey?: string;
}

export interface AppInstallationView {
  id: string;
  companyId: string;
  deviceId?: string;
  appId: string;
  installedVersion: string;
  status: 'INSTALLED' | 'DEPRECATED' | 'BLOCKED';
  installedAt: string;
  updatedAt?: string;
}

export interface StoreAppResponse {
  app: AppCatalogItem;
  status: StoreAppState;
  installedVersion: string | null;
  entitlement: AppEntitlementView | null;
  installation: AppInstallationView | null;
}
