export const formatDue = (iso: string | null) => {
    if (!iso) return { formatted: 'Tidak ada due date', helper: '', overdue: false };
    const due = new Date(iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const normalizedDue = new Date(due);
    normalizedDue.setHours(0, 0, 0, 0);
    const diffDays = Math.round((normalizedDue.getTime() - today.getTime()) / 86400000);
    const formatted = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    let helper = '';
    if (diffDays > 0) helper = `${diffDays} hari lagi`;
    else if (diffDays === 0) helper = 'Jatuh tempo hari ini';
    else helper = `Terlambat ${Math.abs(diffDays)} hari`;
    return { formatted, helper, overdue: diffDays < 0 };
};

export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
