const bcrypt = require('bcryptjs');
const readline = require('readline');

/** Read the admin password without echoing it, then print only its bcrypt hash. */
async function main() {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Run this command in an interactive terminal so the password can be hidden.');
  }

  readline.emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  process.stdout.write('Admin password (hidden, minimum 12 characters): ');

  const password = await new Promise((resolve, reject) => {
    let value = '';
    input.on('keypress', (character, key) => {
      if (key?.ctrl && key.name === 'c') {
        input.setRawMode(false);
        reject(new Error('Password entry cancelled.'));
      } else if (key?.name === 'return') {
        input.setRawMode(false);
        process.stdout.write('\n');
        resolve(value);
      } else if (key?.name === 'backspace') {
        value = value.slice(0, -1);
      } else if (character && !key?.ctrl) {
        value += character;
      }
    });
  });

  if (typeof password !== 'string' || password.length < 12 || password.length > 200) {
    throw new Error('Password must be between 12 and 200 characters.');
  }
  process.stdout.write(`${await bcrypt.hash(password, 12)}\n`);
}

main().catch((error) => {
  if (process.stdin.isTTY && process.stdin.setRawMode) process.stdin.setRawMode(false);
  console.error(error.message);
  process.exitCode = 1;
});
