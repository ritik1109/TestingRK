const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const backendRoot = path.join(projectRoot, 'backend');
const mobileRoot = path.join(projectRoot, 'mobile');
const expoCli = path.join(mobileRoot, 'node_modules', 'expo', 'bin', 'cli');

if (!fs.existsSync(path.join(backendRoot, 'node_modules'))) {
  console.error('Backend dependencies are missing. Run npm install in the backend folder first.');
  process.exit(1);
}

if (!fs.existsSync(expoCli)) {
  console.error('Mobile dependencies are missing. Run npm install in the mobile folder first.');
  process.exit(1);
}

const children = [
  {
    name: 'Backend',
    child: spawn(process.execPath, ['server.js'], {
      cwd: backendRoot,
      env: process.env,
      stdio: 'inherit',
    }),
  },
  {
    name: 'Expo',
    child: spawn(process.execPath, [expoCli, 'start', '--lan'], {
      cwd: mobileRoot,
      env: process.env,
      stdio: 'inherit',
    }),
  },
];

let shuttingDown = false;
let exitCode = 0;
let remaining = children.length;

for (const { name, child } of children) {
  child.on('error', (error) => {
    console.error(`${name} failed to start: ${error.message}`);
    exitCode = 1;
  });

  child.on('close', (code) => {
    if (code && code !== 0) exitCode = code;
    remaining -= 1;
    if (remaining === 0) process.exitCode = exitCode;
  });
}

function stopChildren() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children) {
    if (child.exitCode === null && !child.killed) child.kill();
  }
}

process.on('SIGINT', stopChildren);
process.on('SIGTERM', stopChildren);
