import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  onSnapshot,
  runTransaction as firebaseRunTransaction,
  arrayUnion as firebaseArrayUnion,
  arrayRemove as firebaseArrayRemove,
} from 'firebase/firestore';
import { db } from '@/app/firebase';
import type { IDbService } from '../IDbService';
import type { DocSnapshot, QueryConstraint, TransactionContext, Unsubscribe } from '../types';
import { isArrayUnion, isArrayRemove } from '../types';
import { toFirebaseServiceError as toServiceError } from './utils';

/** Translate FieldValue sentinels to Firebase SDK values. Recurses into plain objects. */
function resolveFieldValues(data: Record<string, unknown>): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isArrayUnion(value)) {
      resolved[key] = firebaseArrayUnion(...value.items);
    } else if (isArrayRemove(value)) {
      resolved[key] = firebaseArrayRemove(...value.items);
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

export class FirebaseDbService implements IDbService {
  async getDocument<T>(col: string, id: string): Promise<DocSnapshot<T>> {
    try {
      const snap = await getDoc(doc(db, col, id));
      return { id: snap.id, exists: snap.exists(), data: snap.exists() ? (snap.data() as T) : null };
    } catch (err) {
      throw toServiceError(err);
    }
  }

  async getCollection<T>(col: string): Promise<DocSnapshot<T>[]> {
    try {
      const snap = await getDocs(collection(db, col));
      return snap.docs.map((d) => ({ id: d.id, exists: true, data: d.data() as T }));
    } catch (err) {
      throw toServiceError(err);
    }
  }

  async queryCollection<T>(col: string, constraints: QueryConstraint[]): Promise<DocSnapshot<T>[]> {
    try {
      const q = query(
        collection(db, col),
        ...constraints.map((c) => where(c.field, c.op, c.value)),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, exists: true, data: d.data() as T }));
    } catch (err) {
      throw toServiceError(err);
    }
  }

  async addDocument<T>(col: string, data: T): Promise<string> {
    try {
      const ref = await addDoc(collection(db, col), data as Record<string, unknown>);
      return ref.id;
    } catch (err) {
      throw toServiceError(err);
    }
  }

  async setDocument<T>(
    col: string,
    id: string,
    data: Partial<T>,
    options?: { merge?: boolean },
  ): Promise<void> {
    try {
      await setDoc(doc(db, col, id), data as Record<string, unknown>, options ?? {});
    } catch (err) {
      throw toServiceError(err);
    }
  }

  async updateDocument(col: string, id: string, data: Record<string, unknown>): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateDoc(doc(db, col, id), resolveFieldValues(data) as any);
    } catch (err) {
      throw toServiceError(err);
    }
  }

  async deleteDocument(col: string, id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, col, id));
    } catch (err) {
      throw toServiceError(err);
    }
  }

  async runTransaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    try {
      return await firebaseRunTransaction(db, async (firestoreTx) => {
        const ctx: TransactionContext = {
          async get<U>(col: string, id: string): Promise<DocSnapshot<U>> {
            const ref = doc(db, col, id);
            const snap = await firestoreTx.get(ref);
            return {
              id: snap.id,
              exists: snap.exists(),
              data: snap.exists() ? (snap.data() as U) : null,
            };
          },
          set<U>(col: string, id: string, data: Partial<U>) {
            firestoreTx.set(doc(db, col, id), data as Record<string, unknown>);
          },
          update<U>(col: string, id: string, data: Partial<U>) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            firestoreTx.update(doc(db, col, id), data as any);
          },
          delete(col: string, id: string) {
            firestoreTx.delete(doc(db, col, id));
          },
        };
        return fn(ctx);
      });
    } catch (err) {
      throw toServiceError(err);
    }
  }

  subscribeToDocument<T>(
    col: string,
    id: string,
    callback: (snapshot: DocSnapshot<T>) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      doc(db, col, id),
      (snap) => {
        callback({ id: snap.id, exists: snap.exists(), data: snap.exists() ? (snap.data() as T) : null });
      },
      (err) => onError?.(toServiceError(err)),
    );
  }

  subscribeToQuery<T>(
    col: string,
    constraints: QueryConstraint[],
    callback: (snapshots: DocSnapshot<T>[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    const q = query(
      collection(db, col),
      ...constraints.map((c) => where(c.field, c.op, c.value)),
    );
    return onSnapshot(
      q,
      (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, exists: true, data: d.data() as T })));
      },
      (err) => onError?.(toServiceError(err)),
    );
  }
}
