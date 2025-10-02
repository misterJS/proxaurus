import ComponentsAppsTaskManagement from '@/components/apps/task-management/components-apps-task-management';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Task Management',
};

const TaskManagementPage = () => {
    return <ComponentsAppsTaskManagement />;
};

export default TaskManagementPage;
