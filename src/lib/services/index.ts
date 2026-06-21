// The single import point for all backend service access.
// Usage: import { authService, dbService, storageService, arrayUnion, arrayRemove } from '@/lib/services';

export { authService, dbService, storageService } from './factory';

export {
  arrayUnion,
  arrayRemove,
  isArrayUnion,
  isArrayRemove,
  ServiceError,
} from './types';

export type {
  ServiceUser,
  DocSnapshot,
  QueryConstraint,
  WhereOperator,
  FieldValue,
  ArrayUnionValue,
  ArrayRemoveValue,
  Unsubscribe,
  TransactionContext,
} from './types';

export type { IAuthService } from './IAuthService';
export type { IDbService } from './IDbService';
export type { IStorageService } from './IStorageService';
