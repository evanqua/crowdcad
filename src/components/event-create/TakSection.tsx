'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Input, Switch } from '@heroui/react';
import { AlertTriangle, Info, Radio, ShieldAlert } from 'lucide-react';
import type { Event, TakCallPublishMode, TakPublishSettings, Venue } from '@/app/types';
import { eventToCotEvents } from '@/lib/tak/mapping';
import { summarizeSkips, withTakDefaults } from '@/lib/tak/settings';
import { COT_TYPE_CALL, COT_TYPE_CODES_VERIFIED, COT_TYPE_POST } from '@/lib/tak/types';
import type { CotEvent } from '@/lib/tak/types';
import type { MappingSkip, MappingSkipReason } from '@/lib/tak/mapping';

interface TakSectionProps {
  settings: TakPublishSettings | undefined;
  onChange: (next: TakPublishSettings) => void;
  event: Event;
  venue: Venue | null;
  disabled?: boolean;
}

const CALL_MODE_OPTIONS: Array<{
  key: TakCallPublishMode;
  label: string;
  description: string;
}> = [
  { key: 'off', label: 'Off', description: 'No call markers published at all. Default.' },
  {
    key: 'location-only',
    label: 'Location only',
    description: 'A marker with a call number at the incident location. No clinical detail. Recommended maximum.',
  },
  {
    key: 'full',
    label: 'Full',
    description: 'Adds the chief complaint to the marker. See the warning below before enabling.',
  },
];

function toneBannerClasses(tone: 'info' | 'warn' | 'danger'): string {
  switch (tone) {
    case 'danger':
      return 'border-status-red/50 bg-status-red/10 text-status-red';
    case 'warn':
      return 'border-status-orange/50 bg-status-orange/10 text-status-orange';
    default:
      return 'border-surface-liner text-surface-faint';
  }
}

function toneIcon(tone: 'info' | 'warn' | 'danger') {
  if (tone === 'danger') return <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />;
  if (tone === 'warn') return <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />;
  return <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />;
}

/** What kind of marker a CotEvent represents, for the diagnostics breakdown.
 *  COT_TYPE_TEAM and COT_TYPE_SUPERVISOR are currently the same code (see
 *  types.ts) so type alone can't tell them apart — groupRole can. */
function markerKind(cot: CotEvent): 'team' | 'supervisor' | 'post' | 'call' {
  if (cot.type === COT_TYPE_POST) return 'post';
  if (cot.type === COT_TYPE_CALL) return 'call';
  return cot.detail?.groupRole === 'Team Lead' ? 'supervisor' : 'team';
}

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  ariaLabel: string;
  helperText?: string;
  isDisabled: boolean;
  onCommit: (value: number) => void;
}

/** Numeric input with local text state so a user can freely retype a value
 *  (including clearing the field) without every keystroke racing a parent
 *  re-render — same pattern as GeoreferenceSection's ControlPointRow. */
function NumberField({ label, value, min, ariaLabel, helperText, isDisabled, onCommit }: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const lastCommitted = useRef(value);

  useEffect(() => {
    if (value !== lastCommitted.current) {
      setText(String(value));
      lastCommitted.current = value;
      setError(null);
    }
  }, [value]);

  const handleChange = (next: string) => {
    setText(next);
    const parsed = Number(next);
    if (next.trim() === '' || !Number.isFinite(parsed)) {
      setError('Must be a number');
      return;
    }
    if (parsed < min) {
      setError(`Must be at least ${min}`);
      return;
    }
    setError(null);
    lastCommitted.current = parsed;
    onCommit(parsed);
  };

  return (
    <div>
      <Input
        label={label}
        labelPlacement="outside"
        aria-label={ariaLabel}
        value={text}
        onValueChange={handleChange}
        type="number"
        size="sm"
        variant="flat"
        isDisabled={isDisabled}
        isInvalid={!!error}
        classNames={{
          label: 'text-surface-light text-xs',
          input: 'text-surface-light text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
          inputWrapper: 'rounded-lg px-2 hover:bg-surface-deep bg-surface-deeperer',
        }}
      />
      {error ? (
        <p className="mt-1 text-xs text-status-red">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-surface-faint">{helperText}</p>
      ) : null}
    </div>
  );
}

/** Raw skip records for one reason, in order — used where a group needs its
 *  per-item `detail` text, not just a subject list (summarizeSkips only
 *  carries subjects). */
function skipsForReason(skipped: MappingSkip[], reason: MappingSkipReason): MappingSkip[] {
  return skipped.filter((s) => s.reason === reason);
}

export default function TakSection({ settings, onChange, event, venue, disabled = false }: TakSectionProps) {
  const resolved = withTakDefaults(settings);
  const controlsInactive = disabled || !resolved.enabled;

  const patch = (partial: Partial<TakPublishSettings>) => {
    onChange({ ...resolved, ...partial });
  };

  const preview = useMemo(() => {
    if (!venue) return null;
    return eventToCotEvents(event, venue, resolved, Date.now());
  }, [event, venue, resolved]);

  const counts = useMemo(() => {
    const base = { team: 0, supervisor: 0, post: 0, call: 0 };
    if (!preview) return base;
    for (const cot of preview.events) {
      base[markerKind(cot)] += 1;
    }
    return base;
  }, [preview]);

  const skipGroups = useMemo(() => (preview ? summarizeSkips(preview.skipped) : []), [preview]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-surface-light">TAK / CoT Publishing</label>
      </div>

      {!COT_TYPE_CODES_VERIFIED && (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${toneBannerClasses('danger')}`}>
          {toneIcon('danger')}
          <span>
            <strong>CoT type codes are unverified.</strong> The marker symbols this event would publish have not
            been confirmed against a real TAK client. Publishing to a shared or partner TAK server is not yet
            approved — a wrong type code can render as a confusing or alarming symbol on someone else&apos;s map, and
            a published CoT marker cannot be unsent.
          </span>
        </div>
      )}

      <Card isBlurred className="border border-default-200 bg-transparent">
        <div className="flex items-center justify-between gap-4 px-3 py-3">
          <div>
            <p className="text-sm font-medium text-surface-light">Enable TAK publishing</p>
            <p className="text-xs text-surface-faint">
              Off by default. Turning this on is what starts publishing this event to TAK — the controls below stay
              visible either way so you can see what you&apos;d be turning on.
            </p>
          </div>
          <Switch
            isSelected={resolved.enabled}
            onValueChange={(value) => patch({ enabled: value })}
            aria-label="Enable TAK publishing"
            isDisabled={disabled}
          />
        </div>
      </Card>

      <div className={`space-y-4 transition-opacity ${controlsInactive ? 'opacity-40 pointer-events-none' : ''}`}>
        <Card isBlurred className="border border-default-200 bg-transparent">
          <div className="divide-y divide-surface-liner">
            <div className="flex items-center justify-between gap-4 px-3 py-2.5">
              <div>
                <p className="text-sm text-surface-light">Publish teams</p>
              </div>
              <Switch
                isSelected={resolved.publishTeams}
                onValueChange={(value) => patch({ publishTeams: value })}
                aria-label="Publish teams"
                isDisabled={controlsInactive}
                size="sm"
              />
            </div>
            <div className="flex items-center justify-between gap-4 px-3 py-2.5">
              <div>
                <p className="text-sm text-surface-light">Publish supervisors</p>
              </div>
              <Switch
                isSelected={resolved.publishSupervisors}
                onValueChange={(value) => patch({ publishSupervisors: value })}
                aria-label="Publish supervisors"
                isDisabled={controlsInactive}
                size="sm"
              />
            </div>
            <div className="flex items-center justify-between gap-4 px-3 py-2.5">
              <div>
                <p className="text-sm text-surface-light">Publish posts</p>
              </div>
              <Switch
                isSelected={resolved.publishPosts}
                onValueChange={(value) => patch({ publishPosts: value })}
                aria-label="Publish posts"
                isDisabled={controlsInactive}
                size="sm"
              />
            </div>
          </div>
        </Card>

        <div>
          <p className="mb-2 text-sm text-surface-light">Publish calls</p>
          <div className="flex gap-2">
            {CALL_MODE_OPTIONS.map((opt) => {
              const active = resolved.publishCalls === opt.key;
              return (
                <Button
                  key={opt.key}
                  size="sm"
                  variant={active ? 'solid' : 'flat'}
                  color={active ? (opt.key === 'full' ? 'danger' : 'primary') : 'default'}
                  isDisabled={controlsInactive}
                  onPress={() => patch({ publishCalls: opt.key })}
                  className="flex-1"
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-surface-faint">
            {CALL_MODE_OPTIONS.find((o) => o.key === resolved.publishCalls)?.description}
          </p>
          {resolved.publishCalls === 'full' && (
            <div className={`mt-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${toneBannerClasses('danger')}`}>
              {toneIcon('danger')}
              <span>
                <strong>Full mode transmits clinical text.</strong> Each call&apos;s chief complaint is added to the
                marker and leaves CrowdCAD&apos;s access controls — it is visible to every connected TAK client and
                every federated partner server, not just your organization. Patient age, gender, notes, and the call
                log are never published in any mode. Choose Full only with an explicit, informed decision to share
                clinical text this broadly.
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Callsign prefix"
            labelPlacement="outside"
            aria-label="Callsign prefix"
            placeholder="e.g. ICEMS"
            value={resolved.callsignPrefix ?? ''}
            onValueChange={(value) => patch({ callsignPrefix: value || undefined })}
            size="sm"
            variant="flat"
            isDisabled={controlsInactive}
            classNames={{
              label: 'text-surface-light text-xs',
              input: 'text-surface-light text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
              inputWrapper: 'rounded-lg px-2 hover:bg-surface-deep bg-surface-deeperer',
            }}
          />
          <Input
            label="TAK group / channel"
            labelPlacement="outside"
            aria-label="TAK group or channel"
            placeholder="e.g. Cyan"
            value={resolved.cotGroup ?? ''}
            onValueChange={(value) => patch({ cotGroup: value || undefined })}
            size="sm"
            variant="flat"
            isDisabled={controlsInactive}
            classNames={{
              label: 'text-surface-light text-xs',
              input: 'text-surface-light text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
              inputWrapper: 'rounded-lg px-2 hover:bg-surface-deep bg-surface-deeperer',
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Stale after (seconds)"
            ariaLabel="Marker stale time in seconds"
            value={resolved.staleSeconds ?? 120}
            min={1}
            isDisabled={controlsInactive}
            onCommit={(value) => patch({ staleSeconds: value })}
            helperText="How long a marker stays valid on a TAK client after publish before it's shown as stale."
          />
          <NumberField
            label="Publish every (seconds)"
            ariaLabel="Publish interval in seconds"
            value={resolved.publishIntervalSeconds ?? 30}
            min={1}
            isDisabled={controlsInactive}
            onCommit={(value) => patch({ publishIntervalSeconds: value })}
            helperText="Keep stale time well above this — a couple of missed publishes in a row shouldn't drop a stationary team off the map."
          />
        </div>
      </div>

      <Card isBlurred className="border border-default-200 bg-transparent">
        <div className="space-y-3 px-3 py-3">
          <div className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-surface-faint" />
            <p className="text-sm font-medium text-surface-light">What would publish</p>
          </div>

          {!venue ? (
            <p className="text-xs text-surface-faint">
              This event has no venue attached yet — nothing to preview until one is set.
            </p>
          ) : preview ? (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-surface-liner px-2 py-1 text-surface-light">
                  {preview.events.length} marker{preview.events.length === 1 ? '' : 's'} total
                </span>
                <span className="rounded-full border border-surface-liner px-2 py-1 text-surface-faint">
                  {counts.team} team
                </span>
                <span className="rounded-full border border-surface-liner px-2 py-1 text-surface-faint">
                  {counts.supervisor} supervisor
                </span>
                <span className="rounded-full border border-surface-liner px-2 py-1 text-surface-faint">
                  {counts.post} post
                </span>
                <span className="rounded-full border border-surface-liner px-2 py-1 text-surface-faint">
                  {counts.call} call
                </span>
              </div>

              {skipGroups.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-surface-light">Not publishing</p>
                  {skipGroups.map((group) => {
                    const detailed =
                      group.reason === 'layer-fit-unacceptable'
                        ? skipsForReason(preview.skipped, group.reason)
                        : null;
                    return (
                      <div
                        key={group.reason}
                        className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${toneBannerClasses(group.tone)}`}
                      >
                        {toneIcon(group.tone)}
                        <div>
                          <p>
                            {group.label} ({group.count})
                          </p>
                          {detailed ? (
                            <ul className="mt-1 list-disc pl-4">
                              {detailed.map((s, idx) => (
                                <li key={`${s.subject}-${idx}`}>
                                  {s.subject}
                                  {s.detail ? ` — ${s.detail}` : ''}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-0.5 text-surface-faint">{group.subjects.join(', ')}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
