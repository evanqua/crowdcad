import { DISPATCH_TERMS } from './terms';

export const DEFAULT_PRESET_ID = 'crowdcad-default';
export const FRENCH_PRESET_ID = 'crowdcad-french';

export const BUILTIN_PRESET_IDS = [DEFAULT_PRESET_ID, FRENCH_PRESET_ID] as const;
export type BuiltinPresetId = (typeof BUILTIN_PRESET_IDS)[number];

export interface DispatchVocabularyPresetSummary {
  id: string;
  name: string;
  terms: Record<string, string>;
  /** Built-in presets have no owner; custom (forked) presets do. */
  createdByName?: string;
}

// Identity mapping — every key displays as itself.
const CROWDCAD_DEFAULT_TERMS: Record<string, string> = Object.fromEntries(
  DISPATCH_TERMS.map((t) => [t.key, t.defaultLabel]),
);

// CrowdCAD French. Entries marked with the user's own supplied swaps are
// used verbatim; the rest are filled in with contextually-appropriate
// French event-medical/dispatch terminology.
const CROWDCAD_FRENCH_TERMS: Record<string, string> = {
  // Entities & roles
  Team: 'Équipe',
  Call: 'Appel',
  Clinic: 'Poste de secours',
  Supervisor: 'Superviseur',
  Post: 'Poste',
  Equipment: 'Équipement',
  Roaming: 'Mobile',
  Lead: 'Responsable',
  Walkup: 'Présentation spontanée',
  Unknown: 'Inconnu',

  // Call statuses
  Pending: 'En attente',
  Assigned: 'Assigné',
  'En Route': 'En route',
  'On Scene': 'Sur les lieux',
  Transporting: 'En transport',
  Delivered: 'Remis',
  Refusal: 'Refus de soins',
  NMM: 'Sans objet médical',
  'Unable to Locate': 'Introuvable',
  Rolled: 'Évacué',
  'Rolled from Scene': 'Transport direct',
  Resolved: 'Résolu',

  // Team / supervisor / equipment-run statuses
  Available: 'Disponible',
  Detached: 'Dégagé',
  'On Break': 'En pause',
  'In Clinic': 'Au poste de secours',
  'Delivered Eq': 'Équipement livré',
  'En Route Eq': 'Équipement en route',
  Assisting: 'En assistance',

  // Equipment
  'In Use': 'En utilisation',

  // Clinic outcomes
  Discharged: 'Sortie',
  AMA: 'SCAM',
  'Rolled from Clinic': 'Transféré',
  Transported: 'Transporté',

  // Actions & labels
  'Total Calls': 'Appels totaux',
  'Call #': "N° d'appel",
  'Chief Complaint': 'Plainte principale',
  'A/S': 'A/S',
  'Age/Sex': 'A/S',
  Status: 'Statut',
  'Primary Team': 'Équipe principale',
  Location: 'Position',
  'Add Call': 'Ajouter un appel',
  'Add Team': 'Ajouter une équipe',
  'Add Supervisor': 'Ajouter un superviseur',
  'Add Equipment': 'Ajouter un équipement',
  'Add Patient': 'Ajouter un patient',
  Calls: 'Appels',
  Teams: 'Équipes',
  Supervisors: 'Superviseurs',
  'No calls': 'Aucun appel',
  'No clinic calls': 'Aucun appel au poste de secours',
  'No teams available': 'Aucune équipe disponible',
  'No available teams': 'Aucune équipe disponible',
  'No supervisors available': 'Aucun superviseur disponible',
  'No available supervisors': 'Aucun superviseur disponible',
  'No equipment available': 'Aucun équipement disponible',
  'No available equipment': 'Aucun équipement disponible',
  'No equipment configured': 'Aucun équipement configuré',
  'Show Resolved Calls': 'Afficher les appels résolus',
  'Hide Resolved Calls': 'Masquer les appels résolus',
  'Show Resolved Clinic Calls': 'Afficher les appels résolus du poste de secours',
  'Hide Resolved Clinic Calls': 'Masquer les appels résolus du poste de secours',
  'Total Patients': 'Total des patients',
  'Show Log': 'Afficher le registre',
  'Hide Log': 'Masquer le registre',
  'Mark as Duplicate': 'Marquer comme doublon',
  'Mark as Priority': 'Marquer comme prioritaire',
  'Remove Priority': 'Retirer la priorité',
  'Delete Call': "Supprimer l'appel",
  'Staging Location': 'Emplacement de préparation',
  'Delivery Team': 'Équipe de livraison',
  'Mark Ready': 'Marquer comme prêt',
  'Equipment Details': "Détails de l'équipement",
  'Supervisor Call Sign': 'Indicatif du superviseur',
  'Supervisor Name (optional)': 'Nom du superviseur (facultatif)',
  Certification: 'Certification',
  'Refresh Post': 'Actualiser le poste',
  'No location': 'Aucune position',
  'Clinic Status': 'Statut du poste de secours',
  'Team Members': "Membres de l'équipe",
  'Team Status': "Statut de l'équipe",
  'Team Name': "Nom de l'équipe",
  'Add New Team': 'Ajouter une nouvelle équipe',
  'Edit Team': "Modifier l'équipe",
  'Add New Supervisor': 'Ajouter un nouveau superviseur',
  'Edit Supervisor': 'Modifier le superviseur',
  Notes: 'Notes',
  'Add notes': 'Ajouter des notes',
  'Add notes about this equipment': 'Ajouter des notes sur cet équipement',
  'Not Set': 'Non défini',
  'Call ID': "ID d'appel",
  'No log entries': "Aucune entrée dans le registre",
  'Log for Call': "Registre de l'appel",
  'PRIORITY CALL: Life threat to patient/provider': 'APPEL PRIORITAIRE : menace vitale pour le patient ou l’intervenant',
  Edit: 'Modifier',
  Delete: 'Supprimer',
  'No members': 'Aucun membre',
  'Activity Log': 'Registre d’activité',
  'Add Clinic Walkup': 'Ajouter une présentation spontanée',
  Cancel: 'Annuler',
  Submit: 'Envoyer',
  'Member name': 'Nom du membre',
  'Add member': 'Ajouter un membre',
  'Save Changes': 'Enregistrer les modifications',
  'Create Team': "Créer l'équipe",
  'Create Supervisor': 'Créer le superviseur',
  Source: 'Source',
  'Assign Team': 'Assigner une équipe',
  'Select a team': 'Sélectionner une équipe',
  'Venue Map': 'Plan du site',
  'Posting Schedule': 'Horaire des postes',
  'End Event': "Terminer l'événement",
  Venues: 'Sites',
  'Clear Event': "Réinitialiser l'événement",
  'Export Summary': 'Exporter le résumé',
};

export const BUILTIN_PRESETS: Record<BuiltinPresetId, DispatchVocabularyPresetSummary> = {
  [DEFAULT_PRESET_ID]: {
    id: DEFAULT_PRESET_ID,
    name: 'CrowdCAD Default',
    terms: CROWDCAD_DEFAULT_TERMS,
  },
  [FRENCH_PRESET_ID]: {
    id: FRENCH_PRESET_ID,
    name: 'CrowdCAD French',
    terms: CROWDCAD_FRENCH_TERMS,
  },
};

export function isBuiltinPresetId(id: string): id is BuiltinPresetId {
  return (BUILTIN_PRESET_IDS as readonly string[]).includes(id);
}
