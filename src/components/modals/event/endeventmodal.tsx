'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Checkbox,
} from '@heroui/react';

export interface EndEventModalProps {
  open: boolean;
  onClose: () => void;

  onEndNoSummary: () => Promise<void> | void;

  onQuickSummary: () => Promise<string | void> | string | void;

  eventId?: string;

  warningText?: string;
}

type BusyKey = null | 'none' | 'quick';

export default function EndEventModal({
  open,
  onClose,
  onEndNoSummary,
  onQuickSummary,
  eventId,
  warningText = "Ending an event cannot be undone. You'll still be able to view existing logs.",
}: EndEventModalProps) {
  // modalRef reserved for future use
  // const modalRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const [choices, setChoices] = useState({ none: false, quick: false, anon: false, full: false });
  const [busy, setBusy] = useState<BusyKey>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setChoices({ none: false, quick: false, anon: false, full: false });
      setBusy(null);
    }
  }, [open]);

  const toggle = (key: keyof typeof choices) =>
    setChoices((c) => ({ ...c, [key]: !c[key] }));

  const canContinue = choices.quick || choices.none;

  const getEventIdFromURL = (): string | undefined => {
    if (typeof window === 'undefined') return undefined;
    const m = window.location.pathname.match(/\/events\/([^/]+)/);
    return m?.[1];
  };

  const handleContinue = async () => {
    if (busy || !canContinue) return;

    if (choices.quick) {
      setBusy('quick');
      try {
        const returned = await onQuickSummary();
        const freshId =
          (typeof returned === 'string' && returned) ||
          eventId ||
          getEventIdFromURL();

        if (freshId) {
          router.push(`/events/${freshId}/summary`);
        } else {
          console.error('No event id available for summary navigation.');
        }
        onClose();
      } finally {
        setBusy(null);
      }
      return;
    }

    if (choices.none) {
      setBusy('none');
      try {
        await onEndNoSummary();
        onClose();
      } finally {
        setBusy(null);
      }
    }
  };

  const CheckTile = ({
    title,
    desc,
    checked,
    onToggle,
    variant = 'default',
    disabled = false,
  }: {
    title: string;
    desc: string;
    checked: boolean;
    onToggle: () => void;
    variant?: 'default' | 'danger' | 'primary';
    disabled?: boolean;
  }) => {
    return (
      <label
        className={clsx(
          'group cursor-pointer rounded-xl p-6 w-full transition min-h-[88px]',
          'border border-surface',
          'bg-surface-deep hover:bg-surface-deep/70',
          disabled && 'opacity-50 cursor-not-allowed hover:bg-surface-deep',
          checked && (variant === 'danger'
            ? 'ring-1 ring-status-red/50'
            : variant === 'primary'
              ? 'ring-1 ring-status-blue/50'
              : 'ring-1 ring-white/20')
        )}
      >
        <div className="flex items-center gap-4">
          <div className="flex-none w-8 flex items-center justify-center">
            <Checkbox
              isSelected={checked}
              onValueChange={() => onToggle()}
              disabled={disabled}
              classNames={{
                base: 'h-6 w-6',
                wrapper: 'outline-none focus:outline-none',
              }}
              aria-label={title}
            />
          </div>
          <div className="min-w-0 ml-3">
            <div className="font-semibold text-lg">{title}</div>
            <div className="text-sm text-surface-light/80">{desc}</div>
          </div>
        </div>
      </label>
    );
  };

  return (
    <Modal
      isOpen={open}
      onOpenChange={(open) => { if (!open) onClose(); }}
      placement="center"
      backdrop="opaque"
      radius="lg"
      classNames={{
        base: 'rounded-2xl bg-surface-deepest text-surface-light max-w-4xl w-full',
        header: 'pb-0',
        body: 'py-4',
        footer: 'pt-0'
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          End Event
        </ModalHeader>
        <ModalBody>
          <p className="text-surface-light/90 text-sm">{warningText}</p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <CheckTile
              title="End with no summary"
              desc="Immediately end the event without generating a report."
              checked={choices.none}
              onToggle={() => toggle('none')}
              variant="danger"
            />
            <CheckTile
              title="Quick summary"
              desc="Finish and jump to the summary page to finalize a short report."
              checked={choices.quick}
              onToggle={() => toggle('quick')}
              variant="primary"
            />
            <CheckTile
              title="Anonymized summary"
              desc="Generate a de-identified report for external sharing."
              checked={choices.anon}
              onToggle={() => toggle('anon')}
              disabled
            />
            <CheckTile
              title="Full summary"
              desc="Generate the complete, detailed report."
              checked={choices.full}
              onToggle={() => toggle('full')}
              disabled
            />
          </div>
        </ModalBody>
        <ModalFooter className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={!!busy}>Cancel</Button>
          <Button
            variant="solid"
            onClick={handleContinue}
            disabled={!canContinue || !!busy}
          >
            {busy === 'quick' ? 'Generating summary...' : busy === 'none' ? 'Ending event...' : 'Continue'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
