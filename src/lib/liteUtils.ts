/**
 * Utility functions to identify and work with Lite pages.
 * Lite pages are routes under `/lite` and must be completely local-only.
 */

/**
 * Check if a pathname is a Lite route.
 * @param pathname - The route pathname (e.g., '/lite/create', '/events/123/dispatch')
 * @returns true if the pathname is under /lite, false otherwise
 */
export function isLiteRoute(pathname: string): boolean {
  return pathname.startsWith('/lite');
}

/**
 * Extract the Lite event ID from a Lite route pathname.
 * Example: '/lite/events/abc123/dispatch' -> 'abc123'
 * @param pathname - The route pathname
 * @returns The event ID or null if not found
 */
export function extractLiteEventId(pathname: string): string | null {
  const match = pathname.match(/^\/lite\/events\/([^/]+)/);
  return match?.[1] ?? null;
}

/**
 * Assert that a file is NOT importing Firebase, Auth, Firestore, or DataConnect.
 * This is a development-time check; runtime import detection is done via static analysis.
 * @param fileContent - The full file content as a string
 * @param filePath - The file path (for error messages)
 * @throws Error if forbidden imports are detected
 */
export function assertNoCloudImports(fileContent: string, filePath: string): void {
  const forbiddenPatterns = [
    /import\s+.*from\s+['"]@\/app\/firebase['"]/,
    /import\s+.*from\s+['"]firebase\/auth['"]/,
    /import\s+.*from\s+['"]firebase\/firestore['"]/,
    /import\s+.*from\s+['"]firebase\/storage['"]/,
    /import\s+.*from\s+['"]@\/hooks\/useauth['"]/,
    /import\s+.*from\s+['"]@\/hooks\/useDataCollection['"]/,
    /from\s+['"]@\/app\/firebase['"]/,
    /from\s+['"]firebase\/auth['"]/,
    /from\s+['"]firebase\/firestore['"]/,
    /from\s+['"]firebase\/storage['"]/,
  ];

  const violations: string[] = [];

  forbiddenPatterns.forEach((pattern) => {
    if (pattern.test(fileContent)) {
      const match = fileContent.match(pattern);
      violations.push(match?.[0] || pattern.toString());
    }
  });

  if (violations.length > 0) {
    throw new Error(
      `Lite file "${filePath}" contains forbidden cloud imports:\n${violations.join('\n')}\n` +
      `Lite pages must NOT import Firebase, Auth, Firestore, Storage, or cloud hooks.`
    );
  }
}
