import { Injectable, inject } from '@angular/core';
import { OsSdkService } from '../../sdk/os-sdk.service';
import { OsDatabaseNamespace } from '../../contracts/os/os-database.contract';
import { from, Observable } from 'rxjs';

export interface PublicProduct {
  name: string;
  price: number;
  desc: string;
}

export interface PublicSpaceData {
  companyId: string;
  companySlug: string;
  title: string;
  description: string;
  logo: string;
  templateId: 'restaurant' | 'retail' | 'business';
  themeColor: string;
  status: 'draft' | 'preview' | 'published';
  phone: string;
  email: string;
  address: string;
  hours: string;
  products: PublicProduct[];
  customDomain?: string;
  customDomainStatus?: 'active' | 'pending' | 'failed';
}

@Injectable({
  providedIn: 'root'
})
export class PublicSpaceService {
  private osSdk = inject(OsSdkService);
  private ns: OsDatabaseNamespace;

  constructor() {
    const app = this.osSdk.bind('app_public_space');
    this.ns = app.storage;
  }

  getSpaceConfig(companyId: string): Observable<PublicSpaceData> {
    return from(this.fetchConfig(companyId));
  }

  private async fetchConfig(companyId: string): Promise<PublicSpaceData> {
    const stored = await this.ns.get<PublicSpaceData>(`public_space_config_${companyId}`);
    if (stored) return stored;

    const defaultConfig: PublicSpaceData = {
      companyId,
      companySlug: companyId === 'comp_1' ? 'hamburgueria-artesanal' : companyId,
      title: companyId === 'comp_1' ? 'Hamburgueria Artesanal 3eatcru' : 'Meu Espaço Público',
      description: 'Site e cardápio digital oficial da nossa unidade.',
      logo: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=300',
      templateId: 'restaurant',
      themeColor: '#e11d48',
      status: 'published',
      phone: '(11) 98765-4321',
      email: 'contato@empresa.com.br',
      address: 'Av. Paulista, 1000 - São Paulo, SP',
      hours: 'Seg a Sáb: 18:00 às 23:30',
      products: [
        { name: 'Burger Clássico Artesanal', price: 34.90, desc: 'Pão brioche selado na manteiga, blend 180g, queijo cheddar e bacon crocante.' },
        { name: 'Smash Bacon Duplo', price: 28.50, desc: '2x blends de 90g ultra prensados, muito cheddar e cebola caramelizada.' }
      ]
    };
    await this.ns.put(`public_space_config_${companyId}`, defaultConfig);
    return defaultConfig;
  }

  async setCustomDomain(companyId: string, customDomain: string): Promise<{ success: boolean; status: 'active' | 'pending' | 'failed' }> {
    const config = await this.fetchConfig(companyId);
    const updated: PublicSpaceData = {
      ...config,
      customDomain,
      customDomainStatus: 'pending'
    };
    await this.persistConfig(companyId, updated);
    return { success: true, status: 'pending' };
  }

  saveSpaceConfig(companyId: string, data: PublicSpaceData): Observable<{ success: boolean }> {
    return from(this.persistConfig(companyId, data));
  }

  private async persistConfig(companyId: string, data: PublicSpaceData): Promise<{ success: boolean }> {
    await this.ns.put(`public_space_config_${companyId}`, data);
    const app = this.osSdk.bind('app_public_space');
    app.events.publish('public_space.updated', data);
    await app.sync.queueOperation('public_space.update', data);
    return { success: true };
  }
}

