import { supabase } from '@/lib/supabase-browser';

export const insertFlow = (projectId: string, name: string, position: number) => supabase.from('flows').insert({ project_id: projectId, name, position }).select('id, name, position').single();
