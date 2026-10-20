import { TestBed } from '@angular/core/testing';
import { PlatformDatabaseAdapter } from './platform-database.adapter';
import { SqliteNativeAdapter } from './sqlite-native.adapter';
import { IndexedDbDatabaseAdapter } from './indexeddb-database.adapter';
import { DevelopmentVirtualAdapter } from './development-virtual.adapter';

describe('PlatformDatabaseAdapter (DatabaseAdapterResolver)', () => {
  let adapter: PlatformDatabaseAdapter;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PlatformDatabaseAdapter,
        SqliteNativeAdapter,
        IndexedDbDatabaseAdapter,
        DevelopmentVirtualAdapter
      ]
    });
    adapter = TestBed.inject(PlatformDatabaseAdapter);
  });

  it('should be created', () => {
    expect(adapter).toBeTruthy();
  });

  it('should store and retrieve data', async () => {
    await adapter.put('testNs', 'key1', { value: 123 });
    const result = await adapter.get<{ value: number }>('testNs', 'key1');
    expect(result?.value).toBe(123);
  });

  it('should process cross-namespace transactions atomically', async () => {
    await adapter.transaction('ns1', async (tx) => {
      await tx.put('doc1', { v: 1 });
      await tx.put('doc2', { v: 2 }, 'ns2'); // cross-namespace
    });

    const r1 = await adapter.get<{ v: number }>('ns1', 'doc1');
    const r2 = await adapter.get<{ v: number }>('ns2', 'doc2');

    expect(r1?.v).toBe(1);
    expect(r2?.v).toBe(2);
  });

  it('should rollback transaction on error', async () => {
    try {
      await adapter.transaction('ns1', async (tx) => {
        await tx.put('doc3', { v: 3 });
        throw new Error('Abort transaction');
      });
    } catch (_e: unknown) { console.log(_e); }

    const r3 = await adapter.get<{ v: number }>('ns1', 'doc3');
    expect(r3).toBeNull(); // Should not exist due to rollback
  });

  it('should backup and restore database records with encryption', async () => {
    await adapter.put('backupNs', 'k1', { item: 'Secret 1' });
    await adapter.put('backupNs', 'k2', { item: 'Secret 2' });

    const encryptedBlob = await adapter.backup('MyStrongPassphrase123!');
    expect(encryptedBlob).toBeTruthy();
    expect(encryptedBlob?.type).toBe('application/json');

    let rawText: string;
    if (typeof encryptedBlob!.text === 'function') {
      rawText = await encryptedBlob!.text();
    } else if (typeof encryptedBlob!.arrayBuffer === 'function') {
      const buffer = await encryptedBlob!.arrayBuffer();
      rawText = new TextDecoder().decode(buffer);
    } else {
      rawText = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(encryptedBlob!);
      });
    }
    const envelope = JSON.parse(rawText);
    expect(envelope.encrypted).toBe(true);
    expect(envelope.ciphertextHex).toBeTruthy();

    // Clear and restore
    await adapter.clear('backupNs');
    const cleared = await adapter.get('backupNs', 'k1');
    expect(cleared).toBeNull();

    const restoreResult = await adapter.restore(encryptedBlob!, 'MyStrongPassphrase123!');
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.recordCount).toBeGreaterThanOrEqual(2);

    const restoredK1 = await adapter.get<{ item: string }>('backupNs', 'k1');
    expect(restoredK1?.item).toBe('Secret 1');
  });
});
