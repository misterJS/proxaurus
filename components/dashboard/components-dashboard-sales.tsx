'use client';

import Link from 'next/link';
import { useSelector } from 'react-redux';
import { useMemo, useState, useEffect } from 'react';
import type { IRootState } from '@/store';
import { useAuthUser } from '@/hooks/tasker/useAuthUser';
import { useBoardData } from '@/hooks/tasker/useBoardData';
import IconDollarSign from '@/components/icon/icon-dollar-sign';
import IconUsers from '@/components/icon/icon-users';
import IconClock from '@/components/icon/icon-clock';
import IconBox from '@/components/icon/icon-box';
import { supabase } from '@/lib/supabase-browser';

type UserBreakdownItem = {
    userId: string;
    email: string;
    hours: number;
    cost: number;
};

type ProjectStat = {
    projectId: string;
    projectName: string;
    totalTasks: number;
    totalHours: number;
    totalCost: number;
    userBreakdown: UserBreakdownItem[];
};

const HOURLY_RATE = 50_000;

export default function ComponentsDashboardSales() {
    const isRtl = useSelector((s: IRootState) => s.themeConfig.rtlClass === 'rtl');

    // data board (projects + tasks + assignees)
    const { userId } = useAuthUser();
    const { projects, isLoading } = useBoardData(userId);

    // ===== Filter per-bulan =====
    const [month, setMonth] = useState<string>(() => new Date().toISOString().slice(0, 7)); // 'YYYY-MM'
    const [monthSecondsByTask, setMonthSecondsByTask] = useState<Record<string, number>>({});
    const [filterLoading, setFilterLoading] = useState(false);

    // Range bulan (UTC) → pakai YYYY-MM-DD string agar aman untuk timestamp/timestamptz
    const monthDateRangeStrings = (ym: string) => {
        const [y, m] = ym.split('-').map(Number);
        const start = new Date(Date.UTC(y, m - 1, 1));
        const end = new Date(Date.UTC(y, m, 1));
        const startStr = start.toISOString().slice(0, 10);
        const endStr = end.toISOString().slice(0, 10);
        return { start, end, startStr, endStr };
    };

    // ===== Ambil data bulan dari task_time_entries =====
    useEffect(() => {
        const fetchMonthSeconds = async () => {
            if (!projects.length) {
                setMonthSecondsByTask({});
                return;
            }
            setFilterLoading(true);
            try {
                const allTaskIds = projects.flatMap((p) => p.flows.flatMap((f) => f.tasks.map((t) => t.id)));
                if (!allTaskIds.length) {
                    setMonthSecondsByTask({});
                    setFilterLoading(false);
                    return;
                }

                const { start, end, startStr, endStr } = monthDateRangeStrings(month);

                // Ambil entri yang overlap dengan rentang bulan:
                // (stopped_at >= start) AND (started_at < end)
                // Syarat stopped_at NOT NULL supaya entri sudah selesai.
                const { data, error } = await supabase
                    .from('task_time_entries')
                    .select('task_id, user_id, started_at, stopped_at, duration_sec, created_at')
                    .in('task_id', allTaskIds)
                    .not('stopped_at', 'is', null)
                    .gte('stopped_at', startStr)
                    .lt('started_at', endStr);

                if (error) throw error;

                // Agregasi per task dengan CLIPPING ke [start, end)
                const agg: Record<string, number> = {};
                (data || []).forEach((row: any) => {
                    const started = new Date(row.started_at);
                    const stopped = new Date(row.stopped_at);

                    // potong ke rentang bulan
                    const clipStart = started < start ? start : started;
                    const clipEnd = stopped > end ? end : stopped;
                    const clipped = Math.max(0, Math.floor((clipEnd.getTime() - clipStart.getTime()) / 1000));

                    // Kalau duration_sec ada dan lebih kecil dari clipped (karena rounding), ambil yang lebih kecil
                    const d = Number.isFinite(Number(row.duration_sec)) && row.duration_sec > 0 ? Math.min(clipped, Number(row.duration_sec)) : clipped;

                    if (d > 0) {
                        agg[row.task_id] = (agg[row.task_id] || 0) + d;
                    }
                });

                setMonthSecondsByTask(agg);
            } catch (e) {
                console.error('[stats-month][time_entries] fetch error', e);
                setMonthSecondsByTask({});
            } finally {
                setFilterLoading(false);
            }
        };

        fetchMonthSeconds();
    }, [projects, month]);

    const stats = useMemo(() => {
        if (!projects.length) {
            return { totalProjects: 0, totalTasks: 0, totalHours: 0, totalCost: 0, projectStats: [] as ProjectStat[] };
        }

        const projectStats: ProjectStat[] = projects.map((project) => {
            const tasks = project.flows.flatMap((flow) => flow.tasks);
            const totalTasks = tasks.length;

            // INDEX email by userId dari members project
            const emailById = new Map<string, string>((project.members ?? []).map((m) => [m.userId, m.email || m.fullName || m.userId]));

            const perUser = new Map<string, { email: string; seconds: number }>();

            tasks.forEach((task) => {
                const secsInMonth = monthSecondsByTask[task.id] ?? 0;
                if (secsInMonth <= 0) return;

                if (!task.assignees.length) {
                    const cur = perUser.get('Unassigned') || { email: 'Unassigned', seconds: 0 };
                    perUser.set('Unassigned', { email: cur.email, seconds: cur.seconds + secsInMonth });
                } else {
                    const share = secsInMonth / task.assignees.length;
                    task.assignees.forEach((a) => {
                        const email = emailById.get(a.userId) || a.email || a.fullName || 'Unknown';
                        const cur = perUser.get(a.userId) || { email, seconds: 0 };
                        perUser.set(a.userId, { email, seconds: cur.seconds + share });
                    });
                }
            });

            const userBreakdown: UserBreakdownItem[] = Array.from(perUser.entries()).map(([userId, d]) => ({
                userId,
                email: d.email,
                hours: d.seconds / 3600,
                cost: (d.seconds / 3600) * HOURLY_RATE,
            }));

            const totalSeconds = tasks.reduce((sum, t) => sum + (monthSecondsByTask[t.id] ?? 0), 0);
            const totalHours = totalSeconds / 3600;
            const totalCost = userBreakdown.reduce((s, u) => s + u.cost, 0);

            return {
                projectId: project.id,
                projectName: project.name,
                totalTasks,
                totalHours,
                totalCost,
                userBreakdown,
            };
        });

        const totalProjects = projects.length;
        const totalTasks = projectStats.reduce((s, p) => s + p.totalTasks, 0);
        const totalHours = projectStats.reduce((s, p) => s + p.totalHours, 0);
        const totalCost = projectStats.reduce((s, p) => s + p.totalCost, 0);

        return { totalProjects, totalTasks, totalHours, totalCost, projectStats };
    }, [projects, monthSecondsByTask]);

    // ===== Utils tampilan =====
    const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

    const formatHours = (hours: number) => {
        const h = Math.floor(hours);
        const m = Math.floor((hours - h) * 60);
        return `${h}j ${m}m`;
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center text-slate-500">
                <div className="text-center">
                    <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p>Memuat data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* breadcrumbs */}
            <ul className="flex space-x-2 rtl:space-x-reverse">
                <li>
                    <Link href="/" className="text-primary hover:underline">
                        Dashboard
                    </Link>
                </li>
                <li className="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
                    <span>Project Stats</span>
                </li>
            </ul>

            {/* Filter Per Bulan */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-500 dark:text-slate-400">{filterLoading ? 'Menghitung data bulan ini…' : `Menampilkan bulan: ${month}`}</div>

                <label className="inline-flex items-center gap-2 text-sm">
                    <span className="text-slate-600 dark:text-slate-300">Filter</span>
                    <input type="month" className="form-input" value={month} onChange={(e) => setMonth(e.target.value)} max={new Date().toISOString().slice(0, 7)} />
                </label>
            </div>

            {/* Summary Cards */}
            <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-[#0f172a]">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Projects</h3>
                        <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-500/10">
                            <IconBox className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalProjects}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Active projects</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-[#0f172a]">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Tasks</h3>
                        <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-500/10">
                            <IconUsers className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalTasks}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Across all projects</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-[#0f172a]">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Hours</h3>
                        <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-500/10">
                            <IconClock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatHours(stats.totalHours)}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Tracked time</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-[#0f172a]">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Cost</h3>
                        <div className="rounded-lg bg-rose-50 p-2 dark:bg-rose-500/10">
                            <IconDollarSign className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.totalCost)}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">@ Rp 50k/jam</p>
                </div>
            </div>

            {/* Project Breakdown */}
            <div className="mt-8">
                <h2 className="mb-6 text-xl font-semibold text-slate-900 dark:text-white">Project Breakdown</h2>
                <div className="space-y-6">
                    {stats.projectStats.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-12 text-center dark:border-slate-600 dark:bg-[#0f172a]">
                            <IconBox className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Belum ada project</p>
                            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Buat project pertama Anda untuk melihat statistik</p>
                        </div>
                    ) : (
                        stats.projectStats.map((project) => (
                            <div key={project.projectId} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-[#0f172a]">
                                <div className="mb-6 flex items-start justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{project.projectName}</h3>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            {project.totalTasks} tasks · {formatHours(project.totalHours)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-primary">{formatCurrency(project.totalCost)}</p>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Total biaya</p>
                                    </div>
                                </div>

                                {project.userBreakdown.length > 0 ? (
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Breakdown per User</h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                                        <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">User</th>
                                                        <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Hours</th>
                                                        <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cost</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {project.userBreakdown.map((user) => (
                                                        <tr key={user.userId} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                            <td className="py-3 text-sm font-medium text-slate-700 dark:text-slate-300">{user.email}</td>
                                                            <td className="py-3 text-right text-sm text-slate-600 dark:text-slate-400">{formatHours(user.hours)}</td>
                                                            <td className="py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(user.cost)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                                        Belum ada user yang bekerja di project ini
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* soft gradient background */}
            <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[240px] bg-gradient-to-b from-primary/10 to-transparent dark:from-primary/20" />
        </div>
    );
}
