'use client';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import IconPlus from '@/components/icon/icon-plus';
import { rpc } from '@/services/tasker/rpc';
import { findUserByEmail, insertProjectMember } from '@/services/tasker/projects';
import ModalShell from '../primitive/ModalShell';

type Props = {
    projectId: string;
    onClose: () => void;
};

type InviteResponse = {
    token: string;
    status?: string;
};

export default function InviteModal({ projectId, onClose }: Props) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'member' | 'admin'>('member');
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [copyState, setCopyState] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        if (!copyState) return;
        const timer = window.setTimeout(() => setCopyState(null), 2500);
        return () => window.clearTimeout(timer);
    }, [copyState]);

    const resolveToken = (payload: unknown): InviteResponse | null => {
        if (!payload) return null;
        if (Array.isArray(payload)) {
            const first = payload[0];
            if (first && typeof first === 'object' && 'token' in first) return first as InviteResponse;
            return null;
        }
        if (typeof payload === 'object' && payload && 'token' in payload) {
            return payload as InviteResponse;
        }
        return null;
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErr(null);
        setCopyState(null);
        const normalizedEmail = email.trim().toLowerCase();
        try {
            const { data: existingUser, error: userErr } = await findUserByEmail(normalizedEmail);
            if (userErr) throw userErr;

            // Jika user sudah terdaftar, langsung assign ke project tanpa invite
            if (existingUser?.id) {
                const { error: insertErr } = await insertProjectMember({ project_id: projectId, user_id: existingUser.id, role, is_active: true, hourly_rate: null });
                if (insertErr) {
                    // Jika sudah member, beri pesan lebih jelas
                    if ('code' in insertErr && insertErr.code === '23505') {
                        setErr('Pengguna sudah menjadi member di project ini.');
                    } else {
                        setErr(insertErr.message);
                    }
                } else {
                    // selesai, tutup modal
                    setEmail('');
                    setInviteLink(null);
                    onClose();
                }
                setLoading(false);
                return;
            }

            // Jika user belum terdaftar, pakai mekanisme invite
            const { data, error } = await rpc.createOrRefreshInvite(projectId, normalizedEmail, role);
            if (error) throw error;
            const info = resolveToken(data);
            if (!info?.token) {
                setErr('Gagal membuat tautan undangan. Coba lagi.');
                setLoading(false);
                return;
            }
            if (info.status === 'already_member') {
                setErr('Pengguna sudah menjadi member di project ini.');
                setLoading(false);
                return;
            }
            const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
            setInviteLink(`${base}/accept?token=${info.token}`);
            setEmail('');
            setLoading(false);
        } catch (error: any) {
            setLoading(false);
            setErr(error?.message || 'Gagal memproses permintaan. Coba lagi.');
        }
    };

    const copyInviteLink = async () => {
        if (!inviteLink) return;
        try {
            if (navigator.clipboard?.writeText && window.isSecureContext) {
                await navigator.clipboard.writeText(inviteLink);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = inviteLink;
                textarea.setAttribute('readonly', '');
                textarea.style.position = 'absolute';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textarea);
                if (!successful) throw new Error('execCommand failed');
            }
            setCopyState({ type: 'success', message: 'Link undangan disalin ke clipboard.' });
        } catch (error) {
            console.error(error);
            setCopyState({ type: 'error', message: 'Tidak bisa menyalin otomatis. Salin manual dari kolom di atas.' });
        }
    };

    const handleClose = () => {
        setInviteLink(null);
        setErr(null);
        setCopyState(null);
        setEmail('');
        onClose();
    };

    return (
        <ModalShell title="Invite member" onClose={handleClose} maxWidth="max-w-md" zIndexClass="z-[80]">
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
                    <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-400/40 dark:bg-emerald-500/10">
                        <div>
                            <p className="font-medium text-emerald-700 dark:text-emerald-300">Invite link dibuat!</p>
                            <p className="mt-1 text-xs text-emerald-600/80 dark:text-emerald-200/80">Bagikan tautan ini kepada orang yang kamu undang. Mereka perlu login atau membuat akun sebelum bergabung.</p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                                className="form-input flex-1"
                                readOnly
                                value={inviteLink}
                                onFocus={(event) => event.currentTarget.select()}
                            />
                            <button
                                type="button"
                                onClick={copyInviteLink}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                                Salin link
                            </button>
                        </div>
                        {copyState ? (
                            <p className={`text-xs ${copyState.type === 'success' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>{copyState.message}</p>
                        ) : null}
                    </div>
                ) : null}

                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={handleClose}
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
