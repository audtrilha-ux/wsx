import { Routes } from '@angular/router';
import { hqAuthGuard } from '../../core/identity/hq-auth.guard';

export const hqOsRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./hq-login.component').then(m => m.HqLoginComponent)
  },
  {
    path: '',
    canActivate: [hqAuthGuard],
    loadComponent: () => import('./hq-os-shell.component').then(m => m.HqOsShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { 
        path: 'dashboard', 
        loadComponent: () => import('./apps/dashboard/dashboard.component').then(m => m.HqDashboardComponent) 
      },
      { 
        path: 'tenants', 
        loadComponent: () => import('./apps/tenants/tenants.component').then(m => m.HqTenantsComponent) 
      },
      { 
        path: 'billing', 
        loadComponent: () => import('./apps/billing/billing.component').then(m => m.HqBillingComponent) 
      },
      { 
        path: 'catalog', 
        loadComponent: () => import('./apps/catalog/catalog.component').then(m => m.HqCatalogComponent) 
      },
      { 
        path: 'marketplace', 
        loadComponent: () => import('./apps/marketplace/hq-marketplace.component').then(m => m.HqMarketplaceComponent) 
      },
      { 
        path: 'dev-hub', 
        loadComponent: () => import('./apps/dev-hub/dev-hub.component').then(m => m.HqDevHubComponent) 
      },
      { 
        path: 'telemetry', 
        loadComponent: () => import('./apps/telemetry/telemetry.component').then(m => m.HqTelemetryComponent) 
      }
    ]
  }
];
