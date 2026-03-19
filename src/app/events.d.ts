export {};

declare global {
  interface WindowEventMap {
    'open-venue-map': CustomEvent<void>;
    'open-posting-schedule': CustomEvent<void>;
    'open-end-event': CustomEvent<void>;
    'open-lite-clear-event': CustomEvent<void>;
    'open-lite-export-summary': CustomEvent<void>;
  }
}