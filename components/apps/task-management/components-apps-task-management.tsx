'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import BoardColumn from '@/components/tasker/BoardColumn';
import TaskListView from '@/components/tasker/TaskListView';
import { useAuthUser } from '@/hooks/tasker/useAuthUser';
import { useBoardData } from '@/hooks/tasker/useBoardData';
import { useTaskTimer } from '@/hooks/tasker/useTaskTimer';
import { exportTimesheetXLSX } from '@/utils/tasker/export';
import { rpc } from '@/services/tasker/rpc';
import { deleteTask, insertTask, updateTask, removeAssignee, addAssignee } from '@/services/tasker/tasks';
import { BoardTask, Member } from '@/types/tasker';
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

    const [editingTask, setEditingTask] = useState<BoardTask | null>(null);

    const openEditTask = (task: BoardTask) => {
        setEditingTask(task);
        setEditOpen(true);
    };

    const summary = useMemo(() => ({ tasks: activeProject ? activeProject.flows.reduce((a, f) => a + f.tasks.length, 0) : 0 }), [activeProject]);
    const formatCurrencyIdr = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Math.round(value));
    const activeRole = activeProject ? myRoles[activeProject.id] ?? 'member' : 'member';
    const canExport = activeRole === 'owner' || activeRole === 'admin';

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

    const monthlySummary = useMemo(() => {
        if (!activeProject) return { tasks: 0, seconds: 0, nominal: 0 };
        const [year, monthStr] = selectedMonth.split('-').map((v) => Number(v));
        const validMonth = !Number.isNaN(year) && !Number.isNaN(monthStr) && monthStr >= 1 && monthStr <= 12;
        const fallbackStart = new Date();
        fallbackStart.setUTCDate(1);
        fallbackStart.setUTCHours(0, 0, 0, 0);
        const start = validMonth ? new Date(Date.UTC(year, monthStr - 1, 1)) : fallbackStart;
        const end = new Date(start);
        end.setUTCMonth(start.getUTCMonth() + 1);

        const memberRates = new Map<string, number>();
        (activeProject.members ?? []).forEach((m) => {
            if (typeof m.hourlyRate === 'number') memberRates.set(m.userId, m.hourlyRate);
        });
        const resolveRate = (userId: string | null | undefined) => {
            if (!userId) return hourlyRate || 0;
            return memberRates.get(userId) ?? (hourlyRate || 0);
        };

        const filtered = activeProject.flows.flatMap((flow) =>
            flow.tasks.filter((task) => {
                const created = new Date(task.createdAt);
                const inMonth = created >= start && created < end;
                const assigneeMatch =
                    selectedAssignee === 'all'
                        ? true
                        : selectedAssignee === 'unassigned'
                        ? !task.assignees?.length
                        : task.assignees?.some((a) => a.userId === selectedAssignee);
                return inMonth && assigneeMatch;
            }),
        );

        const seconds = filtered.reduce((acc, task) => acc + getTrackedSeconds(task), 0);
        const nominal = filtered.reduce((acc, task) => {
            const secs = getTrackedSeconds(task);
            const normalizedAssignees =
                task.assignees?.length && selectedAssignee !== 'unassigned'
                    ? task.assignees
                    : task.assignees?.length
                    ? task.assignees
                    : [{ userId: 'unassigned', fullName: 'Unassigned', email: null, avatarUrl: null }];

            const relevantAssignees =
                selectedAssignee === 'all'
                    ? normalizedAssignees
                    : normalizedAssignees.filter((a) => (selectedAssignee === 'unassigned' ? a.userId === 'unassigned' : a.userId === selectedAssignee));

            if (!relevantAssignees.length) return acc;

            const shareSeconds = selectedAssignee === 'all' && normalizedAssignees.length ? secs / normalizedAssignees.length : secs;
            let taskNominal = 0;
            relevantAssignees.forEach((member) => {
                const rate = resolveRate(member.userId);
                taskNominal += (shareSeconds / 3600) * rate;
            });
            return acc + taskNominal;
        }, 0);
        return { tasks: filtered.length, seconds, nominal };
    }, [activeProject, getTrackedSeconds, hourlyRate, selectedAssignee, selectedMonth]);

    if (userLoading || isLoading) return <div className="flex min-h-[400px] items-center justify-center text-slate-500">Memuat Task Management...</div>;
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
        if (!canExport) return;
        setExportConfirmOpen(true);
    };

    const handleConfirmExport = () => {
        if (!canExport) return;
        if (activeProject)
            exportTimesheetXLSX(activeProject, getTrackedSeconds, {
                month: selectedMonth,
                assigneeFilter: selectedAssignee,
                hourlyRate,
            });
    };

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Task Management</h1>
                            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                <span>Project</span>
                                <select
                                    className="form-select h-9 border-slate-200 text-sm dark:border-slate-700"
                                    value={activeProjectId ?? ''}
                                    onChange={(e) => {
                                        const pid = e.target.value || null;
                                        setActiveProjectId(pid);
                                        const p = projects.find((p) => p.id === pid);
                                        setActiveColumnId(p?.flows[0]?.id ?? null);
                                    }}
                                >
                                    {projects.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setProjectOpen(true)}
                                    className="rounded-md border border-dashed border-primary/40 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                                >
                                    + Project
                                </button>
                            </div>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Kelola projects, flows, tasks, dan member.</p>
                    </div>
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:max-w-3xl">
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
                        <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2 md:grid-cols-3 lg:flex lg:flex-wrap lg:justify-end lg:gap-3">
                            <button
                                type="button"
                                onClick={handleExport}
                                disabled={!activeProject || !canExport}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                title={!canExport ? 'Hanya admin/owner yang dapat export' : 'Export laporan'}
                            >
                                Export
                            </button>
                            <button
                                type="button"
                                onClick={() => setMembersOpen(true)}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            >
                                <span className="inline-flex">
                                    <IconPlus className="h-4 w-4" />
                                </span>
                                Members ({activeProject?.members?.length ?? 0})
                            </button>
                            <button
                                type="button"
                                onClick={() => setInviteOpen(true)}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            >
                                <IconPlus className="h-4 w-4" />
                                Invite
                            </button>
                            <button
                                type="button"
                                onClick={() => setFlowOpen(true)}
                                disabled={!activeProject}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            >
                                <IconPlus className="h-4 w-4" />
                                Flow baru
                            </button>
                            <button
                                type="button"
                                onClick={() => setTaskOpen(true)}
                                disabled={!activeColumnId || !activeProject}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            >
                                <IconPlus className="h-5 w-5" />
                                Task baru
                            </button>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                            <span className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Bulan</span>
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
                                <option value="all">Semua user</option>
                                <option value="unassigned">Tanpa assignee</option>
                                {(activeProject?.members ?? []).map((m) => (
                                    <option key={m.userId} value={m.userId}>
                                        {m.fullName || m.email || m.userId}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                            <span className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Tarif / jam (IDR)</span>
                            <input
                                type="number"
                                min={0}
                                value={hourlyRate}
                                onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
                                className="form-input w-full"
                            />
                        </label>
                        <div className="flex flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 shadow-inner dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                            <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Nominal bulan ini</span>
                            <span className="text-lg font-semibold">{formatCurrencyIdr(monthlySummary.nominal)}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {monthlySummary.tasks} task | {(monthlySummary.seconds / 3600).toFixed(1)} jam
                            </span>
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
                        <p className="text-sm font-medium">Belum ada flow. Buat flow baru untuk mulai menambahkan task.</p>
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
