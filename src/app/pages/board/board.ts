import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { BoardService } from '../../services/board-service';
import { DepartmentService } from '../../services/department';
import { ProjectService } from '../../services/project-service';
import { UserService } from '../../services/user-service';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './board.html',
  styleUrls: ['./board.css']
})
export class BoardComponent implements OnInit, OnDestroy {
  private boardService = inject(BoardService);
  private projectService = inject(ProjectService);
  private userService = inject(UserService);
  private departmentService = inject(DepartmentService);
  private eRef = inject(ElementRef);

  // --- Current User State ---
  currentUser: any = null;
  isProjectsLoaded = signal(false); // NEW: Prevents premature task fetching

  // --- UI State Signals ---
  isFilterOpen = signal(false);
  activeTab = signal<'Project' | 'Assignee' | 'Status' | 'Priority' | 'Department'>('Project');

  // --- Master Data Signals ---
  allProjects = signal<any[]>([]);
  allUsers = signal<any[]>([]);
  allDepartment = signal<any[]>([]);

  // --- Board Data Signals ---
  tasks = signal<any[]>([]);
  selectedProjectIds = signal<number[]>([]);
  selectedAssigneeIds = signal<number[]>([]);
  selectedStatuses = signal<string[]>([]);
  selectedDepartments = signal<string[]>([]);
  groupBy = signal<'status' | 'user' | 'project'>('status');

  searchTerm = signal<string>('');
  filterSearchQuery = signal<string>('');
  isExportOpen = signal(false);

  // --- KANBAN GLOBAL TIMER LOGIC ---
  currentTime = signal<number>(new Date().getTime());
  private timerInterval: any;

  readonly availableStatuses = [
    'NOT_STARTED', 'DEVELOPMENT_IN_PROGRESS', 'DEVELOPMENT_COMPLETE',
    'RE_DEVELOPMENT_IN_PROGRESS', 'TESTING_IN_PROGRESS', 'TESTING_COMPLETE',
    'RE_TESTING_IN_PROGRESS', 'IN_UAT', 'DEPLOYMENT_COMPLETE', 'HOLD', 'CANCELLED'
  ];

  constructor() {
    // 1. RESTORE MEMORY: Check if we saved filters before we navigated away
    const savedState = sessionStorage.getItem('taskvortex_board_filters');
    if (savedState) {
      const parsed = JSON.parse(savedState);

      // Inject the saved memory directly into your signals before the board loads!
      this.selectedProjectIds.set(parsed.selectedProjectIds || []);
      this.selectedAssigneeIds.set(parsed.selectedAssigneeIds || []);
      this.selectedStatuses.set(parsed.selectedStatuses || []);
      this.selectedDepartments.set(parsed.selectedDepartments || []);
      this.groupBy.set(parsed.groupBy || 'status');
    }

    // 2. YOUR EXISTING EFFECT (Now with Auto-Save!)
    effect(() => {
      // Automatically save the current state to memory every time a user clicks a filter
      const stateToSave = {
        selectedProjectIds: this.selectedProjectIds(),
        selectedAssigneeIds: this.selectedAssigneeIds(),
        selectedStatuses: this.selectedStatuses(),
        selectedDepartments: this.selectedDepartments(),
        groupBy: this.groupBy(),
      };
      sessionStorage.setItem('taskvortex_board_filters', JSON.stringify(stateToSave));

      // Trigger the backend fetch just like you were already doing
      this.fetchBoardData();
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    const userJson = localStorage.getItem('user_details');
    if (userJson) {
      this.currentUser = JSON.parse(userJson);
    }
    this.loadFilterMetadata();
    // Start the global timer to update all cards every 60 seconds
    this.timerInterval = setInterval(() => {
      this.currentTime.set(new Date().getTime());
    }, 60000);
  }

  private loadFilterMetadata() {
    if (!this.currentUser) return;

    // 1. Fetch ONLY the projects this user is involved in (Manager, Group Member, or Assignee)
    this.projectService.getAccessibleProjects(this.currentUser.email).subscribe(data => {
      this.allProjects.set(data);
      this.isProjectsLoaded.set(true); // Tell the effect it is now safe to fetch tasks
    });

    this.userService.getAllUsers().subscribe(data => this.allUsers.set(data));
    this.departmentService.getAll().subscribe(data => this.allDepartment.set(data));
  }

  // --- SECURE BOARD FETCH LOGIC ---
  private fetchBoardData() {
    // Step A: Do not fetch tasks until we know which projects the user is allowed to see
    if (!this.isProjectsLoaded()) return;

    const accessibleProjectIds = this.allProjects().map(p => p.id);

    // Step B: If the user is involved in ZERO projects, clear the board immediately
    if (accessibleProjectIds.length === 0) {
      this.tasks.set([]);
      return;
    }

    // Step C: Force the backend to ONLY return tasks for these specific projects
    // If the user checked boxes in the filter, use those. If not, use ALL accessible projects.
    const selectedUserProjects = this.selectedProjectIds();
    const finalProjectIds = selectedUserProjects.length > 0 ? selectedUserProjects : accessibleProjectIds;

    const filters = {
      projectIds: finalProjectIds,
      assigneeIds: this.selectedAssigneeIds(),
      statuses: this.selectedStatuses(),
      departments: this.selectedDepartments(),
      searchTerm: this.searchTerm().trim()
    };

    this.boardService.getFilteredTasks(filters).subscribe({
      next: (data) => this.tasks.set(data),
      error: (err) => console.error('Error fetching board tasks:', err)
    });
  }

  // --- DYNAMIC BREADCRUMB LOGIC ---
  selectedProjectNames = computed(() => {
    const selectedIds = this.selectedProjectIds();
    const projects = this.allProjects();

    if (selectedIds.length === 0) {
      return 'All My Projects';
    }

    const names = projects.filter(p => selectedIds.includes(p.id)).map(p => p.name);
    return names.length > 2 ? `${names.length} Projects Selected` : names.join(', ');
  });

  filterCount = computed(() =>
    this.selectedProjectIds().length +
    this.selectedAssigneeIds().length +
    this.selectedStatuses().length +
    this.selectedDepartments().length
  );

  // --- GROUPING LOGIC ---
  filteredGroupedTasks = computed((): Record<string, any[]> => {
    const allTasks = this.tasks();
    const grouped: Record<string, any[]> = {};

    if (this.groupBy() === 'status') {
      this.availableStatuses.forEach(status => {
        grouped[status] = allTasks.filter(t => t.status === status);
      });
    } else if (this.groupBy() === 'user') {
      this.allUsers().forEach(user => {
        const fullName = `${user.firstName} ${user.lastName}`;
        grouped[fullName] = allTasks.filter(t => t.assigneeName === fullName);
      });
      const unassigned = allTasks.filter(t => !t.assigneeName);
      if (unassigned.length > 0) grouped['Unassigned'] = unassigned;
    } else if (this.groupBy() === 'project') {
      this.allProjects().forEach(project => {
        grouped[project.name] = allTasks.filter(t => t.projectId === project.id || t.projectKey === project.key || t.projectName === project.name);
      });
      const noProject = allTasks.filter(t => !t.projectId && !t.projectKey && !t.projectName);
      if (noProject.length > 0) grouped['No Project'] = noProject;
    }

    return grouped;
  });

  columnNames = computed(() => {
    const grouped = this.filteredGroupedTasks();
    const selectedStatusFilters = this.selectedStatuses();
    const selectedUserFilters = this.selectedAssigneeIds();

    const isFilteringSearchOrOther =
      this.searchTerm().trim() !== '' ||
      this.selectedProjectIds().length > 0 ||
      this.selectedDepartments().length > 0;

    if (this.groupBy() === 'status') {
      if (selectedStatusFilters.length > 0) {
        return this.availableStatuses.filter(status => selectedStatusFilters.includes(status));
      }
      return Object.keys(grouped).filter(key => grouped[key].length > 0);
    }

    if (this.groupBy() === 'user') {
      if (selectedUserFilters.length > 0) {
        return this.allUsers()
          .filter(user => selectedUserFilters.includes(user.id))
          .map(user => `${user.firstName} ${user.lastName}`);
      }
      if (isFilteringSearchOrOther || selectedStatusFilters.length > 0) {
        return Object.keys(grouped).filter(key => grouped[key].length > 0);
      }
    }

    if (this.groupBy() === 'project') {
      if (this.selectedProjectIds().length > 0) {
        return this.allProjects()
          .filter(project => this.selectedProjectIds().includes(project.id))
          .map(project => project.name);
      }
      if (isFilteringSearchOrOther || selectedStatusFilters.length > 0 || selectedUserFilters.length > 0) {
        return Object.keys(grouped).filter(key => grouped[key].length > 0);
      }
    }

    return Object.keys(grouped).filter(key => grouped[key].length > 0);
  });

  // --- ACTIONS ---
  toggleFilterMenu() { this.isFilterOpen.update(v => !v); }

  toggleProjectFilter(id: number) {
    this.selectedProjectIds.update(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
  }

  toggleUserFilter(id: number) {
    this.selectedAssigneeIds.update(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
  }

  toggleStatusFilter(status: string) {
    this.selectedStatuses.update(s => s.includes(status) ? s.filter(x => x !== status) : [...s, status]);
  }

  toggleDepartmentFilter(deptName: string) {
    this.selectedDepartments.update(depts => depts.includes(deptName) ? depts.filter(d => d !== deptName) : [...depts, deptName]);
  }

  resetFilters() {
    this.selectedProjectIds.set([]);
    this.selectedAssigneeIds.set([]);
    this.selectedStatuses.set([]);
    this.selectedDepartments.set([]);
    this.searchTerm.set('');
    this.filterSearchQuery.set('');
  }

  filteredProjects = computed(() => {
    const query = this.filterSearchQuery().toLowerCase().trim();
    return this.allProjects().filter(p => p.name.toLowerCase().includes(query));
  });

  filteredUsers = computed(() => {
    const query = this.filterSearchQuery().toLowerCase().trim();
    return this.allUsers().filter(u => (u.firstName + ' ' + u.lastName).toLowerCase().includes(query));
  });

  filteredStatuses = computed(() => {
    const query = this.filterSearchQuery().toLowerCase().trim();
    return this.availableStatuses.filter(s => s.replace(/_/g, ' ').toLowerCase().includes(query));
  });

  filteredDepartments = computed(() => {
    const query = this.filterSearchQuery().toLowerCase().trim();
    return this.allDepartment().filter(d => d?.name?.toLowerCase().includes(query));
  });

  selectTab(tab: 'Project' | 'Assignee' | 'Status' | 'Department' | 'Priority') {
    this.activeTab.set(tab);
    this.filterSearchQuery.set('');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const filter_container = this.eRef.nativeElement.querySelector('.filter-dropdown-container');
    const export_container = this.eRef.nativeElement.querySelector('.export-dropdown-container');

    if (filter_container && !filter_container.contains(event.target) && this.isFilterOpen()) {
      this.isFilterOpen.set(false);
    }

    if (export_container && !export_container.contains(event.target) && this.isExportOpen()) {
      this.isExportOpen.set(false);
    }
  }

  getAvatar(name: string) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=random&size=64`;
  }

  getStatusColor(status: string): string {
    const statusMap: Record<string, string> = {
      'NOT_STARTED': '#6b778c',
      'HOLD': '#ff8b00',
      'CANCELLED': '#de350b',
      'DEVELOPMENT_IN_PROGRESS': '#006644',
      'RE_DEVELOPMENT_IN_PROGRESS': '#216e4e',
      'DEVELOPMENT_COMPLETE': '#36b37e',
      'TESTING_IN_PROGRESS': '#403294',
      'RE_TESTING_IN_PROGRESS': '#5243aa',
      'TESTING_COMPLETE': '#00b8d9',
      'IN_UAT': '#0052cc',
      'DEPLOYMENT_COMPLETE': '#172b4d'
    };
    return statusMap[status] || '#94a3b8';
  }

  formatStatus(status: string): string {
    if (!status) return '';
    return status.replace(/_/g, ' ').toLowerCase();
  }

  getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      'HIGH': '#ef4444',
      'MEDIUM': '#f59e0b',
      'LOW': '#22c55e',
    };
    return colors[priority] || '#94a3b8';
  }

  exportData(type: 'excel' | 'csv' | 'pdf') {
    const rawData = this.tasks().map(task => ({
      'ID': `${task.projectKey}-${task.id}`,
      'Title': task.title,
      'Status': this.formatStatus(task.status).toUpperCase(),
      'Priority': task.priority,
      'Assignee': task.assigneeName || 'Unassigned',
      'Department': task.dept
    }));

    const date = new Date().toISOString().split('T')[0];

    if (type === 'excel' || type === 'csv') {
      const worksheet = XLSX.utils.json_to_sheet(rawData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks');
      XLSX.writeFile(workbook, `TaskVortex_Export_${date}.${type === 'excel' ? 'xlsx' : 'csv'}`);
    } else if (type === 'pdf') {
      const doc = new jsPDF();
      doc.text(`TaskVortex Report - ${date}`, 14, 15);
      autoTable(doc, {
        startY: 20,
        head: [['ID', 'Title', 'Status', 'Priority', 'Assignee', 'Department']],
        body: rawData.map(r => Object.values(r)),
        theme: 'grid',
        headStyles: { fillColor: [0, 82, 204] }
      });
      doc.save(`TaskVortex_Report_${date}.pdf`);
    }
    this.isExportOpen.set(false);
  }

  ngOnDestroy(): void {
    // Prevent memory leaks when navigating away from the board
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  isOverdue(task: any): boolean {
    if (!task || !task.dueDate) return false;

    const completedStatuses = ['DEPLOYMENT_COMPLETE', 'TESTING_COMPLETE', 'DONE', 'CANCELLED'];
    if (completedStatuses.includes(task.status)) return false;

    const dueDate = new Date(task.dueDate);
    const today = new Date(this.currentTime()); // Bound to the signal
    today.setHours(0, 0, 0, 0);

    return dueDate < today;
  }

  getTimeLeft(task: any): string | null {
    if (!task || !task.dueDate) return null;

    const completedStatuses = ['DEPLOYMENT_COMPLETE', 'TESTING_COMPLETE', 'DONE', 'CANCELLED'];
    if (completedStatuses.includes(task.status)) return 'Done';

    const deadline = new Date(task.dueDate);
    deadline.setHours(23, 59, 59, 999);

    const diff = deadline.getTime() - this.currentTime(); // Bound to the signal

    if (diff <= 0) {
      const overdueDays = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
      return overdueDays === 0 ? 'Due Today' : `${overdueDays}d Late`;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);

    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h ${minutes}m`;
  }
}