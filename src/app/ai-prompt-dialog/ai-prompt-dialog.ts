import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AiService } from '../services/ai.service';
import { AppStore } from '../store/app-store';

@Component({
  selector: 'app-ai-prompt-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatProgressBarModule,
  ],
  templateUrl: './ai-prompt-dialog.html',
  styleUrl: './ai-prompt-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiPromptDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<AiPromptDialogComponent>);
  private readonly ai = inject(AiService);
  private readonly store = inject(AppStore);

  protected readonly prompt = signal('');
  protected readonly isLoading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    if (!this.prompt().trim()) return;

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const currentMarkdown = this.store.currentMarkdown();
      const modifiedContent = await this.ai.generateContent(this.prompt(), currentMarkdown);
      this.dialogRef.close(modifiedContent);
    } catch (e: any) {
      console.error('AI generation failed', e);
      this.error.set(e.message || 'An unexpected error occurred.');
    } finally {
      this.isLoading.set(false);
    }
  }

  protected handleKeyDown(event: Event): void {
    const kbEvent = event as KeyboardEvent;
    if (kbEvent.key === 'Enter' && (kbEvent.ctrlKey || kbEvent.metaKey)) {
      kbEvent.preventDefault();
      this.submit();
    }
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
