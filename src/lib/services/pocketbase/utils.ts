import { ServiceError } from '../types';

/**
 * PocketBase answers a rejected write with a generic top-level message —
 * "Failed to create record." — and puts the actual reason under
 * `response.data`, keyed by field ("name: Cannot be blank.",
 * "mapUrl: Must be no more than 5000 character(s)."). Dropping that leaves the
 * caller with an error that says nothing about what to fix, so fold it into
 * the message.
 */
function withFieldDetails(message: string, data: unknown): string {
  if (!data || typeof data !== 'object') return message;
  const parts = Object.entries(data as Record<string, unknown>).map(([field, detail]) => {
    const text =
      detail && typeof detail === 'object' && 'message' in detail
        ? String((detail as { message: unknown }).message)
        : String(detail);
    return `${field}: ${text}`;
  });
  return parts.length ? `${message} (${parts.join('; ')})` : message;
}

/** Narrows the shape of a PocketBase HTTP error. */
type PbHttpError = { status: number; message: string; response?: { data?: unknown } };

/** Maps PocketBase HTTP errors to generic service error codes (DB / Storage). */
export function toPbServiceError(err: unknown): ServiceError {
  if (err && typeof err === 'object' && 'status' in err) {
    const pbErr = err as PbHttpError;
    const code =
      pbErr.status === 404 ? 'not-found' :
      pbErr.status === 403 ? 'permission-denied' :
      pbErr.status === 401 ? 'unauthenticated' :
      `pocketbase/${pbErr.status}`;
    return new ServiceError(code, withFieldDetails(pbErr.message, pbErr.response?.data));
  }
  if (err instanceof Error) return new ServiceError('unknown', err.message);
  return new ServiceError('unknown', String(err));
}

/** Maps PocketBase HTTP errors to auth-specific service error codes. */
export function toPbAuthError(err: unknown): ServiceError {
  if (err && typeof err === 'object' && 'status' in err) {
    const pbErr = err as PbHttpError;
    const code =
      pbErr.status === 400 ? 'auth/invalid-credential' :
      pbErr.status === 401 ? 'auth/wrong-password' :
      pbErr.status === 403 ? 'auth/user-disabled' :
      pbErr.status === 404 ? 'auth/user-not-found' :
      `pocketbase/${pbErr.status}`;
    return new ServiceError(code, withFieldDetails(pbErr.message, pbErr.response?.data));
  }
  if (err instanceof Error) return new ServiceError('unknown', err.message);
  return new ServiceError('unknown', String(err));
}
