import PocketBase from 'pocketbase';

const url = process.env.NEXT_PUBLIC_POCKETBASE_URL;

if (!url && typeof window !== 'undefined') {
  console.warn(
    'NEXT_PUBLIC_POCKETBASE_URL is not set. ' +
    'Set it to your PocketBase server URL (e.g. http://192.168.x.x:8090).',
  );
}

// Module-level singleton — safe for Next.js client-side module caching.
export const pb = new PocketBase(url ?? 'http://127.0.0.1:8090');

// Disable auto-cancellation so subscriptions are not cancelled on navigation.
pb.autoCancellation(false);
