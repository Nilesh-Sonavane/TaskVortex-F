import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/auth';
import { Project } from '../models/project';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {

  private http = inject(HttpClient);
  private auth = inject(AuthService); // Injecting your updated AuthService
  private apiUrl = 'http://localhost:8080/api/projects';

  constructor() { }

  /**
   * Helper to generate performerId parameter
   */
  private getPerformerParams(): HttpParams {
    const userId = this.auth.currentUser?.id;
    return new HttpParams().set('performerId', userId ? userId.toString() : '');
  }

  /**
   * 1. Get All Projects (Admin view)
   */
  getAllProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(this.apiUrl);
  }

  /**
   * Get Projects Assigned to a Specific Manager
   */
  getProjectsByManager(managerId: number): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.apiUrl}/manager/${managerId}`);
  }

  getProjectsByUser(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/user/${userId}`);
  }

  // 2. Get Single Project
  getProjectById(id: number): Observable<Project> {
    return this.http.get<Project>(`${this.apiUrl}/${id}`);
  }

  // 3. Create Project - Now sends ?performerId=...
  addProject(projectData: any): Observable<Project> {
    const params = this.getPerformerParams();
    return this.http.post<Project>(this.apiUrl, projectData, { params });
  }

  // 4. Update Project Details - Now sends ?performerId=...
  updateProject(id: number, projectData: any): Observable<Project> {
    const params = this.getPerformerParams();
    return this.http.put<Project>(`${this.apiUrl}/${id}`, projectData, { params });
  }

  // 5. Update Status Only (Archive/Restore) - Now sends ?status=...&performerId=...
  updateStatus(id: number, status: string): Observable<Project> {
    const params = this.getPerformerParams().set('status', status);
    return this.http.patch<Project>(
      `${this.apiUrl}/${id}/status`,
      {},
      { params: params }
    );
  }

  // 6. Delete Project (Hard Delete) - Now sends ?performerId=...
  deleteProject(id: number): Observable<void> {
    const params = this.getPerformerParams();
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { params });
  }

  getAccessibleProjects(email: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/accessible?email=${email}`);
  }
}