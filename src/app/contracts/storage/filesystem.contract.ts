export type FilePermission = 'read' | 'write' | 'execute';

export interface FileEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  size: number;
  updatedAt: Date;
  mimeType?: string;
  permissions: FilePermission[];
}

export interface INativeFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<boolean>;
  createDirectory(path: string): Promise<boolean>;
  listDirectory(path: string): Promise<FileEntry[]>;
  deleteEntry(path: string): Promise<boolean>;
  watchFile(path: string, callback: (event: 'change' | 'delete') => void): () => void;
  importFile(file: File, destinationDirectory: string): Promise<string>;
  exportFile(path: string): Promise<Blob>;
  checkSandboxPermission(appId: string, path: string, accessType: 'read' | 'write'): boolean;
}
