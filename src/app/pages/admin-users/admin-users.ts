import { CommonModule, TitleCasePipe } from '@angular/common';
import { ChangeDetectorRef, Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog';
import { Loader } from '../../components/loader/loader';
import { Department } from '../../models/department';
import { DepartmentService } from '../../services/department';
import { ToastService } from '../../services/toast';
import { UserService } from '../../services/user-service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TitleCasePipe, ConfirmDialogComponent, Loader],
  templateUrl: './admin-users.html',
  styleUrls: ['./admin-users.css']
})
export class AdminUsersComponent implements OnInit {
  private userService = inject(UserService);
  private deptService = inject(DepartmentService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  // Reference to the confirm dialog in the HTML
  confirmDialog = viewChild.required<ConfirmDialogComponent>('confirmDialog');

  // --- DATA SIGNALS ---
  users = signal<any[]>([]);
  departments = signal<Department[]>([]);

  isLoading = signal(true);
  searchTerm = signal('');
  selectedRole = signal('All Roles');
  selectedDepartment = signal('All Departments');

  // --- PAGINATION ---
  currentPage = signal(1);
  pageSize = signal(5);

  ngOnInit() {
    this.loadUsers();
    this.loadDepartments();
  }

  loadUsers() {
    this.isLoading.set(true);
    this.userService.getAllUsers().subscribe({
      next: (data) => {
        this.users.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading users', err);
        this.toast.show('Failed to load users', 'error');
        this.isLoading.set(false);
      }
    });
  }

  loadDepartments() {
    this.deptService.getAll().subscribe({
      next: (data) => this.departments.set(data),
      error: (err) => console.error('Error loading departments', err)
    });
  }

  // --- FILTER LOGIC ---
  filteredAllUsers = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const role = this.selectedRole();
    const deptFilter = this.selectedDepartment();

    return this.users().filter(user => {
      // Search by name or email
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const matchesSearch = fullName.includes(term) || user.email.toLowerCase().includes(term);

      // Filter by Role
      const matchesRole = role === 'All Roles' || user.role === role.toUpperCase();

      // Filter by Department (String comparison)
      const userDeptName = user.department || '';
      const matchesDept = deptFilter === 'All Departments' || userDeptName === deptFilter;

      return matchesSearch && matchesRole && matchesDept;
    });
  });

  onFilterChange() {
    this.currentPage.set(1);
  }

  paginatedUsers = computed(() => {
    const startIndex = (this.currentPage() - 1) * this.pageSize();
    const endIndex = startIndex + this.pageSize();
    return this.filteredAllUsers().slice(startIndex, endIndex);
  });

  totalPages = computed(() => {
    return Math.ceil(this.filteredAllUsers().length / this.pageSize());
  });

  // --- ACTIONS ---

  /**
   * Toggles the user between Active and Inactive status.
   * Replaces the old 'delete' functionality for better data retention.
   */
  toggleStatus(user: any) {
    const action = user.active ? 'deactivate' : 'activate';
    const confirmBtn = user.active ? 'Deactivate' : 'Activate';

    this.confirmDialog().open(
      `Are you sure you want to ${action} <b>${user.firstName} ${user.lastName}</b>?`,
      confirmBtn,
      () => {
        this.userService.toggleStatus(user.id).subscribe({
          next: () => {
            // Update the local signal data without a full reload
            this.users.update(currentUsers =>
              currentUsers.map(u => u.id === user.id ? { ...u, active: !u.active } : u)
            );

            this.toast.show(`User ${action}d successfully`, 'success');
            this.cdr.detectChanges();
          },
          error: () => {
            this.toast.show(`Failed to ${action} user`, 'error');
          }
        });
      }
    );
  }

  // --- HELPER METHODS ---
  nextPage() {
    if (this.currentPage() < this.totalPages()) this.currentPage.update(p => p + 1);
  }

  prevPage() {
    if (this.currentPage() > 1) this.currentPage.update(p => p - 1);
  }

  onSearchChange(term: string) {
    this.searchTerm.set(term);
    this.currentPage.set(1);
  }


  getAvatar(user: any): string {
    const currentUrl = user.profileUrl;
    if (currentUrl) {
      return currentUrl.startsWith('http') ? currentUrl : `http://localhost:8080${currentUrl}`;
    }
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';

    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
  }
}