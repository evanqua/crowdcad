import React from 'react';

export interface ReviewField {
  label: string;
  value: React.ReactNode;
}

export interface ReviewColumn {
  id: string;
  /** Matches the label of the wizard step this column summarizes. */
  label: string;
  fields: ReviewField[];
}

/**
 * A wizard's Review step, laid out as one column per earlier step (mirroring
 * the "dots" in StepProgress) instead of one long stacked list — the list
 * form had no cap on height and just ran off the bottom of the panel once a
 * step had enough fields.
 *
 * Columns are separated by a thin `surface-liner` line, the same divider
 * color used for card grids on the marketing home page, but scoped to the
 * column content's own height rather than the full page. Column width is
 * fixed rather than shrinking to fit, since this renders inside wizard
 * panels of very different widths (a narrow one-third column next to a map,
 * or the full wizard width) — a fixed width keeps fields readable, with
 * horizontal scroll as the overflow behavior instead of illegibly squeezed
 * text.
 */
export default function ReviewColumns({ columns }: { columns: ReviewColumn[] }) {
  return (
    <div className="overflow-x-auto">
      {/* w-max + mx-auto rather than justify-center: centering this way just
          collapses to flush-left once the columns are wider than the
          container (auto margins resolve to 0), instead of flexbox's
          justify-center-with-overflow quirk of clipping evenly off both
          ends and forcing a scroll left before anything is visible. */}
      <div className="flex divide-x divide-surface-liner/70 w-max mx-auto">
        {columns.map((column) => (
          <div key={column.id} className="w-[170px] shrink-0 space-y-3 px-5 first:pl-0 last:pr-0">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-surface-faint">{column.label}</h4>
            <div className="space-y-3">
              {column.fields.map((field) => (
                <div key={field.label}>
                  <span className="text-xs text-surface-faint">{field.label}</span>
                  <p className="text-surface-light text-sm font-medium">{field.value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
