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

  allTasks = signal<any[]>([]);
  isLoading = signal(true);

  searchQuery = signal('');
  selectedStatus = signal('All');
  selectedPriority = signal('All');

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
        this.allTasks.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  filteredAllTasks = computed(() => {
    const term = this.searchQuery().toLowerCase();
    const statusFilter = this.selectedStatus();
    const priorityFilter = this.selectedPriority();

    return this.allTasks().filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(term) ||
        (task.assigneeName && task.assigneeName.toLowerCase().includes(term));

      const matchesStatus = statusFilter === 'All' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'All' || task.priority === priorityFilter.toUpperCase();

      return matchesSearch && matchesStatus && matchesPriority;
    });
  });

  paginatedTasks = computed(() => {
    const startIndex = (this.currentPage() - 1) * this.pageSize();
    return this.filteredAllTasks().slice(startIndex, startIndex + this.pageSize());
  });

  totalOfTasks = computed(() => this.filteredAllTasks().length);
  totalPages = computed(() => Math.ceil(this.totalOfTasks() / this.pageSize()));

  /**
   * UPDATED: In your new workflow, a subtask is "completed" if it reaches
   * any of these final stages.
   */
  getCompletedSubtasksCount(task: any): number {
    if (!task.subtasks) return 0;
    const terminalStatuses = ['DEPLOYMENT_COMPLETE', 'TESTING_COMPLETE', 'IN_UAT'];
    return task.subtasks.filter((st: any) => terminalStatuses.includes(st.status)).length;
  }

  onFilterChange() {
    this.currentPage.set(1);
  }

  /**
   * UPDATED: Matches the soft pastel CSS classes we created
   */
  getStatusClass(status: string): string {
    if (!status) return 'bg-not-started';
    return 'bg-' + status.toLowerCase().replace(/_/g, '-');
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
}