'use client';
import { BoardTask, Member } from '@/types/tasker';
import IconClock from '@/components/icon/icon-clock';
import IconEdit from '@/components/icon/icon-edit';
import IconTrash from '@/components/icon/icon-trash';
import IconPlayCircle from '@/components/icon/icon-play-circle';

type Props = {
    tasks: BoardTask[];
    flowName: string;
    projectMembers: Member[];
    getTrackedSeconds: (task: BoardTask) => number;
    timerTaskId: string | null;
    canUseTimer: boolean;
    onEdit: (task: BoardTask) => void;
    onToggleTimer: (taskId: string) => void;
    onDelete: (taskId: string) => void;
    myRole: 'owner' | 'admin' | 'member';
};

export default function TaskListView({
    tasks,
    flowName,
    projectMembers,
    getTrackedSeconds,
    timerTaskId,
    canUseTimer,
    onEdit,
    onToggleTimer,
    onDelete,
    myRole,
}: Props) {
    const formatSeconds = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}h ${m}m ${s}s`;
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high':
                return 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-400/40';
            case 'medium':
                return 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-400/40';
            case 'low':
                return 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-400/40';
            default:
                return 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-500/10 dark:border-slate-400/40';
        }
    };

    const getPriorityLabel = (priority: string) => {
        switch (priority) {
            case 'high':
                return 'High';
            case 'medium':
                return 'Medium';
            case 'low':
                return 'Low';
            default:
                return priority;
        }
    };

    const formatTimeAgo = (date: Date): string => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays < 30) return `${diffDays} days ago`;
        return date.toLocaleDateString('en-US');
    };

    if (tasks.length === 0) return null;

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{flowName}</h3>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Task</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Priority</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Assignees</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Time</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Created</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {tasks.map((task) => {
                            const isTimerRunning = timerTaskId === task.id;
                            const trackedSeconds = getTrackedSeconds(task);
                            const timerDisabled = !canUseTimer && !isTimerRunning;
                            const timerTitle = timerDisabled ? 'You are not allowed to start/stop the timer' : isTimerRunning ? 'Stop timer' : 'Start timer';
                            const timerButtonClass = `rounded-lg p-1.5 transition ${
                                timerDisabled
                                    ? 'cursor-not-allowed bg-slate-100 text-slate-400 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-500 dark:hover:bg-slate-700'
                                    : isTimerRunning
                                    ? 'bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-400'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                            }`;
                            return (
                                <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-4">
                                        <div className="space-y-1">
                                            <p className="font-medium text-slate-800 dark:text-white">{task.title}</p>
                                            {task.description && (
                                                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{task.description}</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getPriorityColor(task.priority)}`}>
                                            {getPriorityLabel(task.priority)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex -space-x-2">
                                            {task.assignees.slice(0, 3).map((assignee) => (
                                                <div
                                                    key={assignee.userId}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary text-xs font-semibold text-white dark:border-slate-800"
                                                    title={assignee.email || ''}
                                                >
                                                    {(assignee.email || 'U').charAt(0).toUpperCase()}
                                                </div>
                                            ))}
                                            {task.assignees.length > 3 && (
                                                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-700 dark:text-slate-300">
                                                    +{task.assignees.length - 3}
                                                </div>
                                            )}
                                            {task.assignees.length === 0 && (
                                                <span className="text-sm text-slate-400 dark:text-slate-500">None</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    if (timerDisabled) return;
                                                    onToggleTimer(task.id);
                                                }}
                                                disabled={timerDisabled}
                                                className={timerButtonClass}
                                                title={timerTitle}
                                            >
                                                {isTimerRunning ? <IconClock className="h-4 w-4" /> : <IconPlayCircle className="h-4 w-4" />}
                                            </button>
                                            <span className="text-sm font-mono text-slate-700 dark:text-slate-300">{formatSeconds(trackedSeconds)}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="text-sm text-slate-500 dark:text-slate-400">
                                            {formatTimeAgo(new Date(task.createdAt))}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => onEdit(task)}
                                                className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                                                title="Edit task"
                                            >
                                                <IconEdit className="h-4 w-4" />
                                            </button>
                                            {(myRole === 'owner' || myRole === 'admin') && (
                                                <button
                                                    onClick={() => onDelete(task.id)}
                                                    className="rounded-lg p-1.5 text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                                                    title="Delete task"
                                                >
                                                    <IconTrash className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
