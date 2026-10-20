import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Company } from '../../domain/company/company.entity';
import { CompanyRepository } from '../../domain/company/company.repository';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiCompanyRepository implements CompanyRepository {
  private http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/companies';

  async getById(id: string): Promise<Company | null> {
    try {
      const data = await firstValueFrom(this.http.get<{
        id: string;
        name: string;
        balance: number;
        installedApps: string[];
        status?: 'active' | 'suspended';
        plan?: 'starter' | 'pro' | 'enterprise';
        maxTerminals?: number;
        activeTerminals?: number;
        channel?: 'stable' | 'beta';
        osTargetVersion?: string;
        licenseExpiresAt?: string;
      }>(`${this.baseUrl}/${id}`));
      return new Company(
        data.id,
        data.name,
        data.balance,
        data.installedApps,
        data.status || 'active',
        data.plan || 'pro',
        data.maxTerminals !== undefined ? data.maxTerminals : 5,
        data.activeTerminals !== undefined ? data.activeTerminals : 1,
        data.channel || 'stable',
        data.osTargetVersion || '1.1.0-lts',
        data.licenseExpiresAt || '2026-12-31'
      );
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'status' in e && e.status === 404) return null;
      throw e;
    }
  }

  async save(company: Company): Promise<void> {
    await firstValueFrom(this.http.put(`${this.baseUrl}/${company.id}`, {
      name: company.name,
      balance: company.balance,
      installedApps: company.installedApps,
      status: company.status,
      plan: company.plan,
      maxTerminals: company.maxTerminals,
      activeTerminals: company.activeTerminals,
      channel: company.channel,
      osTargetVersion: company.osTargetVersion,
      licenseExpiresAt: company.licenseExpiresAt
    }));
  }
}
