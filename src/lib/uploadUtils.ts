import { storageService } from '@/lib/services';

// Retry with backoff is already implemented inside storageService.uploadFile
// (per-backend), so this just forwards to it rather than duplicating that logic.
export const uploadWithRetry = (path: string, file: File): Promise<string> => {
  return storageService.uploadFile(path, file);
};
