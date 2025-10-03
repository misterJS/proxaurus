import * as XLSX from 'xlsx';
import { BoardProject, BoardTask } from '@/types/tasker';
import { fmtDate } from './date';

export const buildTimesheetRows = (project: BoardProject, getTrackedSeconds: (task: BoardTask) => number) => {
    const rowsTasks = project.flows.flatMap((flow) =>
        flow.tasks.map((t) => {
            const secs = getTrackedSeconds(t);
            const assignees = (t.assignees || []).map((a) => a.fullName || a.email || a.userId).join(', ');
            return {
                Project: project.name,
                Flow: flow.name,
                Task: t.title,
                Priority: t.priority,
                DueDate: fmtDate(t.dueDate),
                CreatedAt: fmtDate(t.createdAt),
                Assignees: assignees,
                TrackedSeconds: secs,
                TrackedHours: (secs / 3600).toFixed(2),
            };
        }),
    );

    const byMember = new Map<string, number>();
    project.flows.forEach((flow) => {
        flow.tasks.forEach((t) => {
            const secs = getTrackedSeconds(t);
            if (!t.assignees?.length) {
                byMember.set('Unassigned', (byMember.get('Unassigned') || 0) + secs);
                return;
            }
            t.assignees.forEach((m) => {
                const key = m.fullName || m.email || m.userId;
                byMember.set(key, (byMember.get(key) || 0) + secs);
            });
        });
    });

    const rowsMembers = Array.from(byMember.entries()).map(([member, secs]) => ({
        Project: project.name,
        Member: member,
        TrackedSeconds: secs,
        TrackedHours: (secs / 3600).toFixed(2),
    }));

    return { rowsTasks, rowsMembers };
};

export const exportTimesheetXLSX = (project: BoardProject, getTrackedSeconds: (task: BoardTask) => number) => {
    const { rowsTasks, rowsMembers } = buildTimesheetRows(project, getTrackedSeconds);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsTasks), 'Tasks');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsMembers), 'By Member');
    const today = new Date().toISOString().slice(0, 10);
    const safeName = project.name.replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(wb, `Timesheet_${safeName}_${today}.xlsx`);
};
