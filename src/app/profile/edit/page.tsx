'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useauth';
import { auth, db } from '@/app/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Card, CardBody, Button, Avatar } from '@heroui/react';
import LoadingScreen from '@/components/ui/loading-screen';

export default function EditProfilePage() {
  const { user, ready } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    setDisplayName(user.displayName ?? '');
    setPhotoURL(user.photoURL ?? '');
    setPhone(user.phoneNumber ?? '');
  }, [user, ready]);

  if (!ready) return <LoadingScreen label="Loading…" />;
  if (!user) return <div className="p-8">You are not signed in.</div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: displayName || null,
          photoURL: photoURL || null,
        });

        // Save phone (and other profile metadata) to Firestore users collection
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userRef, { phoneNumber: phone || null }, { merge: true });

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
    <main className="min-h-screen bg-surface-deeper text-surface-light" style={{ '--nav-h': '72px' } as React.CSSProperties}>
      <section className="max-w-3xl mx-auto px-6 py-12">
        <form onSubmit={handleSubmit}>
          <Card className="bg-default/10 border border-surface-light/10">
            <CardBody className="p-6">
              <div className="flex items-center gap-6">
                <Avatar name={displayName || (user.email ?? 'U')} isBordered showFallback className="w-20 h-20" />

                <div className="flex-1">
                  <h1 className="text-2xl font-semibold">Edit Profile</h1>
                  <p className="text-surface-light/80">Update your public profile information.</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4">
                <div>
                  <label className="block mb-1 text-sm text-surface-light/90">Full name</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-2 bg-surface-deepest text-white border border-surface rounded-md focus:outline-none focus:ring-2 focus:ring-status-blue"
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm text-surface-light/90">Photo URL</label>
                  <input
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                    className="w-full px-4 py-2 bg-surface-deepest text-white border border-surface rounded-md focus:outline-none focus:ring-2 focus:ring-status-blue"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm text-surface-light/90">Phone number</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2 bg-surface-deepest text-white border border-surface rounded-md focus:outline-none focus:ring-2 focus:ring-status-blue"
                    placeholder="+1 555 555 5555"
                  />
                  <p className="text-xs text-surface-faint mt-1">Phone numbers are saved to your profile document.</p>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <Button type="submit" className="bg-accent hover:bg-accent/90" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
                <Button type="button" variant="bordered" onClick={() => router.push('/profile')}>Cancel</Button>
                {message && <span className="ml-4 text-sm text-surface-light/80">{message}</span>}
              </div>
            </CardBody>
          </Card>
        </form>
      </section>
    </main>
  );
}
