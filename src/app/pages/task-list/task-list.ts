
import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../auth/auth';
import { Loader } from '../../components/loader/loader';
import { TaskService } from '../../services/task-service';
import { UserService } from '../../services/user-service';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, Loader],
  templateUrl: './task-list.html',
  styleUrls: ['./task-list.css']
})
export class TaskListComponent implements OnInit {
  private taskService = inject(TaskService);
  private userService = inject(UserService);
  public auth = inject(AuthService); // <--- Public so HTML can access auth.currentUser
  private router = inject(Router);

  // Data Signals
  allTasks = signal<any[]>([]);
  managers = signal<any[]>([]);
  isLoading = signal(false);

  // Filter Signals
  searchQuery = signal('');
  selectedStatus = signal('All');
  selectedPriority = signal('All');
  selectedManagerId = signal<string>('');

  // Pagination Signals
  currentPage = signal(1);
  pageSize = signal(5);

  ngOnInit() {
    this.initializeFilterContext();
    this.loadManagers();
    this.loadTeamTasks();
  }

  private initializeFilterContext() {
    const user = this.auth.currentUser;
    if (!user) return;

    // 1. Try to set to self first
    this.selectedManagerId.set(user.id.toString());

    // 2. If I am an ADMIN, I might not be a 'Manager' in the DB.
    // We can add a check in loadManagers to select the first available manager 
    // if the current selection remains empty.
  }
  loadManagers() {
    if (this.auth.isManager()) {
      this.userService.getUsersByRole('MANAGER').subscribe({
        next: (data: any[]) => {
          const currentUser = this.auth.currentUser;

          // NEW LOGIC: If I am an ADMIN, add myself to the top of the list 
          // so the dropdown has a value to select by default.
          const isAdmin = currentUser?.role === 'ADMIN';
          const alreadyInList = data.some(m => m.id === currentUser?.id);

          if (isAdmin && !alreadyInList && currentUser) {
            // Push Admin to the start of the managers signal
            this.managers.set([currentUser, ...data]);
          } else {
            this.managers.set(data);
          }

          // Now that the list contains the Admin, this ID will match an option
          if (currentUser) {
            this.selectedManagerId.set(currentUser.id.toString());
          }
        },
        error: (err: any) => console.error('Failed to load managers', err)
      });
    }
  }

  loadTeamTasks() {
    const mId = this.selectedManagerId();
    if (!mId) return;

    this.isLoading.set(true);
    this.taskService.getTasksByManager(Number(mId)).subscribe({
      next: (data) => {
        this.allTasks.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  onManagerChange(id: string) {
    this.selectedManagerId.set(id);
    this.currentPage.set(1);
    this.loadTeamTasks();
  }

  onFilterChange() {
    this.currentPage.set(1);
  }

  // --- Computed Logic ---
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

  totalPages = computed(() => Math.ceil(this.filteredAllTasks().length / this.pageSize()));

  // --- UI Helpers ---
  getCompletedSubtasksCount(task: any): number {
    if (!task.subtasks) return 0;
    const terminalStatuses = ['DEPLOYMENT_COMPLETE', 'TESTING_COMPLETE', 'IN_UAT'];
    return task.subtasks.filter((st: any) => terminalStatuses.includes(st.status)).length;
  }

  getStatusClass = (s: string) => s ? `bg-${s.toLowerCase().replace(/_/g, '-')}` : 'bg-not-started';

  getPriorityClass(priority: string) {
    const p = priority?.toUpperCase();
    return p === 'HIGH' ? 'p-high' : p === 'MEDIUM' ? 'p-med' : 'p-low';
  }

  getAvatarUrl = (name: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=random`;
}