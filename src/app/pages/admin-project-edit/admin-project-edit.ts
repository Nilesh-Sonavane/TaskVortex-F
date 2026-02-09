import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Loader } from '../../components/loader/loader';
// 1. IMPORT YOUR CONFIRM DIALOG
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog';
import { DepartmentService } from '../../services/department';
import { ProjectService } from '../../services/project-service';
import { ToastService } from '../../services/toast';
import { UserService } from '../../services/user-service';

@Component({
  selector: 'app-admin-project-edit',
  standalone: true,
  // 2. ADD TO IMPORTS
  imports: [CommonModule, FormsModule, RouterLink, Loader, ConfirmDialogComponent],
  templateUrl: './admin-project-edit.html',
  styleUrls: ['./admin-project-edit.css']
})
export class AdminProjectEditComponent implements OnInit {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private deptService = inject(DepartmentService);
  private userService = inject(UserService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  // 3. ACCESS THE DIALOG
  @ViewChild(ConfirmDialogComponent) confirmDialog!: ConfirmDialogComponent;

  isLoading = false;
  projectId!: number;

  // UI State
  showMemberAdd = false;
  memberSearchTerm = '';

  departments: any[] = [];
  managers: any[] = [];
  allUsers: any[] = [];
  availableUsers: any[] = [];

  project: any = {
    name: '',
    projectKey: '',
    description: '',
    status: 'ACTIVE',
    managerId: null,
    departmentId: null,
    startDate: '',
    endDate: '',
    members: []
  };

  ngOnInit() {
    this.projectId = Number(this.route.snapshot.paramMap.get('id'));

    if (this.projectId) {
      this.loadInitialData();
    } else {
      this.toast.show('Invalid Project ID', 'error');
      this.router.navigate(['/admin-projects']);
    }
  }

  loadInitialData() {
    this.isLoading = true;
    this.cdr.detectChanges();

    forkJoin({
      project: this.projectService.getProjectById(this.projectId),
      depts: this.deptService.getAll(),
      users: this.userService.getAllUsers()
    })
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response: any) => {
          try {
            this.project = response.project || {};
            this.departments = response.depts || [];
            this.allUsers = response.users || [];

            // Filter Managers
            this.managers = this.allUsers.filter((u: any) => {
              const role = (u.role || '').toUpperCase();
              return role === 'ADMIN' || role === 'MANAGER';
            });

            // Date Fixes
            if (this.project.startDate) this.project.startDate = this.project.startDate.toString().split('T')[0];
            if (this.project.targetEndDate) this.project.endDate = this.project.targetEndDate.toString().split('T')[0];
            else if (this.project.endDate) this.project.endDate = this.project.endDate.toString().split('T')[0];

            if (!this.project.members) this.project.members = [];

          } catch (error) {
            console.error('Error processing data:', error);
          }
        },
        error: (err) => {
          this.toast.show('Failed to load project', 'error');
          this.router.navigate(['/admin-projects']);
        }
      });
  }

  // --- MEMBER MANAGEMENT ---

  toggleAddMember() {
    this.showMemberAdd = !this.showMemberAdd;
    this.memberSearchTerm = '';

    if (this.showMemberAdd) {
      const currentMemberIds = new Set(this.project.members.map((m: any) => m.id));
      // Filter: Not in project AND Role is EMPLOYEE
      this.availableUsers = this.allUsers.filter((u: any) => {
        const isNotMember = !currentMemberIds.has(u.id);
        const isEmployee = (u.role || '').toUpperCase() === 'EMPLOYEE';
        return isNotMember && isEmployee;
      });
    }
  }

  get filteredAvailableUsers() {
    if (!this.memberSearchTerm) return this.availableUsers;
    const term = this.memberSearchTerm.toLowerCase();
    return this.availableUsers.filter(u =>
      (u.firstName + ' ' + u.lastName).toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term)
    );
  }

  addMember(user: any) {
    this.project.members.push({
      id: user.id,
      name: user.firstName + ' ' + user.lastName,
      email: user.email
    });
    this.showMemberAdd = false;
  }

  // 4. UPDATED REMOVE MEMBER (Using Custom Dialog)
  removeMember(userId: number) {
    this.confirmDialog.open(
      'Are you sure you want to remove this member?',
      'Yes, Remove',
      () => {
        // This runs only if user clicks "Yes"
        this.project.members = this.project.members.filter((m: any) => m.id !== userId);
        this.toast.show('Member removed (Save to persist)', 'success');
      }
    );
  }

  // --- ACTIONS ---

  onSubmit() {
    if (this.project.startDate && this.project.endDate) {
      if (new Date(this.project.endDate) < new Date(this.project.startDate)) {
        this.toast.show('End Date cannot be before Start Date', 'error');
        return;
      }
    }

    this.isLoading = true;

    const requestPayload = {
      name: this.project.name,
      key: this.project.projectKey,
      description: this.project.description,
      managerId: this.project.managerId,
      departmentId: this.project.departmentId,
      status: this.project.status,
      startDate: this.project.startDate,
      endDate: this.project.endDate,
      progress: this.project.progress,
      memberIds: this.project.members.map((m: any) => m.id)
    };

    this.projectService.updateProject(this.projectId, requestPayload)
      .pipe(finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.toast.show('Project updated successfully', 'success');
          this.router.navigate(['/admin-projects']);
        },
        error: (err) => {
          console.error(err);
          this.toast.show('Failed to update project', 'error');
        }
      });
  }

  // 5. UPDATED ARCHIVE PROJECT (Using Custom Dialog)
  archiveProject() {
    this.confirmDialog.open(
      'Are you sure you want to archive this project? It will be hidden from active lists.',
      'Yes, Archive it',
      () => {
        // Set status to ARCHIVED and save immediately
        this.project.status = 'ARCHIVED';
        this.onSubmit();
      }
    );
  }
}