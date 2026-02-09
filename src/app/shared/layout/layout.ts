import { CommonModule, Location } from '@angular/common'; // <--- 1. Import Location
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { AuthService } from '../../auth/auth';
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
  private location = inject(Location); // <--- 2. Inject Location
  public auth = inject(AuthService);

  pageTitle: string = 'Dashboard';
  showBackButton: boolean = false; // <--- 3. Control visibility

  ngOnInit() {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(() => {
          let child = this.activatedRoute.firstChild;
          while (child?.firstChild) {
            child = child.firstChild;
          }
          return child?.snapshot.title || 'TaskVortex';
        })
      )
      .subscribe((title: string) => {
        // Update Title
        this.pageTitle = title.replace(' - TaskVortex', '').replace(' | TaskVortex', '');

        // 4. Logic: Hide Back Button on 'Dashboard' so users don't accidentally leave
        this.showBackButton = this.pageTitle !== 'Dashboard';
      });
  }

  // 5. Back Function
  goBack() {
    this.location.back();
  }
}