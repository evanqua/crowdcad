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
 * The "dot-line-dot" progress indicator. Dots and labels sit in the same
 * N-column grid (one column per step) so a dot and its label are always
 * exactly aligned regardless of label width. The connecting line is a
 * single element positioned behind the dots, spanning from the first dot's
 * center to the last dot's center — computed in JS (percentages of the
 * grid, not per-dot DOM measurement) so it's exact at any width, including
 * when this bar is stretched across a much wider column than the step
 * content below it.
 */
export default function StepProgress({ steps, currentStepId, onStepChange, className }: Props) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);
  const n = steps.length;
  const gridStyle = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };

  // Each dot sits centered in its own 100/n-wide column, so the first dot's
  // center is inset from the left edge by half a column, and symmetrically
  // for the last dot on the right.
  const insetPct = n > 0 ? 50 / n : 0;
  const spanPct = 100 - 2 * insetPct;
  const completedPct = n > 1 ? (Math.max(currentIndex, 0) / (n - 1)) * spanPct : 0;

  return (
    <div className={`w-full ${className ?? ''}`}>
      <div className="relative h-4">
        <div
          aria-hidden="true"
          role="presentation"
          className="absolute top-1/2 -translate-y-1/2 h-0.5 rounded-full bg-surface-liner"
          style={{ left: `${insetPct}%`, right: `${insetPct}%` }}
        />
        <div
          aria-hidden="true"
          role="presentation"
          className="absolute top-1/2 -translate-y-1/2 h-0.5 rounded-full bg-accent transition-[width]"
          style={{ left: `${insetPct}%`, width: `${completedPct}%` }}
        />

        <ol aria-label="Progress" className="relative grid h-full" style={gridStyle}>
          {steps.map((step) => {
            const status = getStatus(step, currentStepId);
            const clickable = status !== 'upcoming';

            return (
              <li key={step.id} className="flex items-center justify-center">
                <button
                  type="button"
                  disabled={!clickable}
                  aria-current={status === 'current' ? 'step' : undefined}
                  aria-label={`${step.label}: ${STATUS_ANNOUNCEMENT[status]}`}
                  onClick={() => clickable && onStepChange(step.id)}
                  className={`shrink-0 rounded-full transition-all disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-deepest ${DOT_CLASS[status]}`}
                />
              </li>
            );
          })}
        </ol>
      </div>

      <div aria-hidden="true" className="grid mt-2" style={gridStyle}>
        {steps.map((step) => (
          <div
            key={step.id}
            className="text-center text-sm leading-tight text-surface-faint whitespace-nowrap overflow-hidden text-ellipsis px-1"
          >
            {step.label}
          </div>
        ))}
      </div>
    </div>
  );
}
