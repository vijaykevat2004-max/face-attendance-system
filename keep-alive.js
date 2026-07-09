#!/usr/bin/env node
// Persistent server wrapper - keeps the Next.js server alive
const { spawn } = require('child_process');
const path = require('path');

const PROJECT_DIR = __dirname;
const LOG_FILE = path.join(PROJECT_DIR, 'server.log');

function startServer() {
  const child = spawn('npx', ['next', 'start', '-p', '3000'], {
    cwd: PROJECT_DIR,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  const logStream = require('fs').openSync(LOG_FILE, 'a');

  child.stdout.on('data', (data) => {
    process.stdout.write(data);
    require('fs').writeSync(logStream, data);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(data);
    require('fs').writeSync(logStream, data);
  });

  child.on('exit', (code) => {
    const ts = new Date().toISOString();
    require('fs').writeSync(logStream, `\n[${ts}] Server exited with code ${code}. Restarting in 2s...\n`);
    setTimeout(startServer, 2000);
  });

  child.on('error', (err) => {
    const ts = new Date().toISOString();
    require('fs').writeSync(logStream, `\n[${ts}] Server error: ${err.message}. Restarting in 2s...\n`);
    setTimeout(startServer, 2000);
  });

  // Handle parent signals
  process.on('SIGTERM', () => {
    child.kill('SIGTERM');
    process.exit(0);
  });
  process.on('SIGINT', () => {
    child.kill('SIGINT');
    process.exit(0);
  });
}

console.log('Starting persistent server wrapper...');
startServer();