import type { ReactNode } from 'react';

/**
 * A single step in a WizardShell flow. `component` is the fully-constructed
 * JSX for the step's content — the caller owns the underlying form data, so
 * switching steps never unmounts that data, only which component is shown.
 * `isComplete` is a plain boolean the caller computes from its own data
 * model (e.g. `isComplete: !!eventData.name`); the shell never inspects step
 * content to figure this out itself.
 */
export type WizardStep = {
  id: string;
  label: string;
  component: ReactNode;
  isComplete: boolean;
};

export type WizardStepStatus = 'completed' | 'current' | 'upcoming';
