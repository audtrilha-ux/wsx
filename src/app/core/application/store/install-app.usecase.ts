import { Injectable, inject } from '@angular/core';
import { ClientApiClient } from '../../api/api-client';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class InstallAppUseCase {
  private api = inject(ClientApiClient);

  async execute(appId: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.post(`/store/apps/${appId}/install`, {}));
      return true;
    } catch (error) {
      console.error('Installation failed', error);
      return false;
    }
  }
}
