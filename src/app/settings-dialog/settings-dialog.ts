import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { AppStore } from '../store/app-store';

@Component({
  selector: 'app-settings-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatSliderModule,
    MatTooltipModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
  ],
  templateUrl: './settings-dialog.html',
  styleUrl: './settings-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDialogComponent {
  protected readonly store = inject(AppStore);
  private readonly dialogRef = inject(MatDialogRef<SettingsDialogComponent>);

  protected readonly currentAppTheme = computed(() => this.store.appTheme());
  protected readonly currentFontFamily = computed(() => this.store.prefs().fontFamily);
  protected readonly currentColorScheme = computed(() => this.store.colorScheme());
  protected readonly currentEditorFontSize = computed(() => this.store.prefs().editorFontSize);

  protected close(): void {
    this.dialogRef.close();
  }
}
