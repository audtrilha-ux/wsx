import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PaymentService } from './payment.service';
import { OsDatabaseService } from '../storage/os-database.service';
import { IdentityService } from '../identity/identity.service';
import { DeviceService } from '../device/device.service';
import { CapabilityBrokerService } from '../security/capability-broker.service';

class MockNamespace {
  private store = new Map<string, unknown>();

  constructor(public name: string) {}

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) || null;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async query<T>(): Promise<{ key: string; value: T }[]> {
    const list: { key: string; value: T }[] = [];
    this.store.forEach((value, key) => list.push({ key, value: value as T }));
    return list;
  }
}

describe('PaymentService', () => {
  let service: PaymentService;
  let httpMock: HttpTestingController;
  let namespaces: Map<string, MockNamespace>;

  beforeEach(() => {
    namespaces = new Map();

    const mockOsDbService = {
      getNamespace: (nsName: string) => {
        if (!namespaces.has(nsName)) {
          namespaces.set(nsName, new MockNamespace(nsName));
        }
        return namespaces.get(nsName)!;
      }
    };

    const mockIdentityService = {
      currentTenant: () => ({ tenantId: 'tenant_pay_test' })
    };

    const mockDeviceService = {
      deviceState: () => ({ companyId: 'tenant_pay_test' })
    };

    const mockCapabilityBroker = {
      enforceCapability: async () => Promise.resolve()
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        PaymentService,
        { provide: OsDatabaseService, useValue: mockOsDbService },
        { provide: IdentityService, useValue: mockIdentityService },
        { provide: DeviceService, useValue: mockDeviceService },
        { provide: CapabilityBrokerService, useValue: mockCapabilityBroker }
      ]
    });

    service = TestBed.inject(PaymentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('should create payment intent with idempotency check', async () => {
    const intent1 = await service.createIntent(150.00, 'credit_card', 'idempotency_123');
    expect(intent1).toBeTruthy();
    expect(intent1.amount).toBe(150.00);
    expect(intent1.status).toBe('created');

    // Tentar criar com a mesma chave de idempotência
    const intent2 = await service.createIntent(150.00, 'credit_card', 'idempotency_123');
    expect(intent2.id).toBe(intent1.id);
  });

  it('should process TEF authorization flow', async () => {
    const intent = await service.createIntent(85.50, 'tef', 'idem_tef_01');
    const authPromise = service.authorizeIntent(intent.id);

    // Permitir avanço dos microtasks assíncronos até a chamada HTTP
    await new Promise(resolve => setTimeout(resolve, 0));

    const req = httpMock.expectOne('/api/v1/payment/tef/authorize');
    expect(req.request.method).toBe('POST');
    req.flush({
      success: true,
      status: 'authorized',
      nsu: '987654',
      authorizationCode: 'AUTH_OK'
    });

    const authorized = await authPromise;
    expect(authorized.status).toBe('authorized');
    expect(authorized.nsu).toBe('987654');
  });

  it('should generate PIX QR code and process authorization', async () => {
    const intent = await service.createIntent(42.00, 'pix', 'idem_pix_01');
    expect(intent.qrCodePix).toBeDefined();
    expect(intent.pixCopiaECola).toContain('3EATCRU OS S/A');

    const authPromise = service.authorizeIntent(intent.id);

    // Permitir avanço dos microtasks assíncronos até a chamada HTTP
    await new Promise(resolve => setTimeout(resolve, 0));

    const req = httpMock.expectOne('/api/v1/payment/pix/verify');
    expect(req.request.method).toBe('POST');
    req.flush({
      success: true,
      status: 'authorized',
      authorizationCode: 'PIX_OK'
    });

    const authorized = await authPromise;
    expect(authorized.status).toBe('authorized');
  });

  it('should capture authorized payment', async () => {
    const intent = await service.createIntent(100.00, 'cash', 'idem_cash_01');
    await service.authorizeIntent(intent.id);

    const captured = await service.captureIntent(intent.id);
    expect(captured.status).toBe('captured');
  });

  it('should refund captured payment', async () => {
    const intent = await service.createIntent(100.00, 'cash', 'idem_refund_01');
    await service.authorizeIntent(intent.id);
    await service.captureIntent(intent.id);

    const refunded = await service.refundIntent(intent.id, 'Cliente desistiu');
    expect(refunded.status).toBe('refunded');
    expect(refunded.errorDetails).toContain('Cliente desistiu');
  });
});
