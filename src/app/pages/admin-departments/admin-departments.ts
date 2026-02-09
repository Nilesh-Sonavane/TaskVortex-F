import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog';
import { Department } from '../../models/department';
import { DepartmentService } from '../../services/department';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-admin-departments',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ConfirmDialogComponent],
  templateUrl: './admin-departments.html',
  styleUrls: ['./admin-departments.css']
})
export class AdminDepartmentsComponent {
  deptService = inject(DepartmentService);
  toast = inject(ToastService);

  @ViewChild(ConfirmDialogComponent) confirmDialog!: ConfirmDialogComponent;

  // --- 1. DATA SIGNALS ---
  departments = signal<Department[]>([]);
  isLoading = signal(true);

  // --- 2. FILTER & PAGINATION SIGNALS ---
  searchTerm = signal('');
  currentPage = signal(1);
  pageSize = signal(5);

  constructor() {
    this.loadDepartments();
  }

  loadDepartments() {
    this.isLoading.set(true);
    this.deptService.getAll().subscribe({
      next: (data) => {
        this.departments.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.show('Failed to load departments', 'error');
      }
    });
  }

  // --- 3. COMPUTED LOGIC ---

  filteredDepartments = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.departments().filter(dept =>
      dept.name.toLowerCase().includes(term)
    );
  });

  paginatedDepartments = computed(() => {
    const startIndex = (this.currentPage() - 1) * this.pageSize();
    const endIndex = startIndex + this.pageSize();
    return this.filteredDepartments().slice(startIndex, endIndex);
  });

  totalPages = computed(() => {
    return Math.ceil(this.filteredDepartments().length / this.pageSize());
  });

  // --- 4. ACTIONS ---

  onSearchChange(term: string) {
    this.searchTerm.set(term);
    this.currentPage.set(1);
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  // --- 5. DELETE LOGIC (UPDATED) ---

  onDeleteClick(id: number, name: string) {
    // UPDATED: Pass 3 Arguments (Message, Button Text, Callback)
    this.confirmDialog.open(
      `Are you sure you want to delete the "${name}" department?`, // 1. Message
      'Yes, Delete it', // 2. Button Text
      () => this.performDelete(id) // 3. Callback
    );
  }

  performDelete(id: number) {
    this.deptService.delete(id).subscribe({
      next: () => {
        this.toast.show('Deleted successfully', 'success');
        this.loadDepartments();
      },
      error: () => this.toast.show('Delete failed. Department might be in use.', 'error')
    });
  }
}