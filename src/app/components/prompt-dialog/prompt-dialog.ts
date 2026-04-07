import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-prompt-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isOpen()) {
      <div class="confirm-overlay">
        <div class="confirm-box">
          <div class="icon-circle text-primary">
            <i class="fa-solid fa-keyboard"></i>
          </div>
          <h3>Work Description</h3>
          <p [innerHTML]="message()"></p>
          
          <textarea 
            class="form-control mb-4" 
            rows="3" 
            [(ngModel)]="inputText" 
            placeholder="Type your work description here..."
            style="resize: none; border-radius: 8px;">
          </textarea>

          <div class="actions">
            <button class="btn-cancel" (click)="onCancel()">Cancel</button>
            <button class="btn-confirm bg-danger text-white" (click)="onConfirm()">
                {{ confirmLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styleUrls: ['../confirm-dialog/confirm-dialog.css'] // Apna same CSS path yahan daalein
})
export class PromptDialogComponent {
  isOpen = signal(false);
  message = signal('');
  confirmLabel = signal('Submit');

  // User jo type karega wo isme save hoga
  inputText = '';

  private confirmCallback: ((value: string) => void) | null = null;

  open(msg: string, btnText: string, defaultText: string, onConfirm: (value: string) => void) {
    this.message.set(msg);
    this.confirmLabel.set(btnText);
    this.inputText = defaultText; // Default text set karein
    this.confirmCallback = onConfirm;
    this.isOpen.set(true);
  }

  onConfirm() {
    if (this.confirmCallback) {
      this.confirmCallback(this.inputText);
    }
    this.isOpen.set(false);
  }

  onCancel() {
    this.isOpen.set(false);
  }
}