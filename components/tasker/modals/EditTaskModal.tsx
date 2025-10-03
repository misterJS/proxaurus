// ===== components/tasker/modals/EditTaskModal.tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import IconPlus from '@/components/icon/icon-plus';
import { updateTask } from '@/services/tasker/tasks';
import { rpc } from '@/services/tasker/rpc';
import type { BoardTask, Priority, TaskFormState, TaskActivity } from '@/types/tasker';
import { uploadPastedImage } from '@/actions/attachment';
import { useActivities } from '@/hooks/tasker/useActivities';
import ModalShell from '../primitive/ModalShell';

export default function EditTaskModal({ task, onClose, onSaved }: { task: BoardTask; onClose: () => void; onSaved?: () => void }) {
    const [form, setForm] = useState<TaskFormState>({
        title: task.title,
        description: task.description ?? '',
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
        priority: task.priority,
    });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const { activities, loading: actLoading, load } = useActivities();

    useEffect(() => {
        void load(task.id);
    }, [task.id]);

    const makePasteHandler =
        (applyUrl: (url: string) => void): React.ClipboardEventHandler<HTMLTextAreaElement> =>
        async (e) => {
            const items = e.clipboardData?.items;
            if (!items?.length) return;
            const imgItem = Array.from(items).find((it) => it.kind === 'file' && it.type.startsWith('image/'));
            if (!imgItem) return;
            e.preventDefault();
            try {
                const file = imgItem.getAsFile();
                if (!file) return;
                const url = await uploadPastedImage(file);
                applyUrl(url);
            } catch (er: any) {
                setErr(er.message || 'Gagal upload gambar yang di-paste.');
            }
        };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErr(null);
        const payload = {
            title: form.title.trim(),
            description: form.description.trim() || null,
            priority: form.priority.toLowerCase(),
            due_date: form.dueDate || null,
        };
        const before = { title: task.title, description: task.description, due_date: task.dueDate };
        const { data, error } = await updateTask(task.id, payload);
        setLoading(false);
        if (error) {
            setErr(error.message);
            return;
        }

        // log per field yang berubah
        if ((before.title || '') !== (data!.title || '')) {
            await rpc.logTaskActivity(task.id, 'title_changed', { old: before.title, new: data!.title });
        }
        if ((before.description || '') !== (data!.description || '')) {
            await rpc.logTaskActivity(task.id, 'description_changed', { old: !!before.description, new: !!data!.description });
        }
        if ((before.due_date || null) !== (data!.due_date || null)) {
            await rpc.logTaskActivity(task.id, 'due_changed', { old: before.due_date, new: data!.due_date });
        }

        onSaved?.();
        onClose();
    };

    const formatKind = (k: TaskActivity['kind']) =>
        (
            ({
                title_changed: 'Title changed',
                description_changed: 'Description changed',
                due_changed: 'Deadline changed',
                timer_started: 'Timer started',
                timer_stopped: 'Timer stopped',
                assignee_added: 'Assignee added',
                assignee_removed: 'Assignee removed',
                reordered: 'Task reordered',
            }) as const
        )[k] ?? k;

    const renderActivityDetails = (k: TaskActivity['kind'], d: any) => {
        try {
            const details = typeof d === 'string' ? JSON.parse(d) : d;
            if (k === 'title_changed')
                return (
                    <span>
                        {details?.old} → <b>{details?.new}</b>
                    </span>
                );
            if (k === 'description_changed') return <span>deskripsi diperbarui</span>;
            if (k === 'due_changed')
                return (
                    <span>
                        {details?.old || '—'} → <b>{details?.new || '—'}</b>
                    </span>
                );
            if (k === 'timer_started') return <span>mulai pada {new Date(details?.started_at || Date.now()).toLocaleTimeString()}</span>;
            if (k === 'timer_stopped') return <span>+{Math.round((details?.delta_seconds || 0) / 60)} menit</span>;
            if (k === 'assignee_added') return <span>+ {details?.assignee_email || details?.assignee_id}</span>;
            if (k === 'assignee_removed') return <span>− {details?.assignee_email || details?.assignee_id}</span>;
            if (k === 'reordered')
                return (
                    <span>
                        posisi: {details?.from} → <b>{details?.to}</b>
                    </span>
                );
            return <span>{JSON.stringify(details)}</span>;
        } catch {
            return <span>{String(d)}</span>;
        }
    };

    return (
        <ModalShell title="Edit task" onClose={onClose} maxWidth="max-w-2xl" zIndexClass="z-[80]">
            <form className="grid gap-4" onSubmit={submit}>
                {err ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:border-rose-400/40 dark:bg-rose-500/10">{err}</div> : null}
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Judul task
                        <input type="text" className="form-input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Deadline
                        <input type="date" className="form-input" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} />
                    </label>
                </div>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Deskripsi
                    <textarea
                        className="form-textarea min-h-[120px]"
                        value={form.description}
                        onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                        onPaste={makePasteHandler((url) => setForm((p) => ({ ...p, description: (p.description ? p.description + '\n\n' : '') + `![pasted-image](${url})` })))}
                        placeholder="Rincian pekerjaan — paste gambar langsung ke sini"
                    />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Prioritas
                    <select className="form-select" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as Priority }))}>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                    </select>
                </label>
                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-md shadow-primary/30 hover:bg-primary/90 disabled:opacity-60"
                    >
                        <IconPlus className="h-4 w-4" /> {loading ? 'Menyimpan...' : 'Simpan perubahan'}
                    </button>
                </div>
            </form>

            {/* Activity */}
            <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-700">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Activity</h3>
                    <button type="button" onClick={() => load(task.id)} className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400">
                        Refresh
                    </button>
                </div>
                <div className="max-h-64 overflow-auto p-3">
                    {actLoading ? (
                        <p className="text-xs text-slate-400">Loading...</p>
                    ) : activities.length ? (
                        <ul className="space-y-3">
                            {activities.map((a) => (
                                <li key={a.id} className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-900/40">
                                    <div className="mb-1 flex items-center justify-between">
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">{formatKind(a.kind)}</span>
                                        <span className="text-[11px] text-slate-400">{new Date(a.created_at).toLocaleString()}</span>
                                    </div>
                                    <div className="text-slate-600 dark:text-slate-300">{renderActivityDetails(a.kind, a.details)}</div>
                                    <div className="mt-1 text-[11px] text-slate-400">by {a.actor?.full_name || a.actor?.id || 'Unknown'}</div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-slate-400">Belum ada activity.</p>
                    )}
                </div>
            </div>
        </ModalShell>
    );
}
