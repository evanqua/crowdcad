import type { ServiceUser, Unsubscribe } from './types';

export interface IAuthService {
  signIn(email: string, password: string): Promise<ServiceUser>;
  signUp(email: string, password: string): Promise<ServiceUser>;
  signOut(): Promise<void>;

  /** Subscribe to auth state changes. Fires immediately with the current user. */
  onAuthStateChanged(callback: (user: ServiceUser | null) => void): Unsubscribe;

  /** Update display name for the current user. */
  updateProfile(updates: { displayName?: string | null }): Promise<void>;

  /** Re-authenticates with currentPassword before setting the new one. */
  updatePassword(currentPassword: string, newPassword: string): Promise<void>;

  /** Re-authenticates with password before permanently deleting the account. */
  deleteCurrentUser(password: string): Promise<void>;

  /**
   * Sends a password-reset email for an account that's locked out (doesn't
   * know its current password). `actionUrl` (Firebase only) is where the
   * reset link in the email points back into this app; PocketBase's link
   * destination is controlled by its own email template instead.
   */
  sendPasswordResetEmail(email: string, actionUrl?: string): Promise<void>;

  /** Completes a password reset using the code/token pulled from the reset-link URL. */
  confirmPasswordReset(code: string, newPassword: string): Promise<void>;

  /** Synchronous access to the current user (null if not signed in or not yet resolved). */
  readonly currentUser: ServiceUser | null;
}
