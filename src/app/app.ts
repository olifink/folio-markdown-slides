import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { CdkDrag, CdkDragMove } from '@angular/cdk/drag-drop';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { EditorPaneComponent } from './editor-pane/editor-pane';
import { PreviewPaneComponent } from './preview-pane/preview-pane';
import { FileListDrawerComponent } from './file-list-drawer/file-list-drawer';
import { HelpDialogComponent } from './help-dialog/help-dialog';
import { AppStore } from './store/app-store';
import { ExportService } from './services/export.service';

const COLOR_SCHEME_ICON: Record<string, string> = {
  system: 'brightness_auto',
  light:  'light_mode',
  dark:   'dark_mode',
};

const COLOR_SCHEME_LABEL: Record<string, string> = {
  system: 'Color scheme: automatic (click to switch)',
  light:  'Color scheme: light (click to switch)',
  dark:   'Color scheme: dark (click to switch)',
};

@Component({
  selector: 'app-root',
  imports: [
    MatToolbarModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatSidenavModule,
    MatSnackBarModule,
    MatMenuModule,
    MatDialogModule,
    MatButtonToggleModule,
    CdkDrag,
    EditorPaneComponent,
    PreviewPaneComponent,
    FileListDrawerComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 
    class: 'app-root',
    '(window:mouseup)': 'onDragEnd()'
  },
})
export class App {
  protected readonly store = inject(AppStore);
  private readonly splitPane = viewChild<ElementRef<HTMLDivElement>>('splitPane');
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly snackBar = inject(MatSnackBar);
  private readonly exportService = inject(ExportService);
  private readonly dialog = inject(MatDialog);

  readonly isWide = toSignal(
    this.breakpointObserver.observe('(min-width: 840px)').pipe(
      map(r => r.matches),
    ),
    { initialValue: false },
  );

  protected readonly colorSchemeIcon = computed(
    () => COLOR_SCHEME_ICON[this.store.colorScheme()],
  );

  protected readonly colorSchemeLabel = computed(
    () => COLOR_SCHEME_LABEL[this.store.colorScheme()],
  );

  protected readonly isDragging = signal(false);
  protected readonly selectedTab = signal(0);

  protected readonly isEditingTitle = signal(false);
  protected readonly editValue = signal('');

  protected onTitleClick(): void {
    const current = this.store.currentFile();
    if (!current) return;
    
    // Show without extension for editing
    this.editValue.set(current.replace('.md', ''));
    this.isEditingTitle.set(true);
  }

  protected async finishRename(): Promise<void> {
    if (!this.isEditingTitle()) return;
    
    const oldName = this.store.currentFile();
    let newName = this.editValue().trim();
    
    if (!newName) {
      this.isEditingTitle.set(false);
      return;
    }

    if (!newName.endsWith('.md')) newName += '.md';
    
    if (oldName && oldName !== newName) {
      try {
        await this.store.renameFile(oldName, newName);
      } catch (e: any) {
        this.snackBar.open(e.message || 'Failed to rename file', 'Dismiss', { duration: 3000 });
      }
    }
    
    this.isEditingTitle.set(false);
  }

  protected onTitleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.finishRename();
    } else if (event.key === 'Escape') {
      this.isEditingTitle.set(false);
    }
  }

  protected onDragStart(): void {
    this.isDragging.set(true);
  }

  protected onDragEnd(): void {
    this.isDragging.set(false);
  }

  protected onResize(event: CdkDragMove): void {
    const pane = this.splitPane()?.nativeElement;
    if (!pane) return;

    const rect = pane.getBoundingClientRect();
    const newWidth = event.pointerPosition.x - rect.left;

    this.store.setEditorWidth(newWidth);
    // Reset the drag transform so the divider stays synced with the grid
    event.source.reset();
  }

  protected onDownloadMd(): void {
    const file = this.store.currentFile();
    if (!file) return;
    this.exportService.downloadMarkdown(file, this.store.currentMarkdown());
  }

  protected onDownloadHtml(): void {
    const file = this.store.currentFile();
    if (!file) return;
    this.exportService.downloadHtml(file, this.store.currentMarkdown());
  }

  protected onPrintPdf(): void {
    this.exportService.print(this.store.currentMarkdown());
  }

  protected onShowHelp(): void {
    this.dialog.open(HelpDialogComponent, {
      width: '90vw',
      maxWidth: '850px',
      maxHeight: '90vh',
      panelClass: 'folio-help-dialog'
    });
  }

  constructor() {
    this.store.init();

    // Focus input when editing starts
    effect(() => {
      if (this.isEditingTitle()) {
        setTimeout(() => this.titleInput()?.nativeElement.focus(), 0);
      }
    });

    // Reflect the chosen color scheme on <html> so CSS selectors and Material
    // theme rules can respond without a page reload.
    effect(() => {
      const scheme = this.store.colorScheme();
      const html = document.documentElement;
      if (scheme === 'system') {
        html.removeAttribute('data-color-scheme');
      } else {
        html.setAttribute('data-color-scheme', scheme);
      }
    });
  }
}
