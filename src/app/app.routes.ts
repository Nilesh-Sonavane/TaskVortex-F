import { Routes } from '@angular/router';
import { authGuard } from './auth/auth-guard';
import { ForgotPasswordComponent } from './auth/forgot-password/forgot-password';
import { LoginComponent } from './auth/login/login';
import { AddDepartmentComponent } from './pages/add-department/add-department';
import { AddProjectComponent } from './pages/add-project/add-project';
import { AddUserComponent } from './pages/add-user/add-user';
import { AdminDepartmentsComponent } from './pages/admin-departments/admin-departments';
import { AdminProjectEditComponent } from './pages/admin-project-edit/admin-project-edit';
import { AdminProjectComponent } from './pages/admin-project/admin-project';
import { AdminUsersComponent } from './pages/admin-users/admin-users';
import { CreateTaskComponent } from './pages/create-task/create-task';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { TaskDetail } from './pages/task-detail/task-detail';
import { TaskListComponent } from './pages/task-list/task-list';
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
            { path: 'admin-departments', component: AdminDepartmentsComponent, title: 'User Department - TaskVortex' },
            { path: 'admin-departments/add', component: AddDepartmentComponent, title: 'Add Department - TaskVortex' },
            { path: 'admin-projects', component: AdminProjectComponent, title: 'Projects | TaskVortex' },
            { path: 'admin-projects/create', component: AddProjectComponent, title: 'Create Project | TaskVortex' },
            { path: 'admin-projects/edit/:id', component: AdminProjectEditComponent, title: 'Edit Project | TaskVortex' },

            // --- Manager Routes (Tasks) ---
            // { path: 'tasks', component: TaskListComponent, title: 'All Tasks - TaskVortex' }, // Uncomment when ready
            { path: 'tasks', component: TaskListComponent, title: 'All Tasks - TaskVortex' },
            { path: 'tasks/new', component: CreateTaskComponent, title: 'Create Task | TaskVortex' },
            { path: 'tasks/edit/:id', component: CreateTaskComponent, title: 'Edit Task | TaskVortex' },
            { path: 'tasks/:id', component: TaskDetail, title: 'Task Details | TaskVortex' },

            // Redirect root to dashboard
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
        ]
    },

    { path: '**', redirectTo: 'login' }
];