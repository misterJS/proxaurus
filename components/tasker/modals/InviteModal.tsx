'use client';
import { useState } from 'react';
import IconPlus from '@/components/icon/icon-plus';
import { rpc } from '@/services/tasker/rpc';
import ModalShell from '../primitive/ModalShell';

type Props = {
    projectId: string;
    onClose: () => void;
};

export default function InviteModal({ projectId, onClose }: Props) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'member' | 'admin'>('member');
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErr(null);
        const { data, error } = await rpc.createOrRefreshInvite(projectId, email.trim(), role);
        setLoading(false);
        if (error) {
            setErr(error.message);
            return;
        }
        if (data?.status === 'already_member') {
            setErr('Pengguna sudah menjadi member di project ini.');
            return;
        }
        const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        setInviteLink(`${base}/accept?token=${data.token}`);
    };

    return (
        <ModalShell title="Invite member" onClose={onClose} maxWidth="max-w-md" zIndexClass="z-[80]">
            <form className="grid gap-4" onSubmit={submit}>
                {err ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:border-rose-400/40 dark:bg-rose-500/10">{err}</div> : null}

                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Email yang diundang
                    <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@contoh.com" required />
                </label>

                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Role
                    <select className="form-select" value={role} onChange={(e) => setRole(e.target.value as 'member' | 'admin')}>
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                    </select>
                </label>

                {inviteLink ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-400/40 dark:bg-emerald-500/10">
                        <p className="mb-2 font-medium text-emerald-700 dark:text-emerald-300">Invite link dibuat!</p>
                        <div className="flex items-center gap-2">
                            <input className="form-input flex-1" readOnly value={inviteLink} />
                            <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(inviteLink)}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                                Copy
                            </button>
                        </div>
                    </div>
                ) : null}

                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
                    >
                        Tutup
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-md shadow-primary/30 hover:bg-primary/90 disabled:opacity-60"
                    >
                        <IconPlus className="h-4 w-4" /> {loading ? 'Mengundang...' : 'Kirim undangan'}
                    </button>
                </div>
            </form>
        </ModalShell>
    );
}
