import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Chart, ChartConfiguration, ChartData, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { AuthService } from '../../auth/auth';
import { ProjectService } from '../../services/project-service';
import { TaskService } from '../../services/task-service';
import { UserService } from '../../services/user-service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  public auth = inject(AuthService);
  private taskService = inject(TaskService);
  private projectService = inject(ProjectService);
  private userService = inject(UserService);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);

  // Raw Data Signals
  tasks = signal<any[]>([]);
  totalUsers = signal<number>(0);
  activeProjects = signal<number>(0);
  auditLogs = signal<any[]>([]);
  selectedActivityFilter = signal<string>('ALL');
  searchTerm = signal<string>('');
  fromDate = signal<string>('');
  toDate = signal<string>('');
  // Filters for Personal "My Activity" Feed
  mySearchTerm = signal<string>('');
  myFromDate = signal<string>('');
  myToDate = signal<string>('');
  constructor() {
    Chart.register(...registerables);
  }

  ngOnInit() {
    const user = this.auth.currentUser;
    if (!user) return; // Safety check

    // 1. Fetch Tasks Based on Role
    if (this.auth.isAdmin()) {
      this.taskService.getAllTasks().subscribe(data => {
        this.tasks.set(data);
      });
    }
    else if (this.auth.isManager()) {
      this.taskService.getTasksByManager(user.id).subscribe(data => this.tasks.set(data));
    }
    else {
      this.taskService.getTasksByAssignee(user.id).subscribe(data => this.tasks.set(data));
    }

    // 2. Fetch Active Projects Based on Role
    if (this.auth.isAdmin()) {
      this.projectService.getAllProjects().subscribe(projects => {
        this.activeProjects.set(projects.length);
      });
      this.userService.getAllUsers().subscribe(users => {
        this.totalUsers.set(users.length);
      });
    }
    else if (this.auth.isManager()) {
      this.projectService.getProjectsByManager(user.id).subscribe(projects => {
        this.activeProjects.set(projects.length);
      });
    }

    // 3. Fetch Global Activity Logs
    this.taskService.getGlobalActivity().subscribe(logs => {
      const safeLogs = logs.map(log => ({
        ...log,
        // FIX: We save the HTML to "safeDetails" so we don't destroy the original "details" string!
        safeDetails: this.sanitizer.bypassSecurityTrustHtml(log.details)
      }));
      this.auditLogs.set(safeLogs);
    });
  }

  // --- UI Helper for Avatars ---
  getAvatar(name: string | undefined): string {
    if (!name) return 'https://ui-avatars.com/api/?name=Unassigned&background=cbd5e1&color=fff';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e0e7ff&color=4f46e5`;
  }

  // =========================================================
  // COMPUTED SIGNALS
  // =========================================================

  globalStats = computed(() => {
    const t = this.tasks().filter(x => x.status !== 'CANCELLED');
    const completed = t.filter(x => x.status === 'DEPLOYMENT_COMPLETE').length;
    return {
      totalTasks: t.length,
      efficiency: t.length > 0 ? Math.round((completed / t.length) * 100) : 0,
    };
  });

  employeeStats = computed(() => {
    const myId = this.auth.currentUser?.id;
    const myTasks = this.tasks().filter(x => x.assigneeId === myId && x.status !== 'CANCELLED');
    return {
      todo: myTasks.filter(x => x.status === 'NOT_STARTED').length,
      inProgress: myTasks.filter(x => ['DEVELOPMENT_IN_PROGRESS', 'TESTING_IN_PROGRESS', 'IN_UAT'].includes(x.status)).length,
      completed: myTasks.filter(x => x.status === 'DEPLOYMENT_COMPLETE').length
    };
  });

  myFocus = computed(() => {
    const myId = this.auth.currentUser?.id;
    const myTasks = this.tasks().filter(x => x.assigneeId === myId && x.status !== 'DEPLOYMENT_COMPLETE' && x.status !== 'CANCELLED');
    return {
      activeCount: myTasks.length,
      urgentList: myTasks.slice(0, 4)
    };
  });

  recentlyAssigned = computed(() => {
    const myId = this.auth.currentUser?.id;
    return this.tasks().filter(x => x.assigneeId === myId && x.status === 'NOT_STARTED').slice(0, 4);
  });

  managerAlerts = computed(() => {
    const t = this.tasks();
    return {
      rework: t.filter(x => ['RE_DEVELOPMENT_IN_PROGRESS', 'RE_TESTING_IN_PROGRESS'].includes(x.status)),
      blocked: t.filter(x => ['HOLD', 'DEVELOPMENT_COMPLETE', 'TESTING_COMPLETE'].includes(x.status))
    };
  });

  // MASTER FILTER FOR PERSONAL FEED
  myRecentActivity = computed(() => {
    const myId = this.auth.currentUser?.id;

    // 1. Get only logs performed by ME
    let myLogs = this.auditLogs().filter(log => log.performedBy?.id === myId);

    const search = this.mySearchTerm().toLowerCase().trim();
    const from = this.myFromDate();
    const to = this.myToDate();

    // 2. Filter by Search Text (Checks action, details, and entity name)
    if (search) {
      myLogs = myLogs.filter(log =>
        log.action?.toLowerCase().includes(search) ||
        log.details?.toLowerCase().includes(search) ||
        log.entityName?.toLowerCase().includes(search)
      );
    }

    // 3. Filter by Date Range
    if (from) {
      const fromTime = new Date(from).getTime();
      myLogs = myLogs.filter(log => new Date(log.timestamp).getTime() >= fromTime);
    }

    if (to) {
      const toDateObj = new Date(to);
      toDateObj.setHours(23, 59, 59, 999);
      myLogs = myLogs.filter(log => new Date(log.timestamp).getTime() <= toDateObj.getTime());
    }

    return myLogs;
  });

  onMySearch(event: Event) {
    this.mySearchTerm.set((event.target as HTMLInputElement).value);
  }

  onMyFromDateChange(event: Event) {
    this.myFromDate.set((event.target as HTMLInputElement).value);
  }

  onMyToDateChange(event: Event) {
    this.myToDate.set((event.target as HTMLInputElement).value);
  }

  // MASTER FILTER: Handles Entity, Search, and Date Range instantly!
  recentActivity = computed(() => {
    let filteredLogs = this.auditLogs();
    const filter = this.selectedActivityFilter();
    const search = this.searchTerm().toLowerCase().trim();
    const from = this.fromDate();
    const to = this.toDate();

    // 1. Filter by Entity Dropdown
    if (filter !== 'ALL') {
      filteredLogs = filteredLogs.filter(log => log.entityName === filter);
    }

    // 2. Filter by Search Text (Checks action, details, and user name)
    if (search) {
      filteredLogs = filteredLogs.filter(log => {
        // Build the full name exactly as it appears on screen
        const performerName = log.performedBy
          ? `${log.performedBy.firstName || ''} ${log.performedBy.lastName || ''}`.trim().toLowerCase()
          : 'system'; // Fallback to 'system' if performedBy is null

        return (
          log.action?.toLowerCase().includes(search) ||
          log.details?.toLowerCase().includes(search) ||
          performerName.includes(search)
        );
      });
    }

    // 3. Filter by Date Range
    if (from) {
      const fromTime = new Date(from).getTime();
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp).getTime() >= fromTime);
    }

    if (to) {
      // Set to the very end of the selected day (23:59:59) so it includes the whole day
      const toDateObj = new Date(to);
      toDateObj.setHours(23, 59, 59, 999);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp).getTime() <= toDateObj.getTime());
    }

    return filteredLogs;
  });

  onActivityFilterChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedActivityFilter.set(selectElement.value);
  }
  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  onFromDateChange(event: Event) {
    this.fromDate.set((event.target as HTMLInputElement).value);
  }

  onToDateChange(event: Event) {
    this.toDate.set((event.target as HTMLInputElement).value);
  }

  public statusData = computed((): ChartData<'doughnut'> => {
    const t = this.tasks().filter(x => x.status !== 'CANCELLED');
    const pending = t.filter(x => x.status === 'NOT_STARTED' || x.status === 'PENDING').length;
    const done = t.filter(x => x.status === 'DEPLOYMENT_COMPLETE' || x.status === 'DONE').length;
    const rework = this.managerAlerts().rework.length;
    const active = t.length - (pending + done + rework);

    return {
      labels: ['Pending', 'Active Work', 'Rework', 'Deployed'],
      datasets: [{
        data: [pending, active, rework, done],
        backgroundColor: ['#cbd5e1', '#3b82f6', '#ef4444', '#10b981'],
        borderWidth: 0,
        hoverOffset: 8
      }]
    };
  });

  public doughnutOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%', // Leaves a nice big empty center
    plugins: {

      // 1. YOUR EXISTING LEGEND
      legend: {
        display: true,
        position: 'right',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { size: 12, family: "'Inter', sans-serif" }
        }
      },

      // 2. NEW: UPGRADED TOOLTIPS
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)', // Dark premium background
        titleFont: { family: "'Inter', sans-serif", size: 13 },
        bodyFont: { family: "'Inter', sans-serif", size: 14, weight: 'bold' },
        padding: 12,
        cornerRadius: 8,
        displayColors: true, // Keeps the little color box in the tooltip
        callbacks: {
          // This custom logic calculates the percentage automatically!
          label: (context: any) => {
            const label = context.label || '';
            const value = context.parsed;

            // Get the total of all slices to calculate math
            const dataset = context.chart.data.datasets[0];
            const total = dataset.data.reduce((acc: number, curr: number) => acc + curr, 0);

            // Prevent dividing by zero
            if (total === 0) return `${label}: 0`;

            const percentage = Math.round((value / total) * 100);
            return ` ${label}: ${value} Tasks (${percentage}%)`;
          }
        }
      }

    }
  };

  public capacityData = computed((): ChartData<'bar'> => {
    const activeTasks = this.tasks().filter(x => x.status !== 'DEPLOYMENT_COMPLETE' && x.status !== 'CANCELLED');
    const names = [...new Set(activeTasks.map(x => x.assigneeName || 'Unassigned'))];

    return {
      labels: names,
      datasets: [{
        label: 'Active Tasks',
        data: names.map(n => activeTasks.filter(x => x.assigneeName === n).length),
        backgroundColor: '#4f46e5',
        borderRadius: 6,
        maxBarThickness: 40
      }]
    };
  });

  public barOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }
  };

  goToTask(taskId: number) {
    this.router.navigate(['/tasks', taskId]);
  }
  goToEntity(entityName: string, entityId: number) {
    if (!entityId) return; // Safety check

    switch (entityName) {
      case 'TASKS':
        this.router.navigate(['/tasks', entityId]); // Route to Task Details
        break;
      case 'PROJECTS':
        this.router.navigate(['/projects', entityId]); // Route to Project Details
        break;
      case 'USERS':
        this.router.navigate(['/users']); // Route to Users List
        break;
      case 'DEPARTMENTS':
        this.router.navigate(['/departments']); // Route to Departments List
        break;
      default:
        console.log('No route defined for entity:', entityName);
    }
  }
}