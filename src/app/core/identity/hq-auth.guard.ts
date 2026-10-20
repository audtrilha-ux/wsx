import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { IdentityService } from './identity.service';

export const hqAuthGuard: CanActivateFn = async () => {
  const identityService = inject(IdentityService);
  const router = inject(Router);

  // If already authenticated in HQ Control Plane, grant access
  if (identityService.isHqAuthenticated()) {
    return true;
  }

  // Attempt to verify stored HQ session token with server
  const isValid = await identityService.verifyHqSession();
  if (isValid && identityService.isHqAuthenticated()) {
    return true;
  }

  // Redirect to HQ Login page if unauthenticated
  router.navigate(['/hq/login']);
  return false;
};
