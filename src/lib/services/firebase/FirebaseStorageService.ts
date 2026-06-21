import { getStorage, ref, uploadBytes, getDownloadURL as firebaseGetDownloadURL } from 'firebase/storage';
import { FirebaseError } from 'firebase/app';
import type { IStorageService } from '../IStorageService';
import { ServiceError } from '../types';

function toServiceError(err: unknown): ServiceError {
  if (err instanceof FirebaseError) {
    return new ServiceError(err.code, err.message);
  }
  if (err instanceof Error) {
    return new ServiceError('unknown', err.message);
  }
  return new ServiceError('unknown', String(err));
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class FirebaseStorageService implements IStorageService {
  private get storage() {
    return getStorage();
  }

  async uploadFile(path: string, file: File): Promise<string> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const storageRef = ref(this.storage, path);
        await uploadBytes(storageRef, file);
        return await firebaseGetDownloadURL(storageRef);
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
        }
      }
    }
    throw toServiceError(lastErr);
  }

  async getDownloadURL(path: string): Promise<string> {
    try {
      const storageRef = ref(this.storage, path);
      return await firebaseGetDownloadURL(storageRef);
    } catch (err) {
      throw toServiceError(err);
    }
  }
}
