'use client';

import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';
import { Suspense } from 'react';

export default function ProgressBarProvider() {
  return (
    <Suspense fallback={null}>
      <ProgressBar
        height="4px"
        color="#3eb1fd"
        options={{ 
          showSpinner: true,
          easing: 'ease',
          speed: 200,
          trickle: true,
          trickleSpeed: 200,
          minimum: 0.08,
          template: '<div class="bar" role="bar"><div class="peg"></div></div><div class="spinner" role="spinner"><div class="spinner-icon"></div></div>',
        }}
        shallowRouting={true}
      />
    </Suspense>
  );
}
