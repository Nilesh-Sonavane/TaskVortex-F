import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.css']
})
export class ForgotPasswordComponent {
  email: string = '';
  isLoading: boolean = false; // To show the spinner
  isSent: boolean = false;    // To show the success message

  handleReset() {
    if (!this.email) return;

    // 1. Start Loading
    this.isLoading = true;

    // 2. Simulate API Delay (1.5 seconds)
    setTimeout(() => {
      this.isLoading = false;
      this.isSent = true; // Switch view to Success Message
    }, 1500);
  }
}