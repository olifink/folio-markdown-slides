import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-safari-warning-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './safari-warning-dialog.html',
  styleUrl: './safari-warning-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SafariWarningDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<SafariWarningDialogComponent>);

  protected close(): void {
    this.dialogRef.close(true);
  }
}
