import { mkdir, readFile, writeFile, cp, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const commit = '08ef397841767b829e492bbecf6d723483b4421e';
const archiveHash =
  '896650da511eab806177f6f2a5d60f7ef57b44dfe617b2844a978f9adadb6d9d';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const overlays = [
  'evaluate_view.go',
  'validated_view.go',
  'validated_view_test.go',
  'geometry_pose.go',
  'geometry_view.go',
  'relationships.go',
  'relationships_test.go',
];
const structuralFixtures = ['model.sysml', 'views.sysml'];
const patchHash = digest(
  Buffer.concat(
    await Promise.all([
      ...overlays.map((name) =>
        readFile(resolve(root, 'engine-bridge/opensysml', name)),
      ),
      ...structuralFixtures.map((name) =>
        readFile(resolve(root, 'examples/assembly', name)),
      ),
    ]),
  ),
);
const destination = resolve(root, 'static/vendor/opensysml');
const cache = resolve(root, 'sandbox/opensysml-build');
try {
  const stamp = JSON.parse(
    await readFile(resolve(destination, 'provenance.json'), 'utf8'),
  );
  if (
    stamp.commit === commit &&
    stamp.patchHash === patchHash &&
    stamp.builderHash ===
      digest(await readFile(fileURLToPath(import.meta.url))) &&
    stamp.binaryHash ===
      digest(await readFile(resolve(destination, 'sysml-wasm.wasm'))) &&
    stamp.runtimeHash ===
      digest(await readFile(resolve(destination, 'wasm_exec.js')))
  )
    process.exit(0);
} catch {}
await mkdir(cache, { recursive: true });
async function download(url, file, sha) {
  try {
    await access(file);
  } catch {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Download failed: ${response.status} ${url}`);
    await writeFile(file, new Uint8Array(await response.arrayBuffer()));
  }
  if (digest(await readFile(file)) !== sha)
    throw new Error(`Checksum mismatch: ${file}`);
}
const archive = resolve(cache, 'source.tar.gz');
await download(
  `https://codeload.github.com/Open-MBEE/OpenSysML/tar.gz/${commit}`,
  archive,
  archiveHash,
);
const source = resolve(cache, 'source');
await mkdir(source, { recursive: true });
execFileSync('tar', ['-xzf', archive, '--strip-components=1', '-C', source]);
const fixtureFolder = resolve(
  source,
  'internal/frontend/combined/testdata/studio-assembly',
);
await mkdir(fixtureFolder, { recursive: true });
for (const name of structuralFixtures)
  await cp(
    resolve(root, 'examples/assembly', name),
    resolve(fixtureFolder, name),
  );
for (const [name, folder] of [
  ['evaluate_view.go', 'engine'],
  ['validated_view.go', 'combined'],
  ['validated_view_test.go', 'combined'],
])
  await cp(
    resolve(root, 'engine-bridge/opensysml', name),
    resolve(
      source,
      'internal/frontend',
      folder,
      name.endsWith('_test.go') ? 'studio_view_test.go' : 'studio_view.go',
    ),
  );
await cp(
  resolve(root, 'engine-bridge/opensysml/relationships.go'),
  resolve(source, 'internal/frontend/engine/studio_relationships.go'),
);
await cp(
  resolve(root, 'engine-bridge/opensysml/relationships_test.go'),
  resolve(source, 'internal/frontend/combined/studio_relationships_test.go'),
);
await cp(
  resolve(root, 'engine-bridge/opensysml/geometry_view.go'),
  resolve(source, 'internal/frontend/engine/studio_geometry.go'),
);
await cp(
  resolve(root, 'engine-bridge/opensysml/geometry_pose.go'),
  resolve(source, 'internal/exec/runtime/studio_geometry.go'),
);
async function replace(file, before, after) {
  const name = resolve(source, file),
    text = await readFile(name, 'utf8');
  if (!text.includes(before))
    throw new Error(`Pinned source seam changed: ${file}`);
  await writeFile(name, text.replace(before, after));
}
await replace(
  'internal/frontend/engine/engine.go',
  'case "RenderView":',
  'case "EvaluateRelationships":\n var req JRenderViewRequest\n if err := decode(params, &req); err != nil { return nil, err }\n return e.studioRelationships(&req)\n case "RenderView":',
);
await replace(
  'internal/frontend/engine/engine.go',
  'case "RenderView":',
  'case "EvaluateView":\n var req JRenderViewRequest\n if err := decode(params, &req); err != nil { return nil, err }\n return e.evaluateView(&req)\n case "RenderView":',
);
await replace(
  'internal/frontend/combined/combined.go',
  'case "GetServerInfo":',
  'case "EvaluateRelationships":\n return s.evaluateRelationships(ctx,params)\n case "EvaluateView":\n return s.evaluateView(ctx,params)\n case "GetServerInfo":',
);
await replace(
  'internal/frontend/combined/combined.go',
  'var capabilities = []string{',
  'var capabilities = []string{\n "studio_evaluate_view_v1",\n "studio_relationships_v1",',
);
let go = process.env.SYSML_GO;
if (!go) {
  try {
    const candidate = resolve(cache, 'go/bin/go');
    await access(candidate);
    go = candidate;
  } catch {}
}
if (!go) {
  if (process.platform !== 'linux' || process.arch !== 'x64')
    throw new Error('Set SYSML_GO to a local Go 1.25.11 binary.');
  const toolArchive = resolve(cache, 'go1.25.11.linux-amd64.tar.gz');
  await download(
    'https://go.dev/dl/go1.25.11.linux-amd64.tar.gz',
    toolArchive,
    '34f14304e856893f4ba30c2cacfe93906e9de7915c5f6aaaf3a81cdccd7ba30b',
  );
  execFileSync('tar', ['-xzf', toolArchive, '-C', cache]);
  go = resolve(cache, 'go/bin/go');
}
const toolchain = execFileSync(go, ['version'], { encoding: 'utf8' }).trim();
if (!toolchain.startsWith('go version go1.25.11 '))
  throw new Error('The native view bridge requires Go 1.25.11.');
await mkdir(destination, { recursive: true });
const env = {
  ...process.env,
  GOTOOLCHAIN: 'local',
  GOCACHE: resolve(cache, 'go-cache'),
  GOPATH: resolve(cache, 'go-path'),
  GOMODCACHE: resolve(cache, 'go-modules'),
};
execFileSync(
  go,
  ['test', './internal/frontend/combined', './internal/frontend/engine'],
  { cwd: source, env, stdio: 'inherit' },
);
execFileSync(
  go,
  [
    'build',
    '-mod=readonly',
    '-buildvcs=false',
    '-trimpath',
    '-ldflags',
    `-X main.Version=v0.10.0 -X main.Commit=${commit}`,
    '-o',
    resolve(destination, 'sysml-wasm.wasm'),
    './cmd/sysml-wasm',
  ],
  {
    cwd: source,
    env: { ...env, GOOS: 'js', GOARCH: 'wasm', CGO_ENABLED: '0' },
    stdio: 'inherit',
  },
);
const goRoot = execFileSync(go, ['env', 'GOROOT'], {
  env,
  encoding: 'utf8',
}).trim();
await cp(
  resolve(goRoot, 'lib/wasm/wasm_exec.js'),
  resolve(destination, 'wasm_exec.js'),
);
await cp(resolve(source, 'LICENSE'), resolve(destination, 'LICENSE'));
await writeFile(
  resolve(destination, 'provenance.json'),
  JSON.stringify(
    {
      commit,
      archiveHash,
      patchHash,
      toolchain,
      bridge: 'studio_evaluate_view_v1',
      builderHash: digest(await readFile(fileURLToPath(import.meta.url))),
      binaryHash: digest(
        await readFile(resolve(destination, 'sysml-wasm.wasm')),
      ),
      runtimeHash: digest(await readFile(resolve(destination, 'wasm_exec.js'))),
    },
    null,
    2,
  ),
);
console.log('Prepared OpenSysML with the validated native-view bridge.');
