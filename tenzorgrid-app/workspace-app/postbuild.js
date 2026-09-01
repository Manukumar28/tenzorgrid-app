// Vite always names its build entry index.html — rename it to workspace.html so
// existing links (dashboard sidebar, Career Growth grid) keep working unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const from = path.join(__dirname, '../public/index.html');
const to = path.join(__dirname, '../public/workspace.html');
fs.renameSync(from, to);
console.log(`[workspace-app] ${from} -> ${to}`);

// Copy the Python runtime out of node_modules into public/, so the notebook is served
// from our own origin rather than a third-party CDN. That matters for three reasons:
// learners behind restrictive corporate or campus networks can still run Python, the
// app does not break if a CDN has a bad day, and the version is pinned by package.json
// rather than by a URL someone edited months ago.
//
// Regenerated on every deploy, same as the Vite output, so none of it belongs in git.
const PYODIDE_FILES = [
  'pyodide.mjs',
  'pyodide.asm.js',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
];
const pyFrom = path.join(__dirname, 'node_modules/pyodide');
const pyTo = path.join(__dirname, '../public/pyodide');
fs.mkdirSync(pyTo, { recursive: true });
let copied = 0;
for (const f of PYODIDE_FILES) {
  const src = path.join(pyFrom, f);
  if (!fs.existsSync(src)) {
    console.error(`[workspace-app] MISSING ${src} — the Python notebook will not load.`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(pyTo, f));
  copied++;
}
console.log(`[workspace-app] copied ${copied} Pyodide runtime files -> ${pyTo}`);
