/** Shape of a document in the `users` collection (keyed by uid), as read/written ad hoc across the app. */
export interface UserDoc {
  email?: string | null;
  displayName?: string | null;
  phoneNumber?: string | null;
  lastPasswordChange?: unknown;
  isAdmin?: boolean;
  /** Built-in preset id ('crowdcad-default' | 'crowdcad-french') or a dispatchVocabularyPresets doc id. */
  dispatchVocabularyPresetId?: string;
}
