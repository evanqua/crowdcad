import type { DispatchVocabularyPreset } from './types';

/**
 * Every mounted useDispatchVocabulary() instance does its own one-time fetch on mount
 * (there's no realtime Firestore subscription here). Components that live in a persistent
 * layout — AppNavbar, LiteNavbar — never remount on client-side navigation, so without this
 * bus they'd stay frozen at whatever preset was active when the app first loaded, even after
 * the user changes it elsewhere in the same session. Every mutation broadcasts here so every
 * other instance can update its own local state immediately, no refetch required.
 */
type VocabularyChange =
  | { type: 'selected'; presetId: string }
  | { type: 'created'; preset: DispatchVocabularyPreset }
  | { type: 'updated'; preset: DispatchVocabularyPreset }
  | { type: 'deleted'; id: string };

type Listener = (change: VocabularyChange) => void;

const listeners = new Set<Listener>();

export function subscribeToVocabularyChanges(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function broadcastVocabularyChange(change: VocabularyChange) {
  listeners.forEach((fn) => fn(change));
}
