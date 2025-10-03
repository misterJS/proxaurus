import { supabase } from '@/lib/supabase-browser';
import { useEffect, useState } from 'react';

export const useAuthUser = () => {
    const [userId, setUserId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            const { data, error } = await supabase.auth.getUser();
            if (error) setError(error.message);
            setUserId(data?.user?.id ?? null);
            setLoading(false);
        };
        run();
    }, []);

    return { userId, loading, error } as const;
};
