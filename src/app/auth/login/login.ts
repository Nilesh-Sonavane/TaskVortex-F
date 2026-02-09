import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Loader } from '../../components/loader/loader';
import { ToastService } from '../../services/toast';
import { AuthService } from '../auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Loader],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  authService = inject(AuthService);
  router = inject(Router);
  toast = inject(ToastService);
  cdr = inject(ChangeDetectorRef);

  email = '';
  password = '';
  isLoading = false;

  onLogin() {
    const credentials = { email: this.email, password: this.password };

    this.authService.login(credentials).subscribe({
      next: () => {
        this.isLoading = true;
        this.cdr.detectChanges();
        setTimeout(() => {

          this.isLoading = false;
          this.cdr.detectChanges();
          this.toast.show('Login Successful!', 'success');

          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 500);

        }, 1000);
      },
      error: (err) => {
        this.isLoading = false;
        this.cdr.detectChanges();

        let msg = 'Server error. Please try again.';
        if (err.status === 401 || err.status === 403) {
          msg = 'Invalid email or password.';
        }
        this.toast.show(msg, 'error');
      }
    });
  }
}