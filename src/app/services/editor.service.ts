import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { CheatItem } from '../editor-pane/cheat-bar/cheat-bar';

@Injectable({ providedIn: 'root' })
export class EditorService {
  private readonly insertSubject = new Subject<string | CheatItem>();
  
  /** Observable that emits whenever a snippet should be inserted at the cursor. */
  readonly insert$ = this.insertSubject.asObservable();

  /** Triggers an insertion of the given text or cheat item into the active editor. */
  insert(value: string | CheatItem): void {
    this.insertSubject.next(value);
  }
}
