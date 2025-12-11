'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import BoardColumn from '@/components/tasker/BoardColumn';
import TaskListView from '@/components/tasker/TaskListView';
import { useAuthUser } from '@/hooks/tasker/useAuthUser';
import { useBoardData } from '@/hooks/tasker/useBoardData';
import { useTaskTimer } from '@/hooks/tasker/useTaskTimer';
import { exportTimesheetXLSX } from '@/utils/tasker/export';
import { rpc } from '@/services/tasker/rpc';
import { updateProjectArchive } from '@/services/tasker/projects';
import { deleteTask, insertTask, updateTask, removeAssignee, addAssignee } from '@/services/tasker/tasks';
import { BoardTask, Member } from '@/types/tasker';
import IconArchive from '@/components/icon/icon-archive';
import IconPlus from '@/components/icon/icon-plus';
import IconLayoutGrid from '@/components/icon/icon-layout-grid';
import IconLayout from '@/components/icon/icon-layout';
import InviteModal from '@/components/tasker/modals/InviteModal';
import MembersModal from '@/components/tasker/modals/MembersModal';
import NewProjectModal from '@/components/tasker/modals/NewProjectModal';
import NewFlowModal from '@/components/tasker/modals/NewFlowModal';
import NewTaskModal from '@/components/tasker/modals/NewTaskModal';
import EditTaskModal from '@/components/tasker/modals/EditTaskModal';
import ExportConfirmationModal from '@/components/tasker/modals/ExportConfirmationModal';
import IconRestore from '@/components/icon/icon-restore';

export default function ComponentsAppsTaskManagement() {
    const { userId, loading: userLoading, error: userError } = useAuthUser();
    const { projects, setProjects, activeProjectId, setActiveProjectId, activeColumnId, setActiveColumnId, activeProject, myRoles, isLoading, error, startMutate, loadProjects, updateTaskInState } =
        useBoardData(userId);
    const { timer, getTrackedSeconds, start, stop } = useTaskTimer();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [inviteOpen, setInviteOpen] = useState(false);
    const [membersOpen, setMembersOpen] = useState(false);
    const [projectOpen, setProjectOpen] = useState(false);
    const [flowOpen, setFlowOpen] = useState(false);
    const [taskOpen, setTaskOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
    const [selectedAssignee, setSelectedAssignee] = useState<'all' | 'unassigned' | string>('all');
    const [hourlyRate, setHourlyRate] = useState<number>(50000);
    const [projectActionError, setProjectActionError] = useState<string | null>(null);
    const [timerError, setTimerError] = useState<string | null>(null);
    const [showArchivedList, setShowArchivedList] = useState(false);
    const [showActionsMobile, setShowActionsMobile] = useState(false);
    const [showFilterMobile, setShowFilterMobile] = useState(false);

    const [editingTask, setEditingTask] = useState<BoardTask | null>(null);

    const openEditTask = (task: BoardTask) => {
        setEditingTask(task);
        setEditOpen(true);
    };

    const archivedProjects = useMemo(() => projects.filter((p) => p.archived), [projects]);
    const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);
    const summary = useMemo(() => ({ tasks: activeProject ? activeProject.flows.reduce((a, f) => a + f.tasks.length, 0) : 0 }), [activeProject]);
    const formatCurrencyIdr = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Math.round(value));
    const activeRole = activeProject ? myRoles[activeProject.id] ?? 'member' : 'member';
    const canSeeNominal = useMemo(() => {
        if (!activeProject || !userId) return true;
        const me = activeProject.members?.find((m) => m.userId === userId);
        if (!me) return true;
        if (me.isActive === false) return false;
        return me.canSeeNominal ?? true;
    }, [activeProject, userId]);
    const canExport = canSeeNominal && (activeRole === 'owner' || activeRole === 'admin');
    const canUseTimer = useMemo(() => {
        if (!activeProject || !userId) return true;
        const me = activeProject.members?.find((m) => m.userId === userId);
        if (!me) return true;
        if (me.isActive === false) return false;
        return me.canUseTimer ?? true;
    }, [activeProject, userId]);

    const allTasks = useMemo(() => activeProject?.flows.flatMap((f) => f.tasks) ?? [], [activeProject]);
    const taskMap = useMemo(() => {
        const map = new Map<string, BoardTask>();
        allTasks.forEach((t) => map.set(t.id, t));
        return map;
    }, [allTasks]);

    const monthRange = useMemo(() => {
        const [year, monthStr] = selectedMonth.split('-').map((v) => Number(v));
        const validMonth = !Number.isNaN(year) && !Number.isNaN(monthStr) && monthStr >= 1 && monthStr <= 12;
        const fallbackStart = new Date();
        fallbackStart.setUTCDate(1);
        fallbackStart.setUTCHours(0, 0, 0, 0);
        const start = validMonth ? new Date(Date.UTC(year, monthStr - 1, 1)) : fallbackStart;
        const end = new Date(start);
        end.setUTCMonth(start.getUTCMonth() + 1);
        return { start, end };
    }, [selectedMonth]);

    const memberRates = useMemo(() => {
        const map = new Map<string, number>();
        (activeProject?.members ?? []).forEach((m) => {
            if (typeof m.hourlyRate === 'number') map.set(m.userId, m.hourlyRate);
        });
        return map;
    }, [activeProject]);

    const resolveRate = useCallback(
        (userId: string | null | undefined) => {
            if (!userId) return hourlyRate || 0;
            return memberRates.get(userId) ?? (hourlyRate || 0);
        },
        [memberRates, hourlyRate],
    );

    const isTaskIncluded = useCallback(
        (task: BoardTask) => {
            const created = new Date(task.createdAt);
            const inMonth = created >= monthRange.start && created < monthRange.end;
            if (!inMonth) return false;
            if (selectedAssignee === 'all') return true;
            if (selectedAssignee === 'unassigned') return !(task.assignees?.length);
            return task.assignees?.some((a) => a.userId === selectedAssignee) ?? false;
        },
        [monthRange, selectedAssignee],
    );

    const normalizeAssignees = useCallback(
        (task: BoardTask) =>
            task.assignees?.length
                ? task.assignees
                : [{ userId: 'unassigned', fullName: 'Unassigned', email: null, avatarUrl: null }],
        [],
    );

    const computeTaskNominal = useCallback(
        (task: BoardTask, seconds: number) => {
            const normalizedAssignees = normalizeAssignees(task);
            const relevantAssignees =
                selectedAssignee === 'all'
                    ? normalizedAssignees
                    : normalizedAssignees.filter((a) => (selectedAssignee === 'unassigned' ? a.userId === 'unassigned' : a.userId === selectedAssignee));

            if (!relevantAssignees.length) return 0;

            const shareSeconds = selectedAssignee === 'all' && normalizedAssignees.length ? seconds / normalizedAssignees.length : seconds;

            return relevantAssignees.reduce((sum, member) => sum + (shareSeconds / 3600) * resolveRate(member.userId), 0);
        },
        [normalizeAssignees, resolveRate, selectedAssignee],
    );

    const filteredTasks = useMemo(() => allTasks.filter((task) => isTaskIncluded(task)), [allTasks, isTaskIncluded]);

    const baseMonthlySummary = useMemo(() => {
        if (!activeProject) return { tasks: 0, seconds: 0, nominal: 0 };
        let seconds = 0;
        let nominal = 0;

        filteredTasks.forEach((task) => {
            const secs = task.trackedSeconds || 0;
            seconds += secs;
            nominal += computeTaskNominal(task, secs);
        });

        return { tasks: filteredTasks.length, seconds, nominal };
    }, [activeProject, filteredTasks, computeTaskNominal]);

    const runningAdjustment = (() => {
        if (!timer.taskId || !timer.startedAt) return { seconds: 0, nominal: 0 };
        const runningTask = taskMap.get(timer.taskId);
        if (!runningTask || !isTaskIncluded(runningTask)) return { seconds: 0, nominal: 0 };

        const elapsed = Math.max(0, Math.floor((Date.now() - timer.startedAt) / 1000));
        if (!elapsed) return { seconds: 0, nominal: 0 };

        const baseSeconds = typeof runningTask.trackedSeconds === 'number' ? runningTask.trackedSeconds : timer.initialSeconds || 0;
        const nextSeconds = baseSeconds + elapsed;
        const baseNominal = computeTaskNominal(runningTask, baseSeconds);
        const nextNominal = computeTaskNominal(runningTask, nextSeconds);

        return { seconds: elapsed, nominal: nextNominal - baseNominal };
    })();

    const monthlySummary = {
        tasks: baseMonthlySummary.tasks,
        seconds: baseMonthlySummary.seconds + runningAdjustment.seconds,
        nominal: baseMonthlySummary.nominal + runningAdjustment.nominal,
    };

    useEffect(() => {
        const pid = searchParams.get('projectId');
        if (pid && pid !== activeProjectId) {
            setActiveProjectId(pid);
            const p = projects.find((proj) => proj.id === pid);
            setActiveColumnId(p?.flows[0]?.id ?? null);
        }
    }, [searchParams, projects, activeProjectId, setActiveProjectId, setActiveColumnId]);

    useEffect(() => {
        const newProject = searchParams.get('newProject');
        if (newProject && userId) {
            setProjectOpen(true);
            const pid = searchParams.get('projectId');
            const query = pid ? `?projectId=${pid}` : '';
            router.replace(`/apps/task-management${query}`);
        }
    }, [searchParams, userId, router]);

    useEffect(() => {
        if (activeProject?.archived) {
            const fallback = activeProjects[0];
            setActiveProjectId(fallback?.id ?? null);
            setActiveColumnId(fallback?.flows[0]?.id ?? null);
        }
    }, [activeProject, activeProjects, setActiveProjectId, setActiveColumnId]);

    useEffect(() => {
        if (canUseTimer) {
            setTimerError(null);
        }
    }, [canUseTimer, activeProjectId]);

    if (userLoading || isLoading) return <div className="flex min-h-[400px] items-center justify-center text-slate-500">Loading Task Management...</div>;
    if (userError || error) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-500 dark:border-rose-400/40 dark:bg-rose-500/10">{userError || error}</div>;

    const handleSort = async (flowId: string, nextTasks: BoardTask[]) => {
        // Optimistic update: update local state immediately
        setProjects((prev) =>
            prev.map((p) => ({
                ...p,
                flows: p.flows.map((f) => (f.id === flowId ? { ...f, tasks: nextTasks } : f)),
            }))
        );

        // Then save to database
        const ids = nextTasks.map((t) => t.id);
        startMutate(async () => {
            await rpc.reorderTasks(flowId, ids);
        });
    };

    const toggleTimer = (taskId: string) => {
        if (!canUseTimer && timer.taskId !== taskId) {
            setTimerError('You are not allowed to start/stop the timer in this project.');
            return;
        }
        setTimerError(null);
        const task = activeProject?.flows.flatMap((f) => f.tasks).find((t) => t.id === taskId);
        if (!task) return;
        if (timer.taskId === taskId) {
            const optimistic = Math.max(0, Math.floor((Date.now() - (timer.startedAt || Date.now())) / 1000)) + (timer.initialSeconds || 0);
            updateTaskInState(taskId, (t) => ({ ...t, trackedSeconds: optimistic }));
            startMutate(async () => {
                await stop(taskId, optimistic, (msg) => console.error(msg));
                await loadProjects(activeProject?.id, { silent: true });
            });
        } else {
            start(taskId, task.trackedSeconds, (msg) => console.error(msg));
        }
    };

    const handleDeleteTask = (taskId: string) => {
        startMutate(async () => {
            await deleteTask(taskId);
            await loadProjects(activeProject?.id, { silent: true });
        });
    };

    const handleExport = () => {
        if (!canExport || !activeProject || activeProject.archived) return;
        setExportConfirmOpen(true);
    };

    const handleConfirmExport = () => {
        if (!canExport || !activeProject || activeProject.archived) return;
        exportTimesheetXLSX(activeProject, getTrackedSeconds, {
            month: selectedMonth,
            assigneeFilter: selectedAssignee,
            hourlyRate,
        });
    };

    const handleArchiveToggle = (projectId: string, archived: boolean) => {
        setProjectActionError(null);
        const prevProjects = projects;
        let nextActiveId = activeProjectId;
        let nextActiveColumn = activeColumnId;

        if (archived && activeProjectId === projectId) {
            const fallback = projects.find((p) => !p.archived && p.id !== projectId);
            nextActiveId = fallback?.id ?? null;
            nextActiveColumn = fallback?.flows[0]?.id ?? null;
            setActiveProjectId(nextActiveId);
            setActiveColumnId(nextActiveColumn);
        } else if (!archived && !activeProjectId) {
            const restored = projects.find((p) => p.id === projectId);
            nextActiveId = projectId;
            nextActiveColumn = restored?.flows[0]?.id ?? null;
            setActiveProjectId(projectId);
            setActiveColumnId(nextActiveColumn);
        }

        setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, archived } : p)));

        startMutate(async () => {
            const { error } = await updateProjectArchive(projectId, archived);
            if (error) {
                setProjectActionError(error.message);
                setProjects(prevProjects);
                setActiveProjectId(activeProjectId);
                setActiveColumnId(activeColumnId);
                return;
            }
            await loadProjects(nextActiveId, { silent: true });
        });
    };

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Task Management</h1>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Manage projects, flows, tasks, and members.</p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-col lg:flex-row lg:flex-wrap lg:justify-end lg:gap-3">
                            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                                <div className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:text-slate-300 sm:w-auto">{summary.tasks} tasks</div>
                                <div className="flex w-full items-stretch gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('board')}
                                    aria-pressed={viewMode === 'board'}
                                    className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition sm:flex-none ${
                                        viewMode === 'board'
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                                    }`}
                                    title="Board View"
                                >
                                    <IconLayoutGrid className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('list')}
                                    aria-pressed={viewMode === 'list'}
                                    className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition sm:flex-none ${
                                        viewMode === 'list'
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                                    }`}
                                    title="List View"
                                >
                                    <IconLayout className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                            <div className="sm:hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowActionsMobile((v) => !v)}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-300"
                                >
                                    {showActionsMobile ? 'Hide actions' : 'Show actions'}
                                </button>
                            </div>
                        <div
                            className={`grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-3 lg:flex lg:flex-wrap lg:justify-end lg:gap-3 ${
                                showActionsMobile ? '' : 'hidden sm:grid'
                            }`}
                        >
                            <button
                                type="button"
                                onClick={handleExport}
                                disabled={!activeProject || !canExport || activeProject.archived}
                                className="col-span-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-300 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1 sm:w-auto"
                                title={
                                    !activeProject
                                        ? 'Select an active project'
                                        : activeProject.archived
                                        ? 'Archived projects cannot be exported'
                                        : !canSeeNominal
                                        ? 'Nominal visibility is disabled for your account'
                                        : !canExport
                                        ? 'Only admin/owner can export'
                                        : 'Export report'
                                }
                            >
                                Export
                            </button>
                            <button
                                type="button"
                                onClick={() => activeProject && handleArchiveToggle(activeProject.id, !activeProject.archived)}
                                disabled={!activeProject}
                                className={`col-span-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition sm:col-span-1 sm:w-auto ${
                                    activeProject?.archived
                                        ? 'border border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-500/10'
                                        : 'border border-slate-300 text-slate-600 hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-300'
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                                title={activeProject?.archived ? 'Restore project to active list' : 'Archive this project'}
                            >
                                {activeProject?.archived ? <IconRestore className="h-4 w-4" /> : <IconArchive className="h-4 w-4" />}
                                {activeProject?.archived ? 'Unarchive' : 'Archive'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setMembersOpen(true)}
                                className="col-span-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1 sm:w-auto"
                            >
                                <span className="inline-flex">
                                    <IconPlus className="h-4 w-4" />
                                </span>
                                Members ({activeProject?.members?.length ?? 0})
                            </button>
                            <button
                                type="button"
                                onClick={() => setInviteOpen(true)}
                                className="col-span-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1 sm:w-auto"
                            >
                                <IconPlus className="h-4 w-4" />
                                Invite
                            </button>
                            <button
                                type="button"
                                onClick={() => setFlowOpen(true)}
                                disabled={!activeProject}
                                className="col-span-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1 sm:w-auto"
                            >
                                <IconPlus className="h-4 w-4" />
                                New flow
                            </button>
                            <button
                                type="button"
                                onClick={() => setTaskOpen(true)}
                                disabled={!activeColumnId || !activeProject}
                                className="col-span-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1 sm:w-auto"
                            >
                                <IconPlus className="h-5 w-5" />
                                New task
                            </button>
                        </div>
                    </div>
                </div>
                {projectActionError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                        {projectActionError}
                    </div>
                ) : null}
                {timerError ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                        {timerError}
                    </div>
                ) : null}
                {archivedProjects.length ? (
                    <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold">Archived Projects ({archivedProjects.length})</p>
                                <p className="text-xs text-amber-700/80 dark:text-amber-200/80">Restore to show them again in the dashboard and export.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowArchivedList((v) => !v)}
                                className="rounded-md px-3 py-1 text-xs font-semibold transition hover:bg-amber-100/60 dark:hover:bg-amber-500/20"
                            >
                                {showArchivedList ? 'Hide' : 'Show list'}
                            </button>
                        </div>
                        {showArchivedList ? (
                            <ul className="mt-3 space-y-2">
                                {archivedProjects.map((p) => {
                                    const taskCount = p.flows.reduce((a, f) => a + f.tasks.length, 0);
                                    return (
                                        <li
                                            key={p.id}
                                            className="flex items-center justify-between rounded-lg border border-amber-200 bg-white/80 px-3 py-2 text-amber-800 dark:border-amber-500/30 dark:bg-slate-900 dark:text-amber-100"
                                        >
                                            <div>
                                                <p className="font-semibold">{p.name}</p>
                                                <p className="text-xs text-amber-700/80 dark:text-amber-200/80">
                                                    {taskCount} task{taskCount === 1 ? '' : 's'}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleArchiveToggle(p.id, false)}
                                                className="inline-flex items-center gap-1 rounded-md border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-100 dark:hover:bg-amber-500/20"
                                            >
                                                <IconRestore className="h-4 w-4" />
                                                Restore
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : null}
                    </div>
                ) : null}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-center justify-between sm:hidden">
                        <div className="flex flex-col">
                            <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">This month&apos;s nominal</span>
                            <span className="text-lg font-semibold text-slate-800 dark:text-slate-50">
                                {canSeeNominal ? formatCurrencyIdr(monthlySummary.nominal) : 'Nominal hidden'}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {monthlySummary.tasks} tasks | {(monthlySummary.seconds / 3600).toFixed(1)} hours
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowFilterMobile((v) => !v)}
                            className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:text-slate-200"
                        >
                            {showFilterMobile ? 'Hide' : 'Filter'}
                        </button>
                    </div>
                    <div className={`${showFilterMobile ? 'block' : 'hidden'} sm:block`}>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                                <span className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Month</span>
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="form-input w-full"
                                />
                            </label>
                            <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                                <span className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Filter User</span>
                                <select
                                    value={selectedAssignee}
                                    onChange={(e) => setSelectedAssignee(e.target.value)}
                                    className="form-select w-full"
                                >
                                    <option value="all">All users</option>
                                    <option value="unassigned">Unassigned</option>
                                    {(activeProject?.members ?? []).map((m) => (
                                        <option key={m.userId} value={m.userId}>
                                            {m.fullName || m.email || m.userId}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                                <span className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Rate / hour (IDR)</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={hourlyRate}
                                    onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
                                    className="form-input w-full"
                                />
                            </label>
                            <div className="hidden flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 shadow-inner sm:flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                                <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">This month&apos;s nominal</span>
                                <span className="text-lg font-semibold">
                                    {canSeeNominal ? formatCurrencyIdr(monthlySummary.nominal) : 'Nominal hidden'}
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {monthlySummary.tasks} tasks | {(monthlySummary.seconds / 3600).toFixed(1)} hours
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {activeProject?.flows?.length ? (
                    viewMode === 'board' ? (
                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                            {activeProject.flows.map((column, idx) => (
                                <BoardColumn
                                    key={column.id}
                                    column={column}
                                    myRole={myRoles[activeProject.id] ?? 'member'}
                                    projectMembers={activeProject.members ?? []}
                                    isLastFlow={idx === activeProject.flows.length - 1}
                                    onSort={handleSort}
                                    getTrackedSeconds={getTrackedSeconds}
                                    timerTaskId={timer.taskId}
                                    canUseTimer={canUseTimer}
                                    onEdit={openEditTask}
                                    onToggleTimer={toggleTimer}
                                    onDelete={handleDeleteTask}
                                    onToggleAssignee={async (task: BoardTask, member: Member) => {
                                        const assigned = !!task.assignees.find((a) => a.userId === member.userId);

                                        updateTaskInState(task.id, (t) => ({
                                            ...t,
                                            assignees: assigned ? t.assignees.filter((a) => a.userId !== member.userId) : [...t.assignees, member],
                                        }));
                                        try {
                                            if (assigned) {
                                                const { error } = await removeAssignee(task.id, member.userId);
                                                if (error) throw error;

                                                await rpc.logTaskActivity(task.id, 'assignee_removed', {
                                                    assignee_id: member.userId,
                                                    assignee_email: member.email,
                                                });
                                            } else {
                                                const { error } = await addAssignee(task.id, member.userId);
                                                if (error) throw error;

                                                await rpc.logTaskActivity(task.id, 'assignee_added', {
                                                    assignee_id: member.userId,
                                                    assignee_email: member.email,
                                                });
                                            }
                                        } catch (err) {
                                            updateTaskInState(task.id, (t) => ({
                                                ...t,
                                                assignees: assigned
                                                    ? [...t.assignees, member]
                                                    : t.assignees.filter((a) => a.userId !== member.userId),
                                            }));
                                            console.error(err);
                                        }
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {activeProject.flows.map((flow) => (
                                <TaskListView
                                    key={flow.id}
                                    tasks={flow.tasks}
                                    flowName={flow.name}
                                    projectMembers={activeProject.members ?? []}
                                    getTrackedSeconds={getTrackedSeconds}
                                    timerTaskId={timer.taskId}
                                    canUseTimer={canUseTimer}
                                    onEdit={openEditTask}
                                    onToggleTimer={toggleTimer}
                                    onDelete={handleDeleteTask}
                                    myRole={myRoles[activeProject.id] ?? 'member'}
                                />
                            ))}
                        </div>
                    )
                ) : (
                    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-[#0f172a] dark:text-slate-400">
                        <p className="text-sm font-medium">No flows yet. Create a new flow to start adding tasks.</p>
                    </div>
                )}
            </div>
        {inviteOpen && activeProject && <InviteModal projectId={activeProject.id} onClose={() => setInviteOpen(false)} />}
        {membersOpen && activeProject && <MembersModal project={activeProject} onClose={() => setMembersOpen(false)} />}
        {projectOpen && userId && (
            <NewProjectModal
                ownerId={userId}
                onClose={() => setProjectOpen(false)}
                onCreated={(newProjectId) => {
                    loadProjects(newProjectId, { silent: true });
                }}
            />
        )}
        {flowOpen && activeProject && (
            <NewFlowModal projectId={activeProject.id} nextPosition={activeProject.flows.length} onClose={() => setFlowOpen(false)} onCreated={() => loadProjects(activeProject.id, { silent: true })} />
        )}
        {taskOpen && activeProject && activeColumnId && userId && (
            <NewTaskModal projectId={activeProject.id} flowId={activeColumnId} ownerId={userId} onClose={() => setTaskOpen(false)} onCreated={() => loadProjects(activeProject.id, { silent: true })} />
        )}
        {editOpen && editingTask && (
            <EditTaskModal
                task={editingTask}
                onClose={() => {
                    setEditOpen(false);
                    setEditingTask(null);
                }}
                onSaved={() => loadProjects(activeProject?.id, { silent: true })}
            />
        )}
        {exportConfirmOpen && <ExportConfirmationModal onClose={() => setExportConfirmOpen(false)} onConfirm={handleConfirmExport} />}
        </>
    );
}
