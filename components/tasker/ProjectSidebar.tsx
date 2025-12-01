'use client';
import React from 'react';
import IconPlus from '@/components/icon/icon-plus';
import { BoardProject } from '@/types/tasker';

export type ProjectSidebarProps = {
    projects: BoardProject[];
    activeProjectId: string | null;
    onSelect: (projectId: string) => void;
    onNewProject: () => void;
};

export default function ProjectSidebar({ projects, activeProjectId, onSelect, onNewProject }: ProjectSidebarProps) {
    return (
        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm dark:border-slate-700 dark:bg-[#0f172a]">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Projects</p>
                    <p className="text-base font-semibold text-slate-900 dark:text-white">
                        {projects.length} project{projects.length === 1 ? '' : 's'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onNewProject}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-primary/40 text-primary transition hover:bg-primary/10 dark:border-primary/30"
                >
                    <IconPlus className="h-4 w-4" />
                </button>
            </div>
            <ul className="space-y-2">
                {projects.map((project) => {
                    const taskCount = project.flows.reduce((acc, f) => acc + f.tasks.length, 0);
                    const isActive = project.id === activeProjectId;
                    return (
                        <li key={project.id}>
                            <button
                                type="button"
                                onClick={() => onSelect(project.id)}
                                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${isActive ? 'border-primary/50 bg-primary/10 text-primary dark:border-primary/40 dark:bg-primary/15' : 'border-transparent bg-slate-100 text-slate-600 hover:border-primary/30 hover:bg-primary/10 hover:text-primary dark:bg-slate-900/40 dark:text-slate-300'}`}
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
    );
}
