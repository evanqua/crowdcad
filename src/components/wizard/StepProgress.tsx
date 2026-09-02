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
 * The "dot-line-dot" progress indicator: one dot per step connected by a
 * line segment, reading as percent-complete. A completed step's dot (or the
 * current one, a no-op) can be clicked to jump there; an upcoming step's dot
 * is inert until it becomes reachable (i.e. completed).
 */
export default function StepProgress({ steps, currentStepId, onStepChange, className }: Props) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);

  return (
    <ol aria-label="Progress" className={`flex items-start w-full ${className ?? ''}`}>
      {steps.map((step, idx) => {
        const status = getStatus(step, currentStepId);
        const clickable = status !== 'upcoming';
        const isLast = idx === steps.length - 1;

        return (
          <li key={step.id} className={`flex items-start min-w-0 ${isLast ? '' : 'flex-1'}`}>
            <div className="flex flex-col items-center min-w-0">
              <button
                type="button"
                disabled={!clickable}
                aria-current={status === 'current' ? 'step' : undefined}
                aria-label={`${step.label}: ${STATUS_ANNOUNCEMENT[status]}`}
                onClick={() => clickable && onStepChange(step.id)}
                className={`shrink-0 rounded-full transition-all disabled:cursor-not-allowed ${DOT_CLASS[status]}`}
              />
              <span
                aria-hidden="true"
                className="mt-1.5 w-full max-w-[5.5rem] text-center text-[11px] leading-tight text-surface-faint break-words"
              >
                {step.label}
              </span>
            </div>

            {!isLast && (
              <div
                aria-hidden="true"
                role="presentation"
                className={`mt-1.5 h-0.5 flex-1 min-w-[0.5rem] mx-1.5 rounded-full ${
                  idx < currentIndex ? 'bg-accent' : 'bg-surface-liner'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
