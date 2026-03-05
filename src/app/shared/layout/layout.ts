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

  pageTitle: string = 'Loading...';
  showBackButton: boolean = false; // <--- 3. Control visibility
  ngOnInit() {
    // Define the title extraction logic as a reusable function
    const getTitle = () => {
      let child = this.activatedRoute.firstChild;
      while (child?.firstChild) {
        child = child.firstChild;
      }
      return child?.snapshot.title || 'TaskVortex';
    };

    // 1. Set title immediately on component load
    this.updateTitle(getTitle());

    // 2. Then listen for future navigation changes
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(() => getTitle())
      )
      .subscribe((title: string) => {
        this.updateTitle(title);
      });
  }

  // Helper method to keep code clean
  private updateTitle(title: string) {
    this.pageTitle = title.replace(' - TaskVortex', '').replace(' | TaskVortex', '');
    this.showBackButton = this.pageTitle !== 'Dashboard';
  }

  // 5. Back Function
  goBack() {
    this.location.back();
  }
}