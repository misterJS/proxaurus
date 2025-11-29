import * as XLSX from 'xlsx';
import { BoardProject, BoardTask, Member } from '@/types/tasker';
import { fmtDate } from './date';

export type TimesheetExportOptions = {
    month?: string;
    assigneeFilter?: 'all' | 'unassigned' | string;
    hourlyRate?: number;
};

const formatCurrencyIdr = (value: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Math.round(value));

const getMonthRange = (month: string) => {
    const [year, monthIndex] = month.split('-').map((v) => Number(v));
    const start = new Date(Date.UTC(year, (monthIndex || 1) - 1, 1));
    const end = new Date(start);
    end.setUTCMonth(start.getUTCMonth() + 1);
    return { start, end };
};

const taskMatchesAssignee = (task: BoardTask, assigneeFilter: TimesheetExportOptions['assigneeFilter']) => {
    if (!assigneeFilter || assigneeFilter === 'all') return true;
    if (assigneeFilter === 'unassigned') return !task.assignees?.length;
    return task.assignees?.some((a) => a.userId === assigneeFilter) ?? false;
};

const labelForMember = (member: Member | { userId: string; fullName: string | null; email: string | null }) =>
    member.fullName || member.email || member.userId || 'Unassigned';

export const buildTimesheetRows = (
    project: BoardProject,
    getTrackedSeconds: (task: BoardTask) => number,
    options?: TimesheetExportOptions,
) => {
    const ADMIN_COMMISSION_PER_HOUR = 10_000;
    const assigneeFilter = options?.assigneeFilter ?? 'all';
    const hourlyRate = options?.hourlyRate ?? 0;
    const monthRange = options?.month ? getMonthRange(options.month) : null;
    const hasValidRange = !!monthRange && Number.isFinite(monthRange.start.getTime()) && Number.isFinite(monthRange.end.getTime());

    const tasks = project.flows.flatMap((flow) =>
        flow.tasks
            .map((task) => ({ flowName: flow.name, task }))
            .filter(({ task }) => {
                if (!hasValidRange || !monthRange) return true;
                const created = new Date(task.createdAt);
                return created >= monthRange.start && created < monthRange.end;
            })
            .filter(({ task }) => taskMatchesAssignee(task, assigneeFilter)),
    );

    const rowsTasks = tasks.map(({ flowName, task }) => {
        const secs = getTrackedSeconds(task);
        const hours = secs / 3600;
        const nominal = hours * hourlyRate;
        const assignees = (task.assignees || []).map((a) => labelForMember(a)).join(', ');
        return {
            Month: options?.month ?? 'All',
            Project: project.name,
            Flow: flowName,
            Task: task.title,
            Priority: task.priority,
            DueDate: fmtDate(task.dueDate),
            CreatedAt: fmtDate(task.createdAt),
            Assignees: assignees || 'Unassigned',
            TrackedSeconds: secs,
            TrackedHours: hours.toFixed(2),
            HourlyRate: hourlyRate,
            Nominal: Math.round(nominal),
            NominalFormatted: formatCurrencyIdr(nominal),
        };
    });

    const byMember = new Map<string, { secs: number; nominal: number }>();
    tasks.forEach(({ task }) => {
        const secs = getTrackedSeconds(task);
        const normalizedAssignees =
            task.assignees?.length && assigneeFilter !== 'unassigned'
                ? task.assignees
                : [{ userId: 'unassigned', fullName: 'Unassigned', email: null, avatarUrl: null }];

        const relevantAssignees =
            assigneeFilter === 'all'
                ? normalizedAssignees
                : normalizedAssignees.filter((a) => (assigneeFilter === 'unassigned' ? a.userId === 'unassigned' : a.userId === assigneeFilter));

        if (!relevantAssignees.length) return;

        const shareSeconds = assigneeFilter === 'all' ? secs / normalizedAssignees.length : secs;
        relevantAssignees.forEach((member) => {
            const key = labelForMember(member);
            const prev = byMember.get(key) || { secs: 0, nominal: 0 };
            const hours = shareSeconds / 3600;
            const nominal = hours * hourlyRate;
            byMember.set(key, { secs: prev.secs + shareSeconds, nominal: prev.nominal + nominal });
        });
    });

    const rowsMembers = Array.from(byMember.entries()).map(([member, payload]) => {
        const hours = payload.secs / 3600;
        const commission = hours * ADMIN_COMMISSION_PER_HOUR;
        return {
            Month: options?.month ?? 'All',
            Project: project.name,
            Member: member,
            TrackedSeconds: payload.secs,
            TrackedHours: hours.toFixed(2),
            HourlyRate: hourlyRate,
            Nominal: Math.round(payload.nominal),
            NominalFormatted: formatCurrencyIdr(payload.nominal),
            AdminCommission: Math.round(commission),
            AdminCommissionFormatted: formatCurrencyIdr(commission),
        };
    });

    if (rowsMembers.length) {
        const totalSeconds = rowsMembers.reduce((acc, r) => acc + r.TrackedSeconds, 0);
        const totalHours = totalSeconds / 3600;
        const totalCommission = totalHours * ADMIN_COMMISSION_PER_HOUR;
        const totalNominal = rowsMembers.reduce((acc, r) => acc + (Number.isFinite(r.Nominal) ? r.Nominal : 0), 0);
        rowsMembers.push({
            Month: options?.month ?? 'All',
            Project: project.name,
            Member: 'TOTAL',
            TrackedSeconds: Math.round(totalSeconds),
            TrackedHours: totalHours.toFixed(2),
            HourlyRate: hourlyRate,
            Nominal: Math.round(totalNominal),
            NominalFormatted: formatCurrencyIdr(totalNominal),
            AdminCommission: Math.round(totalCommission),
            AdminCommissionFormatted: formatCurrencyIdr(totalCommission),
        });
    }

    return { rowsTasks, rowsMembers };
};

export const exportTimesheetXLSX = (project: BoardProject, getTrackedSeconds: (task: BoardTask) => number, options?: TimesheetExportOptions) => {
    const { rowsTasks, rowsMembers } = buildTimesheetRows(project, getTrackedSeconds, options);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsTasks), 'Tasks');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsMembers), 'By Member');
    const today = new Date().toISOString().slice(0, 10);
    const safeName = project.name.replace(/[\\/:*?"<>|]/g, '_');
    const monthSuffix = options?.month ? `_${options.month}` : '';
    XLSX.writeFile(wb, `Timesheet_${safeName}${monthSuffix}_${today}.xlsx`);
};

export const exportAllProjectsTimesheetXLSX = (
    projects: BoardProject[],
    getTrackedSeconds: (task: BoardTask) => number,
    options?: TimesheetExportOptions,
) => {
    const wb = XLSX.utils.book_new();

    const allTasks: any[] = [];
    const allMembers: any[] = [];

    projects.forEach((project) => {
        const { rowsTasks, rowsMembers } = buildTimesheetRows(project, getTrackedSeconds, options);
        allTasks.push(...rowsTasks);
        allMembers.push(...rowsMembers);
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allTasks), 'Tasks');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allMembers), 'By Member');

    const today = new Date().toISOString().slice(0, 10);
    const monthSuffix = options?.month ? `_${options.month}` : '';
    XLSX.writeFile(wb, `Timesheet_AllProjects${monthSuffix}_${today}.xlsx`);
};
