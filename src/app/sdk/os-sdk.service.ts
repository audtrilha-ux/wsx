import { Injectable, inject } from '@angular/core';
import { OsContext } from '../contracts/os/os-context.contract';
import { AppRuntimeService } from '../core/app-runtime/app-runtime.service';
import { OsStateService } from '../os-state.service';
import { IdentityService } from '../core/identity/identity.service';

/**
 * 3EATCRU OS SDK (Section 7 do Master Architecture Blueprint)
 * 
 * Camada canônica de acesso para aplicativos.
 * Todo aplicativo no 3eatcru OS consome serviços do sistema exclusivamente
 * através deste SDK ou dos contratos de OS.
 * 
 * Apps NUNCA devem importar serviços internos do Kernel diretamente.
 */
@Injectable({
  providedIn: 'root'
})
export class OsSdkService {
  private appRuntime = inject(AppRuntimeService);
  private osState = inject(OsStateService);
  private identityService = inject(IdentityService);

  /**
   * Conecta um aplicativo ao OS Runtime, retornando o contexto isolado com storage,
   * barramento de eventos, periféricos de hardware, impressão e telemetria.
   */
  bind(appId: string): OsContext {
    const currentTenant = this.identityService.currentTenant();
    
    if (!currentTenant) {
      throw new Error(`[OS SDK] Falha ao iniciar app '${appId}': Nenhuma sessão de tenant (empresa) ativa encontrada no IdentityService.`);
    }

    return this.appRuntime.createContext(
      appId, 
      currentTenant.tenantId,
      currentTenant.tenantName,
      currentTenant.branchId,
      currentTenant.branchName
    );
  }

  /**
   * Obtém o identificador da empresa ativa no terminal.
   */
  getActiveCompanyId(): string {
    const currentTenant = this.identityService.currentTenant();
    if (!currentTenant) {
      throw new Error('[OS SDK] Nenhuma sessão ativa.');
    }
    return currentTenant.tenantId;
  }

  /**
   * Obtém o nome da empresa ativa no terminal.
   */
  getActiveCompanyName(): string {
    const currentTenant = this.identityService.currentTenant();
    if (!currentTenant) {
      throw new Error('[OS SDK] Nenhuma sessão ativa.');
    }
    return currentTenant.tenantName;
  }
}

