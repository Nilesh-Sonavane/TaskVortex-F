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

  confirmDialog = viewChild.required<ConfirmDialogComponent>('confirmDialog');

  isDropdownOpen = false;
  isLoading = false;
  isEditMode = false;
  taskId: string | null = null;
  assigneeSearchTerm: string = '';

  // Track if the current task being edited is a subtask
  isSubtask = false;

  taskForm: FormGroup;
  managedProjects: any[] = [];
  filteredEmployees: any[] = [];
  selectedFiles: File[] = [];
  existingAttachments: any[] = [];

  // Inside your class:
  historyList = signal<any[]>([]);
  // This automatically stays in sync without re-triggering Change Detection
  historyCount = computed(() => this.historyList().length);

  constructor() {
    this.taskForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      assigneeId: [null, Validators.required],
      dueDate: ['', Validators.required],
      priority: ['MEDIUM', Validators.required],
      projectId: [null, Validators.required],
      subtasks: this.fb.array([])
    });
  }

  ngOnInit() {
    this.taskId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.taskId;

    this.loadInitialData();
    this.setupProjectListener();

    if (this.isEditMode) {
      this.loadTaskDataForEdit();
    }
  }

  /**
   * Fetches task data for edit mode and handles Angular lifecycle safety
   */
  loadTaskDataForEdit() {
    this.isLoading = true;

    this.taskService.getTaskById(Number(this.taskId)).subscribe({
      next: (task) => {
        setTimeout(() => {
          this.isSubtask = !!task.parentTaskId;

          // 1. Patch the form
          this.taskForm.patchValue({
            projectId: task.projectId,
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            priority: task.priority
          });

          this.taskForm.get('assigneeId')?.setValue(task.assigneeId);

          // 2. Handle Activity/History Signal
          // IMPORTANT: Ensure your signal is updated here, not directly in the template
          if (this.historyList && task.auditLogs) {
            this.historyList.set(task.auditLogs);
          }

          if (this.selectedAssignee) {
            this.assigneeSearchTerm = this.selectedAssignee.name ||
              `${this.selectedAssignee.firstName} ${this.selectedAssignee.lastName}`;
          }

          this.existingAttachments = task.attachments || [];

          // 3. Populate Subtasks
          this.subtasks.clear();
          if (!this.isSubtask) {
            task.subtasks?.forEach((st: any) => {
              this.subtasks.push(this.fb.control({
                title: st.title,
                isCompleted: st.status === 'DONE'
              }));
            });
          }

          this.isLoading = false;
          // 4. Mark for check after all state changes are done
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
    const userJson = localStorage.getItem('user_details');
    if (!userJson) return;
    const user = JSON.parse(userJson);

    this.projectService.getProjectsByManager(user.id).subscribe({
      next: (data) => {
        this.managedProjects = data;
        this.cdr.detectChanges();
      }
    });
  }

  setupProjectListener() {
    this.taskForm.get('projectId')?.valueChanges.subscribe((selectedProjectId) => {
      const selectedProject = this.managedProjects.find(p => p.id == selectedProjectId);
      this.filteredEmployees = selectedProject?.members ? [...selectedProject.members] : [];

      if (!this.isLoading) {
        this.taskForm.get('assigneeId')?.setValue(null);
        this.assigneeSearchTerm = '';
      }
      this.cdr.detectChanges();
    });
  }

  get subtasks() { return this.taskForm.get('subtasks') as FormArray; }

  addSubtask(input: HTMLInputElement) {
    // Prevent adding nested subtasks if editing a subtask
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
      for (let file of event.target.files) {
        this.selectedFiles.push(file);
      }
    }
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  viewFile(fileName: string) {
    window.open(`http://localhost:8080/api/tasks/attachments/${fileName}`, '_blank');
  }

  deleteExistingAttachment(fileName: string) {
    const parts = fileName.split('_');
    const cleanName = parts[parts.length - 1];

    // Retrieve the current user's email for the Audit Log
    const userJson = localStorage.getItem('user_details');
    const user = userJson ? JSON.parse(userJson) : null;
    const email = user ? user.email : 'unknown@taskvortex.com';

    this.confirmDialog().open(
      `Permanently delete "${cleanName}"?`,
      'Delete File',
      () => {
        // Pass the email as the third argument
        this.taskService.deleteAttachment(Number(this.taskId), fileName, email).subscribe({
          next: () => {
            this.existingAttachments = this.existingAttachments.filter(f => f !== fileName);
            this.toast.show('File deleted successfully', 'success');
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error("Delete failed:", err);
            this.toast.show('Error deleting file. Please try again.', 'error');
          }
        });
      }
    );
  }

  onSubmit() {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const formData = new FormData();

    const userJson = localStorage.getItem('user_details');
    const user = userJson ? JSON.parse(userJson) : { email: 'unknown@taskvortex.com' };

    // Prepare task data exactly for the Backend Entity structure
    const taskData = {
      ...this.taskForm.value,
      id: this.taskId ? Number(this.taskId) : null,
      project: { id: this.taskForm.get('projectId')?.value }
    };

    formData.append('task', new Blob([JSON.stringify(taskData)], { type: 'application/json' }));
    formData.append('userEmail', user.email); // Required for Audit Log logic

    if (this.selectedFiles.length > 0) {
      this.selectedFiles.forEach(file => formData.append('files', file));
    }

    const request = this.isEditMode
      ? this.taskService.updateTask(Number(this.taskId), formData)
      : this.taskService.createTask(formData);

    request.subscribe({
      next: () => {
        this.toast.show('Task saved successfully', 'success');
        this.router.navigate(['/tasks']);
      },
      error: (err) => {
        this.isLoading = false;
        this.toast.show('Error saving task', 'error');
      }
    });
  }
  // --- UI Select/Search Helpers ---
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
}