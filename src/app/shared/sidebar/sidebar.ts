import { Component, inject, OnInit } from '@angular/core'; // 1. Import OnInit
import { Router, RouterLink, RouterLinkActive } from '@angular/router'; // 2. Import Router
import { AuthService } from '../../auth/auth';
import { Loader } from '../../components/loader/loader';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Loader],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit { // 3. Implement OnInit
  auth = inject(AuthService);
  private router = inject(Router); // 4. Inject Router

  isLoading = false;
  isUserMenuOpen = false;
  isProjectMenuOpen = false;
  isSidebarOpen = false;

  // 5. Auto-open menus on load if we are on that page
  ngOnInit() {
    if (this.router.url.includes('/admin-users')) {
      this.isUserMenuOpen = true;
    }
    if (this.router.url.includes('/admin-projects')) {
      this.isProjectMenuOpen = true;
    }
  }

  // 6. Helper to check if parent should be active
  isActive(route: string): boolean {
    return this.router.url.includes(route);
  }

  toggleUserMenu() {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }
  toggleProjectMenu() {
    this.isProjectMenuOpen = !this.isProjectMenuOpen;
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