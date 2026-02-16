import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly API_URL = 'http://localhost:8080/api/v1/auth';

  // --- 1. EXISTING SIGNALS ---
  currentUserRole = signal<string>(localStorage.getItem('userRole') || '');
  private token = signal<string>(localStorage.getItem('token') || '');

  // --- 2. NEW: ADD THIS SIGNAL (Holds User Name, ID, Email) ---
  // We try to load it from localStorage so it survives a page refresh
  private userSignal = signal<any>(this.getUserFromStorage());

  // --- 3. NEW: ADD THIS GETTER (Fixes the HTML Error) ---
  // This allows your HTML to use {{ auth.currentUser.firstName }}
  get currentUser() {
    return this.userSignal();
  }

  // Computed values
  isAdmin = computed(() => this.currentUserRole() === 'ADMIN');
  isManager = computed(() => this.currentUserRole() === 'MANAGER' || this.currentUserRole() === 'ADMIN');
  isEmployee = computed(() => !!this.currentUserRole());
  isLoggedIn = computed(() => !!this.token());

  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/login`, credentials).pipe(
      tap((response) => {
        this.setSession(response);
      })
    );
  }
  private setSession(authResult: any) {
    const token = authResult.token;
    const role = authResult.role;

    // --- 1. CAPTURE THE NEW DATA ---
    const user = {
      id: authResult.id,
      firstName: authResult.firstName,
      lastName: authResult.lastName,
      jobTitle: authResult.jobTitle,
      email: authResult.email,
      role: role
    };

    // --- 2. UPDATE SIGNALS ---
    this.token.set(token);
    this.currentUserRole.set(role);
    this.userSignal.set(user);

    // --- 3. SAVE TO LOCAL STORAGE ---
    localStorage.setItem('token', token);
    localStorage.setItem('userRole', role);
    localStorage.setItem('user_details', JSON.stringify(user));
  }

  logout() {
    this.currentUserRole.set('');
    this.token.set('');
    this.userSignal.set(null); // <--- Clear user data
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  // --- Helper to safely read JSON from LocalStorage ---
  private getUserFromStorage() {
    const userStr = localStorage.getItem('user_details');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  }
}