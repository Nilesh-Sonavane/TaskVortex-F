import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, computed, HostListener, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog';
import { Loader } from '../../components/loader/loader';
import { TaskService } from '../../services/task-service';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, Loader, FormsModule, ConfirmDialogComponent],
  templateUrl: './task-detail.html',
  styleUrls: ['./task-detail.css']
})
export class TaskDetail implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private taskService = inject(TaskService);
  private sanitizer = inject(DomSanitizer);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private routeSub: Subscription | null = null;

  confirmDialog = viewChild<ConfirmDialogComponent>('confirmDialog');

  // Data Signals
  task = signal<any>(null);
  historyList = signal<any[]>([]);
  isLoading = signal(true);
  isPreviewOpen = signal(false);

  // --- ACTIVITY FILTER SIGNALS ---
  showFilters = signal(false);
  startDate = signal<string>('');
  endDate = signal<string>('');

  // File Preview Signals
  selectedFileName = signal<string>('');
  previewUrl = signal<string>('');
  zoomLevel = signal(1);

  // --- FILTERED HISTORY LOGIC ---
  filteredHistory = computed(() => {
    const logs = this.historyList();
    const start = this.startDate();
    const end = this.endDate();

    if (!start && !end) return logs;

    return logs.filter(log => {
      // Normalize dates to midnight for accurate day-to-day comparison
      const logDate = new Date(log.timestamp).setHours(0, 0, 0, 0);
      const dateStart = start ? new Date(start).setHours(0, 0, 0, 0) : null;
      const dateEnd = end ? new Date(end).setHours(0, 0, 0, 0) : null;

      if (dateStart && dateEnd) return logDate >= dateStart && logDate <= dateEnd;
      if (dateStart) return logDate >= dateStart;
      if (dateEnd) return logDate <= dateEnd;
      return true;
    });
  });

  // Permission Logic
  canEdit = computed(() => {
    const userJson = localStorage.getItem('user_details');
    const currentTask = this.task();
    if (!userJson || !currentTask) return false;

    const user = JSON.parse(userJson);
    const isAuthority = user.role === 'ADMIN' || user.role === 'MANAGER';
    const isCreator = currentTask.creatorEmail === user.email;
    const isAssignee = currentTask.assigneeId === user.id;

    return isAuthority || isCreator || isAssignee;
  });

  taskFiles = computed(() => this.task()?.attachments || []);

  ngOnInit() {
    this.routeSub = this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) this.loadTaskDetails(Number(id));
    });
  }

  // --- FILTER METHODS ---
  toggleFilters() {
    this.showFilters.update(v => !v);
  }

  resetActivityFilters() {
    this.startDate.set('');
    this.endDate.set('');
  }

  loadTaskDetails(id: number) {
    this.isLoading.set(true);
    this.taskService.getTaskById(id).subscribe({
      next: (data) => {
        this.task.set(data);
        this.loadTaskHistory(id);
        this.isLoading.set(false);
        window.scrollTo(0, 0);
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.show('Failed to load task details', 'error');
      }
    });
  }

  loadTaskHistory(id: number) {
    this.taskService.getTaskHistory(id).subscribe({
      next: (logs) => this.historyList.set(logs),
      error: (err) => console.error('Failed to load history', err)
    });
  }

  onStatusChange(newStatus: string) {
    if (!this.task() || !this.canEdit()) {
      this.toast.show('Permission denied', 'error');
      return;
    }
    this.isLoading.set(true);
    const currentTask = this.task();
    const userEmail = JSON.parse(localStorage.getItem('user_details')!).email;

    const { project, assigneeName, assigneeEmail, ...payload } = currentTask;
    payload.status = newStatus;

    if (payload.subtasks && Array.isArray(payload.subtasks)) {
      payload.subtasks = payload.subtasks.map((sub: any) => {
        const { project, assigneeName, assigneeEmail, ...cleanSub } = sub;
        return { ...cleanSub, project: null };
      });
    }

    const formData = new FormData();
    formData.append('task', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    formData.append('userEmail', userEmail);

    this.taskService.updateTask(currentTask.id, formData).subscribe({
      next: (res) => {
        this.task.set({ ...currentTask, ...res, status: newStatus });
        this.loadTaskHistory(currentTask.id);
        this.isLoading.set(false);
        this.toast.show(`Status: ${this.getStatusLabel(newStatus)}`, 'success');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toast.show(err.error?.message || 'Update failed', 'error');
      }
    });
  }

  // UI Helpers
  getCleanFileName = (fn: string) => fn?.includes('_') ? fn.split('_').slice(1).join('_') : fn;

  getFileIcon(fileName: string): string {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext!)) return 'fa-file-image text-success';
    if (ext === 'pdf') return 'fa-file-pdf text-danger';
    return 'fa-file text-muted';
  }

  getAssignmentName = () => this.task()?.assigneeName || 'Unassigned';
  getAssignmentEmail = () => this.task()?.assigneeEmail || 'No Email';

  getAssignmentLabel = () => {
    const user = JSON.parse(localStorage.getItem('user_details') || '{}');
    return this.task()?.assigneeId === user.id ? 'My Task' : 'Assigned To';
  };

  getAssignmentAvatar = () => `https://ui-avatars.com/api/?name=${encodeURIComponent(this.getAssignmentName())}&background=random&size=128`;
  getCompletedSubtasksCount = (t: any) => t?.subtasks?.filter((st: any) => st.status === 'DONE').length || 0;

  getStatusClass = (s: string) => {
    if (!s) return 'bg-not-started';
    return 'bg-' + s.toLowerCase().replace(/_/g, '-');
  };

  getStatusLabel(statusKey: string): string {
    const statusMap: { [key: string]: string } = {
      'NOT_STARTED': 'Not Started',
      'DEPLOYMENT_IN_PROGRESS': 'Deployment in Progress',
      'RE_DEPLOYMENT_IN_PROGRESS': 'Re-Deployment in Progress',
      'DEPLOYMENT_COMPLETE': 'Deployment Complete',
      'TESTING_IN_PROGRESS': 'Testing in Progress',
      'RE_TESTING_IN_PROGRESS': 'Re-Testing in Progress',
      'TESTING_COMPLETE': 'Testing Complete',
      'IN_UAT': 'In UAT',
      'HOLD': 'Hold',
      'CANCELLED': 'Cancelled'
    };
    return statusMap[statusKey] || statusKey.replace(/_/g, ' ');
  }

  getPriorityClass = (p: string) => `p-${p?.toLowerCase()}`;
  getAvatarUrl = (name: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random&size=128`;
  getBackRoute = () => this.router.url.startsWith('/my-tasks') ? '/my-tasks' : '/tasks';
  getSubtaskRoute = (id: number) => [this.getBackRoute(), id];

  viewFile(fileName: string) {
    this.zoomLevel.set(1);
    this.selectedFileName.set(fileName);
    this.previewUrl.set(`http://localhost:8080/api/tasks/attachments/${fileName}`);
    this.isPreviewOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  zoomIn() { if (this.zoomLevel() < 3) this.zoomLevel.update(z => z + 0.2); }
  zoomOut() { if (this.zoomLevel() > 0.5) this.zoomLevel.update(z => z - 0.2); }
  resetZoom() { this.zoomLevel.set(1); }
  closePreview() { this.isPreviewOpen.set(false); document.body.style.overflow = 'auto'; }

  isImage = (fn: string) => ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fn?.split('.').pop()?.toLowerCase() || '');
  isPdf = (fn: string) => fn?.toLowerCase().endsWith('.pdf');
  getDownloadUrl = (fn: string) => `http://localhost:8080/api/tasks/attachments/${fn}`;
  getSafeUrl = (url: string) => this.sanitizer.bypassSecurityTrustResourceUrl(url);
  getSafeHtml = (html: string) => this.sanitizer.bypassSecurityTrustHtml(html);

  @HostListener('click', ['$event'])
  onHistoryAttachmentClick(event: Event) {
    const target = event.target as HTMLElement;
    const link = target.closest('.history-attachment-link');
    if (link) {
      event.preventDefault();
      const fileName = link.getAttribute('data-filename');
      if (fileName) this.viewFile(fileName);
    }
  }

  ngOnDestroy() { if (this.routeSub) this.routeSub.unsubscribe(); }
}