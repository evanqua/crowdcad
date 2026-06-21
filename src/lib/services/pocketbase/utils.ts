import { ServiceError } from '../types';

/** Maps PocketBase HTTP errors to generic service error codes (DB / Storage). */
export function toPbServiceError(err: unknown): ServiceError {
  if (err && typeof err === 'object' && 'status' in err) {
    const pbErr = err as { status: number; message: string };
    const code =
      pbErr.status === 404 ? 'not-found' :
      pbErr.status === 403 ? 'permission-denied' :
      pbErr.status === 401 ? 'unauthenticated' :
      `pocketbase/${pbErr.status}`;
    return new ServiceError(code, pbErr.message);
  }
  if (err instanceof Error) return new ServiceError('unknown', err.message);
  return new ServiceError('unknown', String(err));
}

/** Maps PocketBase HTTP errors to auth-specific service error codes. */
export function toPbAuthError(err: unknown): ServiceError {
  if (err && typeof err === 'object' && 'status' in err) {
    const pbErr = err as { status: number; message: string };
    const code =
      pbErr.status === 400 ? 'auth/invalid-credential' :
      pbErr.status === 401 ? 'auth/wrong-password' :
      pbErr.status === 403 ? 'auth/user-disabled' :
      pbErr.status === 404 ? 'auth/user-not-found' :
      `pocketbase/${pbErr.status}`;
    return new ServiceError(code, pbErr.message);
  }
  if (err instanceof Error) return new ServiceError('unknown', err.message);
  return new ServiceError('unknown', String(err));
}
