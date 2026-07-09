// Date.now() alone collides under parallel Playwright workers — two scenarios
// can call it within the same millisecond and produce identically-named test
// data (e.g. two venues named "Dispatch-Venue-1783612577731"), which then
// fails strict-mode locators expecting a single match.
export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
