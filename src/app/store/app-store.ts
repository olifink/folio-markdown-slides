import { Injectable, computed, inject, signal, effect } from '@angular/core';
import { FsService } from '../services/fs.service';
import { PrefsService, AppPrefs } from '../services/prefs.service';

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
    preferredTheme: 'default',
    appTheme: 'quiet',
    fontFamily: 'sans-serif',
    editorFontSize: 16,
    darkMode: 'system',
  });

  readonly colorScheme = computed(() => this.prefs().darkMode);
  readonly appTheme = computed(() => this.prefs().appTheme);
  readonly editorWidth = signal(500);
  readonly previewVisible = signal(true);

  constructor() {
    // Auto-save effect
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

  async createFile(filename: string, content: string = SAMPLE_PROSE, isSlides: boolean = false): Promise<void> {
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
  }

  async openFile(filename: string): Promise<void> {
    const content = await this.fs.readFile(filename);
    this.currentFile.set(filename);
    this.currentMarkdown.set(content);
    this.isDirty.set(false);
    this.updatePrefs({ lastOpenFile: filename });
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

  togglePreview(): void {
    this.previewVisible.update(v => !v);
  }

  private updatePrefs(patch: Partial<AppPrefs>): void {
    const next = { ...this.prefs(), ...patch };
    this.prefs.set(next);
    this.prefsService.save(next);
  }
}
