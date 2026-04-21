/// <reference types="@types/google.accounts" />
import { Injectable, signal } from '@angular/core';

/**
 * Service to handle Google Drive API interactions using Google Identity Services.
 */
@Injectable({ providedIn: 'root' })
export class GoogleDriveService {
  // Replace this with your actual Client ID from Google Cloud Console
  private readonly CLIENT_ID = '185869293882-nt5ksu73r61t0djh2t9onstikmr8fqc3.apps.googleusercontent.com';
  private readonly SCOPE = 'https://www.googleapis.com/auth/drive.file';

  private accessToken = signal<string | null>(null);

  /**
   * Request an access token from the user.
   * This will open a popup window for the user to select their account and grant permission,
   * unless silent is true, in which case it will attempt to get a token without user interaction.
   */
  async login(silent: boolean = false): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPE,
        hint: silent ? 'none' : undefined,
        callback: (response: google.accounts.oauth2.TokenResponse) => {
          if (response.error) {
            if (silent && response.error === 'interaction_required') {
              // If silent login fails due to interaction being required, 
              // we proceed to an interactive login
              this.login(false).then(resolve).catch(reject);
            } else {
              reject(response);
            }
          } else {
            this.accessToken.set(response.access_token);
            resolve(response.access_token);
          }
        },
      });
      client.requestAccessToken();
    });
  }

  logout() {
    this.accessToken.set(null);
  }

  get isConnected() {
    return !!this.accessToken();
  }

  /**
   * Find or create the app-specific folder "Folio"
   */
  async getOrCreateFolder(): Promise<string> {
    const token = this.accessToken();
    if (!token) throw new Error('Not authenticated');

    // Search for existing folder
    const query = encodeURIComponent("name = 'Folio' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const searchResult = await searchResponse.json();

    if (searchResult.files && searchResult.files.length > 0) {
      return searchResult.files[0].id;
    }

    // Create new folder
    const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Folio',
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
    const token = this.accessToken();
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id, name, modifiedTime)`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const result = await response.json();
    return result.files || [];
  }

  /**
   * Upload a new file or update an existing one
   */
  async uploadFile(name: string, content: string, folderId: string, fileId?: string): Promise<string> {
    const token = this.accessToken();

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

    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });

    const result = await response.json();
    return result.id;
  }

  /**
   * Download file content
   */
  async downloadFile(fileId: string): Promise<string> {
    const token = this.accessToken();
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.text();
  }

  /**
   * Delete a file from Drive
   */
  async deleteFile(fileId: string): Promise<void> {
    const token = this.accessToken();
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}
