#!/usr/bin/env node
/**
 * setup-pocketbase.js
 *
 * Creates all collections required by CrowdCAD in a running PocketBase instance.
 * Run this once after starting PocketBase for the first time (or any time you
 * want to ensure the schema is up to date — the script is fully idempotent).
 *
 * Prerequisites:
 *   - PocketBase is running and reachable at PB_URL
 *   - A superadmin account exists (created with `./pocketbase superuser upsert`)
 *
 * Usage:
 *   PB_URL=http://192.168.x.x:8090 \
 *   PB_ADMIN_EMAIL=admin@example.com \
 *   PB_ADMIN_PASSWORD=YourPassword! \
 *   node scripts/setup-pocketbase.js
 *
 * All three env vars can also be placed in a .env.local file — the script will
 * read it automatically when dotenv is available.
 */

// Optional: load .env.local if present (dotenv is already a dev dependency)
try {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
} catch {
  // dotenv not available — rely on env vars being set externally
}

const PB_URL = (process.env.PB_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    'Error: PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD must be set.\n' +
      'Example:\n' +
      '  PB_URL=http://192.168.x.x:8090 \\\n' +
      '  PB_ADMIN_EMAIL=admin@example.com \\\n' +
      '  PB_ADMIN_PASSWORD=YourPassword! \\\n' +
      '  node scripts/setup-pocketbase.js',
  );
  process.exit(1);
}

async function pbFetch(apiPath, options = {}) {
  const res = await fetch(`${PB_URL}${apiPath}`, options);
  return res;
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

async function ensureCollection(headers, name, fields) {
  const check = await pbFetch(`/api/collections/${name}`, { headers });
  if (check.ok) {
    console.log(`  [skip]   ${name} — already exists`);
    return;
  }

  const res = await pbFetch('/api/collections', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name,
      type: 'base',
      fields,
      // Restrict access to authenticated users by default.
      // Adjust these rules in the PocketBase admin UI to match your security policy.
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create collection '${name}': ${res.status} — ${body}`);
  }
  console.log(`  [create] ${name}`);
}

async function main() {
  console.log(`Connecting to PocketBase at ${PB_URL} ...`);

  let token;
  try {
    token = await getAdminToken();
  } catch (err) {
    console.error(`\nAuthentication error: ${err.message}`);
    console.error('Make sure PocketBase is running and the credentials are correct.');
    process.exit(1);
  }

  console.log('Authenticated. Setting up collections...\n');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  await ensureCollection(headers, 'venues', [
    { name: 'name', type: 'text', required: true },
    { name: 'userId', type: 'text' },
    { name: 'equipment', type: 'json' },
    { name: 'layers', type: 'json' },
    { name: 'posts', type: 'json' },
    { name: 'mapUrl', type: 'text' },
    { name: 'sharedWith', type: 'json' },
  ]);

  await ensureCollection(headers, 'events', [
    { name: 'name', type: 'text' },
    { name: 'date', type: 'text' },
    { name: 'userId', type: 'text' },
    { name: 'venue', type: 'json' },
    { name: 'sharedWith', type: 'json' },
    { name: 'postingTimes', type: 'json' },
    { name: 'staff', type: 'json' },
    { name: 'supervisor', type: 'json' },
    { name: 'calls', type: 'json' },
    { name: 'status', type: 'text' },
    { name: 'eventPosts', type: 'json' },
    { name: 'eventEquipment', type: 'json' },
    { name: 'pendingAssignments', type: 'json' },
    { name: 'postAssignments', type: 'json' },
    { name: 'interactionSessions', type: 'json' },
  ]);

  await ensureCollection(headers, 'dispatchLogs', [
    { name: 'eventId', type: 'text' },
    { name: 'data', type: 'json' },
  ]);

  await ensureCollection(headers, '_storage', [
    { name: 'path', type: 'text', required: true },
    { name: 'file', type: 'file', options: { maxSelect: 1, maxSize: 52428800 } },
  ]);

  console.log('\nDone. CrowdCAD collections are ready.');
  console.log(
    'Review access rules in the PocketBase admin UI at ' + PB_URL + '/_/ before going to production.',
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
