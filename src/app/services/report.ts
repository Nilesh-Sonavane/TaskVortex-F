import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private http = inject(HttpClient);

  // Make sure this matches your Spring Boot server URL
  private apiUrl = 'http://localhost:8080/api/reports';

  /**
   * Fetches the End-of-Month Performance Report
   */
  getPerformanceReport(month: string, projectId: string, role: string, userId: number) {
    let params = new HttpParams()
      .set('month', month)
      .set('role', role)
      // Make sure this says 'userId', not 'loggedInUserId'
      .set('userId', userId.toString());

    if (projectId) {
      params = params.set('projectId', projectId);
    }

    return this.http.get<any>(`${this.apiUrl}/performance`, { params });
  }

  getEmployeeDetail(id: string, month: string): Observable<any> {
    // This hits the new endpoint we just created in Spring Boot
    return this.http.get<any>(`${this.apiUrl}/employee/${id}?month=${month}`);
  }
}