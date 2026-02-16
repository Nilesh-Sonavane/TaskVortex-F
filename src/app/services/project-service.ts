import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Project } from '../models/project';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {

  private http = inject(HttpClient);
  // Base URL for projects
  private apiUrl = 'http://localhost:8080/api/projects';

  constructor() { }

  /**
   * 1. Get All Projects (Admin view)
   */
  getAllProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(this.apiUrl);
  }

  /**
   * NEW: Get Projects Assigned to a Specific Manager
   * This ensures Manager A cannot see Manager B's projects.
   * Backend Endpoint: GET /api/projects/manager/{managerId}
   */
  getProjectsByManager(managerId: number): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.apiUrl}/manager/${managerId}`);
  }

  // 2. Get Single Project
  getProjectById(id: number): Observable<Project> {
    return this.http.get<Project>(`${this.apiUrl}/${id}`);
  }

  // 3. Create Project
  addProject(projectData: any): Observable<Project> {
    return this.http.post<Project>(this.apiUrl, projectData);
  }

  // 4. Update Project Details
  updateProject(id: number, projectData: any): Observable<Project> {
    return this.http.put<Project>(`${this.apiUrl}/${id}`, projectData);
  }

  // 5. Update Status Only (Archive/Restore)
  updateStatus(id: number, status: string): Observable<Project> {
    return this.http.patch<Project>(
      `${this.apiUrl}/${id}/status`,
      {},
      { params: { status: status } }
    );
  }

  // 6. Delete Project (Hard Delete)
  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}