import { useEffect, useMemo, useState, useTransition } from 'react';
import { BoardProject, BoardTask, BoardFlow, Member, ProjectRole } from '@/types/tasker';
import { fetchProjectsRaw, fetchMyRoles, fetchProjectMembers, fetchProfiles, fetchUsers } from '@/services/tasker/projects';
import { fetchTaskAssignees } from '@/services/tasker/tasks';
import { buildUserInfoMap, mapMembersByProject } from '@/services/tasker/members';
import { normalizePriority } from '@/utils/tasker/priority';

export const useBoardData = (ownerId: string | null) => {
    const [projects, setProjects] = useState<BoardProject[]>([]);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
    const [myRoles, setMyRoles] = useState<Record<string, ProjectRole>>({});
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, startMutate] = useTransition();

    const activeProject = useMemo(() => projects.find((p) => p.id === activeProjectId) ?? null, [projects, activeProjectId]);

    const loadProjects = async (preferredProject?: string | null, options?: { silent?: boolean }) => {
        const silent = options?.silent ?? false;
        if (!silent) setIsLoading(true);
        const { data, error } = await fetchProjectsRaw();
        if (error) {
            setError(error.message);
            setIsLoading(false);
            return;
        }

        let normalized: BoardProject[] = (data ?? []).map((project: any) => ({
            id: project.id,
            name: project.name,
            flows: Array.isArray(project.flows)
                ? project.flows
                      .map((flow: any) => ({
                          id: flow.id,
                          name: flow.name,
                          position: flow.position ?? 0,
                          tasks: Array.isArray(flow.tasks)
                              ? flow.tasks
                                    .map((t: any) => ({
                                        id: t.id,
                                        projectId: t.project_id,
                                        flowId: t.flow_id,
                                        title: t.title,
                                        description: t.description ?? null,
                                        priority: normalizePriority(t.priority),
                                        dueDate: t.due_date,
                                        trackedSeconds: t.tracked_seconds ?? 0,
                                        createdAt: t.created_at,
                                        assignees: [],
                                        position: t.position ?? 999999,
                                    }))
                                    .sort((a: BoardTask, b: BoardTask) => (a.position ?? 999999) - (b.position ?? 999999) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                              : [],
                      }))
                      .sort((a: BoardFlow, b: BoardFlow) => a.position - b.position)
                : [],
            members: [],
        }));

        const projectIds = normalized.map((p) => p.id);

        if (projectIds.length && ownerId) {
            const { data: roles } = await fetchMyRoles(projectIds, ownerId);
            const map: Record<string, ProjectRole> = {};
            (roles ?? []).forEach((r: any) => (map[r.project_id] = r.role as ProjectRole));
            setMyRoles(map);
        }

        if (projectIds.length) {
            const { data: pm } = await fetchProjectMembers(projectIds);
            const userIds = Array.from(new Set((pm ?? []).map((r: any) => r.user_id)));
            const [profiles, users] = await Promise.all([fetchProfiles(userIds).then((res) => res.data ?? []), fetchUsers(userIds).then((res) => res.data ?? [])]);
            const usersById = buildUserInfoMap(profiles, users);
            const membersByProject = mapMembersByProject(pm ?? [], usersById);
            normalized = normalized.map((p) => ({ ...p, members: membersByProject[p.id] ?? [] }));

            const taskIds = normalized.flatMap((p) => p.flows.flatMap((f) => f.tasks.map((t) => t.id)));
            if (taskIds.length) {
                const { data: tas } = await fetchTaskAssignees(taskIds);
                const byTask: Record<string, Member[]> = {};
                (tas ?? []).forEach((row: any) => {
                    const i = usersById.get(row.user_id) ?? { fullName: null, avatarUrl: null, email: null };
                    byTask[row.task_id] = byTask[row.task_id]
                        ? [...byTask[row.task_id], { userId: row.user_id, fullName: i.fullName, avatarUrl: i.avatarUrl, email: i.email }]
                        : [{ userId: row.user_id, fullName: i.fullName, avatarUrl: i.avatarUrl, email: i.email }];
                });
                normalized = normalized.map((p) => ({
                    ...p,
                    flows: p.flows.map((f) => ({ ...f, tasks: f.tasks.map((t) => ({ ...t, assignees: byTask[t.id] ?? [] })) })),
                }));
            }
        }

        setProjects(normalized);
        if (!normalized.length) {
            setActiveProjectId(null);
            setActiveColumnId(null);
        } else {
            const chosen = normalized.find((p) => p.id === (preferredProject ?? activeProjectId)) ?? normalized[0];
            setActiveProjectId(chosen.id);
            setActiveColumnId(chosen.flows[0]?.id ?? null);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (ownerId) void loadProjects();
    }, [ownerId]);

    // helpers
    const updateTaskInState = (taskId: string, updater: (task: BoardTask) => BoardTask) => {
        setProjects((prev) =>
            prev.map((p) => ({
                ...p,
                flows: p.flows.map((f) => ({ ...f, tasks: f.tasks.map((t) => (t.id === taskId ? updater(t) : t)) })),
            })),
        );
    };

    return {
        projects,
        setProjects,
        activeProjectId,
        setActiveProjectId,
        activeColumnId,
        setActiveColumnId,
        activeProject,
        myRoles,
        isLoading,
        error,
        isMutating,
        startMutate,
        loadProjects,
        updateTaskInState,
    } as const;
};
