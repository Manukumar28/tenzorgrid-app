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
