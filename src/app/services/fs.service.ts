import { Injectable } from '@angular/core';
import FS from '@isomorphic-git/lightning-fs';

@Injectable({ providedIn: 'root' })
export class FsService {
  private readonly fs = new FS('folio');
  private readonly promises = this.fs.promises;

  async init(): Promise<void> {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      console.log(`[Storage] Persisted storage granted: ${isPersisted}`);
    }

    try {
      await this.promises.mkdir('/documents');
    } catch (e: any) {
      if (e.code !== 'EEXIST') throw e;
    }
  }

  async listFiles(): Promise<string[]> {
    const files = await this.promises.readdir('/documents');
    return files.filter(f => f.endsWith('.md'));
  }

  async readFile(filename: string): Promise<string> {
    const data = await this.promises.readFile(`/documents/${filename}`, { encoding: 'utf8' });
    return data as string;
  }

  async writeFile(filename: string, content: string): Promise<void> {
    await this.promises.writeFile(`/documents/${filename}`, content, { 
      encoding: 'utf8',
      mode: 0o666 
    });
  }

  async deleteFile(filename: string): Promise<void> {
    await this.promises.unlink(`/documents/${filename}`);
  }

  async renameFile(oldName: string, newName: string): Promise<void> {
    await this.promises.rename(`/documents/${oldName}`, `/documents/${newName}`);
  }

  async exists(filename: string): Promise<boolean> {
    try {
      await this.promises.stat(`/documents/${filename}`);
      return true;
    } catch {
      return false;
    }
  }

  async getFileStats(filename: string): Promise<{ mtimeMs: number } | null> {
    try {
      const stats = await this.promises.stat(`/documents/${filename}`);
      return { mtimeMs: stats.mtimeMs };
    } catch {
      return null;
    }
  }
}
