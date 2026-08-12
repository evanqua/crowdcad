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
  return dbService.addDocument<Omit<DispatchVocabularyPreset, 'id'>>(COLLECTION, {
    name: input.name,
    terms: input.terms,
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    basedOn: input.basedOn,
    createdAt: Date.now(),
  });
}
