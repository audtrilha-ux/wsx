import { Component, ChangeDetectionStrategy, input, inject, OnInit, OnDestroy, ComponentRef, ViewContainerRef, Type, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppRuntimeService } from './app-runtime.service';
import { WindowManagerService } from '../application/window-manager.service';
import { OsStateService } from '../../os-state.service';
import { IdentityService } from '../identity/identity.service';

@Component({
  selector: 'app-runtime-host',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<!-- Sandboxed Container Host -->`
})
export class AppRuntimeHostComponent implements OnInit, OnDestroy {
  appId = input.required<string>();
  component = input.required<Type<unknown>>();

  private viewContainerRef = inject(ViewContainerRef);
  private appRuntime = inject(AppRuntimeService);
  private osState = inject(OsStateService);
  private identityService = inject(IdentityService);
  private windowManager = inject(WindowManagerService);
  private componentRef?: ComponentRef<unknown>;

  constructor() {
    // Monitora as alterações de minimização e foco na janela para emitir eventos de onAppPause e onAppResume
    effect(() => {
      const targetAppId = this.appId();
      const wins = this.windowManager.windows();
      const win = wins.find(w => w.id === targetAppId);
      
      if (win && this.componentRef) {
        const instance = this.componentRef.instance as Record<string, unknown>;
        if (win.isMinimized) {
          this.appRuntime.updateInstanceState(targetAppId, 'paused');
          if (instance && typeof instance['onAppPause'] === 'function') {
            try {
              (instance['onAppPause'] as () => void)();
            } catch (err) {
              console.error(`[AppRuntimeHost] Erro ao invocar onAppPause para ${targetAppId}:`, err);
            }
          }
        } else {
          this.appRuntime.updateInstanceState(targetAppId, 'active');
          if (instance && typeof instance['onAppResume'] === 'function') {
            try {
              (instance['onAppResume'] as () => void)();
            } catch (err) {
              console.error(`[AppRuntimeHost] Erro ao invocar onAppResume para ${targetAppId}:`, err);
            }
          }
        }
      }
    });
  }

  ngOnInit() {
    this.viewContainerRef.clear();
    const compClass = this.component() as Type<unknown>;
    
    // Instanciação dinâmica do componente de negócio dentro do container de renderização do OS
    this.componentRef = this.viewContainerRef.createComponent(compClass);

    // Constrói o contexto em sandbox seguro para o aplicativo
    const company = this.osState.company();
    const tenant = this.identityService.currentTenant();
    const ctx = this.appRuntime.createContext(
      this.appId(),
      company.id || tenant?.tenantId || 'company_1',
      company.name || tenant?.tenantName || '3eatcru Company',
      tenant?.branchId,
      tenant?.branchName
    );

    // Invoca gancho onAppInit se declarado pelo desenvolvedor do aplicativo
    const instance = this.componentRef.instance as Record<string, unknown>;
    if (instance && typeof instance['onAppInit'] === 'function') {
      try {
        (instance['onAppInit'] as (context: unknown) => void)(ctx);
      } catch (err) {
        console.error(`[AppRuntimeHost] Erro ao invocar onAppInit para aplicativo ${this.appId()}:`, err);
      }
    }
  }

  ngOnDestroy() {
    if (this.componentRef) {
      // Invoca gancho de encerramento onAppDestroy antes de descartar do DOM
      const instance = this.componentRef.instance as Record<string, unknown>;
      if (instance && typeof instance['onAppDestroy'] === 'function') {
        try {
          (instance['onAppDestroy'] as () => void)();
        } catch (err) {
          console.error(`[AppRuntimeHost] Erro ao invocar onAppDestroy para aplicativo ${this.appId()}:`, err);
        }
      }
      this.appRuntime.terminateApp(this.appId());
      this.componentRef.destroy();
      this.componentRef = undefined;
    }
  }
}
