'use client';
import { useState } from 'react';
import IconPlus from '@/components/icon/icon-plus';
import { insertProject } from '@/services/tasker/projects';
import ModalShell from '../primitive/ModalShell';

export default function NewProjectModal({ ownerId, onClose, onCreated }: { ownerId: string; onClose: () => void; onCreated?: (projectId: string) => void }) {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setLoading(true);
        setErr(null);
        const { data, error } = await insertProject(name.trim(), ownerId);
        setLoading(false);
        if (error) {
            setErr(error.message);
            return;
        }
        onCreated?.(data!.id);
        onClose();
    };

    return (
        <ModalShell title="Project baru" onClose={onClose} maxWidth="max-w-md">
            <form className="grid gap-4" onSubmit={submit}>
                {err ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:border-rose-400/40 dark:bg-rose-500/10">{err}</div> : null}
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Nama project
                    <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Misal: Website Redesign" required />
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
                        <IconPlus className="h-4 w-4" /> {loading ? 'Menyimpan...' : 'Buat project'}
                    </button>
                </div>
            </form>
        </ModalShell>
    );
}
