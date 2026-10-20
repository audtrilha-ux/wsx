import {Routes} from '@angular/router';
import { clientAuthGuard } from './core/identity/client-auth.guard';

export const routes: Routes = [
  { 
    path: '', 
    loadComponent: () => import('./ui/landing/landing.component').then(m => m.LandingComponent)
  },
  { 
    path: 'access', 
    loadComponent: () => import('./ui/access/access.component').then(m => m.AccessComponent)
  },
  {
    path: 'account/recovery',
    loadComponent: () => import('./ui/account-recovery/account-recovery.component').then(m => m.AccountRecoveryComponent)
  },
  {
    path: 'forgot-password',
    redirectTo: 'account/recovery'
  },
  { 
    path: 'onboarding', 
    loadComponent: () => import('./ui/onboarding/onboarding.component').then(m => m.OnboardingComponent)
  },
  {
    path: 'setup',
    redirectTo: 'onboarding'
  },
  { 
    path: 'os', 
    canActivate: [clientAuthGuard],
    loadComponent: () => import('./ui/os/os-shell.component').then(m => m.OsShellComponent)
  },
  { 
    path: 'hq', 
    loadChildren: () => import('./ui/hq-os/hq-os.routes').then(m => m.hqOsRoutes)
  },
  {
    path: 'marketplace',
    loadComponent: () => import('./ui/marketplace/marketplace.component').then(m => m.MarketplaceComponent)
  },
  { 
    path: 'public/:companySlug', 
    loadComponent: () => import('./ui/public-space/public-space.component').then(m => m.PublicSpaceComponent)
  },
  { path: '**', redirectTo: '' }
];
