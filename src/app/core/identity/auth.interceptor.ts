import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { IdentityService } from './identity.service';
import { DeviceService } from '../device/device.service';
import { AUTH_AUTHORITY } from '../api/api-client';

function isExplicitHqRoute(url: string): boolean {
  if (url.startsWith('/api/v1/hq/')) return true;
  if (url.startsWith('/api/v1/auth/hq')) return true;
  if (url.startsWith('/api/v1/dev-hub')) return true;
  if (url.startsWith('/api/v1/os-releases')) return true;
  if (url.startsWith('/api/v1/tenants')) return true;
  if (url === '/api/v1/companies' || url === '/api/v1/companies/') return true;
  if (url.startsWith('/api/v1/billing/admin')) return true;
  if (url.includes('/hq-login')) return true;
  return false;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const identityService = inject(IdentityService);
  const deviceService = inject(DeviceService);

  // If calling an API route, attach appropriate authorization token and device metadata
  if (req.url.startsWith('/api/v1')) {
    const authority = req.context.get(AUTH_AUTHORITY);
    const hqToken = identityService.getHqToken();
    const clientToken = identityService.getClientToken();
    const dState = deviceService.deviceState();

    let chosenToken: string | null = null;

    if (authority === 'hq') {
      chosenToken = hqToken;
    } else if (authority === 'client') {
      chosenToken = clientToken;
    } else {
      // Auto-resolution:
      // 1. Check if the URL is an explicit HQ route
      const isHqRoute = isExplicitHqRoute(req.url);
      // 2. Check if current browser path is in /hq
      const isHqLocation = typeof window !== 'undefined' && window.location.pathname.startsWith('/hq');

      if (isHqRoute || isHqLocation) {
        chosenToken = hqToken;
      } else {
        chosenToken = clientToken;
      }
    }

    const headers: Record<string, string> = {};
    if (chosenToken) {
      headers['Authorization'] = `Bearer ${chosenToken}`;
    }
    if (dState.deviceId) {
      headers['x-device-id'] = dState.deviceId;
    }
    if (dState.fingerprintHash) {
      headers['x-device-fingerprint'] = dState.fingerprintHash;
    }
    if (dState.installationId) {
      headers['x-device-installation-id'] = dState.installationId;
    }

    const cloned = req.clone({
      setHeaders: headers
    });
    return next(cloned);
  }

  return next(req);
};
