import { AppCatalogItem, StoreAppResponse } from './app-catalog.entity';

export interface StoreRepository {
  getAllApps(): Promise<StoreAppResponse[]>;
  getAppById(id: string): Promise<StoreAppResponse | null>;
  getCatalogApps?(): Promise<AppCatalogItem[]>;
}
