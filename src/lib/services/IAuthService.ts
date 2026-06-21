import type { ServiceUser, Unsubscribe } from './types';

export interface IAuthService {
  signIn(email: string, password: string): Promise<ServiceUser>;
  signUp(email: string, password: string): Promise<ServiceUser>;
  signOut(): Promise<void>;

  /** Subscribe to auth state changes. Fires immediately with the current user. */
  onAuthStateChanged(callback: (user: ServiceUser | null) => void): Unsubscribe;

  /**
   * Update display name and/or photo URL for the current user.
   * Note: `photoURL` support is backend-dependent. The PocketBase adapter
   * stores avatars as uploaded files and does not support URL-based photoURL
   * updates — passing `photoURL` on that backend throws `ServiceError('not-supported', ...)`.
   */
  updateProfile(updates: { displayName?: string | null; photoURL?: string | null }): Promise<void>;

  /** Re-authenticates with currentPassword before setting the new one. */
  updatePassword(currentPassword: string, newPassword: string): Promise<void>;

  /** Re-authenticates with password before permanently deleting the account. */
  deleteCurrentUser(password: string): Promise<void>;

  /** Synchronous access to the current user (null if not signed in or not yet resolved). */
  readonly currentUser: ServiceUser | null;
}
