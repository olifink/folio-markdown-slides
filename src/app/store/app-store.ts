import { Injectable, computed, inject, signal, effect } from '@angular/core';
import { FsService } from '../services/fs.service';
import { PrefsService, AppPrefs } from '../services/prefs.service';
import { GoogleDriveService, UnauthorizedError } from '../services/google-drive.service';

export type ColorScheme = 'system' | 'light' | 'dark';

const COLOR_SCHEME_CYCLE: ColorScheme[] = ['system', 'light', 'dark'];

export const SAMPLE_MARKDOWN = `---
marp: true
---

# Hello, Folio

Folio is a local-first Markdown text and slide editor.

---

## Writing slides is simple

Separate each slide with \`---\` and write Markdown.

- **Bold** and *italic* text
- \`Inline code\`
- Images, links, and more

---

## Themes

Folio Slides supports three built-in Marp themes:
\`default\`, \`gaia\`, and \`uncover\` as well as all 
[MarpX themes](https://github.com/cunhapaulo/MarpX).

---

## Present

Hit the **▶ Present** button to go full-screen.
`;

export const SAMPLE_PROSE = `# Hello, Folio

Folio is a local-first Markdown text and slide editor.

## My First Document

Write your content here. Use standard Markdown — headings, lists, **bold**, *italic*, footnotes[^1], tables, and code blocks all work.

---

## Page Two

Use \`---\` to start a new page. It works the same way as in slide mode.

[^1]: Footnotes render at the bottom of the page.
`;

@Injectable({ providedIn: 'root' })
export class AppStore {
  private readonly fs = inject(FsService);
  private readonly prefsService = inject(PrefsService);
  private readonly drive = inject(GoogleDriveService);

  readonly fileList = signal<string[]>([]);
  readonly currentFile = signal<string | null>(null);
  readonly currentMarkdown = signal('');
  readonly currentSlideIndex = signal(0);
  readonly slideCount = signal(1);
  readonly proseViewMode = signal<'flow' | 'paged'>('flow');

  readonly documentType = computed<'slides' | 'prose'>(() => {
    const file = this.currentFile();
    if (file?.endsWith('.slides.md')) return 'slides';

    // Fallback to content detection for older files or manual renaming
    const md = this.currentMarkdown();
    const frontmatterMatch = md.trimStart().match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (frontmatterMatch && /^marp:\s*true\s*$/m.test(frontmatterMatch[1])) {
      return 'slides';
    }
    return 'prose';
  });

  readonly isDirty = signal(false);
  readonly prefs = signal<AppPrefs>({
    lastOpenFile: null,
    lastTab: 0,
    preferredTheme: 'default',
    appTheme: 'quiet',
    fontFamily: 'sans-serif',
    editorFontSize: 16,
    darkMode: 'system',
    safariWarningDismissed: false,
    googleDriveFolderId: null,
    googleDriveSyncEnabled: false,
    googleDriveToken: null,
    googleDriveTokenExpiresAt: null,
    lastSyncTime: null,
    lastSyncError: null,
  });

  readonly selectedTab = signal(0);

  readonly colorScheme = computed(() => this.prefs().darkMode);
  readonly appTheme = computed(() => this.prefs().appTheme);
  readonly editorWidth = signal(500);
  readonly previewVisible = signal(true);

  readonly syncStatus = signal<'idle' | 'syncing' | 'error'>('idle');
  readonly driveConnected = computed(() => this.drive.isConnected);
  readonly driveEnabled = computed(() => this.prefs().googleDriveSyncEnabled);

  constructor() {
    // Auto-save effect (local storage only)
    effect(async () => {
      const markdown = this.currentMarkdown();
      const file = this.currentFile();
      if (file && this.isDirty()) {
        await this.fs.writeFile(file, markdown);
        this.isDirty.set(false);
      }
    });
  }

  async init(): Promise<void> {
    await this.fs.init();
    const prefs = await this.prefsService.init();
    this.prefs.set(prefs);
    this.selectedTab.set(prefs.lastTab);

    // Initialize Drive connection from persisted token if valid
    if (prefs.googleDriveToken && prefs.googleDriveTokenExpiresAt) {
      if (Date.now() < prefs.googleDriveTokenExpiresAt) {
        this.drive.setToken(prefs.googleDriveToken);
      }
    }

    await this.refreshList();
    const list = this.fileList();

    if (prefs.lastOpenFile && list.includes(prefs.lastOpenFile)) {
      await this.openFile(prefs.lastOpenFile);
    } else if (list.length > 0) {
      await this.openFile(list[0]);
    } else {
      await this.createFile('Welcome.md', SAMPLE_PROSE);
    }
  }

  async connectDrive(): Promise<void> {
    try {
      const result = await this.drive.login();
      const folderId = await this.drive.getOrCreateFolder();
      this.updatePrefs({ 
        googleDriveFolderId: folderId, 
        googleDriveSyncEnabled: true,
        googleDriveToken: result.token,
        googleDriveTokenExpiresAt: Date.now() + (result.expires_in * 1000)
      });
    } catch (e) {
      console.error('Failed to connect to Google Drive', e);
      this.syncStatus.set('error');
    }
  }

  async disconnectDrive(): Promise<void> {
    this.drive.logout();
    this.updatePrefs({
      googleDriveFolderId: null,
      googleDriveSyncEnabled: false,
      googleDriveToken: null,
      googleDriveTokenExpiresAt: null,
      lastSyncTime: null,
    });
    // Remove manifest
    try {
      if (await this.fs.exists('.sync-manifest.json')) {
        await this.fs.deleteFile('.sync-manifest.json');
      }
    } catch (e) {
      console.warn('Failed to delete sync manifest', e);
    }
  }

  async syncNow(): Promise<void> {
    this.updatePrefs({ lastSyncError: null });
    this.syncStatus.set('syncing');

    const expiresAt = this.prefs().googleDriveTokenExpiresAt;
    const isExpired = expiresAt && Date.now() > (expiresAt - 60000);
    const lastError = this.prefs().lastSyncError || '';
    const needsInteraction = lastError.includes('interaction_required') || lastError.includes('immediate_failed');

    try {
      // For manual sync, if we're not connected or expired, go straight to re-auth.
      // We skip the silent refresh attempt here because on mobile it often causes the 
      // subsequent interactive popup to be blocked by the browser's popup blocker
      // (as the user gesture context is lost during the silent await).
      if (!this.drive.isConnected || isExpired || needsInteraction) {
        console.log('[Sync] Token missing, expired, or interaction required. Triggering popup...');
        
        const result = await this.drive.login(''); // Trigger interactive popup immediately
        
        this.updatePrefs({
          googleDriveToken: result.token,
          googleDriveTokenExpiresAt: Date.now() + (result.expires_in * 1000),
          lastSyncError: null
        });
      }
      
      await this.performSync();
    } catch (e: any) {
      console.error('Manual sync failed', e);
      this.syncStatus.set('error');
      
      const msg = e.error_description || e.error || e.message || 'Unknown error';
      this.drive.logout();
      this.updatePrefs({ 
        googleDriveToken: null,
        googleDriveTokenExpiresAt: null,
        lastSyncError: `Sync failed: ${msg}. Click 'Sync Now' to reconnect.` 
      });
    } finally {
      if (this.syncStatus() === 'syncing') {
        this.syncStatus.set('idle');
      }
    }
  }

  async openFile(filename: string): Promise<void> {
    const content = await this.fs.readFile(filename);
    this.currentFile.set(filename);
    this.currentMarkdown.set(content);
    this.isDirty.set(false);
    this.updatePrefs({ lastOpenFile: filename });
  }

  /**
   * Extracted core sync logic. 
   * If targetFile is provided, only that specific file is synced (Quick Sync).
   * Otherwise, a full sync including deletions is performed.
   */
  private async performSync(targetFile?: string, isRetry = false): Promise<void> {
    try {
      const folderId = this.prefs().googleDriveFolderId || (await this.drive.getOrCreateFolder());
      if (!this.prefs().googleDriveFolderId) {
        this.updatePrefs({ googleDriveFolderId: folderId });
      }

      // 1. Load data
      let manifest: Record<string, { id: string, lm: number, rm: number }> = {};
      try {
        if (await this.fs.exists('.sync-manifest.json')) {
          const raw = JSON.parse(await this.fs.readFile('.sync-manifest.json'));
          // Migrate old format (string) to new format (object)
          for (const key in raw) {
            if (typeof raw[key] === 'string') {
              manifest[key] = { id: raw[key], lm: 0, rm: 0 };
            } else {
              manifest[key] = raw[key];
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load sync manifest', e);
      }

      const remoteFiles = await this.drive.listFiles(folderId);
      const remoteMap = new Map(remoteFiles.map((f) => [f.name, f]));
      const nextManifest: Record<string, { id: string, lm: number, rm: number }> = { ...manifest };

      // 2. Deletion Sync (Full sync only)
      if (!targetFile) {
        for (const [filename, entry] of Object.entries(manifest)) {
          const isLocal = await this.fs.exists(filename);
          const isRemote = remoteMap.has(filename);

          if (!isLocal && isRemote) {
            console.log(`[Sync] Deleting remote file: ${filename}`);
            await this.drive.deleteFile(entry.id);
            remoteMap.delete(filename);
            delete nextManifest[filename];
          } else if (isLocal && !isRemote) {
            console.log(`[Sync] Deleting local file: ${filename}`);
            await this.fs.deleteFile(filename);
            delete nextManifest[filename];
          }
        }
      }

      // 3. Update / Create Sync
      const localFiles = targetFile ? [targetFile] : await this.fs.listFiles();
      
      for (const filename of localFiles) {
        const localStats = await this.fs.getFileStats(filename);
        if (!localStats) continue; 

        const remoteFile = remoteMap.get(filename);
        const entry = manifest[filename];
        const localMtime = localStats.mtimeMs;

        if (remoteFile) {
          const remoteMtime = new Date(remoteFile.modifiedTime).getTime();
          const driveId = remoteFile.id;

          // 3-way sync check
          const localChanged = !entry || localMtime > (entry.lm + 2000);
          const remoteChanged = !entry || remoteMtime > (entry.rm + 2000);

          if (localChanged && remoteChanged && entry) {
            // Conflict! For Quiet Tech, remote wins to preserve stability
            console.log(`[Sync] Conflict detected for ${filename}, remote wins`);
            const content = await this.drive.downloadFile(driveId);
            await this.fs.writeFile(filename, content);
            const newStats = await this.fs.getFileStats(filename);
            nextManifest[filename] = { id: driveId, lm: newStats?.mtimeMs || Date.now(), rm: remoteMtime };
            
            if (filename === this.currentFile()) {
              this.currentMarkdown.set(content);
              this.isDirty.set(false);
            }
          } else if (localChanged) {
            console.log(`[Sync] Uploading newer local: ${filename}`);
            const content = await this.fs.readFile(filename);
            const newId = await this.drive.uploadFile(filename, content, folderId, driveId);
            // After upload, we need the new remote timestamp
            // For simplicity, we'll use "now" as the rm, or we can just let the next sync fix it.
            // Google doesn't return modifiedTime in the simple upload response.
            // We'll set lm to current to prevent re-upload.
            nextManifest[filename] = { id: newId, lm: localMtime, rm: Date.now() + 5000 };
          } else if (remoteChanged) {
            console.log(`[Sync] Downloading newer remote: ${filename}`);
            const content = await this.drive.downloadFile(driveId);
            await this.fs.writeFile(filename, content);
            const newStats = await this.fs.getFileStats(filename);
            nextManifest[filename] = { id: driveId, lm: newStats?.mtimeMs || Date.now(), rm: remoteMtime };

            if (filename === this.currentFile()) {
              this.currentMarkdown.set(content);
              this.isDirty.set(false);
            }
          } else {
            // No changes, but ensure manifest has timestamps if it was a legacy entry
            nextManifest[filename] = { id: driveId, lm: entry?.lm || localMtime, rm: entry?.rm || remoteMtime };
          }
          remoteMap.delete(filename);
        } else if (!entry) {
          // New local file
          console.log(`[Sync] Uploading new file: ${filename}`);
          const content = await this.fs.readFile(filename);
          const driveId = await this.drive.uploadFile(filename, content, folderId);
          nextManifest[filename] = { id: driveId, lm: localMtime, rm: Date.now() + 5000 };
        }
      }

      // 4. Remote Discovery (Full sync only)
      if (!targetFile) {
        for (const [filename, remoteFile] of remoteMap.entries()) {
          console.log(`[Sync] Downloading new remote: ${filename}`);
          const content = await this.drive.downloadFile(remoteFile.id);
          await this.fs.writeFile(filename, content);
          const newStats = await this.fs.getFileStats(filename);
          const remoteMtime = new Date(remoteFile.modifiedTime).getTime();
          nextManifest[filename] = { id: remoteFile.id, lm: newStats?.mtimeMs || Date.now(), rm: remoteMtime };

          if (filename === this.currentFile()) {
            this.currentMarkdown.set(content);
            this.isDirty.set(false);
          }
        }
      }

      // 5. Cleanup & Save
      await this.fs.writeFile('.sync-manifest.json', JSON.stringify(nextManifest));
      this.updatePrefs({ lastSyncError: null });
      if (!targetFile) {
        this.updatePrefs({ lastSyncTime: Date.now() });
      }
      await this.refreshList();
      
      if (this.currentFile() && !nextManifest[this.currentFile()!]) {
        const list = this.fileList();
        if (list.length > 0) {
          await this.openFile(list[0]);
        }
      }
    } catch (e) {
      if (e instanceof UnauthorizedError && !isRetry) {
        console.log('[Sync] Unauthorized, attempting silent re-auth...');
        try {
          const result = await this.drive.login('none');
          this.updatePrefs({
            googleDriveToken: result.token,
            googleDriveTokenExpiresAt: Date.now() + (result.expires_in * 1000)
          });
          return await this.performSync(targetFile, true);
        } catch (authError: any) {
          const msg = authError.error_description || authError.error || 'Session expired';
          console.log('[Sync] Silent re-auth failed:', msg);
          throw authError; // Rethrow to let caller (syncNow) handle state reset
        }
      }
      throw e;
    } finally {
      if (!isRetry) {
        this.syncStatus.set('idle');
      }
    }
  }

  async createFile(filename: string, content: string = SAMPLE_PROSE, isSlides: boolean = false): Promise<string> {
    let finalName = filename;
    const suffix = isSlides ? '.slides.md' : '.md';

    // Ensure the correct extension based on isSlides
    if (isSlides) {
      if (!finalName.endsWith('.slides.md')) {
        finalName = finalName.replace(/\.md$/, '') + '.slides.md';
      }
    } else {
      if (finalName.endsWith('.slides.md')) {
        finalName = finalName.replace(/\.slides\.md$/, '') + '.md';
      } else if (!finalName.endsWith('.md')) {
        finalName += '.md';
      }
    }

    // Simple collision avoidance
    let counter = 1;
    const baseName = finalName.slice(0, -suffix.length);
    while (await this.fs.exists(finalName)) {
      finalName = `${baseName} (${counter++})${suffix}`;
    }

    await this.fs.writeFile(finalName, content);
    await this.refreshList();
    await this.openFile(finalName);
    return finalName;
  }

  async deleteFile(filename: string): Promise<void> {
    await this.fs.deleteFile(filename);
    await this.refreshList();

    if (this.currentFile() === filename) {
      const list = this.fileList();
      if (list.length > 0) {
        await this.openFile(list[0]);
      } else {
        this.currentFile.set(null);
        this.currentMarkdown.set('');
        this.updatePrefs({ lastOpenFile: null });
      }
    }
  }

  async renameFile(oldName: string, newName: string): Promise<void> {
    let finalNewName = newName;
    if (!finalNewName.endsWith('.md')) finalNewName += '.md';

    if (oldName === finalNewName) return;

    if (await this.fs.exists(finalNewName)) {
      throw new Error('A file with that name already exists');
    }

    await this.fs.renameFile(oldName, finalNewName);
    await this.refreshList();

    if (this.currentFile() === oldName) {
      this.currentFile.set(finalNewName);
      this.updatePrefs({ lastOpenFile: finalNewName });
    }
  }

  private async refreshList(): Promise<void> {
    const list = await this.fs.listFiles();
    this.fileList.set(list);
  }

  setMarkdown(value: string): void {
    this.currentMarkdown.set(value);
    this.isDirty.set(true);
  }

  setEditorWidth(width: number): void {
    const minWidth = 200;
    const maxWidth = window.innerWidth - 200;
    this.editorWidth.set(Math.max(minWidth, Math.min(width, maxWidth)));
  }

  setProseViewMode(mode: 'flow' | 'paged'): void {
    this.proseViewMode.set(mode);
  }

  setSlideCount(count: number): void {
    this.slideCount.set(count);
  }

  cycleColorScheme(): void {
    const current = this.colorScheme();
    const next = COLOR_SCHEME_CYCLE[(COLOR_SCHEME_CYCLE.indexOf(current) + 1) % COLOR_SCHEME_CYCLE.length];
    this.updatePrefs({ darkMode: next });
  }

  goToSlide(index: number): void {
    const clamped = Math.max(0, Math.min(index, this.slideCount() - 1));
    this.currentSlideIndex.set(clamped);
  }

  setTheme(theme: AppPrefs['preferredTheme']): void {
    this.updatePrefs({ preferredTheme: theme });
  }

  setAppTheme(theme: AppPrefs['appTheme']): void {
    this.updatePrefs({ appTheme: theme });
  }

  setFontFamily(family: AppPrefs['fontFamily']): void {
    this.updatePrefs({ fontFamily: family });
  }

  setDarkMode(mode: AppPrefs['darkMode']): void {
    this.updatePrefs({ darkMode: mode });
  }

  setEditorFontSize(size: number): void {
    this.updatePrefs({ editorFontSize: size });
  }

  setSelectedTab(index: number): void {
    this.selectedTab.set(index);
    this.updatePrefs({ lastTab: index });
  }

  togglePreview(): void {
    this.previewVisible.update(v => !v);
  }

  dismissSafariWarning(): void {
    if (this.prefs().safariWarningDismissed) {
      return;
    }

    this.updatePrefs({ safariWarningDismissed: true });
  }

  private updatePrefs(patch: Partial<AppPrefs>): void {
    const next = { ...this.prefs(), ...patch };
    this.prefs.set(next);
    this.prefsService.save(next);
  }
}
