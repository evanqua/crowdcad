# Component Library and Conventions

This document describes where UI components live, naming conventions, and patterns used across CrowdCAD's frontend.

Overview
- Components live under `src/components/` and are organized by role (UI primitives, feature widgets, modals, layout).
- Files are TypeScript React (`.tsx`). Client components that use hooks or browser APIs must include the `'use client'` directive at the top.

Directory highlights

- `src/components/ui/` — small reusable primitives. Examples:
  - `button.tsx` — stylized Button component used across the app.
  - `input.tsx` — form Input with consistent styling and validation helpers.
  - `sidebar.tsx`, `tooltip.tsx`, `sheet.tsx` — UI patterns for layout and overlays.

- `src/components/modals/` — modal dialogs grouped by feature:
  - `modals/auth/loginmodal.tsx` — login flow modal.
  - `modals/event/quickcallmodal.tsx` — quick new-call modal used in dispatch.
  - Naming pattern: `*modal.tsx`.

- `src/components/dispatch/` — feature-specific UI used on the dispatch dashboard:
  - `teamcard.tsx`, `calltrackingcard.tsx`, `clinictrackingcard.tsx` — cards and tracking widgets.

- `src/components/layout/` — layout-level components (global navigation, header):
  - `appnavbar.tsx` — top navigation used in `layout.tsx`.

- Root helpers
  - `src/components/devServiceWorkerCleanup.tsx` — helper for service worker cleanup in dev.

Styling and design tokens

- TailwindCSS powers styling. Use the `cn()` helper in `src/lib/utils.ts` for conditional class merging.
- Use `tailwind-merge` (`tailwind-merge` is already a dependency) for combining utility classes safely.
- Follow existing token and utility patterns when adding new classes to preserve visual consistency.

Third-party UI libraries

- HeroUI components are used for higher-level UI patterns.
- Icons come from `lucide-react`.

Accessibility

- Prefer semantic HTML (buttons, labels, fieldset) and add `aria-*` attributes when needed.
- Ensure focus management for dialogs and keyboard interaction for interactive widgets.

Adding a new component (recommended steps)

1. Create the component under the appropriate folder in `src/components`.
2. If it uses state or effects, add `'use client'` at top.
3. Write a small visual/test harness in a story or a temporary page (or the dev view) to exercise the component.
4. Add unit or integration tests where appropriate.
5. Export the component as default and import it where needed.

Example modal skeleton

```tsx
'use client'
import React from 'react'
import Modal from '@heroui/react/Modal'

export default function ExampleModal({ open, onClose }) {
  return (
    <Modal open={open} onOpenChange={onClose}>
      <div className="p-4">Example modal content</div>
    </Modal>
  )
}
```

Tips

- Keep components small and focused — prefer composition over large monolithic components.
- Reuse primitives from `src/components/ui` rather than adding duplicated styles.
- When creating new modals, follow the `*modal.tsx` naming convention so they are easy to locate.

Where to find examples

- Modal example: `src/components/modals/event/venuemapmodal.tsx`
- Dispatch card examples: `src/components/dispatch/teamcard.tsx`, `calltrackingcard.tsx`
- UI primitives: `src/components/ui/button.tsx`, `input.tsx`

If you need a component added to a shared export index, open a small PR and reference this doc.
