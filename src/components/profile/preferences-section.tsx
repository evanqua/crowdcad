'use client';

import { Card, CardBody, Switch } from '@heroui/react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import LanguageSection from './language-section';

export default function PreferencesSection() {
  const { enabled, setEnabled } = useReducedMotion();

  return (
    <div className="space-y-6 w-full">
      <h2 className="text-3xl font-bold">Preferences</h2>

      <Card isBlurred className="w-full border border-default-200 bg-surface-deep/40">
        <CardBody className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Reduce motion</p>
              <p className="text-sm text-surface-light/70">
                Minimize animations and transitions throughout the app.
              </p>
            </div>
            <Switch isSelected={enabled} onValueChange={setEnabled} aria-label="Reduce motion" />
          </div>
        </CardBody>
      </Card>

      <LanguageSection />
    </div>
  );
}
