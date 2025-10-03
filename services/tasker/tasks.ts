import { supabase } from '@/lib/supabase-browser';

export const insertTask = (payload: { project_id: string; flow_id: string; owner_id: string; title: string; description: string | null; priority: string; due_date: string | null }) =>
    supabase
        .from('tasks')
        .insert({ ...payload, tracked_seconds: 0 })
        .select('id, project_id, flow_id, title, description, priority, due_date, tracked_seconds, created_at')
        .single();

export const updateTask = (
    taskId: string,
    payload: Partial<{
        title: string;
        description: string | null;
        priority: string;
        due_date: string | null;
    }>,
) => supabase.from('tasks').update(payload).eq('id', taskId).select('id, title, description, priority, due_date').single();

export const deleteTask = (taskId: string) => supabase.from('tasks').delete().eq('id', taskId);

export const fetchTaskAssignees = (taskIds: string[]) => supabase.from('task_assignees').select('task_id, user_id').in('task_id', taskIds);

export const addAssignee = (taskId: string, userId: string) => supabase.from('task_assignees').insert({ task_id: taskId, user_id: userId });

export const removeAssignee = (taskId: string, userId: string) => supabase.from('task_assignees').delete().eq('task_id', taskId).eq('user_id', userId);
