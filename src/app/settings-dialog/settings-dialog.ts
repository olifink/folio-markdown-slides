import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { AppStore } from '../store/app-store';

@Component({
  selector: 'app-settings-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatSliderModule,
  ],
  templateUrl: './settings-dialog.html',
  styleUrl: './settings-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDialogComponent {
  protected readonly store = inject(AppStore);
  private readonly dialogRef = inject(MatDialogRef<SettingsDialogComponent>);

  protected close(): void {
    this.dialogRef.close();
  }
}
