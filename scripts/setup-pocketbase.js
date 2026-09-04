#!/usr/bin/env node
/**
 * setup-pocketbase.js
 *
 * Creates all collections required by CrowdCAD in a running PocketBase instance,
 * and applies the access rules that keep editing/ending someone else's venue or
 * event to their owner or an admin only (mirrors firestore.rules — see the rule
 * constants below). Run this once after starting PocketBase for the first time,
 * or any time you want to ensure the schema and rules are up to date — the
 * script is fully idempotent, and re-applies its rules on every run even to
 * collections that already existed.
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

// Access rules applied to every collection this script manages. These mirror
// firestore.rules exactly, so a self-hosted PocketBase deployment gets the
// same "only the owner or an admin can edit important things" guarantees as
// the Firebase backend does — this is the only backend config a self-hoster
// forking this repo actually runs, so it needs to be correct standalone,
// not just documented as a manual follow-up step.
const AUTH_RULE = '@request.auth.id != ""';

// A record's own `userId` field must match the requester, or the requester
// must be an admin. Used for venues (update/delete) and dispatchLogs
// (list/view/update/delete) — anything owner-scoped with no broader sharing
// concept.
const OWNER_OR_ADMIN_RULE = `${AUTH_RULE} && (userId = @request.auth.id || @request.auth.isAdmin = true)`;

// Creating a record requires naming yourself as its owner, not someone else
// — mirrors firestore.rules' create rules for venues/events/dispatchLogs.
const SELF_OWNED_CREATE_RULE = `${AUTH_RULE} && @request.body.userId = @request.auth.id`;

// Event fields that control who owns, can see, or can end an event — a
// shared user or org-event member (anyone the app lets into the dispatch
// view besides the owner/admin) must not be able to touch these via a
// direct write, even though they need broad write access to ordinary
// dispatch fields (calls, staff/supervisor status, equipment) for
// dispatching to work at all. Mirrors firestore.rules'
// isEventProtectedFieldsUnchanged().
const EVENT_PROTECTED_FIELDS = ['userId', 'sharedWith', 'isOrgEvent', 'ended', 'endedAt'];
const EVENT_PROTECTED_FIELDS_UNTOUCHED = EVENT_PROTECTED_FIELDS.map(
  (field) => `@request.body.${field}:isset = false`,
).join(' && ');

const EVENT_UPDATE_RULE =
  `${AUTH_RULE} && (` +
  `userId = @request.auth.id || @request.auth.isAdmin = true || ` +
  `((sharedWith ~ @request.auth.email || isOrgEvent = true) && ${EVENT_PROTECTED_FIELDS_UNTOUCHED})` +
  `)`;

// The built-in `users` auth collection. `isAdmin` is carved out of a
// self-write everywhere below — without that, any signed-up user could set
// `isAdmin: true` on their own record directly via the API (the Profile >
// Admin panel's "self or admin" buttons are a client-side convenience only)
// and grant themselves full admin rights, including editing or deleting
// any other user's venues/events. Only an existing admin may set `isAdmin`
// on anyone, self included. Mirrors firestore.rules' /users/{userId} rule.
const USERS_RULES = {
  listRule: `${AUTH_RULE} && (id = @request.auth.id || @request.auth.isAdmin = true)`,
  viewRule: `${AUTH_RULE} && (id = @request.auth.id || @request.auth.isAdmin = true)`,
  // Left open for public sign-up (PocketBase's own default), but a create
  // request can't set isAdmin to true on the new account.
  createRule: '(@request.body.isAdmin:isset = false || @request.body.isAdmin = false)',
  updateRule:
    `${AUTH_RULE} && (` +
    `@request.auth.isAdmin = true || ` +
    `(id = @request.auth.id && @request.body.isAdmin:isset = false)` +
    `)`,
  deleteRule: `${AUTH_RULE} && (id = @request.auth.id || @request.auth.isAdmin = true)`,
};

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
    // The collection already existed (e.g. from an earlier run of this
    // script, before its rules were tightened) — bring its rules up to
    // date too, instead of only ever setting them at creation time.
    await ensureRules(headers, name, rules);
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

const RULE_KEYS = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'];

/**
 * Brings an existing collection's API rules in line with `rules` (only the
 * keys present in `rules` are considered — omit a key to leave whatever
 * that rule is currently set to alone). Used both to retrofit a collection
 * that already existed under looser rules from an earlier run of this
 * script, and to (re-)apply rules to a collection this script doesn't
 * create itself, like the built-in `users` auth collection.
 */
async function ensureRules(headers, collectionName, rules) {
  if (!rules) return;

  const res = await pbFetch(`/api/collections/${collectionName}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to read collection '${collectionName}': ${res.status} — ${body}`);
  }
  const collection = await res.json();

  const patch = {};
  for (const key of RULE_KEYS) {
    if (key in rules && collection[key] !== rules[key]) {
      patch[key] = rules[key];
    }
  }

  if (Object.keys(patch).length === 0) {
    console.log(`  [skip]   ${collectionName} rules — already up to date`);
    return;
  }

  const patchRes = await pbFetch(`/api/collections/${collectionName}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patch),
  });
  if (!patchRes.ok) {
    const body = await patchRes.text();
    throw new Error(`Failed to update rules for '${collectionName}': ${patchRes.status} — ${body}`);
  }
  console.log(`  [update] ${collectionName} rules — ${Object.keys(patch).join(', ')}`);
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

  await ensureCollection(
    headers,
    'venues',
    [
      { name: 'name', type: 'text', required: true },
      { name: 'userId', type: 'text' },
      { name: 'equipment', type: 'json' },
      { name: 'layers', type: 'json' },
      { name: 'posts', type: 'json' },
      { name: 'mapUrl', type: 'text' },
      { name: 'sharedWith', type: 'json' },
      { name: 'isOrgVenue', type: 'bool' },
    ],
    {
      // Reading a venue stays open to any signed-in user (matches
      // firestore.rules — org-visibility scoping isn't implemented on
      // either backend). Only the creator or an admin may create/update/
      // delete one, so a random org member can't edit or delete someone
      // else's venue preset.
      listRule: AUTH_RULE,
      viewRule: AUTH_RULE,
      createRule: SELF_OWNED_CREATE_RULE,
      updateRule: OWNER_OR_ADMIN_RULE,
      deleteRule: OWNER_OR_ADMIN_RULE,
    },
  );

  // `isOrgVenue` on `venues` — set for deployments where this collection
  // already existed before the field was added above.
  await ensureField(headers, 'venues', { name: 'isOrgVenue', type: 'bool' });

  await ensureCollection(
    headers,
    'events',
    [
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
      { name: 'clinics', type: 'json' },
      { name: 'isOrgEvent', type: 'bool' },
      { name: 'ended', type: 'bool' },
      { name: 'endedAt', type: 'number' },
    ],
    {
      // Same reasoning as venues: read stays open, but update is
      // field-limited for anyone who isn't the owner or an admin — a
      // shared user or org-event member can dispatch (write ordinary
      // fields), but can't touch who owns/can see/can end the event. See
      // EVENT_UPDATE_RULE above (mirrors firestore.rules exactly).
      listRule: AUTH_RULE,
      viewRule: AUTH_RULE,
      createRule: SELF_OWNED_CREATE_RULE,
      updateRule: EVENT_UPDATE_RULE,
      deleteRule: OWNER_OR_ADMIN_RULE,
    },
  );

  // `clinics` on `events` — set for deployments where this collection
  // already existed before the field was added above.
  await ensureField(headers, 'events', { name: 'clinics', type: 'json' });

  // `isOrgEvent`/`ended`/`endedAt` on `events` — set for deployments where
  // this collection already existed before these fields were added above.
  // Without them, "Designate as org event" and "End Event" silently no-op:
  // PocketBase drops any field in an update request that isn't part of the
  // collection's schema, so the field never actually persists even though
  // the request itself succeeds.
  await ensureField(headers, 'events', { name: 'isOrgEvent', type: 'bool' });
  await ensureField(headers, 'events', { name: 'ended', type: 'bool' });
  await ensureField(headers, 'events', { name: 'endedAt', type: 'number' });

  await ensureCollection(
    headers,
    'dispatchLogs',
    [
      { name: 'eventId', type: 'text' },
      { name: 'userId', type: 'text' },
      { name: 'data', type: 'json' },
    ],
    {
      // Owner-scoped in both directions (matches firestore.rules) — these
      // are raw interaction logs, not something even a shared/org-event
      // dispatcher needs to read or write.
      listRule: OWNER_OR_ADMIN_RULE,
      viewRule: OWNER_OR_ADMIN_RULE,
      createRule: SELF_OWNED_CREATE_RULE,
      updateRule: OWNER_OR_ADMIN_RULE,
      deleteRule: OWNER_OR_ADMIN_RULE,
    },
  );

  // `userId` on `dispatchLogs` — set for deployments where this collection
  // already existed before the field was added above; the app's own query
  // for a user's dispatch logs (Profile > Security) filters on it.
  await ensureField(headers, 'dispatchLogs', { name: 'userId', type: 'text' });

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

  // `dispatchVocabularyPresetId` on `users` — stores the dispatcher's chosen
  // dispatch-language preset (see src/hooks/useDispatchVocabulary.ts). Without
  // this field, PocketBase silently drops it from update requests since it's
  // not in the users schema, which also triggers an authStore refresh (PocketBase
  // auto-syncs authStore on updates to the authenticated user's own record) that
  // immediately reloads the stale preset from the server and undoes the change.
  await ensureField(headers, 'users', { name: 'dispatchVocabularyPresetId', type: 'text' });

  // List/View/Update/Delete on `users` — applied automatically now (used to
  // be a manual admin-UI step, easy to forget on a fresh deployment). See
  // USERS_RULES above for what this closes off and why. Create is
  // deliberately left alone otherwise — PocketBase's own default already
  // allows public sign-up, which this app depends on.
  await ensureRules(headers, 'users', USERS_RULES);

  console.log('\nDone. CrowdCAD collections are ready, with owner/admin-scoped access rules applied automatically.');
  console.log(
    'This script re-applies those rules every time it runs, so a manual change to venues/events/dispatchLogs/users\n' +
      "rules in the admin UI (Collections > <name> > API Rules) will be reverted on the next run — that's by design,\n" +
      'so a deployment can never silently drift away from these guarantees. If you need different rules, this file\n' +
      '(scripts/setup-pocketbase.js) is the place to change them, not the admin UI.',
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
