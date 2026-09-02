'use client';

import { useEffect, useRef } from 'react';
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
  const contentRef = useRef<HTMLDivElement>(null);

  // Move focus to the new step's content whenever the step changes (via a
  // progress dot, or a "Continue"/"Back" control the caller renders outside
  // this component) — otherwise focus is left on a control that's no longer
  // relevant (or, if that control was removed from the DOM, silently reset
  // to <body>), forcing keyboard/screen-reader users to hunt for where they
  // landed. The container itself is the focus target (not a form field
  // inside it) since step content is caller-defined and not guaranteed to
  // start with a focusable element.
  useEffect(() => {
    contentRef.current?.focus();
  }, [currentStep.id]);

  return (
    <div className={`flex flex-col gap-6 ${className ?? ''}`}>
      <StepProgress steps={steps} currentStepId={currentStep.id} onStepChange={onStepChange} />
      <div
        ref={contentRef}
        tabIndex={-1}
        role="group"
        aria-label={currentStep.label}
        className="flex-1 min-h-0 outline-none"
      >
        {currentStep.component}
      </div>
    </div>
  );
}
