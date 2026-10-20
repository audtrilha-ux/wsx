import { Injectable, inject } from '@angular/core';
import { OsDatabaseService } from './os-database.service';
import { OsDatabaseNamespace } from '../../contracts/os/os-database.contract';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private osDb = inject(OsDatabaseService);
  private globalNs: OsDatabaseNamespace;

  constructor() {
    this.globalNs = this.osDb.getNamespace('system.global');
  }

  getNamespace(namespace: string): OsDatabaseNamespace {
    return this.osDb.getNamespace(namespace);
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return this.globalNs.get<T>(key);
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    return this.globalNs.put<T>(key, value);
  }

  async remove(key: string): Promise<void> {
    return this.globalNs.delete(key);
  }

  async clear(): Promise<void> {
    return this.globalNs.clear();
  }
}
