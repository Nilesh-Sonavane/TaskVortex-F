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
  previousAssigneeId: number | null = null;
  previousAssigneeSearchTerm: string = '';
  hasClaimed: boolean = false;


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
      subtasks: this.fb.array([]),
      taskPoints: [null, [Validators.min(0)]],
      workingHours: [null, [Validators.min(0)]]
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
  }

  setupProjectListener() {
    this.taskForm.get('projectId')?.valueChanges.subscribe((selectedProjectId) => {
      const selectedProject = this.managedProjects.find(p => p.id == selectedProjectId);
      const assigneeControl = this.taskForm.get('assigneeId');

      if (selectedProject?.members) {
        this.filteredEmployees = [...selectedProject.members];

        const currentUserId = this.currentUser?.id;
        const isAdmin = this.currentUser?.role === 'ADMIN' || this.currentUser?.role === 'SUPER_ADMIN';

        // Safely check if they are the manager of THIS project
        const isProjectManager = selectedProject.managerId === currentUserId ||
          (selectedProject.manager && selectedProject.manager.id === currentUserId);

        // Check if they are a member of THIS project
        const isProjectMember = this.filteredEmployees.some(emp => emp.id === currentUserId);

        if (isAdmin || isProjectManager) {
          // 1. THEY ARE THE BOSS: Enable the dropdown so they can pick anyone.
          assigneeControl?.enable();

          // (Optional) Auto-select them if it's a new task, just to save time
          if (!this.isEditMode && isProjectMember && !assigneeControl?.value) {
            assigneeControl?.setValue(currentUserId);
            this.assigneeSearchTerm = this.currentUser.name || `${this.currentUser.firstName} ${this.currentUser.lastName}`;
          }

        } else {
          // 2. STRICT EMPLOYEE LOCK: They are just a worker on this project.
          // Auto-select them as the assignee immediately.
          if (isProjectMember) {
            assigneeControl?.setValue(currentUserId);
            this.assigneeSearchTerm = this.currentUser.name || `${this.currentUser.firstName} ${this.currentUser.lastName}`;
          } else {
            assigneeControl?.setValue(null);
            this.assigneeSearchTerm = '';
          }

          // Lock the field! They cannot change it to anyone else.
          assigneeControl?.disable();
        }

      } else {
        // Fallback if project data is missing
        this.filteredEmployees = [];
        assigneeControl?.setValue(null);
        this.assigneeSearchTerm = '';
        assigneeControl?.disable();
      }

      this.cdr.detectChanges();
    });
  }

  clearAssignee() {
    // Prevent clearing if the field is locked (Employee)
    if (this.taskForm.get('assigneeId')?.disabled) return;

    this.taskForm.get('assigneeId')?.setValue(null);
    this.assigneeSearchTerm = '';

    // Briefly open the dropdown so they can pick someone else
    setTimeout(() => { this.isDropdownOpen = true; }, 100);
  }

  // 1. The missing method that checks if the button should appear
  canClaimTask(): boolean {
    if (!this.currentUser) return false;

    // Check if the logged-in user is actually a member of the currently selected project
    const isProjectMember = this.filteredEmployees.some(emp => emp.id === this.currentUser?.id);

    // Check who is currently assigned to the task
    const currentAssigneeId = this.taskForm.get('assigneeId')?.value;

    // Show the button ONLY IF they belong to the project AND they aren't already assigned
    return isProjectMember && currentAssigneeId !== this.currentUser?.id;
  }

  // 2. The method to claim the task
  assignToMe() {
    if (!this.currentUser) return;
    const control = this.taskForm.get('assigneeId');
    const wasDisabled = control?.disabled;

    // MEMORY: Save the old user state BEFORE replacing it
    this.previousAssigneeId = control?.value;
    this.previousAssigneeSearchTerm = this.assigneeSearchTerm;
    this.hasClaimed = true;

    // Temporarily enable to update
    if (wasDisabled) control?.enable();

    // Assign to logged-in user
    control?.setValue(this.currentUser.id);
    control?.markAsDirty();
    this.assigneeSearchTerm = this.currentUser.name || `${this.currentUser.firstName} ${this.currentUser.lastName}`;
    this.isDropdownOpen = false;

    // Relock if they are an employee
    if (wasDisabled) control?.disable();

    this.toast.show('Task assigned to you', 'success');
    this.cdr.detectChanges();
  }

  // 3. The method to undo the claim
  cancelClaim() {
    const control = this.taskForm.get('assigneeId');
    const wasDisabled = control?.disabled;

    if (wasDisabled) control?.enable();

    // RESTORE: Put the old user back exactly as they were!
    control?.setValue(this.previousAssigneeId);
    control?.markAsDirty();
    this.assigneeSearchTerm = this.previousAssigneeSearchTerm;
    this.hasClaimed = false;

    if (wasDisabled) control?.disable();

    this.toast.show('Restored original assignee', 'success');
    this.cdr.detectChanges();
  }

  onSubmit() {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      this.toast.show('Please fill all required fields', 'error');
      return;
    }

    this.isLoading = true;
    const formData = new FormData();

    // Crucial: Includes disabled fields (like assigneeId for Employees)
    const formValue = this.taskForm.getRawValue();

    // Build payload: Keep assigneeId flat as expected by standard DTOs
    const taskData = {
      ...formValue,
      id: this.taskId ? Number(this.taskId) : null,
      project: { id: formValue.projectId }
      // Removed the custom 'assignee' object mapping; relying on flat 'assigneeId' from ...formValue
    };

    // Clean up redundant flat IDs (Only projectId, do NOT delete assigneeId here)
    delete (taskData as any).projectId;

    if (taskData.subtasks && Array.isArray(taskData.subtasks)) {
      taskData.subtasks = taskData.subtasks.map((sub: any) => {
        const { project, assigneeName, assigneeEmail, ...cleanSub } = sub;
        return {
          ...cleanSub,
          project: null,
          status: sub.isCompleted ? 'TESTING_COMPLETE' : 'NOT_STARTED'
        };
      });
    }

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
        this.router.navigate([this.getCancelRoute()]);
      },
      error: (err) => {
        this.isLoading = false;
        this.toast.show(err.error?.message || 'Error saving task.', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  // --- UI Helpers & Data Loading ---

  loadInitialData() {
    if (!this.currentUser) return;
    this.isLoading = true;
    this.projectService.getAccessibleProjects(this.currentUser.email).subscribe({
      next: (data) => {
        this.managedProjects = data;
        if (this.isEditMode) {
          this.loadTaskDataForEdit();
        } else if (this.managedProjects.length === 1) {
          this.taskForm.get('projectId')?.setValue(this.managedProjects[0].id);
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isLoading = false; this.toast.show('Error loading projects', 'error'); }
    });
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
            status: task.status,
            taskPoints: task.taskPoints,
            workingHours: task.workingHours

          });

          this.subtasks.clear();
          if (!this.isSubtask) {
            task.subtasks?.forEach((st: any) => {
              this.subtasks.push(this.fb.control({
                title: st.title,
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
      error: () => { this.isLoading = false; this.toast.show('Failed to load task', 'error'); }
    });
  }

  getSelectedProjectName(): string {
    const projectId = this.taskForm.get('projectId')?.value;
    const project = this.managedProjects.find(p => p.id == projectId);
    return project ? `${project.name} (${project.projectKey})` : 'Loading Project...';
  }

  futureDateValidator(control: any) {
    if (!control.value) return null;
    const selectedDate = new Date(control.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate < today ? { pastDate: true } : null;
  }

  getCleanFileName = (fn: string) => fn?.includes('_') ? fn.split('_').slice(1).join('_') : fn;
  get subtasks() { return this.taskForm.get('subtasks') as FormArray; }

  addSubtask(input: HTMLInputElement) {
    if (this.isSubtask) { this.toast.show('No nested subtasks allowed.', 'error'); return; }
    if (input.value.trim()) {
      this.subtasks.push(this.fb.control({ title: input.value, isCompleted: false }));
      input.value = '';
    }
  }

  removeSubtask(index: number) { this.subtasks.removeAt(index); }

  onFileSelected(event: any) {
    if (event.target.files) {
      for (let file of event.target.files) { this.selectedFiles.push(file); }
      event.target.value = '';
    }
  }

  removeFile(index: number) { this.selectedFiles.splice(index, 1); }

  viewFile(fileName: string) { window.open(`http://localhost:8080/api/tasks/attachments/${fileName}`, '_blank'); }

  deleteExistingAttachment(fileName: string) {
    this.taskService.deleteAttachment(Number(this.taskId), fileName, this.currentUser.email).subscribe({
      next: () => { this.existingAttachments = this.existingAttachments.filter(f => f !== fileName); this.toast.show('Deleted', 'success'); }
    });
  }

  selectMember(member: any) {
    this.taskForm.get('assigneeId')?.setValue(member.id);
    this.assigneeSearchTerm = member.name || `${member.firstName} ${member.lastName}`;
    this.isDropdownOpen = false;
  }

  toggleDropdown(state: boolean) { setTimeout(() => { this.isDropdownOpen = state; this.cdr.detectChanges(); }, 200); }

  getCancelRoute = () => this.currentUser?.role === 'EMPLOYEE' ? '/my-tasks' : '/tasks';

  get selectedAssignee() { return this.filteredEmployees.find(e => e.id == this.taskForm.get('assigneeId')?.value); }

  get searchedEmployees() {
    const term = this.assigneeSearchTerm.toLowerCase().trim();
    if (!term) return this.filteredEmployees;
    return this.filteredEmployees.filter(e => (e.name || `${e.firstName} ${e.lastName}`).toLowerCase().includes(term) || e.email.toLowerCase().includes(term));
  }
  //Check if the current date value is in the past ---
  isOverdue(): boolean {
    const dateValue = this.taskForm.get('dueDate')?.value;
    if (!dateValue) return false;

    const selectedDate = new Date(dateValue);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight

    return selectedDate < today;
  }

  getAvatar(member: any) { return `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || member.firstName)}&background=random&size=32`; }
}