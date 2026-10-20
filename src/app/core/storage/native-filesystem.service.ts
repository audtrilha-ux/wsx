import { Injectable, inject, signal } from '@angular/core';
import { INativeFileSystem, FileEntry } from '../../contracts/storage/filesystem.contract';
import { OsDatabaseService } from './os-database.service';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';

@Injectable({
  providedIn: 'root'
})
export class NativeFileSystemService implements INativeFileSystem {
  private osDb = inject(OsDatabaseService);
  private diagnostics = inject(DiagnosticsService);

  private watchers = new Map<string, Set<(event: 'change' | 'delete') => void>>();
  private readonly fileEntriesSignal = signal<Map<string, FileEntry>>(new Map());

  constructor() {
    this.initFileSystem();
  }

  private async initFileSystem(): Promise<void> {
    try {
      const ns = this.osDb.getNamespace('system.vfs');
      const stored = await ns.get<Record<string, { content: string; entry: FileEntry }>>('all_files');
      if (stored) {
        const map = new Map<string, FileEntry>();
        Object.values(stored).forEach(item => {
          map.set(item.entry.path, item.entry);
        });
        this.fileEntriesSignal.set(map);
      } else {
        // Inicializa diretórios raiz default
        await this.createDirectory('/app_data');
        await this.createDirectory('/prints');
        await this.createDirectory('/backups');
        await this.createDirectory('/temp');
      }
    } catch (err) {
      this.diagnostics.warn('[FileSystem] Erro ao carregar diretórios do VFS:', { error: String(err) });
    }
  }

  checkSandboxPermission(appId: string, path: string, accessType: 'read' | 'write'): boolean {
    // Sandbox: cada app só escreve em /app_data/{appId} ou /temp, a menos que seja um app do sistema
    if (path.startsWith('/temp') || path.startsWith(`/app_data/${appId}`)) {
      return true;
    }
    if (appId.startsWith('app_system') || appId.startsWith('3eatcru_core')) {
      return true;
    }
    if (accessType === 'read' && path.startsWith('/public')) {
      return true;
    }
    this.diagnostics.warn(`[FileSystem Sandbox] App '${appId}' negado ao tentar ${accessType} em '${path}'.`);
    return false;
  }

  private getNativeBridge(): { readFile?: (p: string) => Promise<string>; writeFile?: (p: string, c: string) => Promise<boolean> } | null {
    if (typeof window === 'undefined') return null;
    const win = window as unknown as { __3EATCRU_NATIVE_BRIDGE__?: { readFile?: (p: string) => Promise<string>; writeFile?: (p: string, c: string) => Promise<boolean> } };
    return win.__3EATCRU_NATIVE_BRIDGE__ || null;
  }

  async readFile(path: string): Promise<string> {
    const bridge = this.getNativeBridge();
    if (bridge?.readFile) {
      try {
        return await bridge.readFile(path);
      } catch (err) {
        this.diagnostics.warn(`[Native FS] Falha ao ler arquivo físico em '${path}', caindo para VFS:`, { error: String(err) });
      }
    }

    const ns = this.osDb.getNamespace('system.vfs');
    const stored = await ns.get<{ content: string; entry: FileEntry }>(`file_${path}`);
    if (!stored) {
      throw new Error(`[FileSystem] Arquivo não encontrado: ${path}`);
    }
    return stored.content;
  }

  async writeFile(path: string, content: string): Promise<boolean> {
    const bridge = this.getNativeBridge();
    if (bridge?.writeFile) {
      try {
        const success = await bridge.writeFile(path, content);
        if (success) {
          this.notifyWatchers(path, 'change');
          return true;
        }
      } catch (err) {
        this.diagnostics.warn(`[Native FS] Falha na escrita física em '${path}':`, { error: String(err) });
      }
    }

    const fileName = path.split('/').pop() || path;
    const entry: FileEntry = {
      path,
      name: fileName,
      isDirectory: false,
      size: new Blob([content]).size,
      updatedAt: new Date(),
      permissions: ['read', 'write']
    };

    const ns = this.osDb.getNamespace('system.vfs');
    await ns.put(`file_${path}`, { content, entry });

    this.fileEntriesSignal.update(map => {
      const updated = new Map(map);
      updated.set(path, entry);
      return updated;
    });

    this.notifyWatchers(path, 'change');
    return true;
  }

  async createDirectory(path: string): Promise<boolean> {
    const folderName = path.split('/').pop() || path;
    const entry: FileEntry = {
      path,
      name: folderName,
      isDirectory: true,
      size: 0,
      updatedAt: new Date(),
      permissions: ['read', 'write', 'execute']
    };

    const ns = this.osDb.getNamespace('system.vfs');
    await ns.put(`file_${path}`, { content: '', entry });

    this.fileEntriesSignal.update(map => {
      const updated = new Map(map);
      updated.set(path, entry);
      return updated;
    });

    return true;
  }

  async listDirectory(path: string): Promise<FileEntry[]> {
    const normalized = path.endsWith('/') ? path : `${path}/`;
    const all = Array.from(this.fileEntriesSignal().values());
    return all.filter(e => e.path.startsWith(normalized) && e.path !== path);
  }

  async deleteEntry(path: string): Promise<boolean> {
    const ns = this.osDb.getNamespace('system.vfs');
    await ns.delete(`file_${path}`);

    this.fileEntriesSignal.update(map => {
      const updated = new Map(map);
      updated.delete(path);
      return updated;
    });

    this.notifyWatchers(path, 'delete');
    return true;
  }

  watchFile(path: string, callback: (event: 'change' | 'delete') => void): () => void {
    if (!this.watchers.has(path)) {
      this.watchers.set(path, new Set());
    }
    this.watchers.get(path)!.add(callback);

    return () => {
      const set = this.watchers.get(path);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.watchers.delete(path);
        }
      }
    };
  }

  async importFile(file: File, destinationDirectory: string): Promise<string> {
    const content = await file.text();
    const destPath = `${destinationDirectory}/${file.name}`.replace(/\/\//g, '/');
    await this.writeFile(destPath, content);
    return destPath;
  }

  async exportFile(path: string): Promise<Blob> {
    const content = await this.readFile(path);
    return new Blob([content], { type: 'application/octet-stream' });
  }

  private notifyWatchers(path: string, event: 'change' | 'delete'): void {
    const set = this.watchers.get(path);
    if (set) {
      set.forEach(cb => {
        try {
          cb(event);
        } catch (err) {
          console.warn(`[FileSystem Watcher] Erro no callback de '${path}':`, err);
        }
      });
    }
  }
}
