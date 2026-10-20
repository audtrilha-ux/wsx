import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { WindowManagerService } from './window-manager.service';
import { AppRuntimeService } from '../app-runtime/app-runtime.service';
import { OS_DATABASE_ADAPTER } from '../../contracts/os/os-database.contract';
import { DevelopmentVirtualAdapter } from '../storage/adapters/development-virtual.adapter';
import { OS_APPS } from '../app-runtime/app-registry.token';

describe('WindowManagerService', () => {
  let service: WindowManagerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        WindowManagerService,
        AppRuntimeService,
        { provide: OS_DATABASE_ADAPTER, useClass: DevelopmentVirtualAdapter },
        { provide: OS_APPS, useValue: [] }
      ]
    });
    service = TestBed.inject(WindowManagerService);
  });

  it('should start with no active windows', () => {
    expect(service).toBeTruthy();
    expect(service.windows().length).toBe(0);
    expect(service.topWindowId()).toBeNull();
  });

  it('should open a window, track zIndex, and focus it', () => {
    service.openWindow('app_settings', 'Configurações', 'settings');
    
    expect(service.windows().length).toBe(1);
    const win = service.windows()[0];
    expect(win.id).toBe('app_settings');
    expect(win.title).toBe('Configurações');
    expect(win.isMinimized).toBe(false);
    expect(service.topWindowId()).toBe('app_settings');

    // Open second window
    service.openWindow('calculator', 'Calculadora', 'calculate');
    expect(service.windows().length).toBe(2);
    expect(service.topWindowId()).toBe('calculator');

    // Focus first window again
    service.focusWindow('app_settings');
    expect(service.topWindowId()).toBe('app_settings');
  });

  it('should minimize, restore, and close windows correctly', () => {
    service.openWindow('app_settings', 'Configurações', 'settings');
    
    service.minimizeWindow('app_settings');
    expect(service.windows()[0].isMinimized).toBe(true);

    service.focusWindow('app_settings');
    expect(service.windows()[0].isMinimized).toBe(false);

    service.closeWindow('app_settings');
    expect(service.windows()[0].isClosing).toBe(true);

    service.removeWindow('app_settings');
    expect(service.windows().length).toBe(0);
  });

  it('should cascade windows neatly', () => {
    service.openWindow('app_settings', 'Configurações', 'settings');
    service.openWindow('calculator', 'Calculadora', 'calculate');
    service.cascadeWindows();

    const wins = service.windows();
    expect(wins[0].x).toBeDefined();
    expect(wins[1].x).toBeDefined();
    expect(wins[1].x!).toBeGreaterThan(wins[0].x!);
    expect(wins[1].y!).toBeGreaterThan(wins[0].y!);
  });
});
