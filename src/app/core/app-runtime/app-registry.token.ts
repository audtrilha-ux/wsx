import { InjectionToken } from '@angular/core';
import { AppManifest } from '../../contracts/apps/app-manifest.contract';

export const OS_APPS = new InjectionToken<AppManifest[]>('OS_APPS');
