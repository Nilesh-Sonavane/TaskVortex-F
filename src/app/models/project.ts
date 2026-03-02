export interface Project {
    id?: number; // Optional for new projects
    name: string;
    description?: string;
    key: string; // Added: Needed for your generateKey logic

    // Status logic
    status: 'ACTIVE' | 'ON_HOLD' | 'ARCHIVED' | 'COMPLETED';

    icon?: string;
    createdDate?: string;
    startDate?: string; // Added: Matches your projectData structure
    progress?: number;

    // Hierarchy Data
    department?: {
        id: number;
        name: string;
    };

    manager?: {
        id: number;
        firstName: string;
        lastName: string;
        email: string;
    };

    // --- FIX FOR TS2339 ERROR ---
    managerId?: number | null; // Needed for the [(ngModel)] binding
    members?: any[]; // The full list of users returned by the backend

    // Optional Helpers
    iconColorClass?: string;
    membersCount?: number;
}