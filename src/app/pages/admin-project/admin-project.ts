import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog';
import { Loader } from '../../components/loader/loader';
import { ProjectService } from '../../services/project-service';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-admin-project',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, Loader, ConfirmDialogComponent],
  templateUrl: './admin-project.html',
  styleUrls: ['./admin-project.css']
})
export class AdminProjectComponent implements OnInit {

  private projectService = inject(ProjectService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild(ConfirmDialogComponent) confirmDialog!: ConfirmDialogComponent;

  isLoading = false;
  allProjects: any[] = [];
  filteredProjects: any[] = [];

  searchTerm: string = '';
  statusFilter: string = 'active';

  ngOnInit() {
    this.loadProjects();
  }

  loadProjects() {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.projectService.getAllProjects()
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (data) => {
          if (!data) {
            this.allProjects = [];
            return;
          }
          // SIMPLIFIED MAPPING: Just add icons/colors. 
          // We rely on the DTO fields (managerName, departmentName) directly.
          this.allProjects = data.map((p: any) => ({
            ...p,
            icon: this.assignRandomIcon(p.id),
            iconColorClass: this.assignRandomColor(p.id)
          }));

          this.applyFilters();
        },
        error: (err) => {
          console.error('Failed to load projects', err);
          this.toast.show('Error loading projects', 'error');
        }
      });
  }

  applyFilters() {
    this.filteredProjects = this.allProjects.filter(p => {
      // Status Filter
      const matchesStatus = this.statusFilter === 'active'
        ? (p.status === 'ACTIVE' || p.status === 'ON_HOLD')
        : (p.status === 'ARCHIVED');

      // Search Filter
      const term = this.searchTerm.toLowerCase();
      // Use flattened DTO field names
      const deptName = (p.departmentName || '').toLowerCase();
      const mgrName = (p.managerName || '').toLowerCase();

      const matchesSearch =
        (p.name || '').toLowerCase().includes(term) ||
        (p.projectKey || '').toLowerCase().includes(term) ||
        deptName.includes(term) ||
        mgrName.includes(term);

      return matchesStatus && matchesSearch;
    });
  }

  // --- ACTIONS ---

  archiveProject(id: number) {
    this.confirmDialog.open(
      'Are you sure you want to archive this project?',
      'Yes, Archive it',
      () => {
        this.performStatusUpdate(id, 'ARCHIVED', 'Project archived successfully');
      }
    );
  }

  restoreProject(id: number) {
    this.confirmDialog.open(
      'Are you sure you want to restore this project?',
      'Yes, Restore it',
      () => {
        this.performStatusUpdate(id, 'ACTIVE', 'Project restored to active');
      }
    );
  }

  performStatusUpdate(id: number, status: string, successMsg: string) {
    this.isLoading = true;
    this.projectService.updateStatus(id, status)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: () => {
          this.toast.show(successMsg, 'success');
          this.loadProjects();
        },
        error: () => this.toast.show('Action failed', 'error')
      });
  }

  deleteProject(id: number) {
    this.confirmDialog.open(
      'This will permanently delete the project and all tasks!',
      'Yes, Delete it',
      () => {
        this.isLoading = true;
        this.projectService.deleteProject(id)
          .pipe(finalize(() => this.isLoading = false))
          .subscribe({
            next: () => {
              this.toast.show('Project deleted permanently', 'success');
              this.loadProjects();
            },
            error: () => this.toast.show('Failed to delete project', 'error')
          });
      }
    );
  }

  // --- UI HELPERS ---

  assignRandomIcon(id: number): string {
    const icons = ['fa-layer-group', 'fa-mobile-screen', 'fa-server', 'fa-code-branch', 'fa-globe'];
    return icons[(id || 0) % icons.length];
  }

  assignRandomColor(id: number): string {
    const colors = [
      'text-primary bg-primary bg-opacity-10',
      'text-success bg-success bg-opacity-10',
      'text-warning bg-warning bg-opacity-10',
      'text-info bg-info bg-opacity-10',
      'text-danger bg-danger bg-opacity-10'
    ];
    return colors[(id || 0) % colors.length];
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'badge-status st-active';
      case 'ON_HOLD': return 'badge-status st-hold';
      case 'ARCHIVED': return 'badge-status st-archived';
      case 'COMPLETED': return 'badge-status st-completed'; // Added completed style
      default: return 'badge-status';
    }
  }

  getProgressColor(progress: number): string {
    if (!progress) return 'bg-light';
    if (progress === 100) return 'bg-success';
    if (progress < 30) return 'bg-danger';
    if (progress > 70) return 'bg-primary';
    return 'bg-warning';
  }

  // UPDATED: Accepts string name directly
  getAvatarUrl(name: string): string {
    if (!name) return 'https://ui-avatars.com/api/?name=Unknown';
    return `https://ui-avatars.com/api/?name=${name}&background=random`;
  }
}