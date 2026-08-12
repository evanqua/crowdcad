import type { DispatchVocabularyPreset } from './types';

const PRESET_ID_KEY = 'ccad-dispatch-vocabulary-preset-id';
const LOCAL_PRESETS_KEY = 'ccad-dispatch-vocabulary-local-presets';

/** Fallback persistence for lite/unauthenticated mode, where there's no user doc to sync to. */
export function getLocalPresetId(): string | null {
  try {
    return localStorage.getItem(PRESET_ID_KEY);
  } catch {
    return null;
  }
}

export function setLocalPresetId(id: string) {
  try {
    localStorage.setItem(PRESET_ID_KEY, id);
  } catch {
    // localStorage unavailable — in-memory state still updates
  }
}

export function getLocalCustomPresets(): DispatchVocabularyPreset[] {
  try {
    const raw = localStorage.getItem(LOCAL_PRESETS_KEY);
    return raw ? (JSON.parse(raw) as DispatchVocabularyPreset[]) : [];
  } catch {
    return [];
  }
}

export function addLocalCustomPreset(preset: DispatchVocabularyPreset) {
  try {
    const existing = getLocalCustomPresets();
    localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify([...existing, preset]));
  } catch {
    // localStorage unavailable — preset only lives in memory this session
  }
}

export function deleteLocalCustomPreset(id: string) {
  try {
    const existing = getLocalCustomPresets();
    localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(existing.filter((p) => p.id !== id)));
  } catch {
    // localStorage unavailable — nothing to clean up
  }
}
