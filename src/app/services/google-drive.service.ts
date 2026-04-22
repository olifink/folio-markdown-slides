/// <reference types="@types/google.accounts" />
import { Injectable, signal } from '@angular/core';

export class UnauthorizedError extends Error {
  constructor(public details?: any) {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

/**
 * Service to handle Google Drive API interactions using Google Identity Services.
 */
@Injectable({ providedIn: 'root' })
export class GoogleDriveService {
  // Replace this with your actual Client ID from Google Cloud Console
  private readonly CLIENT_ID = '185869293882-nt5ksu73r61t0djh2t9onstikmr8fqc3.apps.googleusercontent.com';
  private readonly SCOPE = 'https://www.googleapis.com/auth/drive.file';

  private accessToken = signal<string | null>(null);

  private async request(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.accessToken();
    if (!token) throw new UnauthorizedError('No token available');

    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`
    };

    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
      this.accessToken.set(null);
      throw new UnauthorizedError(response.statusText);
    }
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || response.statusText);
    }

    return response;
  }

  /**
   * Request an access token from the user.
   * @param prompt - 'none' for silent refresh (no popup), '' for default popup.
   */
  async login(prompt: 'none' | '' = ''): Promise<{ token: string, expires_in: number }> {
    return new Promise((resolve, reject) => {
      try {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: this.CLIENT_ID,
          scope: this.SCOPE,
          prompt: prompt,
          callback: (response: google.accounts.oauth2.TokenResponse) => {
            if (response.error) {
              // On error, also clear our local signal just in case
              this.accessToken.set(null);
              reject(response);
            } else {
              this.accessToken.set(response.access_token);
              resolve({
                token: response.access_token,
                expires_in: parseInt(response.expires_in)
              });
            }
          },
        });
        client.requestAccessToken();
      } catch (e) {
        reject(e);
      }
    });
  }

  setToken(token: string | null) {
    this.accessToken.set(token);
  }

  logout() {
    this.accessToken.set(null);
  }

  get isConnected() {
    return !!this.accessToken();
  }

  /**
   * Find or create the app-specific folder "Folio Markdown"
   */
  async getOrCreateFolder(): Promise<string> {
    const query = encodeURIComponent("name = 'Folio Markdown' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    const searchResponse = await this.request(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`);
    const searchResult = await searchResponse.json();

    if (searchResult.files && searchResult.files.length > 0) {
      return searchResult.files[0].id;
    }

    const createResponse = await this.request('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Folio Markdown',
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
    const createResult = await createResponse.json();
    return createResult.id;
  }

  /**
   * List files in the specified folder
   */
  async listFiles(folderId: string): Promise<any[]> {
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const response = await this.request(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id, name, modifiedTime)`);
    const result = await response.json();
    return result.files || [];
  }

  /**
   * Upload a new file or update an existing one
   */
  async uploadFile(name: string, content: string, folderId: string, fileId?: string): Promise<string> {
    const metadata = {
      name,
      mimeType: 'text/markdown',
      parents: fileId ? undefined : [folderId]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: 'text/markdown' }));

    const url = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const method = fileId ? 'PATCH' : 'POST';
    const response = await this.request(url, { method, body: form });
    const result = await response.json();
    return result.id;
  }

  /**
   * Download file content
   */
  async downloadFile(fileId: string): Promise<string> {
    const response = await this.request(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    return response.text();
  }

  /**
   * Delete a file from Drive
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.request(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE'
    });
  }
}
