'use client';

import type { WizardStep } from './types';
import StepProgress from './StepProgress';

type Props = {
  steps: WizardStep[];
  currentStepId: string;
  onStepChange: (stepId: string) => void;
  className?: string;
};

/**
 * Config-driven step shell shared by venue creation and event creation.
 * Fully controlled: the caller owns `currentStepId` and each step's
 * underlying form data, so this component only decides which step's
 * `component` to render and renders the dot-line-dot progress indicator
 * above it. Adding a step is adding one entry to `steps` — nothing here
 * special-cases a particular step.
 */
export default function WizardShell({ steps, currentStepId, onStepChange, className }: Props) {
  const currentStep = steps.find((s) => s.id === currentStepId) ?? steps[0];

  return (
    <div className={`flex flex-col gap-6 ${className ?? ''}`}>
      <StepProgress steps={steps} currentStepId={currentStep.id} onStepChange={onStepChange} />
      <div className="flex-1 min-h-0">{currentStep.component}</div>
    </div>
  );
}
