'use client';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import IconClock from '@/components/icon/icon-clock';
import IconCalendar from '@/components/icon/icon-calendar';
import IconHorizontalDots from '@/components/icon/icon-horizontal-dots';
import Dropdown from '@/components/dropdown';
import { BoardTask, Member, Priority } from '@/types/tasker';
import { formatDue } from '@/utils/tasker/date';

export type TaskCardProps = {
    task: BoardTask;
    projectMembers: Member[];
    myRole: 'owner' | 'admin' | 'member';
    timerRunning: boolean;
    totalHours: number; // floor(trackedSeconds/3600) saved value
    displayHours: number; // live
    displayMinutes: number; // live
    isLastFlow: boolean;
    onEdit: (task: BoardTask) => void;
    onToggleTimer: (taskId: string) => void;
    onDelete: (taskId: string) => void;
    onToggleAssignee: (task: BoardTask, member: Member) => void;
};

const badgeClassesByPriority = (p: Priority) => {
    switch (p) {
        case 'High':
            return 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300';
        case 'Medium':
            return 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300';
        default:
            return 'bg-sky-100 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300';
    }
};

export default function TaskCard(props: TaskCardProps) {
    const { task, projectMembers, myRole, timerRunning, totalHours, displayHours, displayMinutes, isLastFlow, onEdit, onToggleTimer, onDelete, onToggleAssignee } = props;
    const dueInfo = formatDue(task.dueDate, { completed: isLastFlow });

    const formatTimeAgo = (date: Date): string => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'baru saja';
        if (diffMins < 60) return `${diffMins} menit yang lalu`;
        if (diffHours < 24) return `${diffHours} jam yang lalu`;
        if (diffDays < 30) return `${diffDays} hari yang lalu`;
        return date.toLocaleDateString('id-ID');
    };

    const createdWhen = formatTimeAgo(new Date(task.createdAt));
    const canDelete = myRole === 'owner' || myRole === 'admin';

    return (
        <article
            data-id={task.id}
            className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm transition hover:border-primary/40 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900/60"
        >
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${badgeClassesByPriority(task.priority)}`}>{task.priority}</span>
                    <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{task.title}</h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Dibuat {createdWhen}</p>
                    {task.description ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                            <ReactMarkdown
                                components={{ img: (p) => <img {...p} className="rounded-lg border dark:border-slate-700 max-w-full" />, a: (p) => <a {...p} target="_blank" rel="noreferrer" /> }}
                            >
                                {task.description}
                            </ReactMarkdown>
                        </div>
                    ) : null}
                </div>
                <Dropdown btnClassName="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300" button={<IconHorizontalDots className="h-5 w-5" />}>
                    <ul className="w-44 rounded-xl border border-slate-100 bg-white p-2 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        <li>
                            <button type="button" className="block w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => onEdit(task)}>
                                Edit task
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                className="mt-1 block w-full rounded-lg px-3 py-1.5 text-left text-primary hover:bg-primary/10 dark:text-primary/80 dark:hover:bg-primary/10"
                                onClick={() => onToggleTimer(task.id)}
                            >
                                {timerRunning ? 'Stop timer' : 'Start timer'}
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                disabled={!canDelete}
                                className={`mt-1 block w-full rounded-lg px-3 py-1.5 text-left ${canDelete ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10' : 'text-slate-400 cursor-not-allowed opacity-60'}`}
                                onClick={() => canDelete && onDelete(task.id)}
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
                        onClick={() => onToggleTimer(task.id)}
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
                        <span className="h-7 w-7 rounded-full bg-slate-2 00 text-xs font-semibold text-slate-600 grid place-content-center dark:bg-slate-700 dark:text-slate-200">
                            +{task.assignees.length - 3}
                        </span>
                    ) : null}
                </div>

                <Dropdown
                    placement="top-end"
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
                                        onClick={() => onToggleAssignee(task, m)}
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
}
