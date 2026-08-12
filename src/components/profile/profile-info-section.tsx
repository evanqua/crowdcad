'use client';

import { Avatar, Button, Card, CardBody } from '@heroui/react';
import { useRouter } from 'next/navigation';
import type { ServiceUser } from '@/lib/services';

export default function ProfileInfoSection({ user }: { user: ServiceUser }) {
  const router = useRouter();

  return (
    <Card isBlurred className="w-full border border-default-200 bg-surface-deep/40">
      <CardBody className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={user.displayName || user.email || 'U'} isBordered showFallback className="w-16 h-16" />
            <div>
              <p className="text-lg font-medium">{user.displayName || 'No display name'}</p>
              <p className="text-surface-light/70">{user.email}</p>
            </div>
          </div>
          <Button variant="bordered" onPress={() => router.push('/profile/edit')}>
            Edit Profile
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
