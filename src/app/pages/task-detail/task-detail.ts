import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser'; // Add this import
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { Loader } from '../../components/loader/loader';
import { TaskService } from '../../services/task-service';

// This tells TypeScript that Bootstrap is loaded globally (via angular.json or CDN)
declare var bootstrap: any;

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, Loader],
  templateUrl: './task-detail.html',
  styleUrls: ['./task-detail.css']
})
export class TaskDetail implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private taskService = inject(TaskService);
  private routeSub: Subscription | null = null;

  task = signal<any>(null);
  historyList = signal<any[]>([]);
  isLoading = true;
  isPreviewOpen = signal(false);

  selectedFileName = signal<string>('');
  previewUrl = signal<string>('');
  zoomLevel = signal(1);

  // private sanitizer = inject(DomSanitizer); // Inject the sanitizer
  constructor(private sanitizer: DomSanitizer) { }
  ngOnInit() {
    this.routeSub = this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.loadTaskDetails(Number(id));
      }
    });
  }

  loadTaskDetails(id: number) {
    this.isLoading = true;
    this.taskService.getTaskById(id).subscribe({
      next: (data) => {
        this.task.set(data);
        this.loadTaskHistory(id);
        this.isLoading = false;
        window.scrollTo(0, 0);
      },
      error: () => this.isLoading = false
    });
  }

  loadTaskHistory(id: number) {
    this.taskService.getTaskHistory(id).subscribe({
      next: (logs) => {
        this.historyList.set(logs);
      },
      error: (err) => console.error('Failed to load activity history', err)
    });
  }

  ngOnDestroy() {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  // --- UI HELPERS ---
  getCompletedSubtasksCount(task: any): number {
    return task?.subtasks?.filter((st: any) => st.status === 'DONE').length || 0;
  }

  getStatusClass(status: string): string {
    const s = status?.toUpperCase();
    if (s === 'IN_PROGRESS') return 'bg-progress';
    if (s === 'REVIEW') return 'bg-review';
    if (s === 'DONE') return 'bg-done';
    return 'bg-pending';
  }

  getPriorityClass(priority: string): string {
    const p = priority?.toUpperCase();
    if (p === 'HIGH') return 'p-high';
    if (p === 'MEDIUM') return 'p-med';
    return 'p-low';
  }

  getAvatarUrl(name: string): string {
    const displayName = name || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&size=128`;
  }

  // --- FILE PREVIEW LOGIC ---

  viewFile(fileName: string) {
    this.zoomLevel.set(1);
    const baseUrl = `http://localhost:8080/api/tasks/attachments/${fileName}`;
    this.selectedFileName.set(fileName);
    this.previewUrl.set(baseUrl);
    this.isPreviewOpen.set(true);

    // Prevent background scrolling while viewing
    document.body.style.overflow = 'hidden';
  }

  zoomIn() {
    if (this.zoomLevel() < 3) {
      this.zoomLevel.update(z => z + 0.2);
    }
  }

  zoomOut() {
    if (this.zoomLevel() > 0.5) {
      this.zoomLevel.update(z => z - 0.2);
    }
  }

  resetZoom() {
    this.zoomLevel.set(1);
  }

  closePreview() {
    this.isPreviewOpen.set(false);
    document.body.style.overflow = 'auto';
  }


  isImage(fileName: string): boolean {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
  }

  isPdf(fileName: string): boolean {
    return fileName?.toLowerCase().endsWith('.pdf');
  }



  getFileIcon(fileName: string): string {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'fa-file-pdf text-danger';
      case 'zip':
      case 'rar': return 'fa-file-zipper text-warning';
      case 'xlsx':
      case 'xls': return 'fa-file-excel text-success';
      default: return 'fa-file-lines text-primary';
    }
  }

  getDownloadUrl(fileName: string): string {
    // Replace with your actual API endpoint for file downloads
    return `http://localhost:8080/api/tasks/attachments/${fileName}`;
  }

  getSafeUrl(url: string): SafeResourceUrl {
    // Angular blocks dynamic iframe sources by default to prevent XSS.
    // This explicitly trusts the backend URL.
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
  getSafeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  @HostListener('click', ['$event'])
  onHistoryAttachmentClick(event: Event) {
    const target = event.target as HTMLElement;

    // 1. Find the closest anchor tag with our custom class
    const attachmentLink = target.closest('.history-attachment-link');

    if (attachmentLink) {
      event.preventDefault(); // Stop any default link behavior

      // 2. Extract the unique filename from the data attribute we set in Java
      const fileName = attachmentLink.getAttribute('data-filename');

      if (fileName) {
        // 3. Trigger your existing preview logic!
        this.viewFile(fileName);
      }
    }
  }
}