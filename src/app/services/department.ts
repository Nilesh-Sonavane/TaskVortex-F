import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Department } from '../models/department';

@Injectable({ providedIn: 'root' })
export class DepartmentService {
  http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/departments';

  getAll() {
    return this.http.get<Department[]>(this.apiUrl);
  }

  create(department: Department) {
    return this.http.post<Department>(this.apiUrl, department);
  }

  delete(id: number) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}