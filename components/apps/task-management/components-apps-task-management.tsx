'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useSelector } from 'react-redux';
import Dropdown from '@/components/dropdown';
import IconCalendar from '@/components/icon/icon-calendar';
import IconHorizontalDots from '@/components/icon/icon-horizontal-dots';
import IconClock from '@/components/icon/icon-clock';
import IconPlus from '@/components/icon/icon-plus';
import { supabase } from '@/lib/supabase-browser';
import { ReactSortable } from 'react-sortablejs';
import type { IRootState } from '@/store';

const formatDue = (iso: string | null) => {
    if (!iso) {
        return { formatted: 'Tidak ada due date', helper: '', overdue: false };
    }
    const due = new Date(iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const normalizedDue = new Date(due);
    normalizedDue.setHours(0, 0, 0, 0);
    const diffDays = Math.round((normalizedDue.getTime() - today.getTime()) / 86400000);
    const formatted = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    let helper = '';
    if (diffDays > 0) {
        helper = `${diffDays} hari lagi`;
    } else if (diffDays === 0) {
        helper = 'Jatuh tempo hari ini';
    } else {
        helper = `Terlambat ${Math.abs(diffDays)} hari`;
    }
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
    const [taskForm, setTaskForm] = useState<TaskFormState>(initialTaskForm);
    const [flowName, setFlowName] = useState('');
    const [projectName, setProjectName] = useState('');
    const [isMutating, startMutate] = useTransition();
    const [timer, setTimer] = useState<{ taskId: string | null; startedAt: number; initialSeconds: number }>({ taskId: null, startedAt: 0, initialSeconds: 0 });
    const [, forceTimerTick] = useState(0);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [myRoles, setMyRoles] = useState<Record<string, ProjectRole>>({});

    const activeProject = useMemo(() => projects.find((project) => project.id === activeProjectId) ?? null, [projects, activeProjectId]);
    const columns = activeProject?.flows ?? [];

    const summary = useMemo(() => {
        if (!activeProject) {
            return { tasks: 0 };
        }
        return { tasks: activeProject.flows.reduce((acc, flow) => acc + flow.tasks.length, 0) };
    }, [activeProject]);

    useEffect(() => {
        if (!timer.taskId) {
            return;
        }
        const interval = setInterval(() => {
            forceTimerTick((tick) => tick + 1);
        }, 15000);
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

    const loadProjects = async (ownerId: string, preferredProject?: string) => {
        const { data, error: fetchError } = await supabase
            .from('projects')
            .select(
                `
                id, name,
                flows (
                id, name, position,
                tasks ( id, project_id, flow_id, title, description, priority, due_date, tracked_seconds, created_at )
                )
            `,
            )
            .order('created_at', { ascending: true });

        if (fetchError) {
            setError(fetchError.message);
            return;
        }

        const normalised: BoardProject[] = (data ?? []).map((project: any) => ({
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
                                    }))
                                    .sort((a: BoardTask, b: BoardTask) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                              : [],
                      }))
                      .sort((a: BoardFlow, b: BoardFlow) => a.position - b.position)
                : [],
        }));

        setProjects(normalised);
        const projectIds = normalised.map((p) => p.id);
        if (projectIds.length) {
            const { data: roles, error: rolesErr } = await supabase.from('project_members').select('project_id, role').in('project_id', projectIds).eq('user_id', ownerId);

            if (!rolesErr) {
                const map: Record<string, ProjectRole> = {};
                (roles ?? []).forEach((r: any) => {
                    map[r.project_id] = r.role as ProjectRole;
                });
                setMyRoles(map);
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
        if (!userId) {
            return;
        }
        const trimmed = projectName.trim();
        if (!trimmed) {
            return;
        }
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
        if (!activeProject || !userId) {
            return;
        }
        const trimmed = flowName.trim();
        if (!trimmed) {
            return;
        }
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
        if (!activeProject || !activeColumnId || !userId) {
            return;
        }
        const title = taskForm.title.trim();
        if (!title) {
            return;
        }
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
        if (timer.taskId === task.id) {
            return timer.initialSeconds + Math.max(0, Math.floor((Date.now() - timer.startedAt) / 1000));
        }
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
            const nextSeconds = timer.initialSeconds + elapsedSeconds;
            updateTaskInState(taskId, (task) => ({ ...task, trackedSeconds: nextSeconds }));
            startMutate(async () => {
                await supabase.from('tasks').update({ tracked_seconds: nextSeconds }).eq('id', taskId);
            });
            setTimer({ taskId: null, startedAt: 0, initialSeconds: 0 });
            return;
        }
        const task = projects.flatMap((project) => project.flows.flatMap((flow) => flow.tasks)).find((item) => item.id === taskId);
        if (!task) {
            return;
        }
        setTimer({ taskId, startedAt: Date.now(), initialSeconds: task.trackedSeconds });
    };

    const handleTaskSort = (flowId: string, nextTasks: BoardTask[]) => {
        if (!userId || !activeProject) return;

        setProjects((prev) =>
            prev.map((project) => ({
                ...project,
                flows: project.flows.map((flow) => (flow.id === flowId ? { ...flow, tasks: nextTasks.map((task) => ({ ...task, flowId })) } : flow)),
            })),
        );

        const changedTasks = nextTasks.filter((task) => task.flowId !== flowId);
        if (!changedTasks.length) return;

        startMutate(async () => {
            const { error } = await supabase
                .from('tasks')
                .update({ flow_id: flowId })
                .in(
                    'id',
                    changedTasks.map((task) => task.id),
                );

            if (error) {
                setError(error.message);
                await loadProjects(userId, activeProject.id); // rollback UI jika gagal
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

    if (isLoading) {
        return <div className="flex min-h-[400px] items-center justify-center text-slate-500">Memuat Task Management...</div>;
    }

    if (error) {
        return <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-500 dark:border-rose-400/40 dark:bg-rose-500/10">{error}</div>;
    }

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
                        {task.description ? <p className="text-xs text-slate-500 dark:text-slate-400">{task.description}</p> : null}
                    </div>
                    <Dropdown
                        offset={[0, 10]}
                        placement={isRtl ? 'bottom-start' : 'bottom-end'}
                        btnClassName="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                        button={<IconHorizontalDots className="h-5 w-5" />}
                    >
                        <ul className="w-40 rounded-xl border border-slate-100 bg-white p-2 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
                            <li>
                                <button
                                    type="button"
                                    className="block w-full rounded-lg px-3 py-1.5 text-left text-primary hover:bg-primary/10 dark:text-primary/80 dark:hover:bg-primary/10"
                                    onClick={() => toggleTimer(task.id)}
                                >
                                    {timerRunning ? 'Stop timer' : 'Start timer'}
                                </button>
                            </li>
                            <li>
                                <button
                                    type="button"
                                    disabled={!canDelete}
                                    className={`mt-1 block w-full rounded-lg px-3 py-1.5 text-left ${
                                        canDelete ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10' : 'text-slate-400 cursor-not-allowed opacity-60'
                                    }`}
                                    onClick={() => canDelete && handleDeleteTask(task.id)}
                                >
                                    Hapus task
                                </button>
                            </li>
                        </ul>
                    </Dropdown>
                </div>
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
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300">
                    <IconCalendar className="h-4 w-4" />
                    <span>Due {dueInfo.formatted}</span>
                    {dueInfo.helper ? <span className="text-[11px] text-slate-400 dark:text-slate-500">{dueInfo.helper}</span> : null}
                </div>
            </article>
        );
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
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Kelola projects, flows, dan tasks secara langsung.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:text-slate-300">
                            {summary.tasks} task{summary.tasks === 1 ? '' : 's'}
                        </div>
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

            {isProjectModalOpen ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="panel w-full max-w-md rounded-2xl p-0">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Project baru</h2>
                            <button type="button" onClick={() => setIsProjectModalOpen(false)} className="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                                ï¿½
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

            {isFlowModalOpen && activeProject ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="panel w-full max-w-md rounded-2xl p-0">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Flow baru</h2>
                            <button type="button" onClick={() => setIsFlowModalOpen(false)} className="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                                ï¿½
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

            {isTaskModalOpen && activeProject ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="panel w-full max-w-2xl rounded-2xl p-0">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Task baru</h2>
                            <button type="button" onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                                ï¿½
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
                                    onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))}
                                    placeholder="Rincian pekerjaan"
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
        </div>
    );
};

export default ComponentsAppsTaskManagement;
