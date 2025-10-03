import { supabase } from '@/lib/supabase-browser';

export const rpc = {
    logTaskActivity: (taskId: string, kind: string, details?: unknown) =>
        supabase.rpc('log_task_activity', {
            p_task_id: taskId,
            p_kind: kind,
            ...(details !== undefined ? { p_details: details } : {}),
        }),
    reorderTasks: (flowId: string, ids: string[]) => supabase.rpc('reorder_tasks', { p_flow_id: flowId, p_task_ids: ids }),
    timerStart: (taskId: string) => supabase.rpc('task_timer_start', { p_task_id: taskId }),
    timerStop: (taskId: string) => supabase.rpc('task_timer_stop', { p_task_id: taskId }),
    createOrRefreshInvite: (projectId: string, email: string, role: 'member' | 'admin') =>
        supabase.rpc('create_or_refresh_invite', {
            p_project_id: projectId,
            p_invited_email: email,
            p_role: role,
        }),
};
