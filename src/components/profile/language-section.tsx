'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardBody, Select, SelectItem, Input, Button } from '@heroui/react';
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
  const { activePreset, availablePresets, setActivePresetId, forkPreset, loading } =
    useDispatchVocabulary();

  const [draftTerms, setDraftTerms] = useState<Record<string, string>>(activePreset.terms);
  const [editing, setEditing] = useState(false);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  return (
    <Card isBlurred className="w-full border border-default-200 bg-surface-deep/40">
      <CardBody className="p-6 space-y-4">
        <div>
          <p className="font-medium">Dispatch language</p>
          <p className="text-sm text-surface-light/70">
            Choose the terminology used across the dispatch interface. Presets you create are
            shared with everyone in your org.
          </p>
        </div>

        <Select
          label="Preset"
          labelPlacement="inside"
          variant="bordered"
          size="lg"
          radius="lg"
          classNames={selectClassNames}
          isDisabled={loading}
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
