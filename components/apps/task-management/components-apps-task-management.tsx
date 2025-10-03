'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useSelector } from 'react-redux';
import Dropdown from '@/components/dropdown';
import IconCalendar from '@/components/icon/icon-calendar';
import IconHorizontalDots from '@/components/icon/icon-horizontal-dots';
import IconClock from '@/components/icon/icon-clock';
import ReactMarkdown from 'react-markdown';
import IconPlus from '@/components/icon/icon-plus';
import { supabase } from '@/lib/supabase-browser';
import { ReactSortable } from 'react-sortablejs';
import type { IRootState } from '@/store';
import { uploadPastedImage } from '@/actions/attachment';
import * as XLSX from 'xlsx';

const logActivity = async (
    taskId: string,
    kind: TaskActivity['kind'],
    details?: any, // bebas, akan diserialisasi ke jsonb
) => {
    const args: Record<string, any> = {
        p_task_id: taskId,
        p_kind: kind,
    };
    if (details !== undefined && details !== null) {
        args.p_details = details; // biarin fungsi di DB yg default-in kalau kosong
    }

    const { error } = await supabase.rpc('log_task_activity', args);
    if (error) {
        // lempar ke caller biar bisa ditangani (setError / toast)
        throw error;
    }
};

const formatDue = (iso: string | null) => {
    if (!iso) return { formatted: 'Tidak ada due date', helper: '', overdue: false };
    const due = new Date(iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const normalizedDue = new Date(due);
    normalizedDue.setHours(0, 0, 0, 0);
    const diffDays = Math.round((normalizedDue.getTime() - today.getTime()) / 86400000);
    const formatted = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    let helper = '';
    if (diffDays > 0) helper = `${diffDays} hari lagi`;
    else if (diffDays === 0) helper = 'Jatuh tempo hari ini';
    else helper = `Terlambat ${Math.abs(diffDays)} hari`;
    return { formatted, helper, overdue: diffDays < 0 };
};

const normalizePriority = (value: string | null): Priority => {
    switch ((value || '').toLowerCase()) {
        case 'low':
            return 'Low';
        case 'high':
            return 'High';
        default:
            return 'Medium';
    }
};

type Priority = 'Low' | 'Medium' | 'High';
type ProjectRole = 'owner' | 'admin' | 'member';

type Member = {
    userId: string;
    fullName: string | null;
    email: string | null;
    avatarUrl: string | null;
    role?: ProjectRole;
};

type TaskActivity = {
    id: string;
    kind: 'title_changed' | 'description_changed' | 'due_changed' | 'timer_started' | 'timer_stopped' | 'assignee_added' | 'assignee_removed' | 'reordered';
    details: any;
    created_at: string;
    actor?: { id: string; full_name?: string } | null;
};

type BoardTask = {
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

type BoardFlow = {
    id: string;
    name: string;
    position: number;
    tasks: BoardTask[];
};

type BoardProject = {
    id: string;
    name: string;
    flows: BoardFlow[];
    members?: Member[]; // NEW (untuk modal)
};

type TaskFormState = {
    title: string;
    description: string;
    dueDate: string;
    priority: Priority;
};

const initialTaskForm: TaskFormState = {
    title: '',
    description: '',
    dueDate: '',
    priority: 'Medium',
};

const ComponentsAppsTaskManagement = () => {
    const isRtl = useSelector((state: IRootState) => state.themeConfig.rtlClass === 'rtl');

    const [projects, setProjects] = useState<BoardProject[]>([]);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

    const [userId, setUserId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
    const [inviteLink, setInviteLink] = useState<string | null>(null);

    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false); // NEW

    const [taskForm, setTaskForm] = useState<TaskFormState>(initialTaskForm);
    const [flowName, setFlowName] = useState('');
    const [projectName, setProjectName] = useState('');
    const [isMutating, startMutate] = useTransition();
    const [timer, setTimer] = useState<{ taskId: string | null; startedAt: number; initialSeconds: number }>({ taskId: null, startedAt: 0, initialSeconds: 0 });
    const [, forceTimerTick] = useState(0);

    const [myRoles, setMyRoles] = useState<Record<string, ProjectRole>>({});

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editTaskId, setEditTaskId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<TaskFormState>(initialTaskForm);

    const [activities, setActivities] = useState<TaskActivity[]>([]);
    const [isActLoading, setIsActLoading] = useState(false);

    const activeProject = useMemo(() => projects.find((project) => project.id === activeProjectId) ?? null, [projects, activeProjectId]);
    const columns = activeProject?.flows ?? [];

    const summary = useMemo(() => {
        if (!activeProject) return { tasks: 0 };
        return { tasks: activeProject.flows.reduce((acc, flow) => acc + flow.tasks.length, 0) };
    }, [activeProject]);

    useEffect(() => {
        if (!timer.taskId) return;
        const interval = setInterval(() => forceTimerTick((tick) => tick + 1), 15000);
        return () => clearInterval(interval);
    }, [timer.taskId]);

    useEffect(() => {
        const initialise = async () => {
            setIsLoading(true);
            const { data, error: userError } = await supabase.auth.getUser();
            if (userError) {
                setError(userError.message);
                setIsLoading(false);
                return;
            }
            if (!data.user) {
                setError('Silakan login terlebih dahulu.');
                setIsLoading(false);
                return;
            }
            setUserId(data.user.id);
            await loadProjects(data.user.id);
            setIsLoading(false);
        };
        initialise();
    }, []);

    // HELPER: gabungkan profil/email user
    const buildUserInfoMap = (profiles: any[], users: any[]) => {
        const usersById = new Map<string, { fullName: string | null; avatarUrl: string | null; email: string | null }>();
        profiles?.forEach((p) => usersById.set(p.id, { fullName: p.full_name ?? null, avatarUrl: p.avatar_url ?? null, email: null }));
        users?.forEach((u) => {
            const ex = usersById.get(u.id) ?? { fullName: u.full_name ?? null, avatarUrl: null, email: null };
            usersById.set(u.id, { ...ex, email: u.email ?? null, fullName: ex.fullName ?? u.full_name ?? null });
        });
        return usersById;
    };

    const loadActivities = async (taskId: string) => {
        setIsActLoading(true);
        const { data, error } = await supabase
            .from('task_activities')
            .select(
                `
    id, kind, details, created_at,
    actor:profiles!task_activities_actor_id_fkey ( id, full_name, avatar_url )
  `,
            )
            .eq('task_id', taskId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (!error) setActivities((data as any) || []);
        setIsActLoading(false);
    };

    const loadProjects = async (ownerId: string, preferredProject?: string) => {
        const { data, error: fetchError } = await supabase
            .from('projects')
            .select(
                `
                id, name,
                flows (
                id, name, position,
                tasks ( id, project_id, flow_id, title, description, priority, due_date, tracked_seconds, created_at, position )
                )
            `,
            )
            .order('created_at', { ascending: true });

        if (fetchError) {
            setError(fetchError.message);
            return;
        }

        let normalised: BoardProject[] = (data ?? []).map((project: any) => ({
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
                                    .map((task: any) => ({
                                        id: task.id,
                                        projectId: task.project_id,
                                        flowId: task.flow_id,
                                        title: task.title,
                                        description: task.description ?? null,
                                        priority: normalizePriority(task.priority),
                                        dueDate: task.due_date,
                                        trackedSeconds: task.tracked_seconds ?? 0,
                                        createdAt: task.created_at,
                                        assignees: [],
                                        position: task.position ?? 999999,
                                    }))
                                    .sort((a: BoardTask, b: BoardTask) => {
                                        const pa = a.position ?? 999999;
                                        const pb = b.position ?? 999999;
                                        if (pa !== pb) return pa - pb;
                                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                                    })
                              : [],
                      }))
                      .sort((a: BoardFlow, b: BoardFlow) => a.position - b.position)
                : [],
            members: [],
        }));

        const projectIds = normalised.map((p) => p.id);

        // Roles untuk user saat ini
        if (projectIds.length) {
            const { data: roles, error: rolesErr } = await supabase.from('project_members').select('project_id, role').in('project_id', projectIds).eq('user_id', ownerId);
            if (!rolesErr) {
                const map: Record<string, ProjectRole> = {};
                (roles ?? []).forEach((r: any) => (map[r.project_id] = r.role as ProjectRole));
                setMyRoles(map);
            }
        }

        // ==== MEMBERS ====
        if (projectIds.length) {
            const { data: pm, error: pmErr } = await supabase.from('project_members').select('project_id, user_id, role').in('project_id', projectIds);

            if (!pmErr && pm?.length) {
                const userIds = Array.from(new Set(pm.map((r: any) => r.user_id)));

                const [{ data: profiles }, usersRes] = await Promise.all([
                    supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds),
                    supabase.from('users').select('id, email, full_name').in('id', userIds), // kalau tidak ada tabel 'users', biarkan error diabaikan
                ]);

                const users = usersRes?.data ?? [];
                const usersById = buildUserInfoMap(profiles ?? [], users ?? []);

                const membersByProject: Record<string, Member[]> = {};
                pm.forEach((row: any) => {
                    const info = usersById.get(row.user_id) ?? { fullName: null, avatarUrl: null, email: null };
                    const member: Member = {
                        userId: row.user_id,
                        fullName: info.fullName,
                        avatarUrl: info.avatarUrl,
                        email: info.email,
                        role: row.role,
                    };
                    membersByProject[row.project_id] = membersByProject[row.project_id] ? [...membersByProject[row.project_id], member] : [member];
                });

                normalised = normalised.map((p) => ({ ...p, members: membersByProject[p.id] ?? [] }));

                // ==== ASSIGNEES ====
                const taskIds = normalised.flatMap((p) => p.flows.flatMap((f) => f.tasks.map((t) => t.id)));
                if (taskIds.length) {
                    const { data: tas, error: tasErr } = await supabase.from('task_assignees').select('task_id, user_id').in('task_id', taskIds);
                    if (!tasErr) {
                        const byTask: Record<string, Member[]> = {};
                        tas?.forEach((row: any) => {
                            const i = usersById.get(row.user_id) ?? { fullName: null, avatarUrl: null, email: null };
                            const m: Member = { userId: row.user_id, fullName: i.fullName, avatarUrl: i.avatarUrl, email: i.email };
                            byTask[row.task_id] = byTask[row.task_id] ? [...byTask[row.task_id], m] : [m];
                        });
                        normalised = normalised.map((p) => ({
                            ...p,
                            flows: p.flows.map((f) => ({
                                ...f,
                                tasks: f.tasks.map((t) => ({ ...t, assignees: byTask[t.id] ?? [] })),
                            })),
                        }));
                    }
                }
            }
        }

        setProjects(normalised);

        if (!normalised.length) {
            setActiveProjectId(null);
            setActiveColumnId(null);
            return;
        }
        const chosenProject = normalised.find((project) => project.id === (preferredProject ?? activeProjectId)) ?? normalised[0];
        setActiveProjectId(chosenProject.id);
        setActiveColumnId(chosenProject.flows[0]?.id ?? null);
    };

    const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!userId) return;
        const trimmed = projectName.trim();
        if (!trimmed) return;

        startMutate(async () => {
            const { data, error: insertError } = await supabase.from('projects').insert({ name: trimmed, owner_id: userId }).select('id').single();
            if (insertError) {
                setError(insertError.message);
                return;
            }
            setProjectName('');
            setIsProjectModalOpen(false);
            await loadProjects(userId, data.id);
        });
    };

    const handleCreateInvite = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!activeProject || !userId) return;

        const email = inviteEmail.trim();
        if (!email) return;

        startMutate(async () => {
            const { data, error } = await supabase.rpc('create_or_refresh_invite', {
                p_project_id: activeProject.id,
                p_invited_email: email,
                p_role: inviteRole,
            });

            if (error) {
                setError(error.message);
                return;
            }
            if (data.status === 'already_member') {
                setError('Pengguna sudah menjadi member di project ini.');
                return;
            }

            const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
            setInviteLink(`${base}/accept?token=${data.token}`);
            setInviteEmail('');
        });
    };

    const copyInviteLink = async () => {
        if (!inviteLink) return;
        await navigator.clipboard.writeText(inviteLink);
    };

    const handleCreateFlow = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!activeProject || !userId) return;

        const trimmed = flowName.trim();
        if (!trimmed) return;

        startMutate(async () => {
            const position = activeProject.flows.length;
            const { data, error: insertError } = await supabase.from('flows').insert({ project_id: activeProject.id, name: trimmed, position }).select('id, name, position').single();
            if (insertError) {
                setError(insertError.message);
                return;
            }
            const newFlow: BoardFlow = { id: data.id, name: data.name, position: data.position ?? position, tasks: [] };
            setProjects((prev) => prev.map((project) => (project.id === activeProject.id ? { ...project, flows: [...project.flows, newFlow] } : project)));
            setFlowName('');
            setIsFlowModalOpen(false);
            setActiveColumnId(newFlow.id);
        });
    };

    const handleCreateTask = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!activeProject || !activeColumnId || !userId) return;

        const title = taskForm.title.trim();
        if (!title) return;

        startMutate(async () => {
            const { data, error: insertError } = await supabase
                .from('tasks')
                .insert({
                    project_id: activeProject.id,
                    flow_id: activeColumnId,
                    owner_id: userId,
                    title,
                    description: taskForm.description.trim() || null,
                    priority: taskForm.priority.toLowerCase(),
                    due_date: taskForm.dueDate || null,
                    tracked_seconds: 0,
                })
                .select('id, project_id, flow_id, title, description, priority, due_date, tracked_seconds, created_at')
                .single();

            if (insertError) {
                setError(insertError.message);
                return;
            }

            const newTask: BoardTask = {
                id: data.id,
                projectId: data.project_id,
                flowId: data.flow_id,
                title: data.title,
                description: data.description ?? null,
                priority: normalizePriority(data.priority),
                dueDate: data.due_date,
                trackedSeconds: data.tracked_seconds ?? 0,
                createdAt: data.created_at,
                assignees: [],
                position: (activeProject.flows.find((f) => f.id === activeColumnId)?.tasks.length ?? 0) + 1,
            };

            setProjects((prev) =>
                prev.map((project) =>
                    project.id === activeProject.id
                        ? {
                              ...project,
                              flows: project.flows.map((flow) => (flow.id === activeColumnId ? { ...flow, tasks: [newTask, ...flow.tasks] } : flow)),
                          }
                        : project,
                ),
            );
            setTaskForm(initialTaskForm);
            setIsTaskModalOpen(false);
        });
    };

    const getTrackedSeconds = (task: BoardTask) => {
        if (timer.taskId === task.id) return timer.initialSeconds + Math.max(0, Math.floor((Date.now() - timer.startedAt) / 1000));
        return task.trackedSeconds;
    };

    const updateTaskInState = (taskId: string, updater: (task: BoardTask) => BoardTask) => {
        setProjects((prev) =>
            prev.map((project) => ({
                ...project,
                flows: project.flows.map((flow) => ({
                    ...flow,
                    tasks: flow.tasks.map((task) => (task.id === taskId ? updater(task) : task)),
                })),
            })),
        );
    };

    const toggleTimer = (taskId: string) => {
        if (timer.taskId === taskId) {
            const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timer.startedAt) / 1000));
            const optimistic = timer.initialSeconds + elapsedSeconds;

            updateTaskInState(taskId, (t) => ({ ...t, trackedSeconds: optimistic }));
            setTimer({ taskId: null, startedAt: 0, initialSeconds: 0 });

            startMutate(async () => {
                const { error } = await supabase.rpc('task_timer_stop', { p_task_id: taskId });
                if (error) {
                    setError(error.message);
                    const { data } = await supabase.from('tasks').select('id, tracked_seconds').eq('id', taskId).single();
                    if (data) {
                        updateTaskInState(taskId, (t) => ({ ...t, trackedSeconds: data.tracked_seconds ?? t.trackedSeconds }));
                    }
                } else {
                    const { data } = await supabase.from('tasks').select('id, tracked_seconds').eq('id', taskId).single();
                    if (data) {
                        updateTaskInState(taskId, (t) => ({ ...t, trackedSeconds: data.tracked_seconds ?? optimistic }));
                    }
                }
            });

            return;
        }

        const task = projects.flatMap((p) => p.flows.flatMap((f) => f.tasks)).find((t) => t.id === taskId);
        if (!task) return;

        setTimer({ taskId, startedAt: Date.now(), initialSeconds: task.trackedSeconds });

        startMutate(async () => {
            const { error } = await supabase.rpc('task_timer_start', { p_task_id: taskId });
            if (error) {
                setError(error.message);
                setTimer({ taskId: null, startedAt: 0, initialSeconds: 0 });
            }
        });
    };

    const handleTaskSort = (flowId: string, nextTasks: BoardTask[]) => {
        if (!activeProject) return;

        const prev = projects.find((p) => p.id === activeProject.id)?.flows.find((f) => f.id === flowId)?.tasks;

        const nextIndexById = new Map(nextTasks.map((t, i) => [t.id, i + 1]));
        const prevIndexById = new Map(prev?.map((t, i) => [t.id, t.position || i + 1]));

        setProjects((prev) =>
            prev.map((p) => ({
                ...p,
                flows: p.flows.map((f) => (f.id === flowId ? { ...f, tasks: nextTasks.map((t, i) => ({ ...t, flowId, position: i + 1 })) } : f)),
            })),
        );

        const ids = nextTasks.map((t) => t.id);

        startMutate(async () => {
            const { error } = await supabase.rpc('reorder_tasks', { p_flow_id: flowId, p_task_ids: ids });
            if (error && userId && activeProject) {
                setError(error.message);
                await loadProjects(userId, activeProject.id);
                return;
            }

            for (const t of nextTasks) {
                const from = prevIndexById.get(t.id);
                const to = nextIndexById.get(t.id);
                if (from && to && from !== to) {
                    await logActivity(t.id, 'reordered', { from, to, flow_id: flowId });
                }
            }
        });
    };

    const handleDeleteTask = (taskId: string) => {
        startMutate(async () => {
            await supabase.from('tasks').delete().eq('id', taskId);
            setProjects((prev) =>
                prev.map((project) => ({
                    ...project,
                    flows: project.flows.map((flow) => ({ ...flow, tasks: flow.tasks.filter((task) => task.id !== taskId) })),
                })),
            );
        });
    };

    // ====== EDIT TASK (open modal) ======
    const openEditTask = (task: BoardTask) => {
        setEditTaskId(task.id);
        setEditForm({
            title: task.title,
            description: task.description ?? '',
            // dueDate string harus 'YYYY-MM-DD' agar cocok untuk <input type="date">
            dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
            priority: task.priority,
        });
        setIsEditModalOpen(true);
        loadActivities(task.id);
    };

    // ====== EDIT TASK (submit) ======
    const handleUpdateTask = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editTaskId) return;
        const payload = {
            title: editForm.title.trim(),
            description: editForm.description.trim() || null,
            priority: editForm.priority.toLowerCase(),
            due_date: editForm.dueDate || null,
        };
        startMutate(async () => {
            const before = projects // snapshot nilai lama
                .flatMap((p) => p.flows.flatMap((f) => f.tasks))
                .find((t) => t.id === editTaskId);

            const { data, error: updErr } = await supabase.from('tasks').update(payload).eq('id', editTaskId).select('id, title, description, priority, due_date').single();

            if (updErr) {
                setError(updErr.message);
                return;
            }

            // log per field yang berubah
            if (before) {
                if ((before.title || '') !== (data.title || '')) {
                    await logActivity(editTaskId, 'title_changed', { old: before.title, new: data.title });
                }
                if ((before.description || '') !== (data.description || '')) {
                    await logActivity(editTaskId, 'description_changed', { old: !!before.description, new: !!data.description });
                }
                const oldDue = before.dueDate || null;
                const newDue = data.due_date || null;
                if (oldDue !== newDue) {
                    await logActivity(editTaskId, 'due_changed', { old: oldDue, new: newDue });
                }
            }

            // update state UI...
        });
    };

    // ====== ASSIGNEE (tag member ke task) ======
    const toggleAssignee = (task: BoardTask, member: Member) => {
        const assigned = !!task.assignees.find((m) => m.userId === member.userId);

        // optimistik update
        updateTaskInState(task.id, (t) => ({
            ...t,
            assignees: assigned ? t.assignees.filter((m) => m.userId !== member.userId) : [...t.assignees, member],
        }));

        startMutate(async () => {
            if (assigned) {
                const { error } = await supabase.from('task_assignees').delete().eq('task_id', task.id).eq('user_id', member.userId);
                if (!error) {
                    await logActivity(task.id, 'assignee_removed', { assignee_id: member.userId, assignee_email: member.email });
                }
            } else {
                const { error } = await supabase.from('task_assignees').insert({ task_id: task.id, user_id: member.userId });
                if (!error) {
                    await logActivity(task.id, 'assignee_added', { assignee_id: member.userId, assignee_email: member.email });
                }
            }
        });
    };

    if (isLoading) return <div className="flex min-h-[400px] items-center justify-center text-slate-500">Memuat Task Management...</div>;
    if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-500 dark:border-rose-400/40 dark:bg-rose-500/10">{error}</div>;

    const renderTask = (task: BoardTask) => {
        const dueInfo = formatDue(task.dueDate);
        const trackedSeconds = getTrackedSeconds(task);
        const totalHours = Math.floor(task.trackedSeconds / 3600);
        const displayHours = Math.floor(trackedSeconds / 3600);
        const displayMinutes = Math.floor((trackedSeconds % 3600) / 60);
        const timerRunning = timer.taskId === task.id;
        const myRole = myRoles[task.projectId] ?? 'member';
        const canDelete = myRole === 'owner' || myRole === 'admin';

        const badgeClassesByPriority = (p: Priority) => {
            switch (p) {
                case 'High':
                    return 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300';
                case 'Medium':
                    return 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300';
                case 'Low':
                default:
                    return 'bg-sky-100 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300';
            }
        };

        const projectMembers = projects.find((p) => p.id === task.projectId)?.members ?? [];

        return (
            <article
                key={task.id}
                data-id={task.id}
                className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm transition hover:border-primary/40 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900/60"
            >
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${badgeClassesByPriority(task.priority)}`}>{task.priority}</span>
                        <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{task.title}</h3>
                        {task.description ? (
                            <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                                <ReactMarkdown
                                    components={{
                                        img: (props) => <img {...props} className="rounded-lg border dark:border-slate-700 max-w-full" />,
                                        a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
                                    }}
                                >
                                    {task.description}
                                </ReactMarkdown>
                            </div>
                        ) : null}
                    </div>
                    <Dropdown
                        offset={[0, 10]}
                        placement={isRtl ? 'bottom-start' : 'bottom-end'}
                        btnClassName="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                        button={<IconHorizontalDots className="h-5 w-5" />}
                    >
                        <ul className="w-44 rounded-xl border border-slate-100 bg-white p-2 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
                            <li>
                                <button type="button" className="block w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => openEditTask(task)}>
                                    Edit task
                                </button>
                            </li>
                            <li>
                                <button
                                    type="button"
                                    className="mt-1 block w-full rounded-lg px-3 py-1.5 text-left text-primary hover:bg-primary/10 dark:text-primary/80 dark:hover:bg-primary/10"
                                    onClick={() => toggleTimer(task.id)}
                                >
                                    {timerRunning ? 'Stop timer' : 'Start timer'}
                                </button>
                            </li>
                            <li>
                                <button
                                    type="button"
                                    disabled={!canDelete}
                                    className={`mt-1 block w-full rounded-lg px-3 py-1.5 text-left ${canDelete ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10' : 'text-slate-400 cursor-not-allowed opacity-60'}`}
                                    onClick={() => canDelete && handleDeleteTask(task.id)}
                                >
                                    Hapus task
                                </button>
                            </li>
                        </ul>
                    </Dropdown>
                </div>

                {/* tracker */}
                <div className="mb-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1">
                            <IconClock className="h-4 w-4" />
                            Time tracker
                        </span>
                        <span className="font-medium text-slate-400 dark:text-slate-500">{totalHours}h tercatat</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <span>
                            {displayHours}h {displayMinutes}m
                        </span>
                        <button
                            type="button"
                            className={`text-xs transition ${timerRunning ? 'text-rose-500 hover:text-rose-600' : 'text-primary hover:text-primary/90'}`}
                            onClick={() => toggleTimer(task.id)}
                        >
                            {timerRunning ? 'Stop timer' : 'Start timer'}
                        </button>
                    </div>
                </div>

                {/* due */}
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300">
                    <IconCalendar className="h-4 w-4" />
                    <span>Due {dueInfo.formatted}</span>
                    {dueInfo.helper ? <span className="text-[11px] text-slate-400 dark:text-slate-500">{dueInfo.helper}</span> : null}
                </div>

                {/* assignees */}
                <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                        {task.assignees.slice(0, 3).map((m) => (
                            <img
                                key={m.userId}
                                className="h-7 w-7 rounded-full border border-white object-cover dark:border-slate-800"
                                src={m.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.fullName || m.email || 'U')}`}
                                alt={m.fullName || m.email || m.userId}
                                title={m.fullName || m.email || m.userId}
                            />
                        ))}
                        {task.assignees.length > 3 ? (
                            <span className="h-7 w-7 rounded-full bg-slate-200 text-xs font-semibold text-slate-600 grid place-content-center dark:bg-slate-700 dark:text-slate-200">
                                +{task.assignees.length - 3}
                            </span>
                        ) : null}
                    </div>

                    <Dropdown
                        offset={[0, 8]}
                        placement={isRtl ? 'top-start' : 'top-end'}
                        btnClassName="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-300"
                        button={<span>Assign</span>}
                    >
                        <ul className="w-64 max-h-64 overflow-auto rounded-xl border border-slate-100 bg-white p-2 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
                            {(projectMembers.length ? projectMembers : []).map((m) => {
                                const checked = !!task.assignees.find((a) => a.userId === m.userId);
                                return (
                                    <li key={m.userId}>
                                        <button
                                            type="button"
                                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                                            onClick={() => toggleAssignee(task, m)}
                                        >
                                            <img
                                                className="h-6 w-6 rounded-full border border-white object-cover dark:border-slate-800"
                                                src={m.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.fullName || m.email || 'U')}`}
                                                alt=""
                                            />
                                            <div className="flex-1">
                                                <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{m.fullName || m.email || 'Member'}</p>
                                                {m.role ? <p className="text-[11px] text-slate-400 dark:text-slate-500">{m.role}</p> : null}
                                            </div>
                                            <input type="checkbox" readOnly checked={checked} className="form-checkbox pointer-events-none" />
                                        </button>
                                    </li>
                                );
                            })}
                            {!projectMembers.length ? <li className="px-2 py-1.5 text-xs text-slate-400">Belum ada member</li> : null}
                        </ul>
                    </Dropdown>
                </div>
            </article>
        );
    };

    const handleDescriptionPaste: React.ClipboardEventHandler<HTMLTextAreaElement> = async (e) => {
        const items = e.clipboardData?.items;
        if (!items || !items.length) return;

        const imgItem = Array.from(items).find((it) => it.kind === 'file' && it.type.startsWith('image/'));
        if (!imgItem) return;

        e.preventDefault();

        try {
            const file = imgItem.getAsFile();
            if (!file) return;

            const url = await uploadPastedImage(file);

            setTaskForm((prev) => ({
                ...prev,
                description: (prev.description ? prev.description + '\n\n' : '') + `![pasted-image](${url})`,
            }));
        } catch (err: any) {
            setError(err.message || 'Gagal upload gambar yang di-paste.');
        }
    };

    const makePasteHandler =
        (applyUrl: (url: string) => void): React.ClipboardEventHandler<HTMLTextAreaElement> =>
        async (e) => {
            const items = e.clipboardData?.items;
            if (!items || !items.length) return;

            const imgItem = Array.from(items).find((it) => it.kind === 'file' && it.type.startsWith('image/'));
            if (!imgItem) return;

            e.preventDefault();

            try {
                const file = imgItem.getAsFile();
                if (!file) return;

                const url = await uploadPastedImage(file);

                applyUrl(url);
            } catch (err: any) {
                setError(err.message || 'Gagal upload gambar yang di-paste.');
            }
        };

    const formatKind = (k: TaskActivity['kind']) => {
        switch (k) {
            case 'title_changed':
                return 'Title changed';
            case 'description_changed':
                return 'Description changed';
            case 'due_changed':
                return 'Deadline changed';
            case 'timer_started':
                return 'Timer started';
            case 'timer_stopped':
                return 'Timer stopped';
            case 'assignee_added':
                return 'Assignee added';
            case 'assignee_removed':
                return 'Assignee removed';
            case 'reordered':
                return 'Task reordered';
            default:
                return k;
        }
    };

    const renderActivityDetails = (k: TaskActivity['kind'], d: any) => {
        try {
            // d bisa stringified JSON dari trigger; coba parse aman
            const details = typeof d === 'string' ? JSON.parse(d) : d;

            if (k === 'title_changed')
                return (
                    <span>
                        {details?.old} → <b>{details?.new}</b>
                    </span>
                );
            if (k === 'description_changed') return <span>deskripsi diperbarui</span>;
            if (k === 'due_changed')
                return (
                    <span>
                        {details?.old || '—'} → <b>{details?.new || '—'}</b>
                    </span>
                );
            if (k === 'timer_started') return <span>mulai pada {new Date(details?.started_at || Date.now()).toLocaleTimeString()}</span>;
            if (k === 'timer_stopped') return <span>+{Math.round((details?.delta_seconds || 0) / 60)} menit</span>;
            if (k === 'assignee_added') return <span>+ {details?.assignee_email || details?.assignee_id}</span>;
            if (k === 'assignee_removed') return <span>− {details?.assignee_email || details?.assignee_id}</span>;
            if (k === 'reordered')
                return (
                    <span>
                        posisi: {details?.from} → <b>{details?.to}</b>
                    </span>
                );
            return <span>{JSON.stringify(details)}</span>;
        } catch {
            return <span>{String(d)}</span>;
        }
    };

    const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

    const exportTimesheetXLSX = () => {
        if (!activeProject) return;

        const project = activeProject;

        const rowsTasks = project.flows.flatMap((flow) =>
            flow.tasks.map((t) => {
                const secs = getTrackedSeconds(t);
                const assignees = (t.assignees || []).map((a) => a.fullName || a.email || a.userId).join(', ');

                return {
                    Project: project.name,
                    Flow: flow.name,
                    Task: t.title,
                    Priority: t.priority,
                    DueDate: fmtDate(t.dueDate),
                    CreatedAt: fmtDate(t.createdAt),
                    Assignees: assignees,
                    TrackedSeconds: secs,
                    TrackedHours: (secs / 3600).toFixed(2),
                };
            }),
        );

        const sheetTasks = XLSX.utils.json_to_sheet(rowsTasks);

        const byMember = new Map<string, number>();
        project.flows.forEach((flow) => {
            flow.tasks.forEach((t) => {
                const secs = getTrackedSeconds(t);
                if (!t.assignees || t.assignees.length === 0) {
                    const key = 'Unassigned';
                    byMember.set(key, (byMember.get(key) || 0) + secs);
                    return;
                }
                t.assignees.forEach((m) => {
                    const key = m.fullName || m.email || m.userId;
                    byMember.set(key, (byMember.get(key) || 0) + secs);
                });
            });
        });

        const rowsMembers = Array.from(byMember.entries()).map(([member, secs]) => ({
            Project: project.name,
            Member: member,
            TrackedSeconds: secs,
            TrackedHours: (secs / 3600).toFixed(2),
        }));

        const sheetMembers = XLSX.utils.json_to_sheet(rowsMembers);

        // ---- Buat workbook & simpan
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheetTasks, 'Tasks');
        XLSX.utils.book_append_sheet(wb, sheetMembers, 'By Member');

        const today = new Date().toISOString().slice(0, 10);
        const safeName = project.name.replace(/[\\/:*?"<>|]/g, '_');
        XLSX.writeFile(wb, `Timesheet_${safeName}_${today}.xlsx`);
    };

    return (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm dark:border-slate-700 dark:bg-[#0f172a]">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Projects</p>
                        <p className="text-base font-semibold text-slate-900 dark:text-white">{projects.length} aktif</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsProjectModalOpen(true)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-primary/40 text-primary transition hover:bg-primary/10 dark:border-primary/30"
                    >
                        <IconPlus className="h-4 w-4" />
                    </button>
                </div>
                <ul className="space-y-2">
                    {projects.map((project) => {
                        const taskCount = project.flows.reduce((acc, flow) => acc + flow.tasks.length, 0);
                        const isActive = project.id === activeProjectId;
                        return (
                            <li key={project.id}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveProjectId(project.id);
                                        setActiveColumnId(project.flows[0]?.id ?? null);
                                    }}
                                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                                        isActive
                                            ? 'border-primary/50 bg-primary/10 text-primary dark:border-primary/40 dark:bg-primary/15'
                                            : 'border-transparent bg-slate-100 text-slate-600 hover:border-primary/30 hover:bg-primary/10 hover:text-primary dark:bg-slate-900/40 dark:text-slate-300'
                                    }`}
                                >
                                    <span className="text-sm font-semibold">{project.name}</span>
                                    <span className="text-xs font-medium">
                                        {taskCount} task{taskCount === 1 ? '' : 's'}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </aside>

            <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Task Management</h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Kelola projects, flows, tasks, dan member.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:text-slate-300">
                            {summary.tasks} task{summary.tasks === 1 ? '' : 's'}
                        </div>

                        <button
                            type="button"
                            onClick={exportTimesheetXLSX}
                            disabled={!activeProject}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Export
                        </button>

                        <button
                            type="button"
                            onClick={() => activeProject && setIsMembersModalOpen(true)}
                            disabled={!activeProject}
                            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <IconPlus className="h-4 w-4" />
                            Members ({activeProject?.members?.length ?? 0})
                        </button>

                        <button
                            type="button"
                            onClick={() => activeProject && setIsInviteModalOpen(true)}
                            disabled={!activeProject}
                            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <IconPlus className="h-4 w-4" />
                            Invite
                        </button>
                        <button
                            type="button"
                            onClick={() => activeProject && setIsFlowModalOpen(true)}
                            disabled={!activeProject}
                            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <IconPlus className="h-4 w-4" />
                            Flow baru
                        </button>
                        <button
                            type="button"
                            onClick={() => activeColumnId && setIsTaskModalOpen(true)}
                            disabled={!activeColumnId}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <IconPlus className="h-5 w-5" />
                            Task baru
                        </button>
                    </div>
                </div>

                {columns.length ? (
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {columns.map((column) => (
                            <section
                                key={column.id}
                                className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-slate-700 dark:bg-[#0f172a]"
                            >
                                <header className="mb-4 flex items-start justify-between gap-3 border-b border-transparent pb-1">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{column.name}</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">
                                            {column.tasks.length} task{column.tasks.length === 1 ? '' : 's'}
                                        </p>
                                    </div>
                                </header>
                                <ReactSortable<BoardTask>
                                    list={column.tasks}
                                    setList={(next) => handleTaskSort(column.id, next)}
                                    group="task-cards"
                                    animation={200}
                                    className="flex-1 space-y-4"
                                    ghostClass="opacity-30"
                                >
                                    {column.tasks.map((task) => renderTask(task))}
                                </ReactSortable>
                                {!column.tasks.length ? (
                                    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-400 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-500">
                                        Belum ada task.
                                    </div>
                                ) : null}
                            </section>
                        ))}
                    </div>
                ) : (
                    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-[#0f172a] dark:text-slate-400">
                        <p className="text-sm font-medium">Belum ada flow. Buat flow baru untuk mulai menambahkan task.</p>
                    </div>
                )}
            </div>

            {/* ===== INVITE MODAL ===== */}
            {isInviteModalOpen && activeProject ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="panel w-full max-w-md rounded-2xl p-0">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Invite member</h2>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsInviteModalOpen(false);
                                    setInviteLink(null);
                                }}
                                className="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                            >
                                ×
                            </button>
                        </div>

                        <form className="grid gap-4 px-6 py-6" onSubmit={handleCreateInvite}>
                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Email yang diundang
                                <input type="email" className="form-input" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="nama@contoh.com" required />
                            </label>

                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Role
                                <select className="form-select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}>
                                    <option value="member">Member</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </label>

                            {inviteLink ? (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-400/40 dark:bg-emerald-500/10">
                                    <p className="mb-2 font-medium text-emerald-700 dark:text-emerald-300">Invite link dibuat!</p>
                                    <div className="flex items-center gap-2">
                                        <input className="form-input flex-1" readOnly value={inviteLink} />
                                        <button type="button" onClick={copyInviteLink} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
                                            Copy
                                        </button>
                                    </div>
                                </div>
                            ) : null}

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsInviteModalOpen(false);
                                        setInviteLink(null);
                                    }}
                                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
                                >
                                    Tutup
                                </button>
                                <button
                                    type="submit"
                                    disabled={isMutating}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-md shadow-primary/30 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <IconPlus className="h-4 w-4" />
                                    {isMutating ? 'Mengundang...' : 'Kirim undangan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {/* ===== MEMBERS MODAL (LIST) ===== */}
            {isMembersModalOpen && activeProject ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="panel w-full max-w-lg rounded-2xl p-0">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Members · {activeProject.name}</h2>
                            <button type="button" onClick={() => setIsMembersModalOpen(false)} className="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                                ×
                            </button>
                        </div>
                        <div className="max-h-[60vh] space-y-2 overflow-auto px-6 py-5">
                            {(activeProject.members ?? []).map((m) => (
                                <div key={m.userId} className="flex items-center rounded-xl border border-slate-100 p-3 dark:border-slate-700">
                                    <img
                                        className="h-9 w-9 rounded-full border border-white object-cover dark:border-slate-800"
                                        src={m.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.fullName || m.email || 'U')}`}
                                        alt=""
                                    />
                                    <div className="mx-3 flex-1">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{m.fullName || m.email || m.userId}</p>
                                        {m.email ? <p className="text-xs text-slate-400">{m.email}</p> : null}
                                    </div>
                                    <span
                                        className={`rounded-full px-2 py-0.5 text[11px] font-semibold uppercase ${
                                            m.role === 'owner'
                                                ? 'bg-violet-100 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300'
                                                : m.role === 'admin'
                                                  ? 'bg-sky-100 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300'
                                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300'
                                        }`}
                                    >
                                        {m.role}
                                    </span>
                                </div>
                            ))}
                            {!activeProject.members?.length ? <p className="text-center text-sm text-slate-400">Belum ada member.</p> : null}
                        </div>
                    </div>
                </div>
            ) : null}

            {/* ===== PROJECT MODAL ===== */}
            {isProjectModalOpen ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="panel w-full max-w-md rounded-2xl p-0">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Project baru</h2>
                            <button type="button" onClick={() => setIsProjectModalOpen(false)} className="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                                ×
                            </button>
                        </div>
                        <form className="grid gap-4 px-6 py-6" onSubmit={handleCreateProject}>
                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Nama project
                                <input type="text" className="form-input" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Misal: Website Redesign" required />
                            </label>
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsProjectModalOpen(false)}
                                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isMutating}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-md shadow-primary/30 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <IconPlus className="h-4 w-4" />
                                    {isMutating ? 'Menyimpan...' : 'Buat project'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {/* ===== FLOW MODAL ===== */}
            {isFlowModalOpen && activeProject ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="panel w-full max-w-md rounded-2xl p-0">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Flow baru</h2>
                            <button type="button" onClick={() => setIsFlowModalOpen(false)} className="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                                ×
                            </button>
                        </div>
                        <form className="grid gap-4 px-6 py-6" onSubmit={handleCreateFlow}>
                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Nama flow
                                <input type="text" className="form-input" value={flowName} onChange={(event) => setFlowName(event.target.value)} placeholder="Misal: Backlog" required />
                            </label>
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsFlowModalOpen(false)}
                                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isMutating}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-md shadow-primary/30 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <IconPlus className="h-4 w-4" />
                                    {isMutating ? 'Menyimpan...' : 'Buat flow'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {/* ===== TASK MODAL ===== */}
            {isTaskModalOpen && activeProject ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="panel w-full max-w-2xl rounded-2xl p-0">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Task baru</h2>
                            <button type="button" onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                                ×
                            </button>
                        </div>
                        <form className="grid gap-4 px-6 py-6" onSubmit={handleCreateTask}>
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Judul task
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={taskForm.title}
                                        onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                                        placeholder="Contoh: Implementasi autentikasi"
                                        required
                                    />
                                </label>
                                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Deadline
                                    <input type="date" className="form-input" value={taskForm.dueDate} onChange={(event) => setTaskForm((prev) => ({ ...prev, dueDate: event.target.value }))} />
                                </label>
                            </div>
                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Deskripsi
                                <textarea
                                    className="form-textarea min-h-[120px]"
                                    value={taskForm.description}
                                    onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))}
                                    onPaste={makePasteHandler((url) =>
                                        setTaskForm((p) => ({
                                            ...p,
                                            description: (p.description ? p.description + '\n\n' : '') + `![pasted-image](${url})`,
                                        })),
                                    )}
                                    placeholder="Rincian pekerjaan — paste gambar langsung ke sini"
                                />
                            </label>
                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Prioritas
                                <select className="form-select" value={taskForm.priority} onChange={(event) => setTaskForm((prev) => ({ ...prev, priority: event.target.value as Priority }))}>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </label>
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsTaskModalOpen(false)}
                                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isMutating}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-md shadow-primary/30 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <IconPlus className="h-4 w-4" />
                                    {isMutating ? 'Menyimpan...' : 'Buat task'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {/* ===== EDIT TASK MODAL ===== */}
            {isEditModalOpen && editTaskId ? (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="panel w-full max-w-2xl rounded-2xl p-0">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit task</h2>
                            <button type="button" onClick={() => setIsEditModalOpen(false)} className="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                                ×
                            </button>
                        </div>

                        <form className="grid gap-4 px-6 py-6" onSubmit={handleUpdateTask}>
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Judul task
                                    <input type="text" className="form-input" value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} required />
                                </label>
                                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Deadline
                                    <input type="date" className="form-input" value={editForm.dueDate} onChange={(e) => setEditForm((p) => ({ ...p, dueDate: e.target.value }))} />
                                </label>
                            </div>

                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Deskripsi
                                <textarea
                                    className="form-textarea min-h-[120px]"
                                    value={editForm.description}
                                    onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                                    onPaste={makePasteHandler((url) =>
                                        setEditForm((p) => ({
                                            ...p,
                                            description: (p.description ? p.description + '\n\n' : '') + `![pasted-image](${url})`,
                                        })),
                                    )}
                                    placeholder="Rincian pekerjaan — paste gambar langsung ke sini"
                                />
                            </label>

                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Prioritas
                                <select className="form-select" value={editForm.priority} onChange={(e) => setEditForm((p) => ({ ...p, priority: e.target.value as Priority }))}>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </label>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isMutating}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-md shadow-primary/30 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <IconPlus className="h-4 w-4" />
                                    {isMutating ? 'Menyimpan...' : 'Simpan perubahan'}
                                </button>
                            </div>
                        </form>

                        {/* ===== ACTIVITY LOG ===== */}
                        <div className="m-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-700">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Activity</h3>
                                <button type="button" onClick={() => editTaskId && loadActivities(editTaskId)} className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400">
                                    Refresh
                                </button>
                            </div>

                            <div className="max-h-64 overflow-auto p-3">
                                {isActLoading ? (
                                    <p className="text-xs text-slate-400">Loading...</p>
                                ) : activities.length ? (
                                    <ul className="space-y-3">
                                        {activities.map((a) => (
                                            <li key={a.id} className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-900/40">
                                                <div className="mb-1 flex items-center justify-between">
                                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{formatKind(a.kind)}</span>
                                                    <span className="text-[11px] text-slate-400">{new Date(a.created_at).toLocaleString()}</span>
                                                </div>
                                                <div className="text-slate-600 dark:text-slate-300">{renderActivityDetails(a.kind, a.details)}</div>
                                                <div className="mt-1 text-[11px] text-slate-400">by {a.actor?.full_name || a.actor?.id || 'Unknown'}</div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-slate-400">Belum ada activity.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default ComponentsAppsTaskManagement;
