'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useauth';
import { authService, dbService } from '@/lib/services';
import { Card, CardBody, Button, Input } from '@heroui/react';
import LoadingScreen from '@/components/ui/loading-screen';

const inputClassNames = {
  label: 'text-surface-light font-medium',
  input: 'text-surface-light outline-none focus:outline-none data-[focus=true]:outline-none focus:ring-0 focus-visible:ring-0',
  inputWrapper: 'rounded-2xl px-4 hover:bg-surface-deep',
} as const;

export default function EditProfilePage() {
  const { user, ready } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    setDisplayName(user.displayName ?? '');
    setPhone(user.phoneNumber ?? '');
  }, [user, ready]);

  if (!ready) return <LoadingScreen label="Loading…" />;
  if (!user) return <div className="p-8">You are not signed in.</div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const currentUser = authService.currentUser;
      if (currentUser) {
        await authService.updateProfile({ displayName: displayName || null });

        // Save phone (and other profile metadata) to users collection
        await dbService.setDocument('users', currentUser.uid, { phoneNumber: phone || null }, { merge: true });

        setMessage('Profile saved.');
        router.push('/profile');
      } else {
        setMessage('No authenticated user.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile';
      setMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="relative min-h-[calc(100vh-3.5rem)] bg-surface-deepest text-surface-light overflow-hidden">
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-12">
        <form onSubmit={handleSubmit}>
          <Card
            isBlurred
            className="border border-default-200"
            style={{ backgroundColor: 'hsl(var(--surface-bg-2) / 0.5)' }}
          >
            <CardBody className="p-6">
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <h1 className="text-2xl font-semibold">Edit Profile</h1>
                  <p className="text-surface-light/80">Update your public profile information.</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4">
                <Input
                  label="Full name"
                  labelPlacement="outside"
                  size="lg"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                  classNames={inputClassNames}
                />

                <Input
                  label="Phone number"
                  labelPlacement="outside"
                  size="lg"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 555 5555"
                  description="Phone numbers are saved to your profile document."
                  classNames={inputClassNames}
                />
              </div>

              <div className="mt-6 flex items-center gap-3">
                <Button
                  type="submit"
                  size="lg"
                  radius="lg"
                  className="bg-accent hover:bg-accent/90 text-surface-light"
                  isLoading={saving}
                  isDisabled={saving}
                >
                  Save Changes
                </Button>
                <Button type="button" variant="bordered" onPress={() => router.push('/profile')}>
                  Cancel
                </Button>
                {message && <span className="ml-4 text-sm text-surface-light/80">{message}</span>}
              </div>
            </CardBody>
          </Card>
        </form>
      </section>
    </main>
  );
}
