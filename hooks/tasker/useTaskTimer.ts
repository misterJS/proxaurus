import { useEffect, useState } from 'react';
import { BoardTask } from '@/types/tasker';
import { rpc } from '@/services/tasker/rpc';

export const useTaskTimer = () => {
    const [timer, setTimer] = useState<{ taskId: string | null; startedAt: number; initialSeconds: number }>({ taskId: null, startedAt: 0, initialSeconds: 0 });
    const [, forceTick] = useState(0);

    useEffect(() => {
        if (!timer.taskId) return;
        const t = setInterval(() => forceTick((v) => v + 1), 15000);
        return () => clearInterval(t);
    }, [timer.taskId]);

    const getTrackedSeconds = (task: BoardTask) => (timer.taskId === task.id ? timer.initialSeconds + Math.max(0, Math.floor((Date.now() - timer.startedAt) / 1000)) : task.trackedSeconds);

    const start = async (taskId: string, initial: number, onError: (msg: string) => void) => {
        setTimer({ taskId, startedAt: Date.now(), initialSeconds: initial });
        const { error } = await rpc.timerStart(taskId);
        if (error) {
            onError(error.message);
            setTimer({ taskId: null, startedAt: 0, initialSeconds: 0 });
        }
    };

    const stop = async (taskId: string, optimistic: number, onError: (msg: string) => void) => {
        const { error } = await rpc.timerStop(taskId);
        if (error) onError(error.message);
        setTimer({ taskId: null, startedAt: 0, initialSeconds: 0 });
    };

    return { timer, setTimer, getTrackedSeconds, start, stop } as const;
};
