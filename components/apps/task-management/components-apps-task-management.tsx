'use client';
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import type { IRootState } from '@/store';
import ProjectSidebar from '@/components/tasker/ProjectSidebar';
import BoardColumn from '@/components/tasker/BoardColumn';
import TaskListView from '@/components/tasker/TaskListView';
import { useAuthUser } from '@/hooks/tasker/useAuthUser';
import { useBoardData } from '@/hooks/tasker/useBoardData';
import { useTaskTimer } from '@/hooks/tasker/useTaskTimer';
import { exportTimesheetXLSX } from '@/utils/tasker/export';
import { rpc } from '@/services/tasker/rpc';
import { deleteTask, insertTask, updateTask, removeAssignee, addAssignee } from '@/services/tasker/tasks';
import { BoardTask, Member, Priority } from '@/types/tasker';
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
    const isRtl = useSelector((s: IRootState) => s.themeConfig.rtlClass === 'rtl');
    const { userId, loading: userLoading, error: userError } = useAuthUser();
    const { projects, setProjects, activeProjectId, setActiveProjectId, activeColumnId, setActiveColumnId, activeProject, myRoles, isLoading, error, startMutate, loadProjects, updateTaskInState } =
        useBoardData(userId);
    const { timer, getTrackedSeconds, start, stop } = useTaskTimer();

    const [inviteOpen, setInviteOpen] = useState(false);
    const [membersOpen, setMembersOpen] = useState(false);
    const [projectOpen, setProjectOpen] = useState(false);
    const [flowOpen, setFlowOpen] = useState(false);
    const [taskOpen, setTaskOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

    const [editingTask, setEditingTask] = useState<BoardTask | null>(null);

    const openEditTask = (task: BoardTask) => {
        setEditingTask(task);
        setEditOpen(true);
    };

    const summary = useMemo(() => ({ tasks: activeProject ? activeProject.flows.reduce((a, f) => a + f.tasks.length, 0) : 0 }), [activeProject]);

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
                await loadProjects(activeProject?.id);
            });
        } else {
            start(taskId, task.trackedSeconds, (msg) => console.error(msg));
        }
    };

    const handleDeleteTask = (taskId: string) => {
        startMutate(async () => {
            await deleteTask(taskId);
            await loadProjects(activeProject?.id);
        });
    };

    const handleExport = () => {
        setExportConfirmOpen(true);
    };

    const handleConfirmExport = () => {
        if (activeProject) exportTimesheetXLSX(activeProject, getTrackedSeconds);
    };

    return (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <ProjectSidebar
                projects={projects}
                activeProjectId={activeProjectId}
                onSelect={(pid) => {
                    setActiveProjectId(pid);
                    const p = projects.find((p) => p.id === pid);
                    setActiveColumnId(p?.flows[0]?.id ?? null);
                }}
                onNewProject={() => setProjectOpen(true)}
            />
            <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Task Management</h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Kelola projects, flows, tasks, dan member.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:text-slate-300">{summary.tasks} tasks</div>
                        
                        <div className="flex items-center gap-1 rounded-xl border border-slate-200 p-1 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => setViewMode('board')}
                                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
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
                                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                                    viewMode === 'list'
                                        ? 'bg-primary text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                                }`}
                                title="List View"
                            >
                                <IconLayout className="h-4 w-4" />
                            </button>
                        </div>
                        
                        <button
                            type="button"
                            onClick={handleExport}
                            disabled={!activeProject}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Export
                        </button>
                        <button
                            type="button"
                            onClick={() => setMembersOpen(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <span className="inline-flex">
                                <IconPlus className="h-4 w-4" />
                            </span>
                            Members ({activeProject?.members?.length ?? 0})
                        </button>

                        <button
                            type="button"
                            onClick={() => setInviteOpen(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <IconPlus className="h-4 w-4" />
                            Invite
                        </button>

                        <button
                            type="button"
                            onClick={() => setFlowOpen(true)}
                            disabled={!activeProject}
                            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <IconPlus className="h-4 w-4" />
                            Flow baru
                        </button>

                        <button
                            type="button"
                            onClick={() => setTaskOpen(true)}
                            disabled={!activeColumnId || !activeProject}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <IconPlus className="h-5 w-5" />
                            Task baru
                        </button>
                    </div>
                </div>

                {activeProject?.flows?.length ? (
                    viewMode === 'board' ? (
                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                            {activeProject.flows.map((column) => (
                                <BoardColumn
                                    key={column.id}
                                    column={column}
                                    myRole={myRoles[activeProject.id] ?? 'member'}
                                    projectMembers={activeProject.members ?? []}
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
                        loadProjects(newProjectId);
                    }}
                />
            )}
            {flowOpen && activeProject && (
                <NewFlowModal projectId={activeProject.id} nextPosition={activeProject.flows.length} onClose={() => setFlowOpen(false)} onCreated={() => loadProjects(activeProject.id)} />
            )}
            {taskOpen && activeProject && activeColumnId && userId && (
                <NewTaskModal projectId={activeProject.id} flowId={activeColumnId} ownerId={userId} onClose={() => setTaskOpen(false)} onCreated={() => loadProjects(activeProject.id)} />
            )}
            {editOpen && editingTask && (
                <EditTaskModal
                    task={editingTask}
                    onClose={() => {
                        setEditOpen(false);
                        setEditingTask(null);
                    }}
                    onSaved={() => loadProjects(activeProject?.id)}
                />
            )}
            {exportConfirmOpen && <ExportConfirmationModal onClose={() => setExportConfirmOpen(false)} onConfirm={handleConfirmExport} />}
        </div>
    );
}
