import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit, viewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';

// Components
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog';
import { Loader } from '../../components/loader/loader';

// Services
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
    ConfirmDialogComponent
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

  // Reference to our Custom Confirm Dialog using Signal-based viewChild
  confirmDialog = viewChild.required<ConfirmDialogComponent>('confirmDialog');

  // UI State
  isDropdownOpen = false;
  isLoading = false;
  isEditMode = false;
  taskId: string | null = null;
  assigneeSearchTerm: string = '';

  // Data
  taskForm: FormGroup;
  managedProjects: any[] = [];
  filteredEmployees: any[] = [];
  selectedFiles: File[] = [];
  existingAttachments: any[] = [];

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
   * Fetches existing task data and populates the form
   */
  loadTaskDataForEdit() {
    this.isLoading = true;
    this.taskService.getTaskById(this.taskId!).subscribe({
      next: (task) => {
        // 1. SET PROJECT FIRST - This triggers setupProjectListener 
        // which populates filteredEmployees
        this.taskForm.patchValue({
          projectId: task.projectId,
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          priority: task.priority
        });

        // 2. Wrap the selection in setTimeout to allow the listener 
        // to finish populating the member list
        setTimeout(() => {
          // Now that filteredEmployees is populated, set the assignee
          this.taskForm.get('assigneeId')?.setValue(task.assigneeId);

          // Update the search term for the UI input
          if (this.selectedAssignee) {
            this.assigneeSearchTerm = this.selectedAssignee.name ||
              `${this.selectedAssignee.firstName} ${this.selectedAssignee.lastName}`;
          }

          // Handle other collections
          this.existingAttachments = task.attachments || [];
          this.subtasks.clear();
          task.subtasks?.forEach((st: any) => {
            this.subtasks.push(this.fb.control({
              title: st.title,
              isCompleted: st.isCompleted
            }));
          });

          this.isLoading = false;
          this.cdr.detectChanges();
        }, 50); // Small delay to ensure project listener finishes
      },
      error: () => {
        this.isLoading = false;
        this.toast.show('Failed to load task', 'error');
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

  // --- Subtask & File Helpers ---
  get subtasks() { return this.taskForm.get('subtasks') as FormArray; }

  addSubtask(input: HTMLInputElement) {
    if (input.value.trim()) {
      this.subtasks.push(this.fb.control({ title: input.value, isCompleted: false }));
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
      for (let file of event.target.files) this.selectedFiles.push(file);
    }
  }

  removeFile(index: number) { this.selectedFiles.splice(index, 1); }

  viewFile(fileName: string) {
    window.open(`http://localhost:8080/api/tasks/attachments/${fileName}`, '_blank');
  }

  deleteExistingAttachment(fileName: string) {
    const cleanName = fileName.split('_').pop();

    this.confirmDialog().open(
      `Do you want to permanently delete "${cleanName}"? This action cannot be undone.`,
      'Delete File',
      () => {
        this.taskService.deleteAttachment(this.taskId!, fileName).subscribe({
          next: () => {
            this.existingAttachments = this.existingAttachments.filter(f => f !== fileName);
            this.toast.show('File deleted successfully', 'success');
            this.cdr.detectChanges();
          },
          error: () => this.toast.show('Failed to delete file', 'error')
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
    const taskData = { ...this.taskForm.value, id: this.taskId, project: { id: this.taskForm.value.projectId } };

    formData.append('task', new Blob([JSON.stringify(taskData)], { type: 'application/json' }));
    this.selectedFiles.forEach(file => formData.append('files', file));

    const request = this.isEditMode
      ? this.taskService.updateTask(this.taskId!, formData)
      : this.taskService.createTask(formData);

    request.subscribe({
      next: () => {
        this.toast.show(`Task ${this.isEditMode ? 'updated' : 'created'} successfully!`, 'success');
        this.router.navigate(['/tasks']);
      },
      error: (err) => {
        this.isLoading = false;
        this.toast.show(err.error?.message || 'Failed to save task', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  // --- Custom Dropdown ---
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