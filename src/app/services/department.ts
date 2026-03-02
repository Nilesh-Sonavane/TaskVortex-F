import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DepartmentService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/departments';

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  create(department: any, email: string) {
    return this.http.post(this.apiUrl, department, { params: { email } });
  }

  update(id: number, department: any, email: string) {
    return this.http.put(`${this.apiUrl}/${id}`, department, { params: { email } });
  }

  delete(id: number, email: string) {
    return this.http.delete(`${this.apiUrl}/${id}`, { params: { email } });
  }
}