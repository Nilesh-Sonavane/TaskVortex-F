import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { AuthService } from '../../auth/auth';
import { UserService } from '../../services/user-service';
import { Sidebar } from '../sidebar/sidebar';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, Sidebar],
  templateUrl: './layout.html',
  styleUrls: ['./layout.css']
})
export class Layout implements OnInit {

  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private location = inject(Location);
  public auth = inject(AuthService);
  private userService = inject(UserService);

  pageTitle: string = 'Loading...';
  showBackButton: boolean = false;

  ngOnInit() {
    // --- SECURE DYNAMIC FETCH ---
    // We don't need local storage! The backend token knows exactly who this is.
    this.userService.getMyProfile().subscribe({
      next: (data) => {
        // This updates the AuthService signal, which instantly updates the Navbar!
        this.auth.updateCurrentUser(data);
      },
      error: (err) => console.error('Failed to fetch fresh navbar data', err)
    });

    // --- Existing Title Logic ---
    const getTitle = () => {
      let child = this.activatedRoute.firstChild;
      while (child?.firstChild) {
        child = child.firstChild;
      }
      return child?.snapshot.title || 'TaskVortex';
    };

    this.updateTitle(getTitle());

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(() => getTitle())
      )
      .subscribe((title: string) => {
        this.updateTitle(title);
      });
  }

  private updateTitle(title: string) {
    this.pageTitle = title.replace(' - TaskVortex', '').replace(' | TaskVortex', '');
    this.showBackButton = this.pageTitle !== 'Dashboard';
  }

  goBack() {
    this.location.back();
  }

  // --- CLEAN AVATAR GETTER ---
  get displayAvatar(): string {
    // Just read the Signal! It will have the stale data first, 
    // and instantly swap to the fresh data once the API call above finishes.
    const user = this.auth.currentUser;

    if (!user) return '';

    if (user.profileUrl) {
      return user.profileUrl.startsWith('http')
        ? user.profileUrl
        : `http://localhost:8080${user.profileUrl}`;
    }

    const first = user.firstName || 'U';
    const last = user.lastName || '';
    return `https://ui-avatars.com/api/?name=${first}+${last}&background=818cf8&color=fff&bold=true`;
  }
}