'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardBody, Select, SelectItem, Input, Button } from '@heroui/react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useauth';
import { useDispatchVocabulary } from '@/hooks/useDispatchVocabulary';
import {
  DISPATCH_TERMS,
  DISPATCH_TERM_CATEGORY_LABELS,
  type DispatchTermCategory,
} from '@/lib/dispatchVocabulary/terms';

const inputClassNames = {
  label: 'text-surface-light/70 mb-1 text-xs',
  inputWrapper: 'rounded-xl px-3 h-10 hover:bg-surface-deep',
  input: 'text-surface-light text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
} as const;

const selectClassNames = {
  label: 'text-surface-light mb-1',
  trigger:
    'rounded-2xl px-4 border border-surface-liner bg-transparent hover:bg-surface-deep data-[focus=true]:outline-none',
  value: 'text-surface-light',
  popover: 'bg-surface-deepest border border-surface-liner rounded-2xl',
  listbox: 'p-1 [&_[data-hover=true]]:bg-surface-deep [&_[data-selected=true]]:bg-surface-deep',
} as const;

const CATEGORY_ORDER: DispatchTermCategory[] = [
  'entities',
  'callStatuses',
  'teamStatuses',
  'equipment',
  'clinicOutcomes',
  'actions',
];

export default function LanguageSection() {
  const { user } = useAuth();
  const {
    activePreset,
    availablePresets,
    customPresets,
    setActivePresetId,
    forkPreset,
    deletePreset,
    loading,
  } = useDispatchVocabulary();
  const ownerId = user ? user.uid : 'local';

  const [draftTerms, setDraftTerms] = useState<Record<string, string>>(activePreset.terms);
  const [editing, setEditing] = useState(false);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [creatingNew, setCreatingNew] = useState(false);
  const [newPresetBaseId, setNewPresetBaseId] = useState(activePreset.id);
  const [newPresetName, setNewPresetName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sync the draft whenever the selected preset changes (switching presets discards
  // any unsaved edits — editing always forks a new preset rather than mutating one).
  useEffect(() => {
    setDraftTerms(activePreset.terms);
  }, [activePreset]);

  const dirty = useMemo(
    () => DISPATCH_TERMS.some((t) => draftTerms[t.key] !== activePreset.terms[t.key]),
    [draftTerms, activePreset],
  );

  const termsByCategory = useMemo(() => {
    const grouped = new Map<DispatchTermCategory, typeof DISPATCH_TERMS>();
    for (const term of DISPATCH_TERMS) {
      const list = grouped.get(term.category) ?? [];
      list.push(term);
      grouped.set(term.category, list);
    }
    return grouped;
  }, []);

  const handleSaveAsNewPreset = async () => {
    const name = savingName?.trim();
    if (!name) return;
    setSaving(true);
    try {
      await forkPreset(name, draftTerms, activePreset.id);
      setSavingName(null);
    } finally {
      setSaving(false);
    }
  };

  const ownPresets = useMemo(
    () => customPresets.filter((p) => p.createdBy === ownerId),
    [customPresets, ownerId],
  );

  const handleCreateFromTemplate = async () => {
    const name = newPresetName.trim();
    if (!name) return;
    const base = availablePresets.find((p) => p.id === newPresetBaseId) ?? activePreset;
    setCreating(true);
    try {
      await forkPreset(name, base.terms, base.id);
      setCreatingNew(false);
      setNewPresetName('');
      setEditing(true);
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePreset = async (id: string, name: string) => {
    if (!confirm(`Delete the preset "${name}"? This can't be undone.`)) return;
    setDeletingId(id);
    try {
      await deletePreset(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card isBlurred className="w-full border border-default-200 bg-surface-deep/40">
      <CardBody className="p-6 space-y-4">
        <div>
          <p className="font-medium">Dispatch language</p>
          <p className="text-sm text-surface-light/70">
            Choose the terminology used across the dispatch interface. Presets you create are
            shared with everyone in your org.
          </p>
          <p className="text-sm text-surface-light/50 mt-1">
            This only changes what you see in the dispatch view — other dispatchers pick their
            own preset independently. Activity logs are always recorded in English, regardless
            of preset.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Select
            label="Preset"
            labelPlacement="inside"
            variant="bordered"
            size="lg"
            radius="lg"
            classNames={selectClassNames}
            isDisabled={loading}
            className="flex-1"
            selectedKeys={new Set([activePreset.id])}
            onSelectionChange={(keys) => {
              const id = Array.from(keys)[0] as string | undefined;
              if (id) setActivePresetId(id);
            }}
            aria-label="Dispatch vocabulary preset"
          >
            {availablePresets.map((preset) => (
              <SelectItem key={preset.id} textValue={preset.name}>
                {preset.name}
                {preset.createdByName ? ` — by ${preset.createdByName}` : ''}
              </SelectItem>
            ))}
          </Select>

          <Button
            onPress={() => {
              setNewPresetBaseId(activePreset.id);
              setCreatingNew((v) => !v);
            }}
            variant="bordered"
            radius="lg"
            className="border-surface-liner text-surface-light hover:bg-surface-deep sm:self-stretch"
          >
            New preset
          </Button>
        </div>

        {creatingNew && (
          <div className="rounded-2xl border border-surface-liner bg-surface-deeper/60 p-4 space-y-3">
            <p className="text-sm text-surface-light/70">
              Start a new shared preset from an existing one, then customize its terms.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select
                label="Based on"
                labelPlacement="inside"
                variant="bordered"
                size="sm"
                radius="lg"
                classNames={selectClassNames}
                className="flex-1"
                selectedKeys={new Set([newPresetBaseId])}
                onSelectionChange={(keys) => {
                  const id = Array.from(keys)[0] as string | undefined;
                  if (id) setNewPresetBaseId(id);
                }}
                aria-label="Template preset"
              >
                {availablePresets.map((preset) => (
                  <SelectItem key={preset.id} textValue={preset.name}>
                    {preset.name}
                  </SelectItem>
                ))}
              </Select>
              <Input
                placeholder="New preset name"
                variant="bordered"
                size="sm"
                radius="lg"
                classNames={inputClassNames}
                value={newPresetName}
                onValueChange={setNewPresetName}
                aria-label="New preset name"
                className="flex-1"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onPress={handleCreateFromTemplate}
                isDisabled={creating || !newPresetName.trim()}
                radius="lg"
                className="px-4 bg-accent hover:bg-accent/90 text-surface-light"
              >
                Create preset
              </Button>
              <Button
                onPress={() => {
                  setCreatingNew(false);
                  setNewPresetName('');
                }}
                variant="bordered"
                radius="lg"
                className="border-surface-liner text-surface-light hover:bg-surface-deep"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {ownPresets.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-surface-light/50">Your presets</p>
            <div className="space-y-2">
              {ownPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-surface-liner bg-surface-deeper/40 px-4 py-2.5"
                >
                  <span className="text-sm text-surface-light truncate">{preset.name}</span>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    aria-label={`Delete ${preset.name}`}
                    isDisabled={deletingId === preset.id}
                    onPress={() => handleDeletePreset(preset.id, preset.name)}
                    className="text-status-red hover:bg-status-red/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button
          onPress={() => setEditing((v) => !v)}
          variant="bordered"
          radius="lg"
          className="border-surface-liner text-surface-light hover:bg-surface-deep"
        >
          {editing ? 'Hide term editor' : 'Customize terms'}
        </Button>

        {editing && (
          <div className="space-y-6 max-h-[32rem] overflow-y-auto pr-1">
            {CATEGORY_ORDER.map((category) => {
              const categoryTerms = termsByCategory.get(category);
              if (!categoryTerms?.length) return null;
              return (
                <div key={category} className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-surface-light/50">
                    {DISPATCH_TERM_CATEGORY_LABELS[category]}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {categoryTerms.map((term) => (
                      <Input
                        key={term.key}
                        label={term.key}
                        labelPlacement="inside"
                        variant="bordered"
                        size="sm"
                        radius="lg"
                        classNames={inputClassNames}
                        value={draftTerms[term.key] ?? term.defaultLabel}
                        onValueChange={(value) =>
                          setDraftTerms((prev) => ({ ...prev, [term.key]: value }))
                        }
                        aria-label={`Label for ${term.key}`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {dirty && (
          <div className="rounded-2xl border border-surface-liner bg-surface-deeper/60 p-4 space-y-3">
            <p className="text-sm text-surface-light/70">
              Editing terms creates a new preset — it won&apos;t change &quot;{activePreset.name}
              &quot; for anyone else.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder={`${activePreset.name} (edited)`}
                variant="bordered"
                size="sm"
                radius="lg"
                classNames={inputClassNames}
                value={savingName ?? ''}
                onValueChange={setSavingName}
                aria-label="New preset name"
              />
              <div className="flex gap-2">
                <Button
                  onPress={handleSaveAsNewPreset}
                  isDisabled={saving || !savingName?.trim()}
                  radius="lg"
                  className="px-4 bg-accent hover:bg-accent/90 text-surface-light"
                >
                  Save as new preset
                </Button>
                <Button
                  onPress={() => setDraftTerms(activePreset.terms)}
                  variant="bordered"
                  radius="lg"
                  className="border-surface-liner text-surface-light hover:bg-surface-deep"
                >
                  Discard
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
