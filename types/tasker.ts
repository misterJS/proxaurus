export type Priority = 'Low' | 'Medium' | 'High';
export type ProjectRole = 'owner' | 'admin' | 'member';

export type Member = {
    userId: string;
    fullName: string | null;
    email: string | null;
    avatarUrl: string | null;
    role?: ProjectRole;
    isActive?: boolean;
    hourlyRate?: number | null;
};

export type TaskActivityKind = 'title_changed' | 'description_changed' | 'due_changed' | 'timer_started' | 'timer_stopped' | 'assignee_added' | 'assignee_removed' | 'reordered';

export type TaskActivity = {
    id: string;
    kind: TaskActivityKind;
    details: unknown;
    created_at: string;
    actor?: { id: string; full_name?: string } | null;
};

export type BoardTask = {
    id: string;
    projectId: string;
    flowId: string | null;
    title: string;
    description: string | null;
    priority: Priority;
    dueDate: string | null;
    trackedSeconds: number;
    createdAt: string;
    assignees: Member[];
    position: number;
};

export type BoardFlow = {
    id: string;
    name: string;
    position: number;
    tasks: BoardTask[];
};

export type BoardProject = {
    id: string;
    name: string;
    flows: BoardFlow[];
    members?: Member[];
    archived?: boolean;
};

export type TaskFormState = {
    title: string;
    description: string;
    dueDate: string;
    priority: Priority;
};
