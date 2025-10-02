'use client';

import Dropdown from '@/components/dropdown';
import IconCalendar from '@/components/icon/icon-calendar';
import IconClock from '@/components/icon/icon-clock';
import IconHorizontalDots from '@/components/icon/icon-horizontal-dots';
import IconPlus from '@/components/icon/icon-plus';
import IconTag from '@/components/icon/icon-tag';
import IconChecks from '@/components/icon/icon-checks';
import IconTrashLines from '@/components/icon/icon-trash-lines';
import IconX from '@/components/icon/icon-x';
import { IRootState } from '@/store';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { ReactSortable } from 'react-sortablejs';

type Priority = 'Low' | 'Medium' | 'High';

type ChecklistItem = {
    id: string;
    label: string;
    done: boolean;
};

type Assignee = {
    id: string;
    name: string;
    initials: string;
    color: string;
};

type Task = {
    id: string;
    title: string;
    description: string;
    dueDate: string;
    estimate: number;
    tracked: number;
    tags: string[];
    checklist: ChecklistItem[];
    assignees: Assignee[];
    priority: Priority;
};

type Column = {
    id: string;
    title: string;
    accent: string;
    tasks: Task[];
};

type TaskFormState = {
    title: string;
    description: string;
    dueDate: string;
    estimate: string;
    tags: string;
    checklist: string;
    assigneeIds: string[];
    priority: Priority;
};

const teamMembers: Assignee[] = [
    { id: 'amelia', name: 'Amelia Brown', initials: 'AB', color: '#4F46E5' },
    { id: 'dmitri', name: 'Dmitri Kline', initials: 'DK', color: '#0EA5E9' },
    { id: 'lina', name: 'Lina Ortega', initials: 'LO', color: '#10B981' },
    { id: 'tariq', name: 'Tariq Young', initials: 'TY', color: '#F97316' },
];

const accentPalette = ['border-slate-200', 'border-primary/30', 'border-emerald-200', 'border-amber-200', 'border-rose-200'];

const pickAccent = () => accentPalette[Math.floor(Math.random() * accentPalette.length)];

const pickMembers = (ids: string[]): Assignee[] => teamMembers.filter((member) => ids.includes(member.id));

const createDueDate = (daysFromNow: number) => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + daysFromNow);
    return base.toISOString();
};

const buildInitialColumns = (): Column[] => [
    {
        id: 'planning',
        title: 'Planning',
        accent: 'border-slate-200',
        tasks: [
            {
                id: 'task-planning-1',
                title: 'Define Q4 release scope',
                description: 'Align stakeholders on the features entering the next release train.',
                dueDate: createDueDate(4),
                estimate: 12,
                tracked: 3.5,
                tags: ['Product', 'Planning'],
                checklist: [
                    { id: 'task-planning-1-1', label: 'Collect stakeholder requests', done: true },
                    { id: 'task-planning-1-2', label: 'Draft release narrative', done: false },
                    { id: 'task-planning-1-3', label: 'Review with leadership', done: false },
                ],
                assignees: pickMembers(['amelia', 'lina']),
                priority: 'High',
            },
            {
                id: 'task-planning-2',
                title: 'Research billing migration blockers',
                description: 'Investigate dependencies and propose mitigation plan.',
                dueDate: createDueDate(7),
                estimate: 6,
                tracked: 1.5,
                tags: ['Research'],
                checklist: [
                    { id: 'task-planning-2-1', label: 'Collect integration notes', done: false },
                    { id: 'task-planning-2-2', label: 'Document risks', done: false },
                ],
                assignees: pickMembers(['dmitri']),
                priority: 'Medium',
            },
        ],
    },
    {
        id: 'in-progress',
        title: 'In Progress',
        accent: 'border-primary/30',
        tasks: [
            {
                id: 'task-active-1',
                title: 'Design subscription analytics dashboard',
                description: 'Produce interactive cohort and retention insights for leadership.',
                dueDate: createDueDate(1),
                estimate: 18,
                tracked: 11.25,
                tags: ['Design', 'Analytics'],
                checklist: [
                    { id: 'task-active-1-1', label: 'Wireframes approved', done: true },
                    { id: 'task-active-1-2', label: 'Finalize component states', done: false },
                    { id: 'task-active-1-3', label: 'QA acceptance criteria', done: false },
                ],
                assignees: pickMembers(['lina', 'tariq']),
                priority: 'High',
            },
            {
                id: 'task-active-2',
                title: 'Implement webhook retries',
                description: 'Add exponential backoff and circuit breaker configuration.',
                dueDate: createDueDate(3),
                estimate: 10,
                tracked: 5.75,
                tags: ['Backend'],
                checklist: [
                    { id: 'task-active-2-1', label: 'Proof-of-concept', done: true },
                    { id: 'task-active-2-2', label: 'Instrumentation events', done: false },
                    { id: 'task-active-2-3', label: 'Rollout playbook', done: false },
                ],
                assignees: pickMembers(['dmitri', 'tariq']),
                priority: 'Medium',
            },
        ],
    },
    {
        id: 'review',
        title: 'Review',
        accent: 'border-emerald-200',
        tasks: [
            {
                id: 'task-review-1',
                title: 'Customer onboarding flow QA',
                description: 'Validate translations, journeys, and activation email triggers.',
                dueDate: createDueDate(-1),
                estimate: 8,
                tracked: 7.5,
                tags: ['QA', 'Customer Success'],
                checklist: [
                    { id: 'task-review-1-1', label: 'Device matrix completed', done: true },
                    { id: 'task-review-1-2', label: 'Email triggers verified', done: true },
                    { id: 'task-review-1-3', label: 'Support sign-off', done: false },
                ],
                assignees: pickMembers(['amelia', 'tariq']),
                priority: 'Low',
            },
            {
                id: 'task-review-2',
                title: 'Security documentation update',
                description: 'Refresh SOC 2 evidence and disaster recovery runbook.',
                dueDate: createDueDate(6),
                estimate: 5,
                tracked: 2.25,
                tags: ['Security'],
                checklist: [
                    { id: 'task-review-2-1', label: 'Collect latest pentest results', done: true },
                    { id: 'task-review-2-2', label: 'Update access controls memo', done: false },
                ],
                assignees: pickMembers(['dmitri']),
                priority: 'Low',
            },
        ],
    },
];

const createEmptyTaskForm = (): TaskFormState => ({
    title: '',
    description: '',
    dueDate: '',
    estimate: '6',
    tags: '',
    checklist: '',
    assigneeIds: teamMembers.slice(0, 2).map((member) => member.id),
    priority: 'Medium',
});

const formatDue = (iso: string) => {
    if (!iso) {
        return { formatted: 'No due date', helper: '', overdue: false };
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
        helper = `${diffDays} day${diffDays === 1 ? '' : 's'} left`;
    } else if (diffDays === 0) {
        helper = 'Due today';
    } else {
        helper = `Overdue ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`;
    }
    return { formatted, helper, overdue: diffDays < 0 };
};

const formatHours = (hours: number) => {
    if (!Number.isFinite(hours) || hours <= 0) {
        return '0h';
    }
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h && m) {
        return `${h}h ${m}m`;
    }
    if (h) {
        return `${h}h`;
    }
    return `${m}m`;
};

const getChecklistSummary = (task: Task) => {
    const total = task.checklist.length;
    const done = task.checklist.filter((item) => item.done).length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    return { total, done, percent };
};

const priorityStyles: Record<Priority, string> = {
    High: 'border border-rose-200 bg-rose-100/60 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
    Medium: 'border border-amber-200 bg-amber-100/60 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
    Low: 'border border-emerald-200 bg-emerald-100/60 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
};

const ComponentsAppsTaskManagement = () => {
    const isRtl = useSelector((state: IRootState) => state.themeConfig.rtlClass === 'rtl');
    const [columns, setColumns] = useState<Column[]>(() => buildInitialColumns());
    const [activeColumnId, setActiveColumnId] = useState<string>('planning');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formState, setFormState] = useState<TaskFormState>(() => createEmptyTaskForm());
    const [timer, setTimer] = useState<{ taskId: string | null; startedAt: number; initialTracked: number }>({
        taskId: null,
        startedAt: 0,
        initialTracked: 0,
    });
    const [, setTimerTick] = useState(0);
    const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
    const [columnTitle, setColumnTitle] = useState('');

    const summary = useMemo(() => {
        let tasks = 0;
        let checklistDone = 0;
        let checklistTotal = 0;
        columns.forEach((column) => {
            tasks += column.tasks.length;
            column.tasks.forEach((task) => {
                checklistDone += task.checklist.filter((item) => item.done).length;
                checklistTotal += task.checklist.length;
            });
        });
        return { tasks, checklistDone, checklistTotal };
    }, [columns]);

    const activeTask = useMemo(() => {
        if (!timer.taskId) {
            return null;
        }
        for (const column of columns) {
            const task = column.tasks.find((item) => item.id === timer.taskId);
            if (task) {
                return task;
            }
        }
        return null;
    }, [columns, timer.taskId]);

    const openModal = (columnId: string) => {
        setActiveColumnId(columnId);
        setFormState(createEmptyTaskForm());
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setFormState(createEmptyTaskForm());
    };

    const openColumnModal = () => {
        setColumnTitle('');
        setIsColumnModalOpen(true);
    };

    const closeColumnModal = () => {
        setColumnTitle('');
        setIsColumnModalOpen(false);
    };

    const updateFormField = <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => {
        setFormState((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const toggleAssignee = (id: string) => {
        setFormState((prev) => {
            const exists = prev.assigneeIds.includes(id);
            const next = exists ? prev.assigneeIds.filter((item) => item !== id) : [...prev.assigneeIds, id];
            return {
                ...prev,
                assigneeIds: next,
            };
        });
    };

    const findTask = (taskId: string) => {
        for (const column of columns) {
            const task = column.tasks.find((item) => item.id === taskId);
            if (task) {
                return { task, columnId: column.id };
            }
        }
        return null;
    };

    const toggleTimer = (taskId: string) => {
        if (timer.taskId === taskId) {
            const found = findTask(taskId);
            if (!found) {
                setTimer({ taskId: null, startedAt: 0, initialTracked: 0 });
                return;
            }
            const elapsedHours = (Date.now() - timer.startedAt) / 3600000;
            const newTracked = Math.max(0, timer.initialTracked + elapsedHours);
            setColumns((prev) =>
                prev.map((column) =>
                    column.id === found.columnId
                        ? {
                              ...column,
                              tasks: column.tasks.map((task) => (task.id === taskId ? { ...task, tracked: newTracked } : task)),
                          }
                        : column,
                ),
            );
            setTimer({ taskId: null, startedAt: 0, initialTracked: 0 });
            return;
        }

        const found = findTask(taskId);
        if (!found) {
            return;
        }
        setTimer({
            taskId,
            startedAt: Date.now(),
            initialTracked: found.task.tracked,
        });
    };

    useEffect(() => {
        if (!timer.taskId) {
            return;
        }
        const interval = setInterval(() => {
            setTimerTick((tick) => tick + 1);
        }, 15000);
        return () => clearInterval(interval);
    }, [timer.taskId]);

    const getTrackedHours = (task: Task) => {
        if (timer.taskId === task.id) {
            const elapsedHours = (Date.now() - timer.startedAt) / 3600000;
            return timer.initialTracked + elapsedHours;
        }
        return task.tracked;
    };

    const toggleChecklistItem = (taskId: string, itemId: string) => {
        setColumns((prev) =>
            prev.map((column) => ({
                ...column,
                tasks: column.tasks.map((task) =>
                    task.id === taskId
                        ? {
                              ...task,
                              checklist: task.checklist.map((item) =>
                                  item.id === itemId ? { ...item, done: !item.done } : item,
                              ),
                          }
                        : task,
                ),
            })),
        );
    };

    const completeChecklist = (taskId: string) => {
        setColumns((prev) =>
            prev.map((column) => ({
                ...column,
                tasks: column.tasks.map((task) =>
                    task.id === taskId
                        ? {
                              ...task,
                              checklist: task.checklist.map((item) => ({ ...item, done: true })),
                          }
                        : task,
                ),
            })),
        );
    };

    const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!formState.title.trim()) {
            return;
        }
        const createdAt = Date.now();
        const newTask: Task = {
            id: `task-${createdAt}`,
            title: formState.title.trim(),
            description: formState.description.trim(),
            dueDate: formState.dueDate ? new Date(`${formState.dueDate}T00:00:00`).toISOString() : '',
            estimate: Number.isFinite(Number.parseFloat(formState.estimate)) ? Math.max(0, Number.parseFloat(formState.estimate)) : 0,
            tracked: 0,
            tags: formState.tags
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean),
            checklist: formState.checklist
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean)
                .map((label, index) => ({
                    id: `task-${createdAt}-chk-${index}`,
                    label,
                    done: false,
                })),
            assignees: teamMembers.filter((member) => formState.assigneeIds.includes(member.id)),
            priority: formState.priority,
        };

        setColumns((prev) =>
            prev.map((column) =>
                column.id === activeColumnId
                    ? {
                          ...column,
                          tasks: [newTask, ...column.tasks],
                      }
                    : column,
            ),
        );
        setFormState(createEmptyTaskForm());
        setIsModalOpen(false);
    };

    const createColumn = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = columnTitle.trim();
        if (!trimmed) {
            return;
        }
        const newColumn: Column = {
            id: `column-${Date.now()}`,
            title: trimmed,
            accent: pickAccent(),
            tasks: [],
        };
        setColumns((prev) => [...prev, newColumn]);
        setActiveColumnId(newColumn.id);
        setColumnTitle('');
        setIsColumnModalOpen(false);
    };

    const removeColumn = (columnId: string) => {
        if (columns.length <= 1) {
            return;
        }
        const columnToRemove = columns.find((column) => column.id === columnId);
        if (!columnToRemove) {
            return;
        }
        if (typeof window !== 'undefined' && !window.confirm('Hapus flow ini? Semua task di dalamnya akan ikut dihapus.')) {
            return;
        }
        setColumns((prev) => {
            const next = prev.filter((column) => column.id !== columnId);
            if (timer.taskId && columnToRemove.tasks.some((task) => task.id === timer.taskId)) {
                setTimer({ taskId: null, startedAt: 0, initialTracked: 0 });
            }
            if (!next.some((column) => column.id === activeColumnId)) {
                const fallback = next[0]?.id ?? '';
                setActiveColumnId(fallback);
            }
            return next;
        });
    };

    const handleColumnSort = (nextColumns: Column[]) => {
        setColumns(nextColumns);
    };

    const handleTaskSort = (columnId: string, nextTasks: Task[]) => {
        setColumns((prev) =>
            prev.map((column) => (column.id === columnId ? { ...column, tasks: nextTasks } : column)),
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Task Management</h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Plan and track delivery across teams with Proxaurus.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:text-slate-300">
                        {summary.tasks} task{summary.tasks === 1 ? '' : 's'}
                    </div>
                    <div className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:text-slate-300">
                        {summary.checklistDone}/{summary.checklistTotal} checklist items
                    </div>
                    {activeTask ? (
                        <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary dark:border-primary/30 dark:bg-primary/10">
                            <IconClock className="h-4 w-4" />
                            <span>Timer running on {activeTask.title}</span>
                        </div>
                    ) : null}
                    <button
                        type="button"
                        onClick={openColumnModal}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-300"
                    >
                        <IconPlus className="h-4 w-4" />
                        New flow
                    </button>
                    <button
                        type="button"
                        onClick={() => openModal(columns[0]?.id ?? 'planning')}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90"
                    >
                        <IconPlus className="h-5 w-5" />
                        New Task
                    </button>
                </div>
            </div>

            <ReactSortable<Column>
                list={columns}
                setList={handleColumnSort}
                animation={200}
                className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
                ghostClass="opacity-30"
            >
                {columns.map((column) => (
                    <section
                        key={column.id}
                        data-id={column.id}
                        className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-slate-700 dark:bg-[#0f172a]"
                    >
                        <header className="mb-4 flex items-start justify-between gap-3 border-b border-transparent pb-1">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{column.title}</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">{column.tasks.length} task{column.tasks.length === 1 ? '' : 's'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => openModal(column.id)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
                                >
                                    <IconPlus className="h-4 w-4" />
                                    <span>Add</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removeColumn(column.id)}
                                    disabled={columns.length <= 1}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                                >
                                    <IconTrashLines className="h-4 w-4" />
                                    <span className="sr-only">Delete column</span>
                                </button>
                            </div>
                        </header>
                        <ReactSortable<Task>
                            list={column.tasks}
                            setList={(nextTasks) => handleTaskSort(column.id, nextTasks)}
                            group="task-cards"
                            animation={200}
                            className="flex-1 space-y-4"
                            ghostClass="opacity-30"
                        >
                            {column.tasks.map((task) => {
                                const trackedValue = getTrackedHours(task);
                                const checklist = getChecklistSummary(task);
                                const dueInfo = formatDue(task.dueDate);
                                const effortPercent = task.estimate > 0 ? Math.min(100, Math.round((trackedValue / task.estimate) * 100)) : 0;
                                return (
                                    <article
                                        key={task.id}
                                        data-id={task.id}
                                        className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm transition hover:border-primary/40 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900/60"
                                    >
                                        <div className="mb-3 flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityStyles[task.priority]}`}>
                                                        <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                                                        {task.priority} priority
                                                    </span>
                                                </div>
                                                <h3 className="text-base font-semibold text-slate-900 dark:text-white">{task.title}</h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{task.description}</p>
                                            </div>
                                            <Dropdown
                                                offset={[0, 10]}
                                                placement={isRtl ? 'bottom-start' : 'bottom-end'}
                                                btnClassName="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                                                button={<IconHorizontalDots className="h-5 w-5" />}
                                            >
                                                <ul className="w-44 rounded-xl border border-slate-100 bg-white p-2 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                                    <li>
                                                        <button
                                                            type="button"
                                                            className="block w-full rounded-lg px-3 py-1.5 text-left text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                                            onClick={() => toggleTimer(task.id)}
                                                        >
                                                            {timer.taskId === task.id ? 'Stop timer' : 'Start timer'}
                                                        </button>
                                                    </li>
                                                    <li>
                                                        <button
                                                            type="button"
                                                            className="block w-full rounded-lg px-3 py-1.5 text-left text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                                            onClick={() => completeChecklist(task.id)}
                                                        >
                                                            Complete checklist
                                                        </button>
                                                    </li>
                                                </ul>
                                            </Dropdown>
                                        </div>
                                        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs font-medium">
                                            <div
                                                className={`${dueInfo.overdue ? 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300' : 'border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-300'} flex items-center gap-1 rounded-lg border px-2 py-1`}
                                            >
                                                <IconCalendar className="h-4 w-4" />
                                                <span>Due {dueInfo.formatted}</span>
                                                {dueInfo.helper ? (
                                                    <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500">{dueInfo.helper}</span>
                                                ) : null}
                                            </div>
                                            {task.tags.length ? (
                                                <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                    <IconTag className="h-4 w-4 text-slate-400" />
                                                    {task.tags.map((tag) => (
                                                        <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold dark:bg-slate-800">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className="mb-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                                            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-300">
                                                <span className="inline-flex items-center gap-1">
                                                    <IconClock className="h-4 w-4" />
                                                    Time tracker
                                                </span>
                                                <span className="font-medium text-slate-400 dark:text-slate-500">{formatHours(task.estimate)} est.</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                <span>{formatHours(trackedValue)}</span>
                                                <button
                                                    type="button"
                                                    className={`text-xs transition ${timer.taskId === task.id ? 'text-rose-500 hover:text-rose-600' : 'text-primary hover:text-primary/90'}`}
                                                    onClick={() => toggleTimer(task.id)}
                                                >
                                                    {timer.taskId === task.id ? 'Stop timer' : 'Start timer'}
                                                </button>
                                            </div>
                                            <div className="h-2 w-full rounded-full bg-white dark:bg-slate-800">
                                                <div
                                                    className={`h-full rounded-full ${timer.taskId === task.id ? 'bg-primary' : 'bg-slate-900 dark:bg-primary'}`}
                                                    style={{ width: `${effortPercent}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="mb-3 space-y-2">
                                            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-300">
                                                <span className="inline-flex items-center gap-1">
                                                    <IconChecks className="h-4 w-4" />
                                                    Checklist
                                                </span>
                                                <span>
                                                    {checklist.done}/{checklist.total}
                                                </span>
                                            </div>
                                            <div className="space-y-1.5">
                                                {task.checklist.map((item) => (
                                                    <label key={item.id} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                                                        <input
                                                            type="checkbox"
                                                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                                                            checked={item.done}
                                                            onChange={() => toggleChecklistItem(task.id, item.id)}
                                                        />
                                                        <span className={item.done ? 'line-through text-slate-400 dark:text-slate-500' : ''}>{item.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex -space-x-2">
                                                {task.assignees.map((member) => (
                                                    <span
                                                        key={member.id}
                                                        title={member.name}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white shadow-sm ring-1 ring-slate-900/5 dark:border-slate-900"
                                                        style={{ backgroundColor: member.color }}
                                                    >
                                                        {member.initials}
                                                    </span>
                                                ))}
                                            </div>
                                            {checklist.percent ? (
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{checklist.percent}% done</span>
                                            ) : null}
                                        </div>
                                    </article>
                                );
                            })}
                        </ReactSortable>
                        {!column.tasks.length ? (
                            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-400 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-500">
                                No tasks yet. Add one to get started.
                            </div>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => openModal(column.id)}
                            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-500 transition hover:border-primary/40 hover:text-primary dark:border-slate-600 dark:text-slate-400"
                        >
                            <IconPlus className="h-4 w-4" />
                            Add task
                        </button>
                    </section>
                ))}
            </ReactSortable>

            <Transition appear show={isColumnModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[60]" onClose={closeColumnModal}>
                    <TransitionChild
                        as={Fragment}
                        enter="ease-out duration-200"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-150"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
                    </TransitionChild>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center px-4 py-8">
                            <TransitionChild
                                as={Fragment}
                                enter="ease-out duration-200"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-150"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <DialogPanel className="panel w-full max-w-md rounded-2xl border-0 p-0">
                                    <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">New flow</h2>
                                        <button
                                            type="button"
                                            onClick={closeColumnModal}
                                            className="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                                        >
                                            <IconX />
                                        </button>
                                    </div>
                                    <form className="grid gap-4 px-6 py-6" onSubmit={createColumn}>
                                        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            Flow name
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={columnTitle}
                                                onChange={(event) => setColumnTitle(event.target.value)}
                                                placeholder="Misal: Deployment"
                                                required
                                            />
                                        </label>
                                        <div className="flex items-center justify-end gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={closeColumnModal}
                                                className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-md shadow-primary/30 transition hover:bg-primary/90"
                                            >
                                                <IconPlus className="h-4 w-4" />
                                                Create flow
                                            </button>
                                        </div>
                                    </form>
                                </DialogPanel>
                            </TransitionChild>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            <Transition appear show={isModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[60]" onClose={closeModal}>
                    <TransitionChild
                        as={Fragment}
                        enter="ease-out duration-200"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-150"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
                    </TransitionChild>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center px-4 py-8">
                            <TransitionChild
                                as={Fragment}
                                enter="ease-out duration-200"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-150"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <DialogPanel className="panel w-full max-w-3xl rounded-2xl border-0 p-0">
                                    <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                                        <div>
                                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Create task</h2>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Add checklist items, due dates, and assignees.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={closeModal}
                                            className="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                                        >
                                            <IconX />
                                        </button>
                                    </div>
                                    <form className="grid gap-4 px-6 py-6" onSubmit={handleFormSubmit}>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Task title
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={formState.title}
                                                    onChange={(event) => updateFormField('title', event.target.value)}
                                                    placeholder="e.g. Ship onboarding improvements"
                                                    required
                                                />
                                            </label>
                                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Owner(s)
                                                <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-600">
                                                    {teamMembers.map((member) => {
                                                        const selected = formState.assigneeIds.includes(member.id);
                                                        return (
                                                            <button
                                                                key={member.id}
                                                                type="button"
                                                                onClick={() => toggleAssignee(member.id)}
                                                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                                                    selected
                                                                        ? 'border-primary bg-primary/10 text-primary dark:border-primary/40 dark:bg-primary/15 dark:text-primary'
                                                                        : 'border-transparent bg-slate-100 text-slate-500 hover:border-primary/20 hover:bg-primary/10 hover:text-primary dark:bg-slate-800 dark:text-slate-400'
                                                                }`}
                                                            >
                                                                <span
                                                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] text-white"
                                                                    style={{ backgroundColor: member.color }}
                                                                >
                                                                    {member.initials}
                                                                </span>
                                                                {member.name}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </label>
                                        </div>
                                        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            Description
                                            <textarea
                                                className="form-textarea min-h-[100px]"
                                                value={formState.description}
                                                onChange={(event) => updateFormField('description', event.target.value)}
                                                placeholder="Describe the work so teammates can jump in quickly."
                                            />
                                        </label>
                                        <div className="grid gap-4 md:grid-cols-3">
                                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Due date
                                                <input
                                                    type="date"
                                                    className="form-input"
                                                    value={formState.dueDate}
                                                    onChange={(event) => updateFormField('dueDate', event.target.value)}
                                                />
                                            </label>
                                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Estimate (hours)
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.5"
                                                    className="form-input"
                                                    value={formState.estimate}
                                                    onChange={(event) => updateFormField('estimate', event.target.value)}
                                                />
                                            </label>
                                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Priority
                                                <select
                                                    className="form-select"
                                                    value={formState.priority}
                                                    onChange={(event) => updateFormField('priority', event.target.value as Priority)}
                                                >
                                                    <option value="High">High</option>
                                                    <option value="Medium">Medium</option>
                                                    <option value="Low">Low</option>
                                                </select>
                                            </label>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Tags
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={formState.tags}
                                                    onChange={(event) => updateFormField('tags', event.target.value)}
                                                    placeholder="Separate with commas, e.g. Product, UI"
                                                />
                                            </label>
                                            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Column
                                                <select
                                                    className="form-select"
                                                    value={activeColumnId}
                                                    onChange={(event) => setActiveColumnId(event.target.value)}
                                                >
                                                    {columns.map((column) => (
                                                        <option key={column.id} value={column.id}>
                                                            {column.title}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        </div>
                                        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            Checklist
                                            <textarea
                                                className="form-textarea min-h-[120px]"
                                                value={formState.checklist}
                                                onChange={(event) => updateFormField('checklist', event.target.value)}
                                                placeholder="Write each checklist item on a new line."
                                            />
                                        </label>
                                        <div className="flex items-center justify-end gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={closeModal}
                                                className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-md shadow-primary/30 transition hover:bg-primary/90"
                                            >
                                                <IconPlus className="h-4 w-4" />
                                                Create task
                                            </button>
                                        </div>
                                    </form>
                                </DialogPanel>
                            </TransitionChild>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
};

export default ComponentsAppsTaskManagement;
