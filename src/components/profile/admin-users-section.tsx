'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardBody, Input, Spinner, Switch } from '@heroui/react';
import { RefreshCw } from 'lucide-react';
import { dbService } from '@/lib/services';
import type { UserDoc } from '@/lib/userDoc';
import type { ServiceUser } from '@/lib/services';

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

function toRow(id: string, data: UserDoc & Record<string, unknown>): UserRow {
  return {
    id,
    email: (data.email as string) || '(no email on record)',
    displayName: (data.displayName as string) || (data.name as string) || '',
    isAdmin: Boolean(data.isAdmin),
  };
}

export default function AdminUsersSection({ currentUser }: { currentUser: ServiceUser }) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const docs = await dbService.getCollection<UserDoc & Record<string, unknown>>('users');
      setRows(docs.map((d) => toRow(d.id, d.data ?? {})));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.email.toLowerCase().includes(q) || r.displayName.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const toggleAdmin = async (row: UserRow) => {
    setUpdatingId(row.id);
    try {
      await dbService.setDocument('users', row.id, { isAdmin: !row.isAdmin }, { merge: true });
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isAdmin: !r.isAdmin } : r)));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Card isBlurred className="w-full border border-default-200 bg-surface-deep/40">
      <CardBody className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Manage Admins</h3>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={load}
            isDisabled={loading}
            aria-label="Refresh users"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          classNames={{
            inputWrapper: 'rounded-2xl px-4 hover:bg-surface-deep',
            input: 'text-surface-light outline-none focus:outline-none data-[focus=true]:outline-none',
          }}
          className="mb-4"
        />

        {loading ? (
          <Spinner size="sm" />
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filtered.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-surface-deeper/90 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-surface-light truncate">{row.displayName || row.email}</p>
                  {row.displayName && <p className="text-xs text-surface-faint truncate">{row.email}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {row.id === currentUser.uid && <span className="text-xs text-surface-light/50">(you)</span>}
                  <Switch
                    isSelected={row.isAdmin}
                    onValueChange={() => toggleAdmin(row)}
                    isDisabled={updatingId === row.id}
                    aria-label={`Admin access for ${row.email}`}
                  />
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-sm text-surface-light/50">No users found.</p>}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
