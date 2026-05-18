/**
 * Shared types for the backend service abstraction layer.
 * All adapters (Firebase, PocketBase) use these types at their boundaries.
 */

export interface ServiceUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
}

export type Unsubscribe = () => void;

export interface DocSnapshot<T = Record<string, unknown>> {
  id: string;
  exists: boolean;
  data: T | null;
}

export type WhereOperator = '==' | '!=' | 'array-contains';

export interface QueryConstraint {
  field: string;
  op: WhereOperator;
  value: unknown;
}

// ────────────────────────────────────────────────────────────────
// FieldValue sentinels
// Call-sites use arrayUnion/arrayRemove from '@/lib/services'
// instead of importing from 'firebase/firestore'. Each adapter
// translates these sentinels to its own backend-native equivalent.
// ────────────────────────────────────────────────────────────────

export interface ArrayUnionValue {
  readonly __type: 'array-union';
  readonly items: unknown[];
}

export interface ArrayRemoveValue {
  readonly __type: 'array-remove';
  readonly items: unknown[];
}

export type FieldValue = ArrayUnionValue | ArrayRemoveValue;

export function arrayUnion(...items: unknown[]): ArrayUnionValue {
  return { __type: 'array-union', items };
}

export function arrayRemove(...items: unknown[]): ArrayRemoveValue {
  return { __type: 'array-remove', items };
}

export function isArrayUnion(v: unknown): v is ArrayUnionValue {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as ArrayUnionValue).__type === 'array-union'
  );
}

export function isArrayRemove(v: unknown): v is ArrayRemoveValue {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as ArrayRemoveValue).__type === 'array-remove'
  );
}

// ────────────────────────────────────────────────────────────────
// Error type
// ────────────────────────────────────────────────────────────────

export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// ────────────────────────────────────────────────────────────────
// Transaction context
// ────────────────────────────────────────────────────────────────

export interface TransactionContext {
  get<T>(collection: string, id: string): Promise<DocSnapshot<T>>;
  set<T>(collection: string, id: string, data: Partial<T>): void;
  update<T>(collection: string, id: string, data: Partial<T>): void;
  delete(collection: string, id: string): void;
}
