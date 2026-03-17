import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth'; // <-- 1. Import AuthService
import { Loader } from '../../components/loader/loader';
import { DepartmentService } from '../../services/department';
import { ProjectService } from '../../services/project-service';
import { TaskService } from '../../services/task-service';
import { ToastService } from '../../services/toast';
import { UserService } from '../../services/user-service';

@Component({
  selector: 'app-team-directory',
  standalone: true,
  imports: [CommonModule, FormsModule, Loader],
  templateUrl: './teem-directory.html',
  styleUrls: ['./teem-directory.css']
})
export class TeamDirectory implements OnInit {
  private userService = inject(UserService);
  private deptService = inject(DepartmentService);
  private projectService = inject(ProjectService);
  private taskService = inject(TaskService);
  private authService = inject(AuthService); // <-- 2. Inject it
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  // User Context
  currentUser: any = null;

  // State Signals
  users = signal<any[]>([]);
  departments = signal<any[]>([]);
  isLoading = signal(true);
  selectedProject = signal<string>('All');
  selectedUserForModal = signal<any | null>(null);
  readonly MAX_CAPACITY = 10;
  activeTaskCount = signal<number>(0);

  // Teammate ID Tracker
  teammateIds = signal<Set<number>>(new Set());

  userSharedProjects = signal<Map<number, { key: string, name: string }[]>>(new Map());

  // Filter Signals
  searchTerm = signal('');
  selectedDept = signal('All');
  selectedRole = signal('All');

  // Computed: Master Filter
  filteredUsers = computed(() => {
    const allUsers = this.users();
    const teammateMap = this.userSharedProjects();
    const term = this.searchTerm().toLowerCase();
    const dept = this.selectedDept();
    const projFilter = this.selectedProject();

    const currentUserId = this.currentUser?.id;

    return allUsers.filter(user => {
      // 1. STRATEGIC HIDE: Hide logged-in user
      if (currentUserId && +user.id === +currentUserId) {
        return false;
      }

      if (!user.active) return false;

      // 2. Teammate Check
      const userProjects = teammateMap.get(user.id);
      if (!userProjects) return false;

      // 3. Project Filter
      const matchesProject = projFilter === 'All' || userProjects.some(p => p.key === projFilter);

      // 4. Search & Dept Logic
      const matchesSearch = (user.firstName + ' ' + user.lastName).toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term);

      const matchesDept = dept === 'All' || user.department === dept;

      return matchesProject && matchesSearch && matchesDept;
    });
  });

  ngOnInit() {
    this.loadDepartments();

    // --- FIX: Use our reactive AuthService instead of localStorage! ---
    this.currentUser = this.authService.currentUser;

    if (this.currentUser && this.currentUser.email) {
      this.loadData();
    } else {
      // Failsafe if auth service hasn't loaded yet
      this.toast.show('User context not found. Please log in again.', 'error');
    }
  }

  loadDepartments() {
    this.deptService.getAll().subscribe({
      next: (data) => this.departments.set(data),
      error: (err) => console.error('Error fetching departments', err)
    });
  }

  loadData() {
    this.isLoading.set(true);

    this.projectService.getAccessibleProjects(this.currentUser.email).subscribe({
      next: (projects: any[]) => {
        const idMap = new Map<number, { key: string, name: string }[]>();

        projects.forEach(proj => {
          const members = proj.members || [];
          if (proj.managerId) members.push({ id: proj.managerId });

          members.forEach((m: any) => {
            const currentProjects = idMap.get(m.id) || [];
            if (!currentProjects.find(p => p.key === proj.projectKey)) {
              currentProjects.push({
                key: proj.projectKey,
                name: proj.name || proj.projectName || 'Unnamed Project'
              });
              idMap.set(m.id, currentProjects);
            }
          });
        });

        this.userSharedProjects.set(idMap);
        this.teammateIds.set(new Set(idMap.keys()));
        this.fetchFinalData();
      },
      error: (err: any) => this.handleError('Failed to load project context', err)
    });
  }

  private fetchFinalData() {
    this.userService.getAllUsers().subscribe({
      next: (data: any[]) => {
        this.users.set(data);
        this.isLoading.set(false);
        this.cdr.detectChanges();
      },
      error: (err: any) => this.handleError('User load failed', err)
    });
  }

  private handleError(msg: string, err: any) {
    this.isLoading.set(false);
    this.toast.show(msg, 'error');
    console.error(msg, err);
  }

  availableProjects = computed(() => {
    const allShared = Array.from(this.userSharedProjects().values()).flat();
    return Array.from(new Map(allShared.map(p => [p.key, p])).values());
  });

  getSharedProjects(userId: number): { key: string, name: string }[] {
    const projects = this.userSharedProjects().get(userId);
    return projects || [];
  }

  // --- FIX: Use the user's real uploaded photo and our soft color theme! ---
  getAvatar(user: any) {
    // 1. If they uploaded a profile picture, show it!
    if (user.profileUrl) {
      return user.profileUrl.startsWith('http')
        ? user.profileUrl
        : `http://localhost:8080${user.profileUrl}`;
    }

    // 2. Otherwise, fall back to our premium soft indigo color
    const name = user.firstName + (user.lastName ? ' ' + user.lastName : '');
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128&bold=true`;
  }

  openProfile(user: any) {
    this.selectedUserForModal.set(user);
    this.taskService.getActiveTaskCount(user.id).subscribe({
      next: (count) => this.activeTaskCount.set(count),
      error: () => this.activeTaskCount.set(0)
    });
  }

  closeModal() {
    this.selectedUserForModal.set(null);
  }

  getWorkloadScore(userId: number): number {
    const count = this.activeTaskCount();
    return Math.min((count / this.MAX_CAPACITY) * 100, 100);
  }

  getWorkloadColor(score: number): string {
    if (score < 40) return '#22c55e';
    if (score < 80) return '#f59e0b';
    return '#ef4444';
  }
}