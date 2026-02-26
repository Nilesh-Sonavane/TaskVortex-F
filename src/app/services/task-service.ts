import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/tasks';

  /**
   * Sends Multipart/FormData to create a task with attachments.
   */
  createTask(formData: FormData): Observable<any> {
    return this.http.post(this.apiUrl, formData);
  }

  /**
   * Retrieves a single task by ID. Used for pre-filling the Edit Form.
   */
  getTaskById(id: string | number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  /**
   * Updates an existing task using PUT. 
   * Useful for changing status, priority, or adding new files.
   */
  updateTask(id: string | number, formData: FormData): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, formData);
  }

  /**
   * Fetches all tasks in the system (Admin view).
   */
  getAllTasks(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  /**
   * Fetches tasks specifically assigned to projects managed by the logged-in user.
   */
  getTasksByManager(managerId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/manager/${managerId}`);
  }

  /**
   * Removes a specific file from a task's attachment list.
   */
  deleteAttachment(taskId: number, filename: string, email: string): Observable<void> {
    // Pass the email as a query parameter
    return this.http.delete<void>(
      `${this.apiUrl}/${taskId}/attachments/${filename}?userEmail=${email}`
    );
  }

  // Add to your existing TaskService
  getTaskHistory(taskId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${taskId}/history`);
  }


  getTasksByAssignee(userId: number): Observable<any[]> {
    // This must match the @GetMapping("/assignee/{userId}") in your Java Controller
    return this.http.get<any[]>(`${this.apiUrl}/assignee/${userId}`);
  }

  updateTaskStatus(taskId: number, status: string): Observable<any> {
    // Use a PATCH or PUT request depending on your backend implementation
    return this.http.patch(`${this.apiUrl}/${taskId}/status?status=${status}`, {});
  }

  // Add this method inside your TaskService class
  submitTaskWork(taskId: number, formData: FormData): Observable<any> {
    return this.http.post(`http://localhost:8080/api/tasks/${taskId}/submit`, formData);
  }

  /**
   * Manager approves the submitted work.
   * Moves task status to DONE.
   */
  approveTask(taskId: number, email: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${taskId}/approve?userEmail=${email}`, {});
  }

  /**
   * Manager rejects the submitted work.
   * Moves task status back to IN_PROGRESS with a reason.
   */
  rejectTask(taskId: number, email: string, reason: string): Observable<any> {
    return this.http.patch(
      `${this.apiUrl}/${taskId}/reject?userEmail=${email}&reason=${encodeURIComponent(reason)}`,
      {}
    );
  }
}