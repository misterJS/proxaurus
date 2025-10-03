import { Priority } from '@/types/tasker';

export const normalizePriority = (value: string | null): Priority => {
    switch ((value || '').toLowerCase()) {
        case 'low':
            return 'Low';
        case 'high':
            return 'High';
        default:
            return 'Medium';
    }
};
