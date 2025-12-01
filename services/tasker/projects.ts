import { supabase } from '@/lib/supabase-browser';
import { ProjectRole } from '@/types/tasker';

export const fetchProjectsRaw = () =>
    supabase
        .from('projects')
        .select(
            `
id, name, archived,
flows ( id, name, position,
tasks ( id, project_id, flow_id, title, description, priority, due_date, tracked_seconds, created_at, position )
)
`,
        )
        .order('created_at', { ascending: true });

export const insertProject = (name: string, ownerId: string) => supabase.from('projects').insert({ name, owner_id: ownerId, archived: false }).select('id').single();

export const fetchProjectsSimple = () => supabase.from('projects').select('id, name, archived').order('created_at', { ascending: true });

export const fetchMyRoles = (projectIds: string[], userId: string) => supabase.from('project_members').select('project_id, role').in('project_id', projectIds).eq('user_id', userId);

export const fetchProjectMembers = (projectIds: string[]) => supabase.from('project_members').select('project_id, user_id, role, is_active, hourly_rate').in('project_id', projectIds);

export const fetchProfiles = (userIds: string[]) => supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds);

export const fetchUsers = (userIds: string[]) => supabase.from('users').select('id, email, full_name').in('id', userIds);

export const updateProjectMember = (projectId: string, userId: string, payload: Partial<{ role: ProjectRole; is_active: boolean; hourly_rate: number | null }>) =>
    supabase.from('project_members').update(payload).eq('project_id', projectId).eq('user_id', userId);

export const deleteProjectMember = (projectId: string, userId: string) => supabase.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId);

export const insertProjectMember = (payload: { project_id: string; user_id: string; role: ProjectRole; is_active?: boolean; hourly_rate?: number | null }) =>
    supabase.from('project_members').insert({ is_active: true, hourly_rate: null, ...payload }).select('project_id, user_id').single();

export const findUserByEmail = (email: string) => supabase.from('users').select('id, email, full_name').eq('email', email).maybeSingle();

export const updateProjectArchive = (projectId: string, archived: boolean) => supabase.from('projects').update({ archived }).eq('id', projectId);
