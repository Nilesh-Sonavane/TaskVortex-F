import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Loader } from '../../components/loader/loader';
import { DepartmentService } from '../../services/department';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-add-department',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Loader],
  templateUrl: './add-department.html',
  styleUrls: ['./add-department.css']
})
export class AddDepartmentComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private deptService = inject(DepartmentService);
  private router = inject(Router);
  private toast = inject(ToastService);

  // State Management
  deptName = '';
  isLoading = false;
  isEditMode = false;
  deptId: number | null = null;
  currentUser: any = null;

  constructor() {
    const userJson = localStorage.getItem('user_details');
    if (userJson) this.currentUser = JSON.parse(userJson);
  }

  ngOnInit() {
    // Check if URL has an ID (e.g., /admin-departments/edit/5)
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEditMode = true;
      this.deptId = +idParam;
      this.loadDepartmentData(this.deptId);
    }
  }

  loadDepartmentData(id: number) {
    this.isLoading = true;
    this.deptService.getById(id).subscribe({
      next: (dept) => {
        this.deptName = dept.name;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('Failed to load department.', 'error');
        this.router.navigate(['/admin-departments']);
      }
    });
  }

  onSubmit() {
    if (!this.deptName.trim()) return;

    this.isLoading = true;
    this.cdr.detectChanges(); // Resolve NG0100

    const email = this.currentUser?.email || 'admin@taskvortex.com';
    const payload = { name: this.deptName };

    // Switch between Create and Update based on mode
    const request = (this.isEditMode && this.deptId)
      ? this.deptService.update(this.deptId, payload, email)
      : this.deptService.create(payload, email);

    request.subscribe({
      next: () => {
        setTimeout(() => {
          this.isLoading = false;
          const msg = this.isEditMode ? 'Updated successfully!' : 'Created successfully!';
          this.toast.show(msg, 'success');
          this.cdr.detectChanges();

          setTimeout(() => {
            this.router.navigate(['/admin-departments']);
          }, 1000);
        }, 1000);
      },
      error: (err) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        if (err.status === 409) {
          this.toast.show('Department name already exists!', 'error');
        } else {
          this.toast.show('Action failed. Please try again.', 'error');
        }
      }
    });
  }
}