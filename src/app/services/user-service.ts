// src/app/services/user.service.ts
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UserResponse } from '../models/user-response';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:8080/api/users';

  // Fetch all users for Admin/Manager dashboard
  getAllUsers(): Observable<UserResponse[]> {
    return this.http.get<UserResponse[]>(`${this.API_URL}`);
  }

  // Add a new user (the form data we discussed)
  addUser(userData: any): Observable<any> {
    return this.http.post(`${this.API_URL}/add`, userData);
  }
}