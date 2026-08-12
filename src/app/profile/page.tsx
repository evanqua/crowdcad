'use client';

import { useAuth } from '@/hooks/useauth';
import { DiagonalStreaksFixed } from '@/components/ui/diagonal-streaks-fixed';
import LoadingScreen from '@/components/ui/loading-screen';
import ProfileInfoSection from '@/components/profile/profile-info-section';
import SecuritySection from '@/components/profile/security-section';
import PreferencesSection from '@/components/profile/preferences-section';
import AdminSection from '@/components/profile/admin-section';

export default function ProfilePage() {
  const { user, ready } = useAuth();

  if (!ready) return <LoadingScreen label="Loading…" />;
  if (!user) return <div className="p-8">You are not signed in.</div>;

  return (
    <main className="relative min-h-[calc(100vh-3.5rem)] bg-surface-deepest text-surface-light">
      <DiagonalStreaksFixed />
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-12 space-y-10">
        <ProfileInfoSection user={user} />
        <SecuritySection user={user} />
        <PreferencesSection />
        <AdminSection currentUser={user} />
      </div>
    </main>
  );
}
