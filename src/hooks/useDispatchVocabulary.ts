'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useauth';
import { dbService } from '@/lib/services';
import type { UserDoc } from '@/lib/userDoc';
import {
  BUILTIN_PRESETS,
  DEFAULT_PRESET_ID,
  FRENCH_PRESET_ID,
  isBuiltinPresetId,
  type DispatchVocabularyPresetSummary,
} from '@/lib/dispatchVocabulary/presets';
import type { DispatchVocabularyPreset } from '@/lib/dispatchVocabulary/types';
import {
  createCustomPreset,
  deleteCustomPreset,
  listCustomPresets,
} from '@/lib/dispatchVocabulary/presetsService';
import {
  addLocalCustomPreset,
  deleteLocalCustomPreset,
  getLocalCustomPresets,
  getLocalPresetId,
  setLocalPresetId,
} from '@/lib/dispatchVocabulary/localStore';

export function useDispatchVocabulary() {
  const { user } = useAuth();
  const [presetId, setPresetIdState] = useState<string>(DEFAULT_PRESET_ID);
  const [customPresets, setCustomPresets] = useState<DispatchVocabularyPreset[]>([]);
  const [loading, setLoading] = useState(true);

  // Shared custom presets — visible to every signed-in user, same as org venues.
  useEffect(() => {
    if (!user) {
      setCustomPresets(getLocalCustomPresets());
      return;
    }
    let cancelled = false;
    listCustomPresets()
      .then((presets) => {
        if (!cancelled) setCustomPresets(presets);
      })
      .catch(() => {
        // Collection may not exist yet on this backend — fall back to built-ins only.
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // The signed-in user's chosen preset id (or the lite-mode localStorage fallback).
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        if (user) {
          const snap = await dbService.getDocument<UserDoc>('users', user.uid);
          const id = snap.data?.dispatchVocabularyPresetId;
          if (!cancelled) setPresetIdState(id || DEFAULT_PRESET_ID);
        } else {
          const stored = getLocalPresetId();
          if (!cancelled) setPresetIdState(stored || DEFAULT_PRESET_ID);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setActivePresetId = useCallback(
    async (id: string) => {
      setPresetIdState(id);
      if (user) {
        await dbService.setDocument<UserDoc>(
          'users',
          user.uid,
          { dispatchVocabularyPresetId: id },
          { merge: true },
        );
      } else {
        setLocalPresetId(id);
      }
    },
    [user],
  );

  /** Forks a new named preset from a full term map and switches to it. Never mutates an existing preset. */
  const forkPreset = useCallback(
    async (name: string, terms: Record<string, string>, basedOn?: string) => {
      if (user) {
        const id = await createCustomPreset({
          name,
          terms,
          createdBy: user.uid,
          createdByName: user.displayName || user.email || undefined,
          basedOn,
        });
        const preset: DispatchVocabularyPreset = {
          id,
          name,
          terms,
          createdBy: user.uid,
          createdByName: user.displayName || user.email || undefined,
          basedOn,
          createdAt: Date.now(),
        };
        setCustomPresets((prev) => [...prev, preset]);
        await setActivePresetId(id);
        return id;
      }

      // Lite/unauthenticated mode: no org to share with, keep it local to this browser.
      const preset: DispatchVocabularyPreset = {
        id: `local-${Date.now()}`,
        name,
        terms,
        createdBy: 'local',
        basedOn,
        createdAt: Date.now(),
      };
      addLocalCustomPreset(preset);
      setCustomPresets((prev) => [...prev, preset]);
      await setActivePresetId(preset.id);
      return preset.id;
    },
    [user, setActivePresetId],
  );

  /** Deletes a custom preset the current user created. Built-ins and other users' presets are refused. */
  const deletePreset = useCallback(
    async (id: string) => {
      if (isBuiltinPresetId(id)) return;
      const preset = customPresets.find((p) => p.id === id);
      if (!preset) return;
      const owner = user ? user.uid : 'local';
      if (preset.createdBy !== owner) return;

      if (user) {
        await deleteCustomPreset(id);
      } else {
        deleteLocalCustomPreset(id);
      }
      setCustomPresets((prev) => prev.filter((p) => p.id !== id));
      if (presetId === id) {
        await setActivePresetId(DEFAULT_PRESET_ID);
      }
    },
    [user, customPresets, presetId, setActivePresetId],
  );

  const availablePresets: DispatchVocabularyPresetSummary[] = useMemo(
    () => [BUILTIN_PRESETS[DEFAULT_PRESET_ID], BUILTIN_PRESETS[FRENCH_PRESET_ID], ...customPresets],
    [customPresets],
  );

  const activePreset: DispatchVocabularyPresetSummary = useMemo(() => {
    if (isBuiltinPresetId(presetId)) return BUILTIN_PRESETS[presetId];
    return (
      customPresets.find((p) => p.id === presetId) ?? BUILTIN_PRESETS[DEFAULT_PRESET_ID]
    );
  }, [presetId, customPresets]);

  return {
    presetId,
    activePreset,
    availablePresets,
    customPresets,
    setActivePresetId,
    forkPreset,
    deletePreset,
    loading,
  };
}
