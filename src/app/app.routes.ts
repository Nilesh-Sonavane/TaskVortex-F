import { Routes } from '@angular/router';
import { authGuard } from './auth/auth-guard';
import { ForgotPasswordComponent } from './auth/forgot-password/forgot-password';
import { LoginComponent } from './auth/login/login';
import { AddDepartmentComponent } from './pages/add-department/add-department';
import { AddProjectComponent } from './pages/add-project/add-project';
import { AddUserComponent } from './pages/add-user/add-user';
import { AdminDepartmentsComponent } from './pages/admin-departments/admin-departments';
import { AdminProjectComponent } from './pages/admin-project/admin-project';
import { AdminUsersComponent } from './pages/admin-users/admin-users';
import { BoardComponent } from './pages/board/board';
import { CreateTaskComponent } from './pages/create-task/create-task';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { MyTasksComponent } from './pages/my-tasks/my-tasks';
import { TaskDetail } from './pages/task-detail/task-detail';
import { TaskListComponent } from './pages/task-list/task-list';
import { TeamDirectory } from './pages/teem-directory/teem-directory';
import { Layout } from './shared/layout/layout';

// Import the new Task components here
// import { TaskListComponent } from './pages/task-list/task-list.component'; // Uncomment when you create the list view

export const routes: Routes = [
    { path: 'login', component: LoginComponent, title: 'Login - TaskVortex' },
    {
        path: 'forgot-password',
        component: ForgotPasswordComponent,
        title: 'Reset Password - TaskVortex'
    },
    {
        path: '',
        component: Layout,
        canActivate: [authGuard],
        children: [
            { path: 'dashboard', component: DashboardComponent, title: 'Dashboard - TaskVortex' },

            // --- Admin Routes ---
            { path: 'admin-users', component: AdminUsersComponent, title: 'User Management - TaskVortex' },
            { path: 'add-user', component: AddUserComponent, title: 'Add User - TaskVortex' },
            { path: 'edit-user/:id', component: AddUserComponent, title: 'Edit User - TaskVortex' },
            { path: 'admin-departments', component: AdminDepartmentsComponent, title: 'User Department - TaskVortex' },
            { path: 'admin-departments/add', component: AddDepartmentComponent, title: 'Add Department - TaskVortex' },
            { path: 'admin-departments/edit/:id', component: AddDepartmentComponent, title: 'Edit Department - TaskVortex' },
            { path: 'admin-projects', component: AdminProjectComponent, title: 'Projects | TaskVortex' },
            { path: 'admin-projects/create', component: AddProjectComponent, title: 'Create Project | TaskVortex' },
            { path: 'edit-project/:id', component: AddProjectComponent, title: 'Edit Project | TaskVortex' },
            { path: 'board', component: BoardComponent, title: 'Board | TaskVortex' },


            // --- Manager Routes (Tasks) ---
            // { path: 'tasks', component: TaskListComponent, title: 'All Tasks - TaskVortex' }, // Uncomment when ready
            { path: 'tasks', component: TaskListComponent, title: 'All Tasks - TaskVortex' },
            { path: 'tasks/new', component: CreateTaskComponent, title: 'Create Task | TaskVortex' },
            { path: 'tasks/edit/:id', component: CreateTaskComponent, title: 'Edit Task | TaskVortex' },
            { path: 'tasks/:id', component: TaskDetail, title: 'Task Details | TaskVortex' },

            // --- Employee Routes (Tasks) ---
            { path: 'my-tasks', component: MyTasksComponent, title: 'My Tasks | TaskVortex' },
            // Employees access detail here: /my-tasks/1
            { path: 'my-tasks/:id', component: TaskDetail, title: 'Task Details | TaskVortex' },
            { path: 'team-directory', component: TeamDirectory, title: 'Team Directory | TaskVortex' },



            // Redirect root to dashboard
            { path: '', redirectTo: 'dashboard', pathMatch: 'full', title: 'Dashboard | TaskVortex' }
        ]
    },

    { path: '**', redirectTo: 'login' }
];