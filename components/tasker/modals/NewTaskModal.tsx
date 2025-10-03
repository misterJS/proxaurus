'use client';
import { useState } from 'react';
import IconPlus from '@/components/icon/icon-plus';
import { insertTask } from '@/services/tasker/tasks';
import type { Priority, TaskFormState } from '@/types/tasker';
import { uploadPastedImage } from '@/actions/attachment';
import ModalShell from '../primitive/ModalShell';

export default function NewTaskModal({
    projectId,
    flowId,
    ownerId,
    onClose,
    onCreated,
}: {
    projectId: string;
    flowId: string;
    ownerId: string;
    onClose: () => void;
    onCreated?: (taskId: string) => void;
}) {
    const [form, setForm] = useState<TaskFormState>({ title: '', description: '', dueDate: '', priority: 'Medium' });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

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
        if (!form.title.trim()) return;
        setLoading(true);
        setErr(null);
        const payload = {
            project_id: projectId,
            flow_id: flowId,
            owner_id: ownerId,
            title: form.title.trim(),
            description: form.description.trim() || null,
            priority: form.priority.toLowerCase(),
            due_date: form.dueDate || null,
        };
        const { data, error } = await insertTask(payload);
        setLoading(false);
        if (error) {
            setErr(error.message);
            return;
        }
        onCreated?.(data!.id);
        onClose();
    };

    return (
        <ModalShell title="Task baru" onClose={onClose} maxWidth="max-w-2xl">
            <form className="grid gap-4" onSubmit={submit}>
                {err ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:border-rose-400/40 dark:bg-rose-500/10">{err}</div> : null}
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Judul task
                        <input
                            type="text"
                            className="form-input"
                            value={form.title}
                            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                            placeholder="Contoh: Implementasi autentikasi"
                            required
                        />
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
                        <IconPlus className="h-4 w-4" /> {loading ? 'Menyimpan...' : 'Buat task'}
                    </button>
                </div>
            </form>
        </ModalShell>
    );
}
