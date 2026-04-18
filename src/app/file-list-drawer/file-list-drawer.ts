import { ChangeDetectionStrategy, Component, inject, computed, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AppStore, SAMPLE_MARKDOWN, SAMPLE_PROSE } from '../store/app-store';
import { SettingsDialogComponent } from '../settings-dialog/settings-dialog';
import { FsService } from '../services/fs.service';
import { EditorService } from '../services/editor.service';
import JSZip from 'jszip';

@Component({
  selector: 'app-file-list-drawer',
  imports: [
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatMenuModule,
    MatDialogModule,
  ],
  templateUrl: './file-list-drawer.html',
  styleUrl: './file-list-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileListDrawerComponent {
  protected readonly store = inject(AppStore);
  protected readonly fs = inject(FsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly editorService = inject(EditorService);

  readonly closeDrawer = output<void>();

  async onNewSlides(): Promise<void> {
    const filename = await this.store.createFile('Untitled Slides.slides.md', SAMPLE_MARKDOWN, true);
    this.showNewFileSnackBar(filename, true);
    this.closeDrawer.emit();
  }

  async onNewProse(): Promise<void> {
    const filename = await this.store.createFile('Untitled Document.md', SAMPLE_PROSE, false);
    this.showNewFileSnackBar(filename, false);
    this.closeDrawer.emit();
  }

  private showNewFileSnackBar(filename: string, isSlides: boolean): void {
    const snackBarRef = this.snackBar.open(`Created ${filename}`, 'Clear content', {
      duration: 5000,
    });

    snackBarRef.onAction().subscribe(() => {
      this.store.setSelectedTab(0);
      if (isSlides) {
        this.store.setMarkdown(`---\nmarp: true\n---\n\n`);
      } else {
        this.store.setMarkdown('');
      }
      this.editorService.focus();
    });
  }

  async onDownloadAll(): Promise<void> {
    const files = this.store.fileList();
    if (files.length === 0) {
      this.snackBar.open('No files to export', 'Dismiss', { duration: 2000 });
      return;
    }

    const zip = new JSZip();
    for (const file of files) {
      const content = await this.fs.readFile(file);
      zip.file(file, content);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `folio-export-${new Date().toISOString().split('T')[0]}.zip`;
    link.click();
    URL.revokeObjectURL(url);
    
    this.snackBar.open(`Exported ${files.length} files to ZIP`, 'Dismiss', { duration: 3000 });
    this.closeDrawer.emit();
  }

  async onFileClick(file: string): Promise<void> {
    await this.store.openFile(file);
    this.closeDrawer.emit();
  }

  async onDelete(event: Event, file: string): Promise<void> {
    event.stopPropagation(); // Don't select the file when deleting
    
    const content = await this.fs.readFile(file);
    await this.store.deleteFile(file);

    const snackBarRef = this.snackBar.open(`Deleted ${file}`, 'Undo', {
      duration: 5000,
      panelClass: 'undo-snackbar',
    });

    snackBarRef.onAction().subscribe(async () => {
      const isSlides = file.endsWith('.slides.md');
      await this.store.createFile(file, content, isSlides);
    });
  }

  onShowSettings(): void {
    this.dialog.open(SettingsDialogComponent, {
      width: '90vw',
      maxWidth: '500px',
      maxHeight: '90vh',
      panelClass: 'folio-settings-dialog'
    });
    this.closeDrawer.emit();
  }
}
