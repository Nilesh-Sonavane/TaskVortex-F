import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BoardService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/tasks';

  getFilteredTasks(filters: {
    projectIds?: number[],
    assigneeIds?: number[],
    statuses?: string[],
    departments?: string[],
    searchTerm?: string
  }): Observable<any[]> {
    let params = new HttpParams();

    if (filters.projectIds?.length) params = params.set('projectIds', filters.projectIds.join(','));
    if (filters.assigneeIds?.length) params = params.set('assigneeIds', filters.assigneeIds.join(','));
    if (filters.statuses?.length) params = params.set('statuses', filters.statuses.join(','));
    if (filters.departments?.length) params = params.set('departments', filters.departments.join(','));

    if (filters.searchTerm) params = params.set('searchTerm', filters.searchTerm);

    return this.http.get<any[]>(`${this.apiUrl}/board/filter`, { params });
  }



}