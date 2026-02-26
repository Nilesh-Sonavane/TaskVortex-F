import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';

import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog';
import { Loader } from '../../components/loader/loader';
import { ProjectService } from '../../services/project-service';
import { TaskService } from '../../services/task-service';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-create-task',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    Loader,
    NgSelectModule,
    ConfirmDialogComponent,
  ],
  templateUrl: './create-task.html',
  styleUrls: ['./create-task.css']
})
export class CreateTaskComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private taskService = inject(TaskService);
  private projectService = inject(ProjectService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  minDate: string = '';
  currentUser: any = null;

  confirmDialog = viewChild.required<ConfirmDialogComponent>('confirmDialog');

  isDropdownOpen = false;
  isLoading = false;
  isEditMode = false;
  taskId: string | null = null;
  assigneeSearchTerm: string = '';
  isSubtask = false;

  taskForm: FormGroup;
  managedProjects: any[] = [];
  filteredEmployees: any[] = [];
  selectedFiles: File[] = [];
  existingAttachments: any[] = [];

  historyList = signal<any[]>([]);
  historyCount = computed(() => {
    const list = this.historyList();
    return Array.isArray(list) ? list.length : 0;
  });

  constructor() {
    const today = new Date();
    this.minDate = today.toISOString().split('T')[0];

    this.taskForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      assigneeId: [null, Validators.required],
      dueDate: ['', [Validators.required, this.futureDateValidator.bind(this)]],
      priority: ['MEDIUM', Validators.required],
      projectId: [null, Validators.required],
      status: ['NOT_STARTED'],
      subtasks: this.fb.array([])
    });
  }

  ngOnInit() {
    this.taskId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.taskId;

    const userJson = localStorage.getItem('user_details');
    if (userJson) {
      this.currentUser = JSON.parse(userJson);
    }

    this.loadInitialData();
    this.setupProjectListener();

    if (this.isEditMode) {
      this.loadTaskDataForEdit();
    }
  }

  futureDateValidator(control: any) {
    if (!control.value) return null;
    const selectedDate = new Date(control.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate < today ? { pastDate: true } : null;
  }

  getCleanFileName(fileName: string): string {
    if (!fileName) return '';
    const index = fileName.indexOf('_');
    return index !== -1 ? fileName.substring(index + 1) : fileName;
  }

  loadTaskDataForEdit() {
    this.isLoading = true;
    this.taskService.getTaskById(Number(this.taskId)).subscribe({
      next: (task) => {
        setTimeout(() => {
          if (task.auditLogs) this.historyList.set(task.auditLogs);
          this.isSubtask = !!task.parentTaskId;
          this.existingAttachments = task.attachments || [];

          this.taskForm.patchValue({
            projectId: task.projectId,
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            priority: task.priority,
            assigneeId: task.assigneeId,
            status: task.status
          });

          this.subtasks.clear();
          if (!this.isSubtask) {
            task.subtasks?.forEach((st: any) => {
              this.subtasks.push(this.fb.control({
                title: st.title,
                // UPDATED: Check against new terminal statuses instead of 'DONE'
                isCompleted: ['DEPLOYMENT_COMPLETE', 'TESTING_COMPLETE', 'IN_UAT'].includes(st.status)
              }));
            });
          }

          if (this.selectedAssignee) {
            this.assigneeSearchTerm = this.selectedAssignee.name ||
              `${this.selectedAssignee.firstName} ${this.selectedAssignee.lastName}`;
          }

          this.isLoading = false;
          this.cdr.markForCheck();
        }, 0);
      },
      error: () => {
        this.isLoading = false;
        this.toast.show('Failed to load task details', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  loadInitialData() {
    if (!this.currentUser) return;
    this.projectService.getProjectsByUser(this.currentUser.id).subscribe({
      next: (data) => {
        this.managedProjects = data;
        this.cdr.detectChanges();
      }
    });
  }

  setupProjectListener() {
    this.taskForm.get('projectId')?.valueChanges.subscribe((selectedProjectId) => {
      const selectedProject = this.managedProjects.find(p => p.id == selectedProjectId);

      if (this.currentUser?.role === 'EMPLOYEE') {
        this.filteredEmployees = selectedProject?.members ?
          selectedProject.members.filter((m: any) => m.id === this.currentUser.id) : [];

        if (this.filteredEmployees.length > 0) {
          this.selectMember(this.filteredEmployees[0]);
        }
      } else {
        this.filteredEmployees = selectedProject?.members ? [...selectedProject.members] : [];
        if (!this.isLoading) {
          this.taskForm.get('assigneeId')?.setValue(null);
          this.assigneeSearchTerm = '';
        }
      }
      this.cdr.detectChanges();
    });
  }

  get subtasks() { return this.taskForm.get('subtasks') as FormArray; }

  addSubtask(input: HTMLInputElement) {
    if (this.isSubtask) {
      this.toast.show('A subtask cannot have its own subtasks.', 'error');
      input.value = '';
      return;
    }

    if (input.value.trim()) {
      this.subtasks.push(this.fb.control({
        title: input.value,
        isCompleted: false
      }));
      input.value = '';
    }
  }

  removeSubtask(index: number) {
    const subtaskTitle = this.subtasks.at(index).value.title;
    this.confirmDialog().open(
      `Remove subtask: "${subtaskTitle}"?`,
      'Remove',
      () => {
        this.subtasks.removeAt(index);
        this.cdr.detectChanges();
      }
    );
  }

  onFileSelected(event: any) {
    if (event.target.files) {
      const MAX_SIZE_MB = 10;
      const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
      for (let file of event.target.files) {
        if (file.size > MAX_SIZE_BYTES) {
          this.toast.show(`File "${file.name}" exceeds the 10MB limit.`, 'error');
          continue;
        }
        this.selectedFiles.push(file);
      }
      event.target.value = '';
    }
  }

  removeFile(index: number) { this.selectedFiles.splice(index, 1); }

  viewFile(fileName: string) {
    window.open(`http://localhost:8080/api/tasks/attachments/${fileName}`, '_blank');
  }

  deleteExistingAttachment(fileName: string) {
    const cleanName = this.getCleanFileName(fileName);
    const email = this.currentUser?.email || 'unknown@taskvortex.com';

    this.confirmDialog().open(
      `Permanently delete "${cleanName}"?`,
      'Delete File',
      () => {
        this.taskService.deleteAttachment(Number(this.taskId), fileName, email).subscribe({
          next: () => {
            this.existingAttachments = this.existingAttachments.filter(f => f !== fileName);
            this.toast.show('File deleted successfully', 'success');
            this.cdr.detectChanges();
          },
          error: () => this.toast.show('Error deleting file.', 'error')
        });
      }
    );
  }

  onSubmit() {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      this.toast.show('Please fill all required fields', 'error');
      return;
    }

    this.isLoading = true;
    const formData = new FormData();
    const formValue = this.taskForm.value;

    const taskData = {
      ...formValue,
      id: this.taskId ? Number(this.taskId) : null,
      project: { id: formValue.projectId }
    };

    if (taskData.subtasks && Array.isArray(taskData.subtasks)) {
      taskData.subtasks = taskData.subtasks.map((sub: any) => {
        const { project, assigneeName, assigneeEmail, ...cleanSub } = sub;
        return {
          ...cleanSub,
          project: null,
          // UPDATED: Map boolean back to the new enums instead of DONE/PENDING
          status: sub.isCompleted ? 'TESTING_COMPLETE' : 'NOT_STARTED'
        };
      });
    }

    delete (taskData as any).projectId;

    formData.append('task', new Blob([JSON.stringify(taskData)], { type: 'application/json' }));
    formData.append('userEmail', this.currentUser?.email || 'unknown@taskvortex.com');

    if (this.selectedFiles.length > 0) {
      this.selectedFiles.forEach(file => formData.append('files', file));
    }

    const request = this.isEditMode
      ? this.taskService.updateTask(Number(this.taskId), formData)
      : this.taskService.createTask(formData);

    request.subscribe({
      next: () => {
        this.toast.show('Task saved successfully', 'success');
        if (this.currentUser?.role === 'EMPLOYEE') {
          this.router.navigate(['/my-tasks']);
        } else {
          this.router.navigate(['/tasks']);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.toast.show(err.error?.message || 'Error saving task.', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  selectMember(member: any) {
    this.taskForm.get('assigneeId')?.setValue(member.id);
    this.assigneeSearchTerm = member.name || `${member.firstName} ${member.lastName}`;
    this.isDropdownOpen = false;
    this.cdr.detectChanges();
  }

  toggleDropdown(state: boolean) {
    setTimeout(() => {
      this.isDropdownOpen = state;
      this.cdr.detectChanges();
    }, 200);
  }

  getCancelRoute(): string {
    return this.currentUser?.role === 'EMPLOYEE' ? '/my-tasks' : '/tasks';
  }

  get selectedAssignee() {
    return this.filteredEmployees.find(e => e.id == this.taskForm.get('assigneeId')?.value);
  }

  get searchedEmployees() {
    const term = this.assigneeSearchTerm.toLowerCase();
    return this.filteredEmployees.filter(e =>
      (e.name || `${e.firstName} ${e.lastName}`).toLowerCase().includes(term)
    );
  }

  getAvatar(member: any) {
    const name = member.name || `${member.firstName} ${member.lastName}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=32`;
  }

  // Add this helper method to fix the TS2339 error
  getStatusBadgeClass(s: string) {
    if (!s) return 'bg-not-started';
    // Converts 'DEPLOYMENT_IN_PROGRESS' to 'bg-deployment-in-progress'
    return `bg-${s.toLowerCase().replace(/_/g, '-')}`;
  }
}