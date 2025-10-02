'use client';
import PerfectScrollbar from 'react-perfect-scrollbar';
import Link from 'next/link';
import { useDispatch, useSelector } from 'react-redux';
import { toggleSidebar } from '@/store/themeConfigSlice';
import AnimateHeight from 'react-animate-height';
import { IRootState } from '@/store';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getTranslation } from '@/i18n';

import IconCaretsDown from '@/components/icon/icon-carets-down';
import IconCaretDown from '@/components/icon/icon-caret-down';
import IconMinus from '@/components/icon/icon-minus';
import IconMenuDashboard from '@/components/icon/menu/icon-menu-dashboard';
import IconMenuApps from '@/components/icon/menu/icon-menu-apps';

const Sidebar = () => {
    const dispatch = useDispatch();
    const { t } = getTranslation();
    const pathname = usePathname();

    const [currentMenu, setCurrentMenu] = useState<string>('');
    const semidark = useSelector((state: IRootState) => state.themeConfig.semidark);
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);

    const toggleMenu = (value: string) => {
        setCurrentMenu((old) => (old === value ? '' : value));
    };

    // set active on first load
    useEffect(() => {
        const selector = document.querySelector('.sidebar ul a[href="' + window.location.pathname + '"]');
        if (selector) {
            selector.classList.add('active');
            const ul: HTMLElement | null = selector.closest('ul.sub-menu');
            if (ul) {
                const ele = ul.closest('li.menu')?.querySelectorAll<HTMLButtonElement>('.nav-link');
                if (ele && ele.length) {
                    setTimeout(() => ele[0].click());
                }
            }
        }
    }, []);

    // set active on route change & auto close on mobile
    useEffect(() => {
        setActiveRoute();
        if (window.innerWidth < 1024 && themeConfig.sidebar) {
            dispatch(toggleSidebar());
        }
    }, [pathname]);

    const setActiveRoute = () => {
        const allLinks = document.querySelectorAll('.sidebar ul a.active');
        allLinks.forEach((el) => el.classList.remove('active'));
        const selector = document.querySelector('.sidebar ul a[href="' + window.location.pathname + '"]');
        selector?.classList.add('active');
    };

    return (
        <div className={semidark ? 'dark' : ''}>
            <nav
                className={`sidebar fixed bottom-0 top-0 z-50 h-full min-h-screen w-[260px] shadow-[5px_0_25px_0_rgba(94,92,154,0.1)] transition-all duration-300 ${semidark ? 'text-white-dark' : ''}`}
            >
                <div className="h-full bg-white dark:bg-black">
                    <div className="flex items-center justify-between px-4 py-3">
                        <Link href="/" className="main-logo flex shrink-0 items-center">
                            {/* <img className="ml-[5px] w-8 flex-none" src="/assets/images/logo.svg" alt="logo" /> */}
                            <span className="align-middle text-2xl font-semibold ltr:ml-1.5 rtl:mr-1.5 dark:text-white-light lg:inline">PROXAURUS</span>
                        </Link>

                        <button
                            type="button"
                            className="collapse-icon flex h-8 w-8 items-center rounded-full transition duration-300 hover:bg-gray-500/10 rtl:rotate-180 dark:text-white-light dark:hover:bg-dark-light/10"
                            onClick={() => dispatch(toggleSidebar())}
                        >
                            <IconCaretsDown className="m-auto rotate-90" />
                        </button>
                    </div>

                    <PerfectScrollbar className="relative h-[calc(100vh-80px)]">
                        <ul className="relative space-y-0.5 p-4 py-0 font-semibold">
                            {/* DASHBOARD */}
                            <li className="menu nav-item">
                                <button type="button" className={`${currentMenu === 'dashboard' ? 'active' : ''} nav-link group w-full`} onClick={() => toggleMenu('dashboard')}>
                                    <div className="flex items-center">
                                        <IconMenuDashboard className="shrink-0 group-hover:!text-primary" />
                                        <span className="text-black ltr:pl-3 rtl:pr-3 dark:text-[#506690] dark:group-hover:text-white-dark">{t('dashboard')}</span>
                                    </div>

                                    <div className={currentMenu !== 'dashboard' ? '-rotate-90 rtl:rotate-90' : ''}>
                                        <IconCaretDown />
                                    </div>
                                </button>

                                <AnimateHeight duration={300} height={currentMenu === 'dashboard' ? 'auto' : 0}>
                                    <ul className="sub-menu text-gray-500">
                                        <li>
                                            <Link href="/">{t('sales')}</Link>
                                        </li>
                                        <li>
                                            <Link href="/analytics">{t('analytics')}</Link>
                                        </li>
                                        <li>
                                            <Link href="/finance">{t('finance')}</Link>
                                        </li>
                                        <li>
                                            <Link href="/crypto">{t('crypto')}</Link>
                                        </li>
                                    </ul>
                                </AnimateHeight>
                            </li>

                            {/* APPS SECTION TITLE */}
                            <h2 className="-mx-4 mb-1 flex items-center bg-white-light/30 px-7 py-3 font-extrabold uppercase dark:bg-dark dark:bg-opacity-[0.08]">
                                <IconMinus className="hidden h-5 w-4 flex-none" />
                                <span>{t('apps')}</span>
                            </h2>

                            {/* TASK MANAGEMENT ONLY */}
                            <li className="nav-item">
                                <Link href="/apps/task-management" className="group">
                                    <div className="flex items-center">
                                        <IconMenuApps className="shrink-0 group-hover:!text-primary" />
                                        <span className="text-black ltr:pl-3 rtl:pr-3 dark:text-[#506690] dark:group-hover:text-white-dark">{t('task_management')}</span>
                                    </div>
                                </Link>
                            </li>
                        </ul>
                    </PerfectScrollbar>
                </div>
            </nav>
        </div>
    );
};

export default Sidebar;
