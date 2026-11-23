import { spawn } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Hostinger's LiteSpeed launcher (lsnode.js) loads the entry file with require(). Node rejects
// require() of an ES module graph that uses top-level await (ERR_REQUIRE_ASYNC_MODULE), which
// took production down once. This boots the real entry the same way and waits for listen().
const serverDir = path.resolve(import.meta.dirname, '..');
const [major, minor] = process.versions.node.split('.').map(Number);
const supportsRequireEsm = major > 22 || (major === 22 && minor >= 12) || (major === 20 && minor >= 19);

describe.skipIf(!supportsRequireEsm)('production entry point', () => {
  it('starts when loaded with require(), like Hostinger does', async () => {
    const child = spawn(process.execPath, ['-e', "require('./src/index.js')"], {
      cwd: serverDir,
      env: {
        PATH: process.env.PATH,
        SECRET_KEY: 'startup-test-secret-key-that-is-long-enough',
        DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
        PORT: String(40000 + Math.floor(Math.random() * 20000)),
        DOTENV_CONFIG_PATH: path.join(serverDir, 'does-not-exist.env'),
        DOTENV_CONFIG_QUIET: 'true',
      },
    });
    let output = '';
    const listening = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 15000);
      const onData = (chunk) => {
        output += chunk;
        if (/listening on/.test(output)) { clearTimeout(timer); resolve(true); }
        if (/ERR_REQUIRE_ASYNC_MODULE|Error \[ERR_/.test(output)) { clearTimeout(timer); resolve(false); }
      };
      child.stdout.on('data', onData);
      child.stderr.on('data', onData);
      child.on('exit', () => { clearTimeout(timer); resolve(/listening on/.test(output)); });
    });
    child.kill();
    expect(listening, output).toBe(true);
  }, 20000);
});
