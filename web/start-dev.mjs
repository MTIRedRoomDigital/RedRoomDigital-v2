import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

const child = spawn(process.execPath, [join(__dirname, 'node_modules/next/dist/bin/next'), 'dev', '--port', '3000'], {
  cwd: __dirname,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code));
