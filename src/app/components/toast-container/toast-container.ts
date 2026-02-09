import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast';
@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast-item" [class]="toast.type" (click)="toastService.remove(toast.id)">
          <i class="fa-solid" [class.fa-check-circle]="toast.type === 'success'" 
             [class.fa-circle-exclamation]="toast.type === 'error'"></i>
          <span>{{ toast.message }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index:  1000000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .toast-item {
      min-width: 300px;
      padding: 16px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      gap: 12px;
      animation: slideIn 0.3s ease-out;
      cursor: pointer;
      border-left: 5px solid;
    }
    .success { border-left-color: #10b981; }
    .success i { color: #10b981; font-size: 1.2rem; }
    
    .error { border-left-color: #ef4444; }
    .error i { color: #ef4444; font-size: 1.2rem; }

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `]
})
export class ToastContainerComponent {
  toastService = inject(ToastService);
}