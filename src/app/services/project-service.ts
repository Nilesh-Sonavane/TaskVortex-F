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

  // 1. Get All Projects
  getAllProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(this.apiUrl);
  }

  // 2. Get Single Project (REQUIRED FOR EDIT)
  getProjectById(id: number): Observable<Project> {
    return this.http.get<Project>(`${this.apiUrl}/${id}`);
  }

  // 3. Create Project
  addProject(projectData: any): Observable<Project> {
    return this.http.post<Project>(this.apiUrl, projectData);
  }

  // 4. Update Project Details (REQUIRED FOR EDIT)
  updateProject(id: number, projectData: any): Observable<Project> {
    return this.http.put<Project>(`${this.apiUrl}/${id}`, projectData);
  }

  // 5. Update Status Only (Archive/Restore)
  updateStatus(id: number, status: string): Observable<Project> {
    // PATCH /api/projects/{id}/status?status=ARCHIVED
    return this.http.patch<Project>(
      `${this.apiUrl}/${id}/status`,
      {}, // Empty body
      { params: { status: status } } // Send status as Query Param
    );
  }

  // 6. Delete Project (Hard Delete)
  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}