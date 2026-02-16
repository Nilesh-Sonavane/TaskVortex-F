import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
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

  // --- DATA SIGNALS ---
  allTasks = signal<any[]>([]);
  isLoading = signal(true);

  // --- FILTER SIGNALS ---
  searchQuery = signal('');
  selectedStatus = signal('All');
  selectedPriority = signal('All');

  // --- PAGINATION SIGNALS (Matching User List Logic) ---
  currentPage = signal(1);
  pageSize = signal(5);

  selectedTaskDetail = signal<any | null>(null);

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
        this.allTasks.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
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

  // --- HELPERS ---
  onFilterChange() { this.currentPage.set(1); }

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

  // view detail 

  openTaskDetails(task: any) {
    this.selectedTaskDetail.set(task);
  }

  closeTaskDetails() {
    this.selectedTaskDetail.set(null);
  }

}