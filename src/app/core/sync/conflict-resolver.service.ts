import { Injectable } from '@angular/core';
import { IConflictResolver } from '../../contracts/sync/sync.contract';

export interface VersionedEntity {
  id: string;
  version?: number;
  updatedAt?: string | Date;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class ConflictResolverService implements IConflictResolver {
  resolve<T = unknown>(local: T, remote: T, strategy: 'append-only' | 'last-write-wins' | 'crdt'): T {
    switch (strategy) {
      case 'append-only':
        return this.resolveAppendOnly(local, remote);
      case 'last-write-wins':
        return this.resolveLastWriteWins(local, remote);
      case 'crdt':
        return this.resolveCrdt(local, remote);
      default:
        return this.resolveLastWriteWins(local, remote);
    }
  }

  private resolveAppendOnly<T>(local: T, remote: T): T {
    // Para coleções/arrays, concatena e remove duplicatas por identificador
    if (Array.isArray(local) && Array.isArray(remote)) {
      const merged = [...remote];
      for (const item of local) {
        const itemObj = item as Record<string, unknown>;
        const id = itemObj?.['id'] || itemObj?.['key'];
        if (id) {
          const exists = merged.some(m => (m as Record<string, unknown>)?.['id'] === id || (m as Record<string, unknown>)?.['key'] === id);
          if (!exists) merged.push(item);
        } else {
          merged.push(item);
        }
      }
      return merged as unknown as T;
    }
    // Para registro único append-only, se houver conflito preserva ambos ou prioritiza o mais recente
    return this.resolveLastWriteWins(local, remote);
  }

  private resolveLastWriteWins<T>(local: T, remote: T): T {
    const l = local as VersionedEntity;
    const r = remote as VersionedEntity;

    if (!l || !r) return (remote ?? local) as T;

    // Se houver número de versão explícito
    if (typeof l.version === 'number' && typeof r.version === 'number') {
      return (l.version >= r.version ? local : remote);
    }

    // Se houver data de atualização
    const localTime = l.updatedAt ? new Date(l.updatedAt).getTime() : 0;
    const remoteTime = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;

    if (localTime !== remoteTime) {
      return (localTime >= remoteTime ? local : remote);
    }

    // Em empate, prioriza a autoridade remota da Central
    return remote;
  }

  private resolveCrdt<T>(local: T, remote: T): T {
    // Implementação de LWW-Element-Set para objetos com campos parciais
    if (typeof local === 'object' && local !== null && typeof remote === 'object' && remote !== null) {
      const merged: Record<string, unknown> = { ...(remote as Record<string, unknown>) };
      const localObj = local as Record<string, unknown>;

      for (const key of Object.keys(localObj)) {
        if (merged[key] === undefined || merged[key] === null) {
          merged[key] = localObj[key];
        }
      }
      return merged as T;
    }
    return this.resolveLastWriteWins(local, remote);
  }
}
