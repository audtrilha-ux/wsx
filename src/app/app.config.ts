import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { OS_APPS } from './core/app-runtime/app-registry.token';
import { BUSINESS_APP_MANIFESTS } from './apps';
import { authInterceptor } from './core/identity/auth.interceptor';
import { OS_DATABASE_ADAPTER } from './contracts/os/os-database.contract';
import { DeviceService } from './core/device/device.service';
import { PlatformDatabaseAdapter } from './core/storage/adapters/platform-database.adapter';
import { IndexedDbDatabaseAdapter } from './core/storage/adapters/indexeddb-database.adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    {
      provide: OS_APPS,
      useValue: BUSINESS_APP_MANIFESTS
    },
    {
      provide: OS_DATABASE_ADAPTER,
      useFactory: (deviceService: DeviceService, platformAdapter: PlatformDatabaseAdapter, indexedDbAdapter: IndexedDbDatabaseAdapter) => {
        const platform = deviceService.deviceState().platform;
        if (platform === 'windows' || platform === 'android') {
          return platformAdapter;
        }
        return indexedDbAdapter;
      },
      deps: [DeviceService, PlatformDatabaseAdapter, IndexedDbDatabaseAdapter]
    }
  ],
};
