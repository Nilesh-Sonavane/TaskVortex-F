import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
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
export class BoardComponent implements OnInit {
  private boardService = inject(BoardService);
  private projectService = inject(ProjectService);
  private userService = inject(UserService);
  private departmentService = inject(DepartmentService);

  private eRef = inject(ElementRef);

  // --- UI State Signals ---
  isFilterOpen = signal(false);
  activeTab = signal<'Project' | 'Assignee' | 'Status' | 'Priority' | 'Department'>('Project');
  currentUserEmail = 'xyz@taskvortex.com';

  // --- Master Data Signals (Loaded once for Filters) ---
  allProjects = signal<any[]>([]);
  allUsers = signal<any[]>([]);
  allDepartment = signal<any[]>([]);

  // --- Board Data Signals (Filtered dynamically) ---
  tasks = signal<any[]>([]);
  selectedProjectIds = signal<number[]>([]);
  selectedAssigneeIds = signal<number[]>([]);
  selectedStatuses = signal<string[]>([]);
  selectedDepartments = signal<string[]>([]);
  groupBy = signal<'status' | 'user' | 'project'>('status');

  searchTerm = signal<string>('');
  filterSearchQuery = signal<string>('');
  isExportOpen = signal(false);

  readonly availableStatuses = [
    'NOT_STARTED', 'DEVELOPMENT_IN_PROGRESS', 'DEVELOPMENT_COMPLETE',
    'RE_DEVELOPMENT_IN_PROGRESS', 'TESTING_IN_PROGRESS', 'TESTING_COMPLETE',
    'RE_TESTING_IN_PROGRESS', 'IN_UAT', 'DEPLOYMENT_COMPLETE', 'HOLD', 'CANCELLED'
  ];

  constructor() {
    // Re-fetch board tasks whenever a filter signal changes
    effect(() => {
      this.fetchBoardData();
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    // Load absolute master data for the filter dropdowns
    this.loadFilterMetadata();

  }

  private loadFilterMetadata() {
    // Replace with your actual service methods
    this.projectService.getAllProjects().subscribe(data => this.allProjects.set(data));
    this.userService.getAllUsers().subscribe(data => this.allUsers.set(data));
    this.departmentService.getAll().subscribe(data => this.allDepartment.set(data));

  }
  // --- DYNAMIC BREADCRUMB LOGIC ---
  selectedProjectNames = computed(() => {
    const selectedIds = this.selectedProjectIds();
    const projects = this.allProjects();

    if (selectedIds.length === 0) {
      return 'All'; // Default when nothing is filtered
    }

    // Find the names of selected projects
    const names = projects
      .filter(p => selectedIds.includes(p.id))
      .map(p => p.name);

    if (names.length > 2) {
      return `${names.length} Projects Selected`;
    }

    return names.join(', '); // Displays "Project A, Project B"
  });

  private fetchBoardData() {
    const filters = {
      projectIds: this.selectedProjectIds(),
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

  filterCount = computed(() =>
    this.selectedProjectIds().length +
    this.selectedAssigneeIds().length +
    this.selectedStatuses().length +
    this.selectedDepartments().length
  );

  // Kanban Grouping with Record type to solve indexing error
  // --- UPDATED GROUPING LOGIC ---
  // --- UPDATED GROUPING LOGIC ---
  filteredGroupedTasks = computed((): Record<string, any[]> => {
    const allTasks = this.tasks();
    const grouped: Record<string, any[]> = {};

    if (this.groupBy() === 'status') {
      this.availableStatuses.forEach(status => {
        grouped[status] = allTasks.filter(t => t.status === status);
      });
    } else if (this.groupBy() === 'user') {
      // Group by Assignee Name
      this.allUsers().forEach(user => {
        const fullName = `${user.firstName} ${user.lastName}`;
        grouped[fullName] = allTasks.filter(t => t.assigneeName === fullName);
      });
      // Catch unassigned tasks
      const unassigned = allTasks.filter(t => !t.assigneeName);
      if (unassigned.length > 0) grouped['Unassigned'] = unassigned;
    } else if (this.groupBy() === 'project') {
      // Group by Project Name
      this.allProjects().forEach(project => {
        // Checking by projectId or projectKey depending on what your task object uses
        grouped[project.name] = allTasks.filter(t => t.projectId === project.id || t.projectKey === project.key || t.projectName === project.name);
      });
      // Catch tasks without a project (just in case)
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

    // --- CASE 1: GROUP BY STATUS ---
    if (this.groupBy() === 'status') {
      if (selectedStatusFilters.length > 0) {
        return this.availableStatuses.filter(status => selectedStatusFilters.includes(status));
      }
      return Object.keys(grouped).filter(key => grouped[key].length > 0);
    }

    // --- CASE 2: GROUP BY ASSIGNEE (USER) ---
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

    // --- CASE 3: GROUP BY PROJECT ---
    if (this.groupBy() === 'project') {
      // If user explicitly checked specific projects in the filter
      if (this.selectedProjectIds().length > 0) {
        return this.allProjects()
          .filter(project => this.selectedProjectIds().includes(project.id))
          .map(project => project.name);
      }
      // If searching or filtering by something else, hide empty project rows
      if (isFilteringSearchOrOther || selectedStatusFilters.length > 0 || selectedUserFilters.length > 0) {
        return Object.keys(grouped).filter(key => grouped[key].length > 0);
      }
    }

    // --- DEFAULT (No Filters) ---
    return Object.keys(grouped).filter(key => grouped[key].length > 0);
  });

  // --- ACTIONS ---
  toggleFilterMenu() { this.isFilterOpen.update(v => !v); }

  toggleProjectFilter(id: number) {
    this.selectedProjectIds.update(ids =>
      ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]
    );
  }

  toggleUserFilter(id: number) {
    this.selectedAssigneeIds.update(ids =>
      ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]
    );
  }

  toggleStatusFilter(status: string) {
    this.selectedStatuses.update(s =>
      s.includes(status) ? s.filter(x => x !== status) : [...s, status]
    );
  }

  toggleDepartmentFilter(deptName: string) {
    this.selectedDepartments.update(depts => {
      const exists = depts.includes(deptName);
      if (exists) {
        return depts.filter(d => d !== deptName);
      } else {
        return [...depts, deptName];
      }
    });
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
    return this.allProjects().filter(p =>
      p.name.toLowerCase().includes(query)
    );
  });

  filteredUsers = computed(() => {
    const query = this.filterSearchQuery().toLowerCase().trim();
    return this.allUsers().filter(u =>
      (u.firstName + ' ' + u.lastName).toLowerCase().includes(query)
    );
  });

  filteredStatuses = computed(() => {
    const query = this.filterSearchQuery().toLowerCase().trim();
    return this.availableStatuses.filter(s =>
      s.replace(/_/g, ' ').toLowerCase().includes(query)
    );
  });

  filteredDepartments = computed(() => {
    const query = this.filterSearchQuery().toLowerCase().trim();
    return this.allDepartment().filter(d =>
      d?.name?.toLowerCase().includes(query)
    );
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
      'NOT_STARTED': '#6b778c',                // Gray
      'HOLD': '#ff8b00',                       // Orange
      'CANCELLED': '#de350b',                  // Red
      'DEVELOPMENT_IN_PROGRESS': '#006644',    // Dark Green
      'RE_DEVELOPMENT_IN_PROGRESS': '#216e4e', // Forest Green
      'DEVELOPMENT_COMPLETE': '#36b37e',       // Light Green
      'TESTING_IN_PROGRESS': '#403294',        // Deep Purple
      'RE_TESTING_IN_PROGRESS': '#5243aa',     // Light Purple
      'TESTING_COMPLETE': '#00b8d9',           // Sky Blue
      'IN_UAT': '#0052cc',                     // Jira Blue
      'DEPLOYMENT_COMPLETE': '#172b4d'         // Navy (Final)
    };

    return statusMap[status] || '#94a3b8'; // Fallback Slate
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
    }
    else if (type === 'pdf') {
      const doc = new jsPDF();
      doc.text(`TaskVortex Report - ${date}`, 14, 15);
      autoTable(doc, {
        startY: 20,
        head: [['ID', 'Title', 'Status', 'Priority', 'Assignee', 'Department']],
        body: rawData.map(r => Object.values(r)),
        theme: 'grid',
        headStyles: { fillColor: [0, 82, 204] } // Jira Blue
      });
      doc.save(`TaskVortex_Report_${date}.pdf`);
    }
    this.isExportOpen.set(false);
  }
}