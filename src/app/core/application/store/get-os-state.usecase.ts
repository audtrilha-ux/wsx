import { Injectable, inject } from '@angular/core';
import { Company } from '../../domain/company/company.entity';
import { AppCatalogItem } from '../../domain/store/app-manifest.entity';
import { CompanyRepository } from '../../domain/company/company.repository';
import { StoreRepository } from '../../domain/store/store.repository';
import { ApiCompanyRepository } from '../../infrastructure/api/api-company.repository';
import { ApiStoreRepository } from '../../infrastructure/api/api-store.repository';

export interface OsStateSnapshot {
  company: Company;
  availableApps: AppCatalogItem[];
}

@Injectable({ providedIn: 'root' })
export class GetOsStateUseCase {
  private companyRepository: CompanyRepository = inject(ApiCompanyRepository);
  private storeRepository: StoreRepository = inject(ApiStoreRepository);

  async execute(companyId: string): Promise<OsStateSnapshot> {
    const company = await this.companyRepository.getById(companyId);
    if (!company) throw new Error('Company not found');

    const storeApps = await this.storeRepository.getAllApps();
    const availableApps = storeApps.map(item => item.app);

    return {
      company,
      availableApps
    };
  }
}
