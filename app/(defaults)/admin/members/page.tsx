import AdminMemberManagement from '@/components/admin/AdminMemberManagement';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Admin Member',
};

const AdminMembersPage = () => {
    return <AdminMemberManagement />;
};

export default AdminMembersPage;
