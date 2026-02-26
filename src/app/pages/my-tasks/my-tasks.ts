import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Loader } from '../../components/loader/loader';
import { TaskService } from '../../services/task-service';

@Component({
  selector: 'app-my-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Loader],
  templateUrl: './my-tasks.html',
  styleUrls: ['./my-tasks.css']
})
export class MyTasksComponent implements OnInit {
  private taskService = inject(TaskService);

  tasks = signal<any[]>([]);
  isLoading = signal(true);

  // Filtering & Sorting
  searchTerm = signal('');
  priorityFilter = signal<string>('ALL');
  statusFilter = signal<string>('ALL');
  sortOrder = signal<'ASC' | 'DESC'>('ASC');

  // Pagination
  currentPage = signal(1);
  pageSize = 5;

  filteredAndSortedTasks = computed(() => {
    let list = this.tasks();
    const term = this.searchTerm().toLowerCase();

    list = list.filter(t => !t.parentTaskId);

    if (term) {
      list = list.filter(t => t.title.toLowerCase().includes(term) || t.id.toString().includes(term));
    }

    if (this.priorityFilter() !== 'ALL') {
      list = list.filter(t => t.priority === this.priorityFilter());
    }

    if (this.statusFilter() !== 'ALL') {
      list = list.filter(t => t.status === this.statusFilter());
    }

    return [...list].sort((a, b) => {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      return this.sortOrder() === 'ASC' ? dateA - dateB : dateB - dateA;
    });
  });

  paginatedTasks = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredAndSortedTasks().slice(start, start + this.pageSize);
  });

  totalTasks = computed(() => this.filteredAndSortedTasks().length);
  totalPages = computed(() => Math.ceil(this.totalTasks() / this.pageSize));

  ngOnInit() {
    const userJson = localStorage.getItem('user_details');
    if (userJson) {
      const user = JSON.parse(userJson);
      this.loadMyTasks(user.id);
    }
  }

  loadMyTasks(userId: number) {
    this.isLoading.set(true);
    this.taskService.getTasksByAssignee(userId).subscribe({
      next: (data) => {
        this.tasks.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  getPriorityLabel(): string {
    const val = this.priorityFilter();
    return val === 'ALL' ? 'Priority' : val;
  }

  getStatusLabel(): string {
    const val = this.statusFilter();
    if (val === 'ALL') return 'Status';
    // Friendly labels for the dropdown button
    const labels: any = {
      'NOT_STARTED': 'Not Started',
      'DEPLOYMENT_IN_PROGRESS': 'Deploying',
      'TESTING_IN_PROGRESS': 'Testing',
      'IN_UAT': 'In UAT',
      'HOLD': 'On Hold'
    };
    return labels[val] || val.replace(/_/g, ' ');
  }

  toggleSort() {
    this.sortOrder.update(o => o === 'ASC' ? 'DESC' : 'ASC');
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) this.currentPage.set(page);
  }

  setPriority(val: string) { this.priorityFilter.set(val); this.currentPage.set(1); }
  setStatus(val: string) { this.statusFilter.set(val); this.currentPage.set(1); }

  getPriorityClass(p: string) {
    return p === 'HIGH' ? 'badge-high' : p === 'MEDIUM' ? 'badge-med' : 'badge-low';
  }

  // UPDATED: Matches the soft pastel CSS classes from the deployment workflow
  getStatusBadgeClass(s: string) {
    if (!s) return 'bg-not-started';
    return `bg-${s.toLowerCase().replace(/_/g, '-')}`;
  }
}