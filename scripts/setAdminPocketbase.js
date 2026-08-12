#!/usr/bin/env node
/*
Grants (or revokes) admin access for a CrowdCAD user, identified by email, by
setting `isAdmin` on their record in the PocketBase `users` collection.

This is a one-time bootstrap step for the *first* admin on a deployment —
once at least one admin exists, further admins can be granted/revoked from
the "Manage Admins" panel in Profile > Admin.

Prerequisites:
  - PocketBase is running and reachable at PB_URL
  - `node scripts/setup-pocketbase.js` has been run (adds the `isAdmin` field)

Usage:
  PB_URL=http://192.168.x.x:8090 \
  PB_ADMIN_EMAIL=admin@example.com \
  PB_ADMIN_PASSWORD=YourPassword! \
  node scripts/setAdminPocketbase.js <email-of-user-to-promote> [--revoke]

All PB_* env vars can also be placed in a .env.local file.
*/

try {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
} catch {
  // dotenv not available — rely on env vars being set externally
}

const PB_URL = (process.env.PB_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;

const targetEmail = process.argv[2];
const revoke = process.argv.includes('--revoke');

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Error: PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD must be set.');
  process.exit(1);
}
if (!targetEmail) {
  console.error('Usage: node scripts/setAdminPocketbase.js <email> [--revoke]');
  process.exit(1);
}

async function pbFetch(apiPath, options = {}) {
  return fetch(`${PB_URL}${apiPath}`, options);
}

async function getAdminToken() {
  const res = await pbFetch('/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Superadmin authentication failed: ${res.status} — ${body}`);
  }
  const { token } = await res.json();
  return token;
}

async function main() {
  const token = await getAdminToken();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const filter = encodeURIComponent(`email = "${targetEmail}"`);
  const listRes = await pbFetch(`/api/collections/users/records?filter=${filter}`, { headers });
  if (!listRes.ok) {
    const body = await listRes.text();
    throw new Error(`Failed to look up user '${targetEmail}': ${listRes.status} — ${body}`);
  }
  const { items } = await listRes.json();
  if (!items || items.length === 0) {
    throw new Error(`No user found with email '${targetEmail}'`);
  }
  const user = items[0];

  const patchRes = await pbFetch(`/api/collections/users/records/${user.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ isAdmin: !revoke }),
  });
  if (!patchRes.ok) {
    const body = await patchRes.text();
    throw new Error(`Failed to update user '${targetEmail}': ${patchRes.status} — ${body}`);
  }

  console.log(`${revoke ? 'Revoked' : 'Granted'} admin access for ${targetEmail} (id: ${user.id})`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
