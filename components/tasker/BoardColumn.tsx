'use client';
import React from 'react';
import { ReactSortable } from 'react-sortablejs';
import { BoardFlow, BoardTask, Member } from '@/types/tasker';
import TaskCard from './TaskCard';

export type BoardColumnProps = {
    column: BoardFlow;
    myRole: 'owner' | 'admin' | 'member';
    projectMembers: Member[];
    isLastFlow: boolean;
    onSort: (flowId: string, nextTasks: BoardTask[]) => void;
    getTrackedSeconds: (task: BoardTask) => number;
    timerTaskId: string | null;
    canUseTimer: boolean;
    onEdit: (task: BoardTask) => void;
    onToggleTimer: (taskId: string) => void;
    onDelete: (taskId: string) => void;
    onToggleAssignee: (task: BoardTask, member: Member) => void;
};

export default function BoardColumn(props: BoardColumnProps) {
    const { column, myRole, projectMembers, isLastFlow, onSort, getTrackedSeconds, timerTaskId, canUseTimer, onEdit, onToggleTimer, onDelete, onToggleAssignee } = props;

    return (
        <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-slate-700 dark:bg-[#0f172a]">
            <header className="mb-4 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{column.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                    {column.tasks.length} task{column.tasks.length === 1 ? '' : 's'}
                </p>
            </header>

            <ReactSortable list={column.tasks} setList={(next) => onSort(column.id, next)} group="task-cards" animation={200} className="flex-1 space-y-4" ghostClass="opacity-30">
                {column.tasks.map((task) => {
                    const tracked = getTrackedSeconds(task);
                    return (
                        <TaskCard
                            key={task.id}
                            task={task}
                            projectMembers={projectMembers}
                            myRole={myRole}
                            isLastFlow={isLastFlow}
                            timerRunning={timerTaskId === task.id}
                            totalHours={Math.floor(task.trackedSeconds / 3600)}
                            displayHours={Math.floor(tracked / 3600)}
                            displayMinutes={Math.floor((tracked % 3600) / 60)}
                            canUseTimer={canUseTimer}
                            onEdit={onEdit}
                            onToggleTimer={onToggleTimer}
                            onDelete={onDelete}
                            onToggleAssignee={onToggleAssignee}
                        />
                    );
                })}
            </ReactSortable>

            {!column.tasks.length ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-400 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-500">
                    Belum ada task.
                </div>
            ) : null}
        </section>
    );
}
