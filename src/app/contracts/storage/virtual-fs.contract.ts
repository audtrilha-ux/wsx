/**
 * 3EATCRU OS - Virtual File System Contracts
 * Definições tipadas de nós do sistema de arquivos virtual da plataforma
 */

export interface VirtualFile {
  id: string;
  name: string;
  folderId: string;
  extension: 'txt' | 'json' | 'pdf' | 'csv' | 'png' | 'jpg' | 'log' | 'sql' | 'sqlite' | 'xlsx';
  sizeBytes: number;
  updatedAt: string;
  content: string;
  isSystem?: boolean;
}

export interface VirtualFolder {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  parentId: string | null;
  description: string;
}
