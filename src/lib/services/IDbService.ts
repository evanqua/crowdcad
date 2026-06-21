import type { DocSnapshot, QueryConstraint, TransactionContext, Unsubscribe } from './types';

export interface IDbService {
  // ── Single document reads ──────────────────────────────────
  getDocument<T>(collection: string, id: string): Promise<DocSnapshot<T>>;

  // ── Collection reads ───────────────────────────────────────
  getCollection<T>(collection: string): Promise<DocSnapshot<T>[]>;
  queryCollection<T>(
    collection: string,
    constraints: QueryConstraint[],
  ): Promise<DocSnapshot<T>[]>;

  // ── Writes ─────────────────────────────────────────────────
  /** Add a new document with an auto-generated ID. Returns the new ID. */
  addDocument<T>(collection: string, data: T): Promise<string>;

  /** Create or overwrite a document by ID. Pass `{ merge: true }` to merge instead of overwrite. */
  setDocument<T>(
    collection: string,
    id: string,
    data: Partial<T>,
    options?: { merge?: boolean },
  ): Promise<void>;

  /**
   * Partially update a document. Values may include FieldValue sentinels
   * (arrayUnion / arrayRemove) which each adapter translates natively.
   */
  updateDocument(
    collection: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void>;

  deleteDocument(collection: string, id: string): Promise<void>;

  // ── Atomic update ──────────────────────────────────────────
  /**
   * Atomic read-modify-write. The callback receives a TransactionContext;
   * reads are awaited, writes are collected and committed together.
   * Adapters that lack native transaction support implement this as a
   * sequential read-modify-write (with known non-atomicity).
   */
  runTransaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;

  // ── Real-time subscriptions ────────────────────────────────
  subscribeToDocument<T>(
    collection: string,
    id: string,
    callback: (snapshot: DocSnapshot<T>) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe;

  subscribeToQuery<T>(
    collection: string,
    constraints: QueryConstraint[],
    callback: (snapshots: DocSnapshot<T>[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe;
}
