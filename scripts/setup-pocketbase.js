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

async function ensureCollection(headers, name, fields, rules) {
  const check = await pbFetch(`/api/collections/${name}`, { headers });
  if (check.ok) {
    console.log(`  [skip]   ${name} — already exists`);
    return;
  }

  const authRule = '@request.auth.id != ""';
  const res = await pbFetch('/api/collections', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name,
      type: 'base',
      fields,
      // Restrict access to authenticated users by default.
      // Adjust these rules in the PocketBase admin UI to match your security policy.
      listRule: rules?.listRule ?? authRule,
      viewRule: rules?.viewRule ?? authRule,
      createRule: rules?.createRule ?? authRule,
      updateRule: rules?.updateRule ?? authRule,
      deleteRule: rules?.deleteRule ?? authRule,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create collection '${name}': ${res.status} — ${body}`);
  }
  console.log(`  [create] ${name}`);
}

async function ensureField(headers, collectionName, field) {
  const res = await pbFetch(`/api/collections/${collectionName}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to read collection '${collectionName}': ${res.status} — ${body}`);
  }
  const collection = await res.json();
  const existing = collection.fields || [];
  if (existing.some((f) => f.name === field.name)) {
    console.log(`  [skip]   ${collectionName}.${field.name} — already exists`);
    return;
  }

  const patchRes = await pbFetch(`/api/collections/${collectionName}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: [...existing, field] }),
  });
  if (!patchRes.ok) {
    const body = await patchRes.text();
    throw new Error(`Failed to add field '${field.name}' to '${collectionName}': ${patchRes.status} — ${body}`);
  }
  console.log(`  [add]    ${collectionName}.${field.name}`);
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

  await ensureCollection(
    headers,
    'settings',
    [
      { name: 'key', type: 'text', required: true },
      { name: 'list', type: 'json' },
    ],
    {
      // Readable by any authenticated user (needed at event-create time);
      // writable only by admins.
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.isAdmin = true',
      updateRule: '@request.auth.isAdmin = true',
      deleteRule: '@request.auth.isAdmin = true',
    },
  );

  // `isAdmin` on the built-in `users` auth collection — grants access to the
  // Profile > Admin section. Grant it per-user via scripts/setAdminPocketbase.js
  // (or the Manage Admins panel, once at least one admin exists).
  await ensureField(headers, 'users', { name: 'isAdmin', type: 'bool' });

  console.log('\nDone. CrowdCAD collections are ready.');
  console.log(
    'Review access rules in the PocketBase admin UI at ' + PB_URL + '/_/ before going to production.',
  );
  console.log(
    "\nSecurity: restrict the built-in 'users' collection's List/View/Update rules to\n" +
      '  @request.auth.id = id || @request.auth.isAdmin = true\n' +
      'in the admin UI (Collections > users > API Rules) — otherwise any authenticated\n' +
      "user may be able to list other users or flip their own 'isAdmin' field. This\n" +
      "isn't set automatically so it doesn't overwrite rules you've already customized.",
  );
  console.log(
    "\nForgot-password emails: PocketBase's default reset-password email links to its\n" +
      "own admin UI, not this app. In the admin UI go to Collections > users > Options >\n" +
      'Email templates > Reset password, and change the action URL to:\n' +
      '  {APP_URL}/reset-password?token={TOKEN}\n' +
      "(replace {APP_URL} with your deployed app's URL). Also configure Settings > Mail\n" +
      "settings with real SMTP credentials — without it, PocketBase can't send these\n" +
      'emails at all. Neither of these is set automatically for the same reason as above.',
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
