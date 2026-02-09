import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Loader } from '../../components/loader/loader';
import { DepartmentService } from '../../services/department'; // Fix path if needed
import { ToastService } from '../../services/toast'; // <--- 1. Import Toast

@Component({
  selector: 'app-add-department',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Loader],
  templateUrl: './add-department.html',
  styleUrls: ['./add-department.css']
})
export class AddDepartmentComponent {
  deptService = inject(DepartmentService);
  router = inject(Router);
  toast = inject(ToastService); // <--- 2. Inject Toast

  deptName = '';
  isLoading = false;

  onSubmit() {
    if (!this.deptName.trim()) return;

    this.isLoading = true; // 1. Spinner Starts immediately
    const payload = { name: this.deptName };

    this.deptService.create(payload as any).subscribe({
      next: () => {

        // 2. Wait 1 Second (Spinner continues to spin)
        setTimeout(() => {

          // 3. STOP SPINNER & SHOW SUCCESS MESSAGE
          this.isLoading = false;
          this.toast.show('Department created successfully!', 'success');

          // 4. Wait 1.5 Seconds for user to read the message, THEN Redirect
          setTimeout(() => {
            this.router.navigate(['/admin-departments']);
          }, 1500);

        }, 1000); // <--- First delay (1 second)
      },
      error: (err) => {
        this.isLoading = false; // Stop immediately on error
        if (err.status === 409) {
          this.toast.show('Department name already exists!', 'error');
        } else {
          this.toast.show('Failed to create department.', 'error');
        }
      }
    });
  }
}