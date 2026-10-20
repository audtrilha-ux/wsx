import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AppCatalogItem, StoreAppResponse } from '../../domain/store/app-catalog.entity';
import { StoreRepository } from '../../domain/store/store.repository';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiStoreRepository implements StoreRepository {
  private http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/store/apps';

  async getAllApps(): Promise<StoreAppResponse[]> {
    const data = await firstValueFrom(this.http.get<StoreAppResponse[]>(this.baseUrl));
    return data || [];
  }

  async getAppById(id: string): Promise<StoreAppResponse | null> {
    try {
      const data = await firstValueFrom(this.http.get<StoreAppResponse>(`${this.baseUrl}/${id}`));
      return data;
    } catch (e: unknown) {
      if (e instanceof HttpErrorResponse && e.status === 404) return null;
      throw e;
    }
  }

  async getCatalogApps(): Promise<AppCatalogItem[]> {
    const data = await this.getAllApps();
    return data.map(x => x.app);
  }
}
