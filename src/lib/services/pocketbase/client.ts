type PocketBaseClient = {
  baseURL: string;
  autoCancellation: (enabled: boolean) => void;
  filter: (expression: string, params?: Record<string, unknown>) => string;
  authStore: {
    isValid: boolean;
    model: unknown | null;
    clear: () => void;
    onChange: (callback: () => void) => () => void;
  };
  collection: (name: string) => any;
};

function createPocketBaseClient(): PocketBaseClient {
  const backend = process.env.NEXT_PUBLIC_BACKEND ?? 'firebase';
  const url = process.env.NEXT_PUBLIC_POCKETBASE_URL;

  if (backend !== 'pocketbase') {
    throw new Error('PocketBase client requested while NEXT_PUBLIC_BACKEND is not set to pocketbase.');
  }

  if (!url && typeof window !== 'undefined') {
    console.warn(
      'NEXT_PUBLIC_POCKETBASE_URL is not set. ' +
      'Set it to your PocketBase server URL (e.g. http://192.168.x.x:8090).',
    );
  }

  // Avoid a static import so Firebase-only builds do not need the package installed.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const requireFn = typeof window !== 'undefined'
    ? (0, eval)('require') as ((id: string) => unknown)
    : (0, eval)('require') as ((id: string) => unknown);

  const PocketBase = requireFn('pocketbase') as new (baseUrl: string) => PocketBaseClient;
  const client = new PocketBase(url ?? 'http://127.0.0.1:8090');
  client.autoCancellation(false);
  return client;
}

// Module-level singleton — safe for Next.js client-side module caching.
export const pb = (() => {
  try {
    return createPocketBaseClient();
  } catch {
    // Firebase is the default backend. Keep PocketBase optional by returning
    // a lazy-throwing proxy that only fails if a PocketBase path is used.
    return new Proxy({} as PocketBaseClient, {
      get() {
        throw new Error('PocketBase backend is not enabled. Set NEXT_PUBLIC_BACKEND=pocketbase to use it.');
      },
    });
  }
})();
