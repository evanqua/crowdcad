import { dbService } from '@/lib/services';
import type { DispatchVocabularyPreset } from './types';

const COLLECTION = 'dispatchVocabularyPresets';

/** All shared custom presets, visible to every signed-in user (same flat/unfiltered pattern as org venues). */
export async function listCustomPresets(): Promise<DispatchVocabularyPreset[]> {
  const docs = await dbService.getCollection<DispatchVocabularyPreset>(COLLECTION);
  return docs.map((d) => ({ ...(d.data as DispatchVocabularyPreset), id: d.id }));
}

export async function getCustomPreset(id: string): Promise<DispatchVocabularyPreset | null> {
  const snap = await dbService.getDocument<DispatchVocabularyPreset>(COLLECTION, id);
  if (!snap.exists || !snap.data) return null;
  return { ...snap.data, id };
}

export async function createCustomPreset(input: {
  name: string;
  terms: Record<string, string>;
  createdBy: string;
  createdByName?: string;
  basedOn?: string;
}): Promise<string> {
  const payload: Omit<DispatchVocabularyPreset, 'id'> = {
    name: input.name,
    terms: input.terms,
    createdBy: input.createdBy,
    createdAt: Date.now(),
  };
  // Firestore rejects explicit `undefined` field values — only include optional fields when set.
  if (input.createdByName) payload.createdByName = input.createdByName;
  if (input.basedOn) payload.basedOn = input.basedOn;

  return dbService.addDocument<Omit<DispatchVocabularyPreset, 'id'>>(COLLECTION, payload);
}

export async function deleteCustomPreset(id: string): Promise<void> {
  await dbService.deleteDocument(COLLECTION, id);
}

export async function updateCustomPreset(id: string, terms: Record<string, string>): Promise<void> {
  await dbService.setDocument<DispatchVocabularyPreset>(COLLECTION, id, { terms }, { merge: true });
}
