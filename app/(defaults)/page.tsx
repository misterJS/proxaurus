import ComponentsDashboardSales from '@/components/dashboard/components-dashboard-sales';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Summary Projects',
};

const Sales = () => {
    return <ComponentsDashboardSales />;
};

export default Sales;
