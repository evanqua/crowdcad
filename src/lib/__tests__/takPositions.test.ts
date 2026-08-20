import { describe, expect, it } from 'vitest';

import { classifySubscriptionError } from '@/hooks/useTakPositions';
import { ServiceError } from '@/lib/services';

// Both backend adapters normalise their native errors into a ServiceError
// before calling the subscription's onError callback (see
// lib/services/firebase/utils.ts and lib/services/pocketbase/utils.ts), so
// these are the actual shapes classifySubscriptionError has to handle — not
// raw FirebaseError / PocketBase ClientResponseError instances.

describe('classifySubscriptionError', () => {
  it('PocketBase: maps HTTP 403 to permission-denied', () => {
    const result = classifySubscriptionError(new ServiceError('permission-denied', 'Forbidden.'));
    expect(result).toEqual({ kind: 'permission-denied', message: 'Forbidden.' });
  });

  it('PocketBase: maps HTTP 404 to the benign null case (missing collection)', () => {
    const result = classifySubscriptionError(new ServiceError('not-found', 'Not found.'));
    expect(result).toBeNull();
  });

  it('PocketBase: maps HTTP 401 to permission-denied', () => {
    const result = classifySubscriptionError(
      new ServiceError('unauthenticated', 'The request requires valid record authorization token.'),
    );
    expect(result?.kind).toBe('permission-denied');
  });

  it('PocketBase: maps status 0 (dropped connection) to unavailable', () => {
    const result = classifySubscriptionError(new ServiceError('pocketbase/0', 'Failed to fetch.'));
    expect(result?.kind).toBe('unavailable');
  });

  it('PocketBase: maps a 5xx status to unavailable', () => {
    const result = classifySubscriptionError(new ServiceError('pocketbase/500', 'Internal server error.'));
    expect(result?.kind).toBe('unavailable');
  });

  it('PocketBase: maps an unrecognised non-5xx status to unknown', () => {
    const result = classifySubscriptionError(new ServiceError('pocketbase/418', "I'm a teapot."));
    expect(result?.kind).toBe('unknown');
  });

  it("Firebase: maps the 'permission-denied' code to permission-denied", () => {
    const result = classifySubscriptionError(
      new ServiceError('permission-denied', 'Missing or insufficient permissions.'),
    );
    expect(result).toEqual({
      kind: 'permission-denied',
      message: 'Missing or insufficient permissions.',
    });
  });

  it("Firebase: maps the 'not-found' code to the benign null case", () => {
    expect(classifySubscriptionError(new ServiceError('not-found', 'No document to update.'))).toBeNull();
  });

  it("Firebase: maps the 'unavailable' code to unavailable (network/transport)", () => {
    const result = classifySubscriptionError(
      new ServiceError('unavailable', 'The service is currently unavailable.'),
    );
    expect(result?.kind).toBe('unavailable');
  });

  it('falls back to unknown for a plain Error with no recognised code', () => {
    const result = classifySubscriptionError(new Error('something unexpected happened'));
    expect(result).toEqual({ kind: 'unknown', message: 'something unexpected happened' });
  });

  it('falls back to unknown for a non-Error, non-object value', () => {
    const result = classifySubscriptionError('boom');
    expect(result).toEqual({ kind: 'unknown', message: 'boom' });
  });
});
