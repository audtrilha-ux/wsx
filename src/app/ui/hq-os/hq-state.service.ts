import { Injectable, signal, computed, inject } from '@angular/core';
import { IdentityService } from '../../core/identity/identity.service';

export interface HqLog {
  time: Date;
  text: string;
  type: 'info' | 'success' | 'warn';
}

@Injectable({
  providedIn: 'root'
})
export class HqStateService {
  private identityService = inject(IdentityService);

  readonly isLoggedIn = computed(() => this.identityService.isHqAuthenticated());
  readonly logs = signal<HqLog[]>([]);

  async login(email: string, password: string): Promise<boolean> {
    if (!email || !password) {
      this.addLog('Informe e-mail e senha para autenticação no HQ OS.', 'warn');
      return false;
    }

    try {
      await this.identityService.hqLogin({ email, password });
      this.addLog('Administrador autenticado com sucesso no HQ OS via Central API.', 'success');
      return true;
    } catch (e: unknown) {
      const err = e as { error?: { error?: string }; message?: string };
      this.addLog(err?.error?.error || 'Falha na autenticação do HQ.', 'warn');
      return false;
    }
  }

  logout() {
    this.identityService.hqLogout();
    this.addLog('Sessão encerrada no HQ OS.', 'info');
  }

  addLog(text: string, type: 'info' | 'success' | 'warn' = 'info') {
    this.logs.update(list => [{ time: new Date(), text, type }, ...list]);
  }
}
