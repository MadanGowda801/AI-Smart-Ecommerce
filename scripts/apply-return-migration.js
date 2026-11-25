import { spawn } from 'node:child_process';
import fs from 'node:fs';

const sql = fs.readFileSync('migrations/20261023_return_requests.sql', 'utf-8');

console.log('Applying return requests migration via InsForge CLI...');

const child = spawn('npx.cmd', ['-y', '@insforge/cli', 'db', 'query', sql], {
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Migration applied successfully!');
  } else {
    console.error('Migration exited with code:', code);
  }
  process.exit(code);
});
