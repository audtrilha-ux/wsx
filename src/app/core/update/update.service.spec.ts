import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UpdateService } from './update.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { MigrationEngineService } from '../storage/migration/migration-engine.service';

describe('UpdateService', () => {
  let service: UpdateService;
  let httpMock: HttpTestingController;
  let configService: ConfigurationService;

  afterEach(() => {
    httpMock.verify();
  });

  beforeEach(() => {
    console.log('[Test] beforeEach');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        UpdateService,
        ConfigurationService,
        {
          provide: MigrationEngineService,
          useValue: {
            getCurrentVersion: vi.fn().mockReturnValue(Promise.resolve(1))
          }
        }
      ]
    });

    service = TestBed.inject(UpdateService);
    httpMock = TestBed.inject(HttpTestingController);
    configService = TestBed.inject(ConfigurationService);
  });

  it('should be created with initial version', () => {
    expect(service).toBeTruthy();
    expect(service.getCurrentVersion()).toBeDefined();
  });

  it('should check for updates against distribution endpoint', async () => {
    const updatePromise = service.checkForUpdates();

    const req = httpMock.expectOne('/api/v1/distribution/os-releases');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        version: '2.0.0',
        channel: 'stable',
        releaseDate: '2026-09-20',
        releaseNotes: ['Versão 2.0.0 lançada'],
        minOsVersion: '1.0.0',
        isMandatory: false,
        checksum: 'ef74fcce1cc5a0afbd04d25d9bae6731a3ec2874120b5a9b2e53c089ed562e49'
      }
    ]);

    const result = await updatePromise;
    expect(result).not.toBeNull();
    expect(result?.version).toBe('2.0.0');
    expect(service.state().latestVersion).toBe('2.0.0');
  });

  it('should fail closed when applying update without trusted checksum (UPD-001)', async () => {
    const successPromise = service.applyUpdate('2.0.0');
    httpMock.expectOne('/api/v1/distribution/os-releases').flush([]);
    const success = await successPromise;

    expect(success).toBe(false);
    expect(service.state().status).toBe('failed');
    expect(service.state().errorMessage).toContain('checksum');
  });

  it('should fail closed when applying update with invalid checksum (UPD-001)', async () => {
    const successPromise = service.applyUpdate('2.0.0', '0000000000000000000000000000000000000000000000000000000000000000');
    httpMock.expectOne('/api/v1/distribution/os-releases').flush([]);
    const success = await successPromise;

    expect(success).toBe(false);
    expect(service.state().status).toBe('failed');
    expect(service.state().errorMessage).toContain('Checksum SHA-256 inválido');
  });

  it('should apply update and handle staging and persistence with verified checksum', async () => {
    const validSha256 = '6933f29e34df8176b09393906557dd2710c7a8e2c22f48755c3817c51fb7e0e8';
    
    const successPromise = service.applyUpdate('2.0.0', validSha256);
    httpMock.expectOne('/api/v1/distribution/os-releases').flush([{
        version: '2.0.0',
        checksum: validSha256
    }]);
    const success = await successPromise;

    expect(success).toBe(true);
    expect(service.getCurrentVersion()).toBe('2.0.0');
    expect(service.state().status).toBe('installed');
    expect(configService.get('systemVersion')).toBe('2.0.0');
  });

  it('should perform physical rollback on failure', async () => {
    await service.rollback('1.4.0', 'Falha no health-check');

    expect(service.getCurrentVersion()).toBe('1.4.0');
    expect(service.state().status).toBe('rolled_back');
    expect(configService.get('systemVersion')).toBe('1.4.0');
  });
});
