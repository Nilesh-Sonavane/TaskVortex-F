import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen()) {
      <div class="confirm-overlay">
        <div class="confirm-box">
          <div class="icon-circle">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h3>Are you sure?</h3>
          <p>{{ message() }}</p>
          <div class="actions">
            <button class="btn-cancel" (click)="onCancel()">Cancel</button>
            
            <button class="btn-confirm" (click)="onConfirm()">
                {{ confirmLabel() }}
            </button>
          
          </div>
        </div>
      </div>
    }
  `,
  styleUrls: ['./confirm-dialog.css']
})
export class ConfirmDialogComponent {
  isOpen = signal(false);
  message = signal('');

  // 2. NEW SIGNAL FOR BUTTON TEXT
  confirmLabel = signal('Yes, Confirm');

  private confirmCallback: (() => void) | null = null;

  // 3. UPDATE OPEN METHOD TO ACCEPT BUTTON TEXT
  open(msg: string, btnText: string, onConfirm: () => void) {
    this.message.set(msg);
    this.confirmLabel.set(btnText); // Set the button text
    this.confirmCallback = onConfirm;
    this.isOpen.set(true);
  }

  onConfirm() {
    if (this.confirmCallback) this.confirmCallback();
    this.isOpen.set(false);
  }

  onCancel() {
    this.isOpen.set(false);
  }
}