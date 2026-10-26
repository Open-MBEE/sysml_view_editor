import { mkdir, readFile, writeFile, cp, access, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  toolkitAssets,
  hashToolkitAssets,
  toolkitAssetsMatch,
} from './toolkit-assets.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const version = '0.10.10';
const sha256 =
  '93d6ef0a2140fceabc3115cd95d629146bc004c3959bfa23d715cce8b06cc13c';
const cache = resolve(root, 'sandbox/toolkit-study');
const destination = resolve(root, 'static/vendor/sysml-toolkit');
try {
  const stamp = JSON.parse(
    await readFile(resolve(destination, 'provenance.json'), 'utf8'),
  );
  if (
    stamp.version === version &&
    stamp.sha256 === sha256 &&
    (await toolkitAssetsMatch(destination, stamp.assets))
  )
    process.exit(0);
} catch {}
await mkdir(cache, { recursive: true });
const archive = resolve(cache, `sysml-wasm-${version}.tgz`);
try {
  await access(archive);
} catch {
  const response = await fetch(
    `https://github.com/Open-MBEE/sysml-toolkit/releases/download/v${version}/sysml-wasm-${version}.tgz`,
  );
  if (!response.ok)
    throw new Error(`Toolkit download failed: ${response.status}`);
  await writeFile(archive, new Uint8Array(await response.arrayBuffer()));
}
if (
  createHash('sha256')
    .update(await readFile(archive))
    .digest('hex') !== sha256
)
  throw new Error('Toolkit archive checksum mismatch.');
await rm(resolve(cache, 'package'), { recursive: true, force: true });
execFileSync('tar', ['-xzf', archive, '-C', cache]);
await mkdir(destination, { recursive: true });
const assets = await hashToolkitAssets(resolve(cache, 'package'));
for (const name of toolkitAssets) {
  await rm(resolve(destination, name), { recursive: true, force: true });
  await cp(resolve(cache, 'package', name), resolve(destination, name), {
    recursive: true,
  });
}
if (!(await toolkitAssetsMatch(destination, assets)))
  throw new Error('Prepared Toolkit assets do not match the verified archive.');
await writeFile(
  resolve(destination, 'provenance.json'),
  JSON.stringify(
    {
      version,
      sha256,
      assets,
      url: `https://github.com/Open-MBEE/sysml-toolkit/releases/tag/v${version}`,
    },
    null,
    2,
  ),
);
console.log(`Prepared pinned SysML Toolkit ${version} browser assets.`);
