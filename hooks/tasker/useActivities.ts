import { useState } from 'react';
import { TaskActivity } from '@/types/tasker';
import { supabase } from '@/lib/supabase-browser';


export const useActivities = () => {
const [activities, setActivities] = useState<TaskActivity[]>([]);
const [loading, setLoading] = useState(false);


const load = async (taskId: string) => {
setLoading(true);
const { data } = await supabase
.from('task_activities')
.select(`id, kind, details, created_at, actor:profiles!task_activities_actor_id_fkey ( id, full_name, avatar_url )`)
.eq('task_id', taskId)
.order('created_at', { ascending: false })
.limit(100);
setActivities((data as any) || []);
setLoading(false);
};


return { activities, loading, load } as const;
};