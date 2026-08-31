/**
 * Canonical registry of dispatch vocabulary terms.
 *
 * Each `key` is the exact English string already used internally throughout
 * the dispatch page/components — as stored data (`Call.status`, `Staff.status`,
 * `Staff.location`, etc.), as a comparison target in business logic, or as
 * literal JSX text. Using the existing string as the key means the identity
 * preset (CrowdCAD Default) requires no data migration, and every render site
 * can look up its label via `t(key)` without touching the underlying value.
 *
 * IMPORTANT: keys are internal identifiers, not just English words. Never
 * rename a key — only its label may change per preset. See
 * src/lib/dispatchVocabulary/README.md is intentionally omitted; the
 * constraint is documented on DispatchVocabularyProvider instead.
 */

export type DispatchTermCategory =
  | 'entities'
  | 'callStatuses'
  | 'teamStatuses'
  | 'equipment'
  | 'clinicOutcomes'
  | 'actions';

export interface DispatchTerm {
  key: string;
  category: DispatchTermCategory;
  defaultLabel: string;
}

function terms(category: DispatchTermCategory, keys: string[]): DispatchTerm[] {
  return keys.map((key) => ({ key, category, defaultLabel: key }));
}

export const DISPATCH_TERMS: DispatchTerm[] = [
  // Entities & roles — nouns for the people/things being dispatched.
  ...terms('entities', [
    'Team',
    'Call',
    'Clinic',
    'Supervisor',
    'Post',
    'Equipment',
    'Roaming',
    'Lead',
    'Walkup',
    'Unknown',
  ]),

  // Call statuses — Call.status values, also used for team/supervisor
  // composite call-driven statuses (En Route, On Scene, Transporting).
  ...terms('callStatuses', [
    'Pending',
    'Assigned',
    'En Route',
    'On Scene',
    'Transporting',
    'Delivered',
    'Refusal',
    'NMM',
    'Unable to Locate',
    'Rolled',
    'Rolled from Scene',
    'Resolved',
  ]),

  // Team / supervisor / equipment-run statuses — Staff.status / Supervisor.status.
  ...terms('teamStatuses', [
    'Available',
    'Detached',
    'On Break',
    'In Clinic',
    'Delivered Eq',
    'En Route Eq',
    'Assisting',
  ]),

  // Equipment.
  ...terms('equipment', ['In Use']),

  // ClinicOutcome union (app/types.ts).
  ...terms('clinicOutcomes', ['Discharged', 'AMA', 'Rolled from Clinic', 'Transported']),

  // UI copy: buttons, headers, field labels, empty states, menu items.
  ...terms('actions', [
    'Total Calls',
    'Call #',
    'Chief Complaint',
    'A/S',
    'Age/Sex',
    'Status',
    'Primary Team',
    'Location',
    'Add Call',
    'Add Team',
    'Add Supervisor',
    'Add Equipment',
    'Add Patient',
    'Calls',
    'Teams',
    'Supervisors',
    'No calls',
    'No clinic calls',
    'No teams available',
    'No available teams',
    'No supervisors available',
    'No available supervisors',
    'No equipment available',
    'No available equipment',
    'No equipment configured',
    'Show Resolved Calls',
    'Hide Resolved Calls',
    'Show Resolved Clinic Calls',
    'Hide Resolved Clinic Calls',
    'Total Patients',
    'Show Log',
    'Hide Log',
    'Mark as Duplicate',
    'Mark as Priority',
    'Remove Priority',
    'Delete Call',
    'Staging Location',
    'Delivery Team',
    'Mark Ready',
    'Equipment Details',
    'Supervisor Call Sign',
    'Supervisor Name (optional)',
    'Certification',
    'Refresh Post',
    'No location',
    'Clinic Status',
    'Team Members',
    'Team Status',
    'Team Name',
    'Add New Team',
    'Edit Team',
    'Add New Supervisor',
    'Edit Supervisor',
    'Notes',
    'Add notes',
    'Add notes about this equipment',
    'Not Set',
    'Call ID',
    'No log entries',
    'Log for Call',
    'PRIORITY CALL: Life threat to patient/provider',
    'Edit',
    'Delete',
    'No members',
    'Activity Log',
    'Add Clinic Walkup',
    'Cancel',
    'Submit',
    'Member name',
    'Add member',
    'Save Changes',
    'Create Team',
    'Create Supervisor',
    'Source',
    'Assign Team',
    'Select a team',
    'Venue Map',
    'Posting Schedule',
    'End Event',
    'Venues',
    'Clear Event',
    'Export Summary',
    'On Calls',
    'On Break/Clinic',
    'Surge limit reached',
    'Call pending 2 minutes — surge alert activated',
    'Reopen Call',
    'Revert this status and reopen the call?',
    'Revert this equipment status and reattach it to the team?',
    'Revert this supervisor detachment and reattach them to the call?',
    'Revert this clinic outcome?',
    'Transport Unit #',
    'Enter Transport Unit',
  ]),
];

export const DISPATCH_TERM_KEYS: string[] = DISPATCH_TERMS.map((t) => t.key);

export const DISPATCH_TERM_CATEGORY_LABELS: Record<DispatchTermCategory, string> = {
  entities: 'Entities & Roles',
  callStatuses: 'Call Statuses',
  teamStatuses: 'Team & Supervisor Statuses',
  equipment: 'Equipment',
  clinicOutcomes: 'Clinic Outcomes',
  actions: 'Actions & Labels',
};
