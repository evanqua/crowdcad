'use client';

import { useAdmin } from '@/hooks/useAdmin';
import type { ServiceUser } from '@/lib/services';
import AdminCertificationsSection from './admin-certifications-section';
import AdminUsersSection from './admin-users-section';
import AdminVenuesSection from './admin-venues-section';

export default function AdminSection({ currentUser }: { currentUser: ServiceUser }) {
  const { isAdmin, loading } = useAdmin();

  if (loading || !isAdmin) return null;

  return (
    <div className="space-y-6 w-full">
      <h2 className="text-3xl font-bold">Admin</h2>
      <AdminCertificationsSection />
      <AdminVenuesSection currentUser={currentUser} />
      <AdminUsersSection currentUser={currentUser} />
    </div>
  );
}
