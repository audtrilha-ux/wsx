import { TestBed } from '@angular/core/testing';
import { NativeFileSystemService } from './native-filesystem.service';
import { OsDatabaseService } from './os-database.service';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';

describe('NativeFileSystemService — File System & Sandbox Security', () => {
  let service: NativeFileSystemService;

  beforeEach(() => {
    const memory = new Map<string, unknown>();
    const mockDb = {
      getNamespace: () => ({
        get: async (key: string) => memory.get(key) || null,
        put: async (key: string, val: unknown) => { memory.set(key, val); },
        delete: async (key: string) => { memory.delete(key); }
      })
    };
    const mockDiagnostics = { info: () => true, warn: () => true, error: () => true };

    TestBed.configureTestingModule({
      providers: [
        NativeFileSystemService,
        { provide: OsDatabaseService, useValue: mockDb },
        { provide: DiagnosticsService, useValue: mockDiagnostics }
      ]
    });

    service = TestBed.inject(NativeFileSystemService);
  });

  it('should write and read files in virtual filesystem', async () => {
    const written = await service.writeFile('/app_data/app_pos/config.json', '{"theme":"dark"}');
    expect(written).toBe(true);

    const content = await service.readFile('/app_data/app_pos/config.json');
    expect(content).toBe('{"theme":"dark"}');
  });

  it('should enforce sandbox rules for non-system apps', () => {
    const allowed = service.checkSandboxPermission('app_pos', '/app_data/app_pos/data.txt', 'write');
    expect(allowed).toBe(true);

    const denied = service.checkSandboxPermission('app_pos', '/system/kernel.bin', 'write');
    expect(denied).toBe(false);
  });

  it('should watch file changes and trigger callback', async () => {
    let triggered = false;
    const unsub = service.watchFile('/temp/log.txt', (evt) => {
      triggered = true;
      expect(evt).toBe('change');
    });

    await service.writeFile('/temp/log.txt', 'Log line 1');
    expect(triggered).toBe(true);
    unsub();
  });
});
