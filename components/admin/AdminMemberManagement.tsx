'use client';
import { useMemo, useState, FormEvent } from 'react';
import { useAuthUser } from '@/hooks/tasker/useAuthUser';
import { useBoardData } from '@/hooks/tasker/useBoardData';
import { Member, ProjectRole } from '@/types/tasker';
import { updateProjectMember, deleteProjectMember, insertProjectMember, findUserByEmail } from '@/services/tasker/projects';

const AdminMemberManagement = () => {
    const { userId, loading: userLoading, error: userError } = useAuthUser();
    const { projects, setProjects, activeProjectId, setActiveProjectId, activeProject, myRoles, isLoading, error, startMutate, loadProjects } = useBoardData(userId);

    const [memberActionTarget, setMemberActionTarget] = useState<string | null>(null);
    const [memberError, setMemberError] = useState<string | null>(null);
    const [addEmail, setAddEmail] = useState('');
    const [addRole, setAddRole] = useState<ProjectRole>('member');
    const [addRate, setAddRate] = useState<number>(50_000);
    const [addingExisting, setAddingExisting] = useState(false);

    const canManageMembers = useMemo(() => {
        if (!activeProject) return false;
        const role = myRoles[activeProject.id] ?? 'member';
        return role === 'owner' || role === 'admin';
    }, [activeProject, myRoles]);

    const updateMemberInState = (projectId: string, userId: string, updater: (member: Member) => Member) => {
        setProjects((prev) =>
            prev.map((p) => (p.id === projectId ? { ...p, members: (p.members ?? []).map((m) => (m.userId === userId ? updater(m) : m)) } : p)),
        );
    };

    const removeMemberInState = (projectId: string, userId: string) => {
        setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, members: (p.members ?? []).filter((m) => m.userId !== userId) } : p)));
    };

    const handleToggleMemberActive = (member: Member) => {
        if (!activeProject || !canManageMembers) return;
        const projectId = activeProject.id;
        const prevActive = member.isActive ?? true;
        const nextActive = !prevActive;
        setMemberError(null);
        setMemberActionTarget(member.userId);
        updateMemberInState(projectId, member.userId, (m) => ({ ...m, isActive: nextActive }));

        startMutate(async () => {
            try {
                const { error: updateErr } = await updateProjectMember(projectId, member.userId, { is_active: nextActive });
                if (updateErr) throw updateErr;
                await loadProjects(projectId, { silent: true });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to update member status.';
                setMemberError(message);
                updateMemberInState(projectId, member.userId, (m) => ({ ...m, isActive: prevActive }));
                await loadProjects(projectId, { silent: true });
            } finally {
                setMemberActionTarget(null);
            }
        });
    };

    const handleEditMemberRole = (member: Member, nextRole: ProjectRole) => {
        if (!activeProject || !canManageMembers) return;
        if (member.role === 'owner' || member.role === nextRole) return;
        const projectId = activeProject.id;
        const prevRole = member.role ?? 'member';
        setMemberError(null);
        setMemberActionTarget(member.userId);
        updateMemberInState(projectId, member.userId, (m) => ({ ...m, role: nextRole }));

        startMutate(async () => {
            try {
                const { error: updateErr } = await updateProjectMember(projectId, member.userId, { role: nextRole });
                if (updateErr) throw updateErr;
                await loadProjects(projectId, { silent: true });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to change member role.';
                setMemberError(message);
                updateMemberInState(projectId, member.userId, (m) => ({ ...m, role: prevRole }));
                await loadProjects(projectId, { silent: true });
            } finally {
                setMemberActionTarget(null);
            }
        });
    };

    const handleDeleteMember = (member: Member) => {
        if (!activeProject || !canManageMembers) return;
        if (member.role === 'owner') return;
        const projectId = activeProject.id;
        const label = member.fullName || member.email || member.userId;
        if (!window.confirm(`Remove ${label} from this project?`)) return;
        setMemberError(null);
        setMemberActionTarget(member.userId);
        removeMemberInState(projectId, member.userId);

        startMutate(async () => {
            try {
                const { error: deleteErr } = await deleteProjectMember(projectId, member.userId);
                if (deleteErr) throw deleteErr;
                await loadProjects(projectId, { silent: true });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to delete member.';
                setMemberError(message);
                await loadProjects(projectId, { silent: true });
            } finally {
                setMemberActionTarget(null);
            }
        });
    };

    const handleUpdateMemberRate = (member: Member, nextRate: number) => {
        if (!activeProject || !canManageMembers) return;
        const projectId = activeProject.id;
        const prevRate = member.hourlyRate ?? null;
        const safeRate = Number.isFinite(nextRate) && nextRate >= 0 ? nextRate : 0;
        setMemberError(null);
        setMemberActionTarget(member.userId);
        updateMemberInState(projectId, member.userId, (m) => ({ ...m, hourlyRate: safeRate }));

        startMutate(async () => {
            try {
                const { error: updateErr } = await updateProjectMember(projectId, member.userId, { hourly_rate: safeRate });
                if (updateErr) throw updateErr;
                await loadProjects(projectId, { silent: true });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to update member rate.';
                setMemberError(message);
                updateMemberInState(projectId, member.userId, (m) => ({ ...m, hourlyRate: prevRate }));
                await loadProjects(projectId, { silent: true });
            } finally {
                setMemberActionTarget(null);
            }
        });
    };

    const handleUpdateTimerAccess = (member: Member, allowTimer: boolean) => {
        if (!activeProject || !canManageMembers) return;
        const projectId = activeProject.id;
        const prev = member.canUseTimer ?? true;
        setMemberError(null);
        setMemberActionTarget(member.userId);
        updateMemberInState(projectId, member.userId, (m) => ({ ...m, canUseTimer: allowTimer }));

        startMutate(async () => {
            try {
                const { error: updateErr } = await updateProjectMember(projectId, member.userId, { can_use_timer: allowTimer });
                if (updateErr) throw updateErr;
                await loadProjects(projectId, { silent: true });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to update timer access.';
                setMemberError(message);
                updateMemberInState(projectId, member.userId, (m) => ({ ...m, canUseTimer: prev }));
                await loadProjects(projectId, { silent: true });
            } finally {
                setMemberActionTarget(null);
            }
        });
    };

    const handleUpdateNominalAccess = (member: Member, allowNominal: boolean) => {
        if (!activeProject || !canManageMembers) return;
        const projectId = activeProject.id;
        const prev = member.canSeeNominal ?? true;
        setMemberError(null);
        setMemberActionTarget(member.userId);
        updateMemberInState(projectId, member.userId, (m) => ({ ...m, canSeeNominal: allowNominal }));

        startMutate(async () => {
            try {
                const { error: updateErr } = await updateProjectMember(projectId, member.userId, { can_see_nominal: allowNominal });
                if (updateErr) throw updateErr;
                await loadProjects(projectId, { silent: true });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to update nominal visibility.';
                setMemberError(message);
                updateMemberInState(projectId, member.userId, (m) => ({ ...m, canSeeNominal: prev }));
                await loadProjects(projectId, { silent: true });
            } finally {
                setMemberActionTarget(null);
            }
        });
    };

    const handleAddExistingMember = async (e: FormEvent) => {
        e.preventDefault();
        if (!activeProject || !canManageMembers) return;
        const projectId = activeProject.id;
        const email = addEmail.trim().toLowerCase();
        if (!email) {
            setMemberError('Enter a registered user email.');
            return;
        }
        setMemberError(null);
        setAddingExisting(true);
        try {
            const exists = (activeProject.members ?? []).find((m) => m.email?.toLowerCase() === email);
            if (exists) {
                setMemberError('User is already a member of this project.');
                setAddingExisting(false);
                return;
            }
            const { data: user, error: userErr } = await findUserByEmail(email);
            if (userErr) throw userErr;
            if (!user?.id) {
                setMemberError('User is not registered. Use Invite for unregistered users.');
                setAddingExisting(false);
                return;
            }
            if ((activeProject.members ?? []).some((m) => m.userId === user.id)) {
                setMemberError('User is already a member of this project.');
                setAddingExisting(false);
                return;
            }
            const { error: insertErr } = await insertProjectMember({
                project_id: projectId,
                user_id: user.id,
                role: addRole,
                hourly_rate: addRate,
                is_active: true,
            });
            if (insertErr) throw insertErr;
            await loadProjects(projectId, { silent: true });
            setAddEmail('');
            setAddRate(50_000);
            setAddRole('member');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to add member.';
            setMemberError(message);
        } finally {
            setAddingExisting(false);
        }
    };

    if (userLoading || isLoading) return <div className="flex min-h-[400px] items-center justify-center text-slate-500">Loading admin data...</div>;
    if (userError || error) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-500 dark:border-rose-400/40 dark:bg-rose-500/10">{userError || error}</div>;

    if (!projects.length) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <p className="font-semibold">No projects yet.</p>
                <p className="text-sm">Create a project first to manage members.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Admin - Manage Members</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Activate/deactivate users, change roles, or remove members per project.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Select Project</label>
                        <select
                            className="form-select"
                            value={activeProjectId ?? ''}
                            onChange={(e) => setActiveProjectId(e.target.value)}
                        >
                            {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {canManageMembers && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add existing registered user</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Assign to project without sending an invite. Use Invite for users who have not signed up.</p>
                        </div>
                    </div>
                    <form className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end" onSubmit={handleAddExistingMember}>
                        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Registered user email
                            <input
                                type="email"
                                className="form-input"
                                value={addEmail}
                                onChange={(e) => setAddEmail(e.target.value)}
                                placeholder="nama@contoh.com"
                                required
                            />
                        </label>
                        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Role
                            <select className="form-select" value={addRole} onChange={(e) => setAddRole(e.target.value as ProjectRole)}>
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                            </select>
                        </label>
                        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Rate / hour (IDR)
                            <input
                                type="number"
                                min={0}
                                step={1000}
                                className="form-input"
                                value={addRate}
                                onChange={(e) => setAddRate(Number(e.target.value) || 0)}
                            />
                        </label>
                        <button
                            type="submit"
                            disabled={addingExisting}
                            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {addingExisting ? 'Adding...' : 'Add'}
                        </button>
                    </form>
                </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Project</p>
                        <p className="text-base font-semibold text-slate-900 dark:text-white">{activeProject?.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Your role: {activeProject ? myRoles[activeProject.id] ?? 'member' : 'member'}
                        </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{activeProject?.members?.length ?? 0} member</span>
                </div>

                {memberError ? (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
                        {memberError}
                    </div>
                ) : null}

                {!canManageMembers ? (
                    <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        You are not an admin/owner on this project. Data is read-only.
                    </p>
                ) : null}

                <div className="mt-4 space-y-3">
                    {(activeProject?.members ?? []).map((member) => {
                        const projectId = activeProject?.id;
                        const busy = memberActionTarget === member.userId;
                        const isOwner = member.role === 'owner';
                        const isActive = member.isActive ?? true;
                        return (
                            <div key={member.userId} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                                <div className="flex flex-wrap items-center gap-3">
                                    <img
                                        className="h-10 w-10 rounded-full border border-white object-cover dark:border-slate-700"
                                        src={member.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.fullName || member.email || 'U')}`}
                                        alt=""
                                    />
                                    <div className="flex-1 min-w-[160px]">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{member.fullName || member.email || member.userId}</p>
                                        {member.email ? <p className="text-xs text-slate-500 dark:text-slate-400">{member.email}</p> : null}
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!canManageMembers || busy || isOwner}
                                        onClick={() => handleToggleMemberActive(member)}
                                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                                            isActive
                                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20'
                                                : 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20'
                                        } ${busy || isOwner ? 'opacity-60' : ''}`}
                                    >
                                        {isActive ? 'Active' : 'Inactive'}
                                    </button>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Rate</span>
                                        <input
                                            type="number"
                                            min={0}
                                            step={1000}
                                            className="form-input h-9 w-28"
                                            value={member.hourlyRate ?? 0}
                                            disabled={!canManageMembers || busy}
                                            onChange={(e) => {
                                                if (!projectId) return;
                                                updateMemberInState(projectId, member.userId, (m) => ({ ...m, hourlyRate: Number(e.target.value) || 0 }));
                                            }}
                                            onBlur={(e) => handleUpdateMemberRate(member, Number(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                                        <span>Timer</span>
                                        <div className="flex items-center gap-3 text-[11px] font-medium normal-case text-slate-600 dark:text-slate-300">
                                            <label className="inline-flex items-center gap-1">
                                                <input
                                                    type="radio"
                                                    name={`timer-${member.userId}`}
                                                    className="form-radio"
                                                    checked={member.canUseTimer !== false}
                                                    disabled={!canManageMembers || busy}
                                                    onChange={() => handleUpdateTimerAccess(member, true)}
                                                />
                                                Can start/stop
                                            </label>
                                            <label className="inline-flex items-center gap-1">
                                                <input
                                                    type="radio"
                                                    name={`timer-${member.userId}`}
                                                    className="form-radio"
                                                    checked={member.canUseTimer === false}
                                                    disabled={!canManageMembers || busy}
                                                    onChange={() => handleUpdateTimerAccess(member, false)}
                                                />
                                                Not allowed
                                            </label>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                                        <span>Nominal</span>
                                        <div className="flex items-center gap-3 text-[11px] font-medium normal-case text-slate-600 dark:text-slate-300">
                                            <label className="inline-flex items-center gap-1">
                                                <input
                                                    type="radio"
                                                    name={`nominal-${member.userId}`}
                                                    className="form-radio"
                                                    checked={member.canSeeNominal !== false}
                                                    disabled={!canManageMembers || busy}
                                                    onChange={() => handleUpdateNominalAccess(member, true)}
                                                />
                                                Can see
                                            </label>
                                            <label className="inline-flex items-center gap-1">
                                                <input
                                                    type="radio"
                                                    name={`nominal-${member.userId}`}
                                                    className="form-radio"
                                                    checked={member.canSeeNominal === false}
                                                    disabled={!canManageMembers || busy}
                                                    onChange={() => handleUpdateNominalAccess(member, false)}
                                                />
                                                Not allowed
                                            </label>
                                        </div>
                                    </div>
                                    <select
                                        className="form-select h-10 flex-1 min-w-[140px]"
                                        value={member.role ?? 'member'}
                                        disabled={!canManageMembers || busy || isOwner}
                                        onChange={(e) => handleEditMemberRole(member, e.target.value as ProjectRole)}
                                    >
                                        <option value="owner" disabled>
                                            Owner
                                        </option>
                                        <option value="admin">Admin</option>
                                        <option value="member">Member</option>
                                    </select>
                                    <button
                                        type="button"
                                        disabled={!canManageMembers || busy || isOwner}
                                        onClick={() => handleDeleteMember(member)}
                                        className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
                                    >
                                        Delete
                                    </button>
                                    <span
                                        className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${
                                            member.role === 'owner'
                                                ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300'
                                                : member.role === 'admin'
                                                ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'
                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300'
                                        }`}
                                    >
                                        {member.role ?? 'member'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    {!activeProject?.members?.length ? <p className="text-center text-sm text-slate-400 dark:text-slate-500">No members yet.</p> : null}
                </div>
            </div>
        </div>
    );
};

export default AdminMemberManagement;
