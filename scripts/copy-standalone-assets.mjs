// Cross-platform replacement for `cp -r` in the build script.
// Copies everything the standalone Next.js server needs to actually run:
// static assets, public folder, .env, and the SQLite database.
import { cpSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const root = process.cwd();
const standalone = path.join(root, '.next', 'standalone');

function copy(from, to, label) {
  if (!existsSync(from)) {
    console.warn(`[copy-standalone-assets] SKIPPED (not found): ${label} -> ${from}`);
    return;
  }
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, force: true });
  console.log(`[copy-standalone-assets] OK: ${label}`);
}

copy(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), 'static assets');
copy(path.join(root, 'public'), path.join(standalone, 'public'), 'public folder');
copy(path.join(root, '.env'), path.join(standalone, '.env'), '.env');
copy(path.join(root, 'prisma', 'db'), path.join(standalone, 'prisma', 'db'), 'database');

console.log('[copy-standalone-assets] Done. Run: node .next/standalone/server.js');
