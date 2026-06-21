import { pb } from './client';
import type { IStorageService } from '../IStorageService';
import { ServiceError } from '../types';
import { toPbServiceError } from './utils';

/**
 * PocketBase storage adapter.
 *
 * Files are stored in a dedicated `_storage` collection with two fields:
 *   - path  (text, unique index) — the logical path used by the app
 *   - file  (file field)         — the uploaded binary
 *
 * Create this collection in PocketBase Admin → Collections → New collection
 * named `_storage` with fields `path` (text, required, unique) and `file` (file).
 */

export class PocketbaseStorageService implements IStorageService {
  async uploadFile(path: string, file: File): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('path', path);
      formData.append('file', file);

      let id: string | null = null;
      try {
        const existing = await pb.collection('_storage').getFirstListItem(pb.filter('path = {:path}', { path }));
        id = (existing as unknown as Record<string, unknown>).id as string;
      } catch (findErr) {
        const sErr = toPbServiceError(findErr);
        if (sErr.code !== 'not-found') throw sErr;
      }

      const record = id
        ? await pb.collection('_storage').update(id, formData)
        : await pb.collection('_storage').create(formData);

      return this._buildUrl(record as unknown as Record<string, unknown>);
    } catch (err) {
      if (err instanceof ServiceError) throw err;
      throw toPbServiceError(err);
    }
  }

  async getDownloadURL(path: string): Promise<string> {
    try {
      const record = await pb.collection('_storage').getFirstListItem(pb.filter('path = {:path}', { path }));
      return this._buildUrl(record as unknown as Record<string, unknown>);
    } catch (err) {
      const sErr = toPbServiceError(err);
      if (sErr.code === 'not-found') throw new ServiceError('not-found', `No file found at path: ${path}`);
      throw sErr;
    }
  }

  private _buildUrl(record: Record<string, unknown>): string {
    const id = record.id as string;
    const filename = record.file as string;
    return `${pb.baseURL}/api/files/_storage/${id}/${filename}`;
  }
}
