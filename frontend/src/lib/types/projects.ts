export type ProjectStatus = 'Active' | 'Archived';

export interface Project {
    id: string;
    name: string;
    code?: string;
    description?: string;
    status: ProjectStatus;
    createdAt: string;
    updatedAt?: string;
}
