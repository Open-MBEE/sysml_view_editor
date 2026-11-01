import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import { resolve, sep } from 'node:path';
import test from 'node:test';
import { createServer } from 'vite';

// Exercise Vite's real watcher: generated engine checkouts and test artifacts
// must never consume watchers or trigger reloads, while app source stays live.
test('dev watcher excludes generated directories and retains source watching', async () => {
  const server = await createServer({
    server: { middlewareMode: true, hmr: false },
    logLevel: 'silent',
  });
  try {
    const deadline = Date.now() + 30_000;
    while (!server.watcher.getWatched()[resolve('src')]) {
      assert.ok(Date.now() < deadline, 'source watcher must become ready');
      await setTimeout(20);
    }
    const watched = Object.keys(server.watcher.getWatched());
    for (const directory of ['sandbox', 'static/vendor']) {
      const generated = resolve(directory);
      assert.equal(
        watched.some(
          (path) => path === generated || path.startsWith(generated + sep),
        ),
        false,
        `${directory} must be excluded from development watching`,
      );
    }
    assert.ok(watched.includes(resolve('src')));
  } finally {
    await server.close();
  }
});
