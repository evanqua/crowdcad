import type { IAuthService } from './IAuthService';
import type { IDbService } from './IDbService';
import type { IStorageService } from './IStorageService';
import { FirebaseAuthService } from './firebase/FirebaseAuthService';
import { FirebaseDbService } from './firebase/FirebaseDbService';
import { FirebaseStorageService } from './firebase/FirebaseStorageService';
import { PocketbaseAuthService } from './pocketbase/PocketbaseAuthService';
import { PocketbaseDbService } from './pocketbase/PocketbaseDbService';
import { PocketbaseStorageService } from './pocketbase/PocketbaseStorageService';

// NEXT_PUBLIC_BACKEND is inlined at build time by Next.js, allowing the
// bundler to tree-shake the unused backend in production builds.
const backend = process.env.NEXT_PUBLIC_BACKEND ?? 'firebase';

export const authService: IAuthService =
  backend === 'pocketbase' ? new PocketbaseAuthService() : new FirebaseAuthService();

export const dbService: IDbService =
  backend === 'pocketbase' ? new PocketbaseDbService() : new FirebaseDbService();

export const storageService: IStorageService =
  backend === 'pocketbase' ? new PocketbaseStorageService() : new FirebaseStorageService();
