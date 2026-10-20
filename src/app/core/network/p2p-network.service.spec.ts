import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { P2PNetworkService } from './p2p-network.service';
import { OsDatabaseService } from '../storage/os-database.service';
import { IdentityService } from '../identity/identity.service';
import { DeviceService } from '../device/device.service';

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

describe('P2PNetworkService', () => {
  let service: P2PNetworkService;
  let httpMock: HttpTestingController;
  let namespaces: Map<string, MockNamespace>;

  beforeEach(() => {
    TestBed.resetTestingModule();
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
      currentTenant: () => ({ tenantId: 'tenant_p2p_test' })
    };

    const mockDeviceService = {
      deviceState: () => ({ deviceId: 'dev_local_master', companyId: 'tenant_p2p_test' })
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        P2PNetworkService,
        { provide: OsDatabaseService, useValue: mockOsDbService },
        { provide: IdentityService, useValue: mockIdentityService },
        { provide: DeviceService, useValue: mockDeviceService }
      ]
    });

    service = TestBed.inject(P2PNetworkService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created and discover local peers', async () => {
    const discoverPromise = service.discoverPeers();

    const req = httpMock.expectOne('/api/v1/p2p/discover');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: 'peer_kds_02',
        deviceName: 'KDS Cozinha 2',
        ipAddress: '192.168.1.150',
        port: 3000,
        role: 'kds',
        status: 'discovered',
        capabilities: ['kds']
      }
    ]);

    const peers = await discoverPromise;
    expect(peers.length).toBeGreaterThan(0);
    expect(peers.some(p => p.id === 'peer_kds_02')).toBe(true);
  });

  it('should pair peer using pin authentication', async () => {
    const discoverPromise = service.discoverPeers();
    const req = httpMock.expectOne('/api/v1/p2p/discover');
    req.flush([
      { id: 'peer_kds_01', deviceName: 'Cozinha KDS Terminal 01', ipAddress: '192.168.1.120', port: 3000, role: 'kds', status: 'discovered', capabilities: ['kds'] }
    ]);
    await discoverPromise;

    const pairPromise = service.pairPeer('peer_kds_01', '123456');

    const pairReq = httpMock.expectOne('/api/v1/p2p/pair');
    expect(pairReq.request.method).toBe('POST');
    pairReq.flush({ success: true, sessionToken: 'sess_123' });

    const success = await pairPromise;
    expect(success).toBe(true);

    const peer = service.getKnownPeers().find(p => p.id === 'peer_kds_01');
    expect(peer?.status).toBe('paired');
  });

  it('should start P2P session and send direct messages', async () => {
    const discoverPromise = service.discoverPeers();
    const req = httpMock.expectOne('/api/v1/p2p/discover');
    req.flush([
      { id: 'peer_kds_01', deviceName: 'Cozinha KDS Terminal 01', ipAddress: '192.168.1.120', port: 3000, role: 'kds', status: 'discovered', capabilities: ['kds'] }
    ]);
    await discoverPromise;

    const pairPromise = service.pairPeer('peer_kds_01', '123456');
    const pairReq = httpMock.expectOne('/api/v1/p2p/pair');
    pairReq.flush({ success: true });
    await pairPromise;

    await service.startSession('peer_kds_01');
    expect(service.networkState).toBe('p2p_connected');

    const msgPromise = service.sendDirectMessage('peer_kds_01', 'order.new', { orderId: 'ord_99' });

    const msgReq = httpMock.expectOne('/api/v1/p2p/message');
    expect(msgReq.request.method).toBe('POST');
    msgReq.flush({ ok: true });

    const sent = await msgPromise;
    expect(sent).toBe(true);
  });
});
