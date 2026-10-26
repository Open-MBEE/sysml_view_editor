import { readdir, readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export const toolkitAssets = [
  'sysmlv2.js',
  'sysmlv2_bg.wasm',
  'stdlib',
  'LICENSE',
  'LICENSE-EPL-2.0',
  'THIRD-PARTY-NOTICES.md',
  'buildinfo.json',
];

export async function hashToolkitAssets(directory) {
  const hashes = {};
  async function visit(name) {
    const path = resolve(directory, name);
    const stat = await lstat(path);
    if (stat.isDirectory()) {
      for (const child of (await readdir(path)).sort())
        await visit(`${name}/${child}`);
    } else if (stat.isFile())
      hashes[name] = createHash('sha256')
        .update(await readFile(path))
        .digest('hex');
    else throw new Error(`Unsupported Toolkit asset: ${name}`);
  }
  for (const name of toolkitAssets) await visit(name);
  return hashes;
}

export async function toolkitAssetsMatch(directory, expected) {
  if (!expected || typeof expected !== 'object' || Array.isArray(expected))
    return false;
  try {
    const actual = await hashToolkitAssets(directory);
    const keys = Object.keys(actual);
    return (
      keys.length === Object.keys(expected).length &&
      keys.every((name) => actual[name] === expected[name])
    );
  } catch {
    return false;
  }
}
