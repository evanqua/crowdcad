'use client';

import type { WizardStep, WizardStepStatus } from './types';

type Props = {
  steps: WizardStep[];
  currentStepId: string;
  onStepChange: (stepId: string) => void;
  className?: string;
};

function getStatus(step: WizardStep, currentStepId: string): WizardStepStatus {
  if (step.id === currentStepId) return 'current';
  if (step.isComplete) return 'completed';
  return 'upcoming';
}

const STATUS_ANNOUNCEMENT: Record<WizardStepStatus, string> = {
  completed: 'completed',
  current: 'current step',
  upcoming: 'upcoming',
};

const DOT_CLASS: Record<WizardStepStatus, string> = {
  completed: 'h-3 w-3 bg-accent hover:bg-accent/80 cursor-pointer',
  current: 'h-4 w-4 bg-accent ring-4 ring-accent/25',
  upcoming: 'h-3 w-3 bg-surface-deeper border border-surface-liner cursor-not-allowed',
};

/**
 * The "dot-line-dot" progress indicator. Dots and connecting lines share one
 * flex row so a line always starts at its left dot's edge and ends at its
 * right dot's edge — no gap, regardless of label width. Labels render in a
 * separate row below, in matching flex-1 columns; the accessible name lives
 * on each dot's own aria-label, so the label row is decorative (aria-hidden).
 */
export default function StepProgress({ steps, currentStepId, onStepChange, className }: Props) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);

  return (
    <div className={`w-full ${className ?? ''}`}>
      <ol aria-label="Progress" className="flex items-center w-full">
        {steps.map((step, idx) => {
          const status = getStatus(step, currentStepId);
          const clickable = status !== 'upcoming';
          const isLast = idx === steps.length - 1;

          return (
            <li key={step.id} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
              <button
                type="button"
                disabled={!clickable}
                aria-current={status === 'current' ? 'step' : undefined}
                aria-label={`${step.label}: ${STATUS_ANNOUNCEMENT[status]}`}
                onClick={() => clickable && onStepChange(step.id)}
                className={`shrink-0 rounded-full transition-all disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-deepest ${DOT_CLASS[status]}`}
              />

              {!isLast && (
                <div
                  aria-hidden="true"
                  role="presentation"
                  className={`h-0.5 flex-1 rounded-full ${
                    idx < currentIndex ? 'bg-accent' : 'bg-surface-liner'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>

      <div aria-hidden="true" className="flex w-full mt-1.5">
        {steps.map((step) => (
          <div
            key={step.id}
            className="flex-1 min-w-0 text-center text-[11px] leading-tight text-surface-faint whitespace-nowrap overflow-hidden text-ellipsis px-0.5"
          >
            {step.label}
          </div>
        ))}
      </div>
    </div>
  );
}
