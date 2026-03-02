import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  private route = inject(ActivatedRoute); // To read the ID from URL
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  departments: Department[] = [];
  isLoading = false;
  isEditMode = false;
  userId: string | null = null;

  userData = {
    firstName: '',
    lastName: '',
    email: '',
    department: null as Department | null,
    jobTitle: '',
    role: 'employee',
    password: '' // Optional in edit mode
  };

  ngOnInit() {
    this.loadDepartments();

    // Check if we are in Edit Mode
    this.userId = this.route.snapshot.paramMap.get('id');
    if (this.userId) {
      this.isEditMode = true;
      this.loadUserDetails(this.userId);
    } else {
      this.userData.password = 'Task@123'; // Default for new users
    }
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

  loadUserDetails(id: string) {
    this.isLoading = true;
    this.userService.getUserById(id).subscribe({
      next: (user) => {
        // Mapping backend response to our userData object
        this.userData = {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          jobTitle: user.jobTitle,
          role: user.role.toLowerCase(),
          password: '', // Leave blank for security
          department: this.departments.find(d => d.name === user.department) || null
        };
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.toast.show('Failed to load user data', 'error');
      }
    });
  }

  generatePassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    this.userData.password = Array(12).fill(0).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  }

  // Inside AddUserComponent
  onSubmit() {
    this.isLoading = true;

    const payload = {
      firstName: this.userData.firstName,
      lastName: this.userData.lastName,
      email: this.userData.email,
      password: this.userData.password, // Will be empty in edit mode
      role: this.userData.role.toUpperCase(),
      department: this.userData.department ? this.userData.department.name : '',
      jobTitle: this.userData.jobTitle
    };

    // Ensure userId is converted to Number for the API call
    const request = this.isEditMode
      ? this.userService.updateUser(Number(this.userId), payload)
      : this.userService.addUser(payload);

    request.subscribe({
      next: () => {
        this.router.navigate(['/admin-users']).then(() => {
          this.toast.show(`User ${this.isEditMode ? 'updated' : 'created'} successfully!`, 'success');
        });
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Update Error:', err); // Check console for specific 404 or 405 error
        this.toast.show('Failed to update user.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

}