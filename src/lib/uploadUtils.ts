import { getDownloadURL, uploadBytes, type StorageReference } from 'firebase/storage';

export const uploadWithRetry = async (
  storageRef: StorageReference,
  file: File,
  maxRetries = 3,
  baseDelay = 1200
): Promise<string> => {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    } catch (err: unknown) {
      lastError = err;
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? (err as { code?: unknown }).code
          : undefined;

      const isRetryable =
        code === 'storage/retry-limit-exceeded' ||
        code === 'storage/unknown';

      if (attempt < maxRetries - 1 && isRetryable) {
        const wait = baseDelay * Math.pow(2, attempt);
        await new Promise((res) => setTimeout(res, wait));
        continue;
      }

      throw err;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error('Max retries exceeded');
};
