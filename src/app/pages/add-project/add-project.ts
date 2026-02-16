import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Loader } from '../../components/loader/loader';
import { ProjectService } from '../../services/project-service';
import { ToastService } from '../../services/toast';
import { UserService } from '../../services/user-service';

@Component({
  selector: 'app-add-project',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Loader],
  templateUrl: './add-project.html',
  styleUrls: ['./add-project.css']
})
export class AddProjectComponent implements OnInit {

  private projectService = inject(ProjectService);
  private userService = inject(UserService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  isLoading = false;
  users: any[] = [];
  managers: any[] = [];
  employees: any[] = [];
  memberSearchTerm = '';

  projectData = {
    name: '',
    key: '',
    description: '',
    managerId: null,
    startDate: '',
    endDate: '',
    memberIds: new Set<number>()
  };

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.isLoading = true; // Use local loader state if you want, or just rely on global
    this.userService.getAllUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.processUsers();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('Failed to load users', 'error');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  processUsers() {
    if (!this.users) return;

    this.managers = this.users.filter(u => {
      const role = (u.role || '').toUpperCase();
      return role === 'ADMIN' || role === 'MANAGER';
    });

    this.employees = this.users.filter(u => {
      const role = (u.role || '').toUpperCase();
      return role === 'EMPLOYEE' || role === 'ADMIN' || role == 'MANAGER' || role === '';
    });
  }

  // Search Filter
  get filteredEmployees() {
    if (!this.memberSearchTerm) return this.employees;
    const term = this.memberSearchTerm.toLowerCase();
    return this.employees.filter(u =>
      (u.firstName + ' ' + u.lastName).toLowerCase().includes(term) ||
      (u.jobTitle || '').toLowerCase().includes(term)
    );
  }

  generateKey(name: string) {
    if (!name) {
      this.projectData.key = '';
      return;
    }
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '');
    this.projectData.key = cleanName.substring(0, 4).toUpperCase();
  }

  toggleMember(userId: number) {
    if (this.projectData.memberIds.has(userId)) {
      this.projectData.memberIds.delete(userId);
    } else {
      this.projectData.memberIds.add(userId);
    }
  }

  getAvatar(user: any) {
    return `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}&background=random`;
  }

  // --- MATCHING SUBMIT LOGIC ---
  onSubmit() {
    // Basic Logic Check: Dates
    if (this.projectData.startDate && this.projectData.endDate) {
      if (new Date(this.projectData.endDate) < new Date(this.projectData.startDate)) {
        this.toast.show('End Date cannot be before Start Date', 'error');
        return;
      }
    }

    this.isLoading = true;

    const payload = {
      ...this.projectData,
      memberIds: Array.from(this.projectData.memberIds)
    };

    this.projectService.addProject(payload).subscribe({
      next: () => {
        this.router.navigate(['/admin-projects']).then(() => {
          this.toast.show('Project created successfully!', 'success');
        });
      },
      error: (err) => {
        this.isLoading = false;
        console.log('Full Error:', err);

        let msg = 'Failed to create project.';

        if (err.status === 403) {
          msg = 'Access Denied: You do not have permission to create projects.';
        } else if (err.status === 400 && err.error) {
          msg = typeof err.error === 'string' ? err.error : (err.error.message || msg);
        }

        this.toast.show(msg, 'error');
        this.cdr.detectChanges();
      }
    });
  }
}