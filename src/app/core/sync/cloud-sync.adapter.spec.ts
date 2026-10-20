import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CloudSyncAdapter } from './cloud-sync.adapter';
import { CloudSyncBatchPayload } from '../../contracts/sync/sync.contract';

describe('CloudSyncAdapter', () => {
  let adapter: CloudSyncAdapter;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CloudSyncAdapter,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    adapter = TestBed.inject(CloudSyncAdapter);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should initialize with disconnected state', () => {
    expect(adapter).toBeTruthy();
    expect(adapter.connectionState).toBe('disconnected');
  });

  it('should push batch operations to central cloud sync API and return acks', async () => {
    const payload: CloudSyncBatchPayload = {
      tenantId: 'comp_test_1',
      operations: [
        {
          id: 'op_1',
          idempotencyKey: 'idemp_1',
          tenantId: 'comp_test_1',
          action: 'sale.create',
          payload: { total: 100 },
          timestamp: new Date().toISOString()
        }
      ]
    };

    const pushPromise = adapter.pushBatch(payload);

    const req = httpTesting.expectOne('/api/v1/sync/batch');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.companyId).toBe('comp_test_1');
    expect(req.request.body.operations.length).toBe(1);

    req.flush({
      success: true,
      processedCount: 1,
      failedCount: 0,
      serverTimestamp: '2026-09-17T00:00:00.000Z',
      acks: [
        {
          opId: 'op_1',
          idempotencyKey: 'idemp_1',
          status: 'ACK',
          serverTimestamp: '2026-09-17T00:00:00.000Z'
        }
      ]
    });

    const result = await pushPromise;
    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(1);
    expect(adapter.connectionState).toBe('connected');
  });

  it('should set error state if batch sync fails', async () => {
    const payload: CloudSyncBatchPayload = {
      tenantId: 'comp_test_1',
      operations: []
    };

    const pushPromise = adapter.pushBatch(payload);

    const req = httpTesting.expectOne('/api/v1/sync/batch');
    req.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

    let didThrow = false;
    try {
      await pushPromise;
    } catch {
      didThrow = true;
    }
    expect(didThrow).toBe(true);
    expect(adapter.connectionState).toBe('error');
  });

  it('should check health and report connectivity', async () => {
    const healthPromise = adapter.checkHealth();

    const req = httpTesting.expectOne('/api/v1/telemetry/health');
    req.flush({ status: 'ok' });

    const healthy = await healthPromise;
    expect(healthy).toBe(true);
    expect(adapter.connectionState).toBe('connected');
  });
});
