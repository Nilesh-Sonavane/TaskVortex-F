import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Loader } from '../../components/loader/loader';
import { Department } from '../../models/department';
import { DepartmentService } from '../../services/department';
import { ToastService } from '../../services/toast';
import { UserService } from '../../services/user-service';

@Component({
  selector: 'app-add-user',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Loader],
  templateUrl: './add-user.html',
  styleUrls: ['./add-user.css']
})
export class AddUserComponent implements OnInit {
  private userService = inject(UserService);
  private deptService = inject(DepartmentService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  departments: Department[] = [];

  userData = {
    firstName: '',
    lastName: '',
    email: '',
    department: null as Department | null,
    jobTitle: '',
    role: 'employee',
    password: 'Task@123'
  };

  isLoading = false;

  // constructor() {
  //   this.generatePassword();
  // }

  ngOnInit() {
    this.loadDepartments();
  }

  loadDepartments() {
    this.deptService.getAll().subscribe({
      next: (data) => {
        this.departments = data;
        this.cdr.detectChanges();
      },
      error: () => this.toast.show('Failed to load departments', 'error')
    });
  }

  generatePassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    this.userData.password = Array(12).fill(0).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  }

  // --- UPDATED SUBMIT METHOD ---
  onSubmit() {
    this.isLoading = true; // 1. Show Spinner

    const payload = {
      firstName: this.userData.firstName,
      lastName: this.userData.lastName,
      email: this.userData.email,
      password: this.userData.password,
      role: this.userData.role.toUpperCase(),
      department: this.userData.department ? this.userData.department.name : '',
      jobTitle: this.userData.jobTitle
    };

    this.userService.addUser(payload).subscribe({
      next: () => {
        // 2. Redirect immediately (No setTimeout)
        this.router.navigate(['/admin-users']).then(() => {
          // 3. Show Success Message AFTER redirect starts
          // Since ToastService is a singleton, this message will appear on the User List page.
          this.toast.show('User created successfully!', 'success');
        });
      },
      error: (err) => {
        this.isLoading = false; // Stop spinner only on error
        console.log('Full Error:', err);

        let msg = 'Failed to create user.';

        if (err.status === 403) {
          msg = 'Access Denied: You do not have permission to add users.';
        } else if (err.status === 400 && err.error) {
          // Handle "Email already exists" or other validation errors
          msg = typeof err.error === 'string' ? err.error : err.error.message;
        }

        this.toast.show(msg, 'error');
        this.cdr.detectChanges();
      }
    });
  }
}