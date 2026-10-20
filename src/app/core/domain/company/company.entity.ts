export interface CompanyBranch {
  id: string;
  name: string;
  code?: string;
  isMain?: boolean;
  isActive?: boolean;
  address?: string;
  phone?: string;
  receiptHeader?: string;
  receiptFooter?: string;
}

export class Company {
  constructor(
    public readonly id: string,
    public name: string,
    public balance: number,
    public installedApps: string[],
    public status: 'active' | 'suspended' = 'active',
    public plan: 'starter' | 'pro' | 'enterprise' = 'pro',
    public maxTerminals = 5,
    public activeTerminals = 1,
    public channel: 'stable' | 'beta' = 'stable',
    public osTargetVersion = '1.1.0-lts',
    public licenseExpiresAt = '2026-12-31',
    public branches?: CompanyBranch[]
  ) {}

  canAfford(price: number): boolean {
    return this.balance >= price;
  }

  hasApp(appId: string): boolean {
    return this.installedApps.includes(appId);
  }

  installApp(appId: string): void {
    if (this.hasApp(appId)) {
      throw new Error('App is already installed');
    }
    this.installedApps.push(appId);
  }

  uninstallApp(appId: string): void {
    this.installedApps = this.installedApps.filter(id => id !== appId);
  }
}
