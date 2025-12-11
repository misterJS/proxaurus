'use client';
import type { BoardProject } from '@/types/tasker';
import ModalShell from '../primitive/ModalShell';

export default function MembersModal({ project, onClose }: { project: BoardProject; onClose: () => void }) {
    return (
        <ModalShell title={`Members - ${project.name}`} onClose={onClose} maxWidth="max-w-lg" zIndexClass="z-[80]">
            <div className="max-h-[60vh] space-y-2 overflow-auto">
                {(project.members ?? []).map((m) => (
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
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
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
                {!project.members?.length ? <p className="text-center text-sm text-slate-400">No members yet.</p> : null}
            </div>
        </ModalShell>
    );
}
