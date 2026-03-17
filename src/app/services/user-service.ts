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

  getUserById(id: number | string): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.API_URL}/${id}`);
  }

  // Add a new user (the form data we discussed)
  addUser(userData: any): Observable<any> {
    return this.http.post(`${this.API_URL}/add`, userData);
  }

  updateUser(id: number | string, userData: any): Observable<any> {
    return this.http.put(`${this.API_URL}/update/${id}`, userData);
  }

  getUsersByRole(role: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/role/${role}`);
  }

  toggleStatus(id: number): Observable<any> {
    return this.http.patch(`${this.API_URL}/toggle-status/${id}`, {});
  }

  // --- NEW: PERSONAL PROFILE METHODS ---

  /**
   * Updates the logged-in user's personal profile data (Name, Bio, Phone, Location)
   */
  updateMyProfile(profileData: any): Observable<any> {
    return this.http.put(`${this.API_URL}/profile`, profileData);
  }

  /**
   * Uploads the avatar image file and returns the new image URL
   */
  uploadProfileImage(file: File): Observable<{ profileUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<{ profileUrl: string }>(`${this.API_URL}/profile/image`, formData);
  }

  // Fetch the dynamic profile for the logged-in user
  getMyProfile(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.API_URL}/me`);
  }

  /**
   * Updates the logged-in user's password
   */
  changePassword(passwordData: { currentPassword: string, newPassword: string }): Observable<any> {
    return this.http.put(`${this.API_URL}/profile/password`, passwordData);
  }
}