import { FirebaseError } from 'firebase/app';
import { ServiceError } from '../types';

export function toFirebaseServiceError(err: unknown): ServiceError {
  if (err instanceof FirebaseError) {
    return new ServiceError(err.code, err.message);
  }
  if (err instanceof Error) {
    return new ServiceError('unknown', err.message);
  }
  return new ServiceError('unknown', String(err));
}
