export {};

declare global {
  interface WindowEventMap {
    'open-posting-schedule': CustomEvent<void>;
    'open-event-summary': CustomEvent<void>;
    'open-lite-clear-event': CustomEvent<void>;
    'open-lite-export-summary': CustomEvent<void>;
  }
}