import { Injectable, inject } from '@angular/core';
import { ClientApiClient } from '../../api/api-client';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UninstallAppUseCase {
  private api = inject(ClientApiClient);

  async execute(appId: string): Promise<void> {
    try {
      await firstValueFrom(this.api.delete(`/store/apps/${appId}`));
    } catch (error) {
      console.error('Uninstallation failed', error);
      throw error;
    }
  }
}
