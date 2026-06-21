import { pb } from './client';
import type { IAuthService } from '../IAuthService';
import type { ServiceUser, Unsubscribe } from '../types';
import { ServiceError } from '../types';
import { toPbAuthError as toServiceError } from './utils';

function toServiceUser(model: Record<string, unknown>): ServiceUser {
  return {
    uid: model.id as string,
    email: (model.email as string) ?? null,
    displayName: (model.name as string) ?? null,
    photoURL: model.avatar
      ? `${pb.baseURL}/api/files/_pb_users_auth_/${model.id}/${model.avatar}`
      : null,
    phoneNumber: (model.phone as string) ?? null,
  };
}


export class PocketbaseAuthService implements IAuthService {
  get currentUser(): ServiceUser | null {
    if (!pb.authStore.isValid || !pb.authStore.model) return null;
    return toServiceUser(pb.authStore.model as Record<string, unknown>);
  }

  async signIn(email: string, password: string): Promise<ServiceUser> {
    try {
      const auth = await pb.collection('users').authWithPassword(email, password);
      return toServiceUser(auth.record as unknown as Record<string, unknown>);
    } catch (err) {
      throw toServiceError(err);
    }
  }

  async signUp(email: string, password: string): Promise<ServiceUser> {
    try {
      await pb.collection('users').create({
        email,
        password,
        passwordConfirm: password,
      });
      const auth = await pb.collection('users').authWithPassword(email, password);
      return toServiceUser(auth.record as unknown as Record<string, unknown>);
    } catch (err) {
      throw toServiceError(err);
    }
  }

  async signOut(): Promise<void> {
    pb.authStore.clear();
  }

  onAuthStateChanged(callback: (user: ServiceUser | null) => void): Unsubscribe {
    // Fire immediately with current state
    callback(this.currentUser);

    // PocketBase fires onChange when token/model changes
    const unsubscribe = pb.authStore.onChange(() => {
      callback(this.currentUser);
    });

    return unsubscribe;
  }

  async updateProfile(updates: {
    displayName?: string | null;
    photoURL?: string | null;
  }): Promise<void> {
    if (!pb.authStore.isValid || !pb.authStore.model) {
      throw new ServiceError('auth/no-current-user', 'No user is signed in.');
    }
    const userId = (pb.authStore.model as Record<string, unknown>).id as string;
    if (updates.photoURL !== undefined) {
      throw new ServiceError(
        'not-supported',
        'PocketBase adapter does not support URL-based photoURL updates. Upload an avatar file directly via the PocketBase API instead.',
      );
    }
    const data: Record<string, unknown> = {};
    if (updates.displayName !== undefined) data.name = updates.displayName;
    try {
      await pb.collection('users').update(userId, data);
      await pb.collection('users').authRefresh();
    } catch (err) {
      throw toServiceError(err);
    }
  }

  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (!pb.authStore.isValid || !pb.authStore.model) {
      throw new ServiceError('auth/no-current-user', 'No user is signed in.');
    }
    const userId = (pb.authStore.model as Record<string, unknown>).id as string;
    try {
      await pb.collection('users').update(userId, {
        oldPassword: currentPassword,
        password: newPassword,
        passwordConfirm: newPassword,
      });
    } catch (err) {
      throw toServiceError(err);
    }
  }

  async deleteCurrentUser(password: string): Promise<void> {
    if (!pb.authStore.isValid || !pb.authStore.model) {
      throw new ServiceError('auth/no-current-user', 'No user is signed in.');
    }
    const email = (pb.authStore.model as Record<string, unknown>).email as string;
    const userId = (pb.authStore.model as Record<string, unknown>).id as string;
    try {
      // Re-authenticate to confirm identity
      await pb.collection('users').authWithPassword(email, password);
      await pb.collection('users').delete(userId);
      pb.authStore.clear();
    } catch (err) {
      throw toServiceError(err);
    }
  }
}
