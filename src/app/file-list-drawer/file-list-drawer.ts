import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AppStore, SAMPLE_MARKDOWN, SAMPLE_PROSE } from '../store/app-store';
import { FsService } from '../services/fs.service';

const COLOR_SCHEME_ICON: Record<string, string> = {
  system: 'brightness_auto',
  light:  'light_mode',
  dark:   'dark_mode',
};

const COLOR_SCHEME_LABEL: Record<string, string> = {
  system: 'Color scheme: automatic',
  light:  'Color scheme: light',
  dark:   'Color scheme: dark',
};

@Component({
  selector: 'app-file-list-drawer',
  imports: [
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  templateUrl: './file-list-drawer.html',
  styleUrl: './file-list-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileListDrawerComponent {
  protected readonly store = inject(AppStore);
  protected readonly fs = inject(FsService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly colorSchemeIcon = computed(
    () => COLOR_SCHEME_ICON[this.store.colorScheme()],
  );

  protected readonly colorSchemeLabel = computed(
    () => COLOR_SCHEME_LABEL[this.store.colorScheme()],
  );

  async onNewPresentation(): Promise<void> {
    await this.store.createFile('Untitled Slides.md', SAMPLE_MARKDOWN);
  }

  async onNewProse(): Promise<void> {
    await this.store.createFile('Untitled Document.md', SAMPLE_PROSE);
  }

  async onFileClick(file: string): Promise<void> {
    await this.store.openFile(file);
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
      await this.store.createFile(file, content);
    });
  }

  onShowSettings(): void {
    // Settings logic could be added here later
    this.snackBar.open('Settings coming soon!', 'Dismiss', { duration: 2000 });
  }
}
