import { supabase } from '@/lib/supabase-browser';

export const fetchProjectsRaw = () =>
    supabase
        .from('projects')
        .select(
            `
id, name,
flows ( id, name, position,
tasks ( id, project_id, flow_id, title, description, priority, due_date, tracked_seconds, created_at, position )
)
`,
        )
        .order('created_at', { ascending: true });

export const insertProject = (name: string, ownerId: string) => supabase.from('projects').insert({ name, owner_id: ownerId }).select('id').single();

export const fetchMyRoles = (projectIds: string[], userId: string) => supabase.from('project_members').select('project_id, role').in('project_id', projectIds).eq('user_id', userId);

export const fetchProjectMembers = (projectIds: string[]) => supabase.from('project_members').select('project_id, user_id, role').in('project_id', projectIds);

export const fetchProfiles = (userIds: string[]) => supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds);

export const fetchUsers = (userIds: string[]) => supabase.from('users').select('id, email, full_name').in('id', userIds);
