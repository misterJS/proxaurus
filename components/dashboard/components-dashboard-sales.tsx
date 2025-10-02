'use client';

import Link from 'next/link';
import { useSelector } from 'react-redux';
import type { IRootState } from '@/store';
import IconBolt from '@/components/icon/icon-bolt';
import IconArrowLeft from '@/components/icon/icon-arrow-left';

const ComponentsDashboardSales = () => {
    const isRtl = useSelector((s: IRootState) => s.themeConfig.rtlClass === 'rtl');

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
                    <span>Sales</span>
                </li>
            </ul>

            {/* hero */}
            <div className="mx-auto mt-16 max-w-2xl text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-white shadow-lg">
                    <IconBolt className="h-8 w-8" />
                </div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Dashboard Sedang Dalam Pengembangan</h1>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Kami masih menyiapkan grafik, ringkasan, dan laporan. Nantikan pembaruan selanjutnya.</p>

                <div className="mt-6 flex items-center justify-center gap-3">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/30 transition hover:bg-primary/90"
                    >
                        <IconArrowLeft className={`h-4 w-4 ${isRtl ? 'rtl:rotate-180' : ''}`} />
                        Kembali ke Beranda
                    </Link>
                    <button
                        type="button"
                        onClick={() => location.reload()}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
                    >
                        Muat Ulang
                    </button>
                </div>
            </div>

            {/* placeholder skeletons */}
            <div className="mx-auto mt-14 grid max-w-6xl gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-[#0f172a]">
                        <div className="mb-4 h-5 w-40 rounded bg-slate-200/70 dark:bg-slate-700/60" />
                        <div className="mb-3 h-28 rounded-lg bg-slate-100 dark:bg-slate-800" />
                        <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
                        <div className="mt-2 h-3 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                ))}
            </div>

            {/* soft gradient background */}
            <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[240px] bg-gradient-to-b from-primary/10 to-transparent dark:from-primary/20" />
        </div>
    );
};

export default ComponentsDashboardSales;
