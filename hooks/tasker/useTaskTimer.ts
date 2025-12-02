'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase-browser';

type TimerState = {
  taskId: string | null;
  startedAt: number;        // epoch ms
  initialSeconds: number;   // akumulasi sebelum start terakhir
  entryId?: string | null;  // id row di task_time_entries
};

const LS_KEY = 'tm.activeTimer.v1';

function saveToLS(state: TimerState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
}
function clearLS() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}
function loadFromLS(): TimerState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return {
      taskId: o?.taskId ?? null,
      startedAt: Number(o?.startedAt ?? 0),
      initialSeconds: Number(o?.initialSeconds ?? 0),
      entryId: o?.entryId ?? null,
    };
  } catch { return null; }
}

export function useTaskTimer() {
  const [timer, setTimer] = useState<TimerState>({ taskId: null, startedAt: 0, initialSeconds: 0, entryId: null });

  // bikin UI “jalan” per 15 detik
  const [, forceTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!timer.taskId) return;
    tickRef.current && clearInterval(tickRef.current);
    tickRef.current = setInterval(() => forceTick((x) => x + 1), 15_000);
    return () => { tickRef.current && clearInterval(tickRef.current); };
  }, [timer.taskId]);

  // === Restore saat mount ===
  useEffect(() => {
    const restore = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;

        // Cari entry aktif milik user ini
        const { data: entry, error } = await supabase
          .from('task_time_entries')
          .select('id, task_id, started_at')
          .eq('user_id', uid)
          .is('stopped_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && entry && entry.task_id) {
          // Ambil tracked_seconds dari tasks via query terpisah (FIX: tidak nested join)
          const { data: taskRow } = await supabase
            .from('tasks')
            .select('tracked_seconds')
            .eq('id', entry.task_id)
            .single();

          const initialSeconds = Number(taskRow?.tracked_seconds ?? 0);
          const startedAt = new Date(entry.started_at).getTime();

          const next: TimerState = {
            taskId: entry.task_id,
            startedAt,
            initialSeconds,
            entryId: entry.id,
          };
          setTimer(next);
          saveToLS(next);
          return;
        }

        // fallback ke localStorage
        const ls = loadFromLS();
        if (ls?.taskId) setTimer(ls);
      } catch {
        // diamkan; UI tetap jalan
      }
    };
    restore();
  }, []);

  // Hitung detik berjalan untuk task tertentu (buat render UI)
  const getTrackedSeconds = useCallback(
    (task: { id: string; trackedSeconds: number }) => {
      if (timer.taskId === task.id && timer.startedAt) {
        const elapsed = Math.max(0, Math.floor((Date.now() - timer.startedAt) / 1000));
        return timer.initialSeconds + elapsed;
      }
      return task.trackedSeconds;
    },
    [timer.initialSeconds, timer.startedAt, timer.taskId],
  );

  // Start timer
  const start = async (taskId: string, initialSeconds: number, onError?: (msg: string) => void) => {
    try {
      if (timer.taskId) return; // sudah ada timer aktif

      // coba pakai RPC kamu dulu
      let entryId: string | null = null;
      let startedAtISO: string | null = null;

      const rpcRes = await supabase.rpc('task_timer_start', { p_task_id: taskId });
      if (!rpcRes.error) {
        const ret: any = rpcRes.data || {};
        entryId = ret.entry_id ?? ret.id ?? null;
        startedAtISO = ret.started_at ?? null;
      } else {
        // fallback insert manual
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) throw new Error('Unauthenticated');

        const started_at = new Date().toISOString();
        const { data, error } = await supabase
          .from('task_time_entries')
          .insert({ task_id: taskId, user_id: uid, started_at })
          .select('id, started_at')
          .single();
        if (error) throw error;
        entryId = data.id;
        startedAtISO = data.started_at;
      }

      const startedAt = new Date(startedAtISO || new Date().toISOString()).getTime();
      const next: TimerState = { taskId, startedAt, initialSeconds, entryId };
      setTimer(next);
      saveToLS(next);
    } catch (e: any) {
      onError?.(e?.message || 'Failed to start timer');
    }
  };

  // Stop timer
  const stop = async (taskId: string, optimisticTotalSeconds: number, onError?: (msg: string) => void) => {
    try {
      if (timer.taskId !== taskId) return;

      // RPC stop jika ada
      const stopRes = await supabase.rpc('task_timer_stop', { p_task_id: taskId });
      if (stopRes.error) {
        // fallback update entry aktif
        let activeEntryId = timer.entryId || null;
        if (!activeEntryId) {
          const { data, error } = await supabase
            .from('task_time_entries')
            .select('id, started_at')
            .eq('task_id', taskId)
            .is('stopped_at', null)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (error) throw error;
          activeEntryId = data?.id || null;
        }
        if (activeEntryId) {
          const stopped_at = new Date().toISOString();
          const duration_sec = Math.max(0, Math.floor((Date.now() - (timer.startedAt || Date.now())) / 1000));
          await supabase.from('task_time_entries').update({ stopped_at, duration_sec }).eq('id', activeEntryId);
        }
      }

      setTimer({ taskId: null, startedAt: 0, initialSeconds: 0, entryId: null });
      clearLS();
    } catch (e: any) {
      onError?.(e?.message || 'Failed to stop timer');
    }
  };

  return { timer, getTrackedSeconds, start, stop };
}
