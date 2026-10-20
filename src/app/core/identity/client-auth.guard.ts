import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { IdentityService } from './identity.service';

export const clientAuthGuard: CanActivateFn = async () => {
  const identityService = inject(IdentityService);
  const router = inject(Router);

  // If client session is active, grant access
  if (identityService.isAuthenticated()) {
    return true;
  }

  // Verify stored client session token with server
  const isValid = await identityService.verifySession();
  if (isValid && identityService.isAuthenticated()) {
    return true;
  }

  // If unauthenticated, redirect to access page
  router.navigate(['/access']);
  return false;
};
