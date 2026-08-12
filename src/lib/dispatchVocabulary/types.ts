/** A user-forked, org-shared dispatch vocabulary preset (stored in the `dispatchVocabularyPresets` collection). */
export interface DispatchVocabularyPreset {
  id: string;
  name: string;
  /** Full term map (a fork copies the whole map, not a diff). */
  terms: Record<string, string>;
  createdBy: string;
  createdByName?: string;
  /** Preset id (built-in or custom) this was forked from. */
  basedOn?: string;
  createdAt: number;
}
