import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { DeviceService } from './device.service';
import { HardwareService } from '../hardware/hardware.service';
import { IdentityService } from '../identity/identity.service';

describe('DeviceService — Cryptographic Identity & Management', () => {
  let service: DeviceService;

  beforeEach(() => {
    localStorage.clear();

    const mockHardware = { peripherals: () => [] };
    const mockIdentity = { currentTenant: () => ({ tenantId: 'tenant_device_test' }) };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        DeviceService,
        { provide: HardwareService, useValue: mockHardware },
        { provide: IdentityService, useValue: mockIdentity }
      ]
    });

    service = TestBed.inject(DeviceService);
  });

  it('should initialize device state with untrusted level and pos station type', () => {
    expect(service).toBeTruthy();
    const state = service.deviceState();
    expect(state.trustLevel).toBe('untrusted');
    expect(state.stationType).toBe('pos');
  });

  it('should generate cryptographic keypair for terminal identity', async () => {
    const keyPair = await service.ensureCryptographicKeyPair();
    expect(keyPair.publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----');
    expect(keyPair.privateKeyPem).toContain('-----BEGIN PRIVATE KEY-----');

    const state = service.deviceState();
    expect(state.trustLevel).toBe('trusted');
  });

  it('should rotate device credentials and update token', async () => {
    const rotated = await service.rotateCredentials();
    expect(rotated.newDeviceToken).toContain('jwt_terminal_rot_');
    expect(rotated.newPublicKeyPem).toContain('PUBLIC KEY');
  });

  it('should revoke device and set status to revoked', async () => {
    await service.revokeDevice('Dispositivo roubado');
    const state = service.deviceState();
    expect(state.status).toBe('revoked');
    expect(state.trustLevel).toBe('untrusted');
    expect(service.isPaired()).toBe(false);
  });

  it('should configure station type and device group', () => {
    service.setStationType('kds', 'Cozinha_Central');
    const state = service.deviceState();
    expect(state.stationType).toBe('kds');
    expect(state.deviceGroup).toBe('Cozinha_Central');
  });
});
