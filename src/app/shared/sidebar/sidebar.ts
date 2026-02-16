import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../auth/auth';
import { Loader } from '../../components/loader/loader';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Loader],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit {
  auth = inject(AuthService);
  private router = inject(Router);

  isLoading = false;
  isUserMenuOpen = false;
  isProjectMenuOpen = false;
  isSidebarOpen = false;
  isTaskMenuOpen = false; // Added for Task Management

  // Auto-open menus on load if we are on that page
  ngOnInit() {
    if (this.router.url.includes('/admin-users')) {
      this.isUserMenuOpen = true;
    }
    if (this.router.url.includes('/admin-projects')) {
      this.isProjectMenuOpen = true;
    }
    // Added auto-open for tasks
    if (this.router.url.includes('/tasks')) {
      this.isTaskMenuOpen = true;
    }
  }

  // Helper to check if parent should be active
  isActive(route: string): boolean {
    return this.router.url.includes(route);
  }

  toggleUserMenu() {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  toggleProjectMenu() {
    this.isProjectMenuOpen = !this.isProjectMenuOpen;
  }

  // Added toggle for Task Management
  toggleTaskMenu() {
    this.isTaskMenuOpen = !this.isTaskMenuOpen;
  }

  closeSidebar() {
    this.isSidebarOpen = false;
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  logout() {
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.auth.logout();
    }, 1000);
  }
}