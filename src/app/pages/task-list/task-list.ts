import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TaskService } from '../../services/task-service';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './task-list.html',
  styleUrls: ['./task-list.css']
})
export class TaskListComponent implements OnInit {
  private taskService = inject(TaskService);
  private router = inject(Router);

  // --- DATA SIGNALS ---
  allTasks = signal<any[]>([]);
  isLoading = signal(true);

  // --- FILTER SIGNALS ---
  searchQuery = signal('');
  selectedStatus = signal('All');
  selectedPriority = signal('All');

  // --- PAGINATION SIGNALS ---
  currentPage = signal(1);
  pageSize = signal(5);

  ngOnInit() {
    this.loadTeamTasks();
  }

  loadTeamTasks() {
    this.isLoading.set(true);
    const userJson = localStorage.getItem('user_details');
    if (!userJson) return;

    const managerId = JSON.parse(userJson).id;

    this.taskService.getTasksByManager(managerId).subscribe({
      next: (data) => {
        // Only root tasks (parentTask == null) should be in this list
        this.allTasks.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  // --- REACTIVE FILTER LOGIC ---
  filteredAllTasks = computed(() => {
    const term = this.searchQuery().toLowerCase();
    const statusFilter = this.selectedStatus();
    const priorityFilter = this.selectedPriority();

    return this.allTasks().filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(term) ||
        (task.assigneeName && task.assigneeName.toLowerCase().includes(term));

      const normalizedStatus = statusFilter.toUpperCase().replace(' ', '_');
      const matchesStatus = statusFilter === 'All' || task.status === normalizedStatus;

      const matchesPriority = priorityFilter === 'All' || task.priority === priorityFilter.toUpperCase();

      return matchesSearch && matchesStatus && matchesPriority;
    });
  });

  // --- PAGINATION LOGIC ---
  paginatedTasks = computed(() => {
    const startIndex = (this.currentPage() - 1) * this.pageSize();
    return this.filteredAllTasks().slice(startIndex, startIndex + this.pageSize());
  });

  totalPages = computed(() => Math.ceil(this.filteredAllTasks().length / this.pageSize()));

  // --- SINGLE-TABLE HELPERS ---

  /**
   * Used in the HTML to show "3/5" progress for subtasks
   */
  getCompletedSubtasksCount(task: any): number {
    if (!task.subtasks) return 0;
    return task.subtasks.filter((st: any) => st.status === 'DONE').length;
  }

  /**
   * Resets all filters (used in the @empty table state)
   */
  resetFilters() {
    this.searchQuery.set('');
    this.selectedStatus.set('All');
    this.selectedPriority.set('All');
    this.currentPage.set(1);
  }

  // --- UI HELPERS ---
  onFilterChange() {
    this.currentPage.set(1);
  }

  getStatusClass(status: string): string {
    const s = status?.toUpperCase();
    if (s === 'IN_PROGRESS') return 'bg-progress';
    if (s === 'REVIEW') return 'bg-review';
    if (s === 'DONE') return 'bg-done';
    return 'bg-pending';
  }

  getPriorityClass(priority: string): string {
    const p = priority?.toUpperCase();
    if (p === 'HIGH') return 'p-high';
    if (p === 'MEDIUM') return 'p-med';
    return 'p-low';
  }

  getAvatarUrl(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
  }

  // NOTE: openTaskDetails and closeTaskDetails are removed 
  // because we are using routerLink in the HTML now.
}