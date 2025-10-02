'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase-server';

export type AuthFormState = {
    error?: string;
    message?: string;
};

const invalidCreds = { error: 'Email dan password wajib diisi.' } satisfies AuthFormState;

export async function signUpAction(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const fullName = String(formData.get('fullName') ?? '').trim();

    if (!email || !password) {
        return invalidCreds;
    }

    const supabase = createSupabaseServer();

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName || null,
            },
        },
    });

    if (error) {
        return { error: error.message };
    }

    const { data: sess } = await supabase.auth.getSession();
    if (sess.session) {
        const userId = sess.session.user.id;
        await supabase.from('profiles').upsert({
            id: userId,
            full_name: fullName || null,
        });
        await supabase.from('users').upsert({
            id: userId,
            full_name: fullName || null,
            email,
        });
        revalidatePath('/');
        redirect('/');
        return { message: 'Akun berhasil dibuat.' };
    }

    return { message: 'Cek email kamu untuk konfirmasi.' };
}

export async function signInAction(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    if (!email || !password) {
        return invalidCreds;
    }

    const supabase = createSupabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        return { error: error.message };
    }

    revalidatePath('/');
    redirect('/');
    return { message: 'Berhasil masuk.' };
}

export async function signOutAction() {
    const supabase = createSupabaseServer();
    await supabase.auth.signOut();
    redirect('/auth/boxed-signin');
}
