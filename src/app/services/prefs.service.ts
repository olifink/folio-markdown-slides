import { Injectable } from '@angular/core';

export interface AppPrefs {
  lastOpenFile: string | null;
  preferredTheme: 'default' | 'gaia' | 'uncover';
  appTheme: 'quiet' | 'clean';
  fontFamily: 'sans-serif' | 'serif';
  editorFontSize: number;
  darkMode: 'system' | 'light' | 'dark';
}

const DEFAULT_PREFS: AppPrefs = {
  lastOpenFile: null,
  preferredTheme: 'default',
  appTheme: 'quiet',
  fontFamily: 'sans-serif',
  editorFontSize: 16,
  darkMode: 'system',
};

@Injectable({ providedIn: 'root' })
export class PrefsService {
  private readonly DB_NAME = 'folio_prefs';
  private readonly STORE_NAME = 'prefs';
  private readonly KEY = 'current';

  private db: IDBDatabase | null = null;

  async init(): Promise<AppPrefs> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };

      request.onsuccess = async () => {
        this.db = request.result;
        const prefs = await this.get();
        resolve(prefs || DEFAULT_PREFS);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async get(): Promise<AppPrefs | null> {
    if (!this.db) return null;
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.STORE_NAME, 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(this.KEY);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async save(prefs: AppPrefs): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(prefs, this.KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
