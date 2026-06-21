#!/usr/bin/env node

/**
 * Generates index.html files for navigation layers only (root + branch level).
 * Playwright report folders already have their own index.html and are left untouched.
 *
 * Expected structure:
 *   <pages-dir>/
 *     <branch>/
 *       <sha>/          ← Playwright report (skipped — already has index.html)
 *
 * Generated files:
 *   <pages-dir>/index.html           ← lists all branches
 *   <pages-dir>/<branch>/index.html  ← lists all commits for that branch
 *
 * Usage: node generate-index.js <pages-dir> <base-url>
 * Example: node generate-index.js ./report https://org.github.io/repo
 */

const fs = require("fs");
const path = require("path");

const [pagesDir, baseUrl] = process.argv.slice(2);

if (!pagesDir || !baseUrl) {
    console.error("Usage: generate-index.js <pages-dir> <base-url>");
    process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isDirectory(p) {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
}

/** Returns true if the folder is a Playwright report (has its own index.html) */
function isPlaywrightReport(p) {
    return fs.existsSync(path.join(p, "index.html"));
}

function mtime(p) {
    return fs.statSync(p).mtimeMs;
}

function writeFile(filePath, content) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✅ Written → ${filePath}`);
}

// ── HTML templates ────────────────────────────────────────────────────────────

function layout({ title, breadcrumbs, content }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      max-width: 860px;
      margin: 48px auto;
      padding: 0 24px;
      color: #1f2328;
    }
    nav { font-size: 0.85rem; color: #6b7280; margin-bottom: 24px; }
    nav a { color: #2563eb; text-decoration: none; }
    nav a:hover { text-decoration: underline; }
    nav span { margin: 0 6px; }
    h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 4px; }
    p.subtitle { color: #6b7280; font-size: 0.875rem; margin: 0 0 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th {
      text-align: left;
      padding: 8px 12px;
      border-bottom: 2px solid #e5e7eb;
      color: #6b7280;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f9fafb; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; color: #6b7280; }
    .empty { text-align: center; padding: 40px; color: #9ca3af; }
  </style>
</head>
<body>
  <nav>${breadcrumbs}</nav>
  ${content}
</body>
</html>`;
}

function breadcrumb(items) {
    return items
        .map(({ label, href }, i) =>
            i < items.length - 1
                ? `<a href="${href}">${label}</a><span>/</span>`
                : `<span>${label}</span>`
        )
        .join("");
}

// ── Branch-level index: lists all commit SHAs for a given branch ──────────────

function generateBranchIndex(branchDir, branchName) {
    const entries = fs.readdirSync(branchDir)
        .map((sha) => ({ sha, fullPath: path.join(branchDir, sha) }))
        .filter(({ fullPath }) => isDirectory(fullPath) && isPlaywrightReport(fullPath))
        .sort((a, b) => mtime(b.fullPath) - mtime(a.fullPath)); // newest first

    const rows = entries.length
        ? entries.map(({ sha }) => `
      <tr>
        <td class="mono">${sha}</td>
        <td><a href="${baseUrl}/${branchName}/${sha}/">View report →</a></td>
      </tr>`).join("\n")
        : `<tr><td colspan="2" class="empty">No reports yet.</td></tr>`;

    const content = `
  <h1>🌿 ${branchName}</h1>
  <p class="subtitle">${entries.length} report${entries.length !== 1 ? "s" : ""} — most recent first</p>
  <table>
    <thead>
      <tr>
        <th>Commit</th>
        <th>Report</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;

    writeFile(
        path.join(branchDir, "index.html"),
        layout({
            title: `${branchName} — Playwright Reports`,
            breadcrumbs: breadcrumb([
                { label: "Reports", href: `${baseUrl}/` },
                { label: branchName, href: "#" },
            ]),
            content,
        })
    );

    return entries.length;
}

// ── Root index: lists all branches ───────────────────────────────────────────

function generateRootIndex(branches) {
    const rows = branches.length
        ? branches.map(({ name, count }) => `
      <tr>
        <td><a href="${baseUrl}/${name}/">${name}</a></td>
        <td class="mono">${count} report${count !== 1 ? "s" : ""}</td>
      </tr>`).join("\n")
        : `<tr><td colspan="2" class="empty">No branches yet.</td></tr>`;

    const content = `
  <h1>📊 Playwright Reports</h1>
  <p class="subtitle">${branches.length} branch${branches.length !== 1 ? "es" : ""}</p>
  <table>
    <thead>
      <tr>
        <th>Branch</th>
        <th>Reports</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;

    writeFile(
        path.join(pagesDir, "index.html"),
        layout({
            title: "Playwright Reports",
            breadcrumbs: breadcrumb([{ label: "Reports", href: "#" }]),
            content,
        })
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────

const branches = fs.readdirSync(pagesDir)
    .filter((name) => !name.startsWith("."))
    .map((name) => ({ name, fullPath: path.join(pagesDir, name) }))
    .filter(({ fullPath }) => isDirectory(fullPath) && !isPlaywrightReport(fullPath))
    .sort((a, b) => mtime(b.fullPath) - mtime(a.fullPath));

const result = branches.map(({ name, fullPath }) => ({
    name,
    count: generateBranchIndex(fullPath, name),
}));

generateRootIndex(result);

console.log(`\n🎉 Done — ${result.length} branch index(es) generated`);