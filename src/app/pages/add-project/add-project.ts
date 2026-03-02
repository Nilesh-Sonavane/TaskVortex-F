import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Loader } from '../../components/loader/loader';
import { ProjectService } from '../../services/project-service';
import { ToastService } from '../../services/toast';
import { UserService } from '../../services/user-service';

@Component({
  selector: 'app-add-project',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Loader],
  templateUrl: './add-project.html',
  styleUrls: ['./add-project.css']
})
export class AddProjectComponent implements OnInit {

  private projectService = inject(ProjectService);
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  isLoading = false;
  isEditMode = false;
  projectId: number | null = null;

  users: any[] = [];
  managers: any[] = [];
  employees: any[] = [];
  memberSearchTerm = '';

  projectData = {
    name: '',
    key: '',
    description: '',
    managerId: null as number | null,
    startDate: new Date().toISOString().split('T')[0],
    memberIds: new Set<number>()
  };

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      if (idParam) {
        this.isEditMode = true;
        this.projectId = Number(idParam);
      }
      this.loadUsers();
    });
  }

  loadUsers() {
    this.isLoading = true;
    this.userService.getAllUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.processUsers();
        if (this.isEditMode && this.projectId) {
          this.loadProjectForEdit();
        } else {
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.toast.show('Failed to load users', 'error');
        this.isLoading = false;
      }
    });
  }
  loadProjectForEdit() {
    if (!this.projectId) return;
    this.projectService.getProjectById(this.projectId).subscribe({
      next: (project: any) => {
        // Console log for final confirmation
        console.log('Backend Data:', project);

        // --- MAPPING BASED ON YOUR LOG ---
        this.projectData = {
          name: project.name || '',

          // Fix: Use projectKey from your log
          key: project.projectKey || '',

          description: project.description || '',

          // Fix: Use managerId directly as it is already a number in your log
          managerId: project.managerId ? Number(project.managerId) : null,

          startDate: project.startDate || '',

          // Map members list to Set
          memberIds: new Set(project.members?.map((m: any) => m.id) || [])
        };

        this.isLoading = false;

        // Trigger change detection to update the dropdown selection
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.toast.show('Failed to load project details', 'error');
      }
    });
  }

  processUsers() {
    this.managers = this.users.filter(u => ['ADMIN', 'MANAGER'].includes(u.role?.toUpperCase()));
    this.employees = this.users;
  }

  get filteredEmployees() {
    let list = this.employees;
    if (this.projectData.managerId) {
      const mId = Number(this.projectData.managerId);
      list = list.filter(u => u.id != mId);
      if (this.projectData.memberIds.has(mId)) {
        this.projectData.memberIds.delete(mId);
      }
    }
    if (this.memberSearchTerm) {
      const term = this.memberSearchTerm.toLowerCase();
      list = list.filter(u =>
        (u.firstName + ' ' + u.lastName).toLowerCase().includes(term) ||
        (u.jobTitle || '').toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term)
      );
    }
    return list;
  }

  generateKey(name: string) {
    if (this.isEditMode || !name) return;
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '');
    this.projectData.key = cleanName.substring(0, 4).toUpperCase();
  }

  toggleMember(userId: number) {
    if (this.projectData.memberIds.has(userId)) {
      this.projectData.memberIds.delete(userId);
    } else {
      this.projectData.memberIds.add(userId);
    }
  }

  getAvatar = (user: any) => `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}&background=random`;

  onSubmit() {
    this.isLoading = true;
    const payload = {
      ...this.projectData,
      memberIds: Array.from(this.projectData.memberIds)
    };

    const request = (this.isEditMode && this.projectId)
      ? this.projectService.updateProject(this.projectId, payload)
      : this.projectService.addProject(payload);

    request.subscribe({
      next: () => {
        this.router.navigate(['/admin-projects']).then(() => {
          this.toast.show(this.isEditMode ? 'Project updated!' : 'Project created!', 'success');
        });
      },
      error: (err) => {
        this.isLoading = false;
        this.toast.show(err.error?.message || 'Operation failed', 'error');
        this.cdr.detectChanges();
      }
    });
  }
}