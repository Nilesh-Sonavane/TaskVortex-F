import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TimeLogService {
  private http = inject(HttpClient);
  // Make sure this matches your Spring Boot server URL
  private apiUrl = 'http://localhost:8080/api/time-logs';

  // 1. Submit a new time log
  logTime(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/log`, payload);
  }

  // 2. Fetch the total logged hours for the progress bar
  getTotalHours(taskId: number): Observable<{ totalLoggedHours: number }> {
    return this.http.get<{ totalLoggedHours: number }>(`${this.apiUrl}/task/${taskId}/total-hours`);
  }

  // 3. (Optional) Fetch the history of all logs for a task
  getLogsForTask(taskId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/task/${taskId}`);
  }

  getUserTotalHours(taskId: number, userId: number) {
    return this.http.get<number>(`${this.apiUrl}/task/${taskId}/user/${userId}/hours`);
  }
}