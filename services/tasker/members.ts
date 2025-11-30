import { Member } from '@/types/tasker';

export const buildUserInfoMap = (
    profiles: Array<{ id: string; full_name: string | null; avatar_url: string | null }> = [],
    users: Array<{ id: string; email: string | null; full_name?: string | null }> = [],
) => {
    const usersById = new Map<string, { fullName: string | null; avatarUrl: string | null; email: string | null }>();
    profiles.forEach((p) => usersById.set(p.id, { fullName: p.full_name ?? null, avatarUrl: p.avatar_url ?? null, email: null }));
    users.forEach((u) => {
        const ex = usersById.get(u.id) ?? { fullName: u.full_name ?? null, avatarUrl: null, email: null };
        usersById.set(u.id, { ...ex, email: u.email ?? null, fullName: ex.fullName ?? u.full_name ?? null });
    });
    return usersById;
};

export const mapMembersByProject = (
    pm: Array<{ project_id: string; user_id: string; role?: string; is_active?: boolean; hourly_rate?: number | null }>,
    usersById: Map<string, { fullName: string | null; avatarUrl: string | null; email: string | null }>,
): Record<string, Member[]> => {
    const membersByProject: Record<string, Member[]> = {};
    pm.forEach((row) => {
        const info = usersById.get(row.user_id) ?? { fullName: null, avatarUrl: null, email: null };
        const member: Member = {
            userId: row.user_id,
            fullName: info.fullName,
            avatarUrl: info.avatarUrl,
            email: info.email,
            role: row.role as Member['role'],
            isActive: row.is_active ?? true,
            hourlyRate: row.hourly_rate ?? null,
        };
        membersByProject[row.project_id] = membersByProject[row.project_id] ? [...membersByProject[row.project_id], member] : [member];
    });
    return membersByProject;
};
