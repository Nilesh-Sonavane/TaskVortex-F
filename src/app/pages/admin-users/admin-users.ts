import { CommonModule, TitleCasePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Department } from '../../models/department';
import { DepartmentService } from '../../services/department'; // Check path
import { UserService } from '../../services/user-service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TitleCasePipe],
  templateUrl: './admin-users.html',
  styleUrls: ['./admin-users.css']
})
export class AdminUsersComponent {
  userService = inject(UserService);
  deptService = inject(DepartmentService);

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

  constructor() {
    this.loadUsers();
    this.loadDepartments();
  }

  loadUsers() {
    this.userService.getAllUsers().subscribe({
      next: (data) => {
        this.users.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading users', err);
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

  // --- FILTER LOGIC (FIXED) ---
  filteredAllUsers = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const role = this.selectedRole();
    const deptFilter = this.selectedDepartment();

    return this.users().filter(user => {
      // Search
      const matchesSearch = (user.firstName + ' ' + user.lastName + user.email).toLowerCase().includes(term);

      // Role
      const matchesRole = role === 'All Roles' || user.role === role.toUpperCase();

      // --- FIX HERE: Remove .name ---
      // user.department is a String (e.g. "Engineering"), not an object.
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

  getAvatar(firstName: string, role: string) {
    return `https://ui-avatars.com/api/?name=${firstName}&background=random&color=fff&size=32`;
  }
}