'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-browser';

export default function AcceptInvitePage() {
  const params = useSearchParams();
  const router = useRouter();
  const [msg, setMsg] = useState('Memproses undangan...');

  useEffect(() => {
    const run = async () => {
      const token = params.get('token');
      if (!token) { setMsg('Token tidak ditemukan.'); return; }

      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) { setMsg('Silakan login terlebih dahulu.'); return; }

      const { data, error } = await supabase.rpc('accept_project_invite', { p_token: token });
      if (error) { setMsg(error.message); return; }

      setMsg('Undangan diterima! Membuka project...');
      router.replace(`/apps/task-management`);
    };
    run();
  }, [params, router]);

  return <div className="p-6">{msg}</div>;
}
