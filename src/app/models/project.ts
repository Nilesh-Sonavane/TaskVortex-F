export interface Project {
    id: number;
    name: string;
    description?: string;

    // Backend sends 'ACTIVE', 'ON_HOLD', etc.
    status: 'ACTIVE' | 'ON_HOLD' | 'ARCHIVED' | 'COMPLETED';

    icon: string; // e.g., "fa-globe"
    createdDate: string; // "2026-02-06"
    progress: number;

    // Backend sends the full Department object
    department: {
        id: number;
        name: string;
    };

    // Backend sends the full User object
    manager: {
        id: number;
        firstName: string;
        lastName: string;
        email: string;
    };

    // Optional: Frontend specific helper properties
    // We will calculate these in the component/html
    iconColorClass?: string;
    membersCount?: number; // Backend doesn't send this yet, we can default it
}