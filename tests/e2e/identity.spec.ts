import { readdir, readFile, writeFile } from 'node:fs/promises';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, ready } from './support';
import type {
  SourceDocument,
  ModelSnapshot,
} from '../../src/lib/workspace/project';
import {
  readModelSnapshot,
  validateDocuments,
} from '../../src/lib/workspace/project';
import {
  validateEvaluation,
  type EvaluatedView,
} from '../../src/lib/workspace/views';
import {
  readSemanticRequest,
  readTransformRequest,
  readWorkerReply,
} from '../../src/lib/engines/workers/schema';
import { checkPostconditions } from '../../src/lib/workspace/editing';

// Contract investigation: execute the production workers with their real WASM
// assets. This does not assert UI layout retention or implement reconciliation.
async function engineProbe(page: Page) {
  const assets = await readdir(new URL('../../build/assets/', import.meta.url));
  function workerAsset(prefix: string) {
    const matches = assets.filter(
      (name) => name.startsWith(prefix) && name.endsWith('.js'),
    );
    expect(matches).toHaveLength(1);
    return '/assets/' + matches[0]!;
  }
  const semantic = workerAsset('semantic.worker-');
  const transformation = workerAsset('transform.worker-');
  async function request(url: string, input: unknown): Promise<unknown> {
    const reply = readWorkerReply(
      await page.evaluate(
        async ({ url, input }) => {
          const worker = new Worker(url, { type: 'module' });
          try {
            return await new Promise<unknown>((resolve, reject) => {
              const timer = setTimeout(
                () => reject(new Error('Identity probe worker timed out.')),
                60_000,
              );
              worker.onmessage = (event) => {
                clearTimeout(timer);
                resolve(event.data);
              };
              worker.onerror = (event) => {
                clearTimeout(timer);
                reject(new Error(event.message));
              };
              worker.postMessage(input);
            });
          } finally {
            worker.terminate();
          }
        },
        { url, input },
      ),
    );
    if ('error' in reply) throw new Error(reply.error);
    return reply.value;
  }
  return {
    async snapshot(
      documents: readonly SourceDocument[],
      views: readonly string[],
    ) {
      const model = readModelSnapshot(
        await request(
          semantic,
          readSemanticRequest({
            protocolVersion: 1,
            base: '/vendor/opensysml/',
            operation: 'parse',
            documents,
          }),
        ),
      );
      expect(
        model.diagnostics.filter((item) => item.severity === 'error'),
      ).toEqual([]);
      const evaluated: Record<string, EvaluatedView> = {};
      for (const view of views) {
        evaluated[view] = validateEvaluation(
          await request(
            semantic,
            readSemanticRequest({
              protocolVersion: 1,
              base: '/vendor/opensysml/',
              operation: 'evaluate',
              documents,
              modelHash: model.modelHash,
              view,
            }),
          ),
          model.modelHash,
          view,
        );
        expect(evaluated[view].status).toBe('complete');
        expect(evaluated[view].renderStatus).toBe('available');
      }
      return { documents, model, views: evaluated };
    },
    async rename(
      documents: readonly SourceDocument[],
      target: string,
      name: string,
    ) {
      return validateDocuments(
        await request(
          transformation,
          readTransformRequest({
            protocolVersion: 1,
            base: '/vendor/sysml-toolkit/',
            documents,
            command: { kind: 'rename', target, name },
          }),
        ),
      );
    },
  };
}

interface Snapshot {
  documents: readonly SourceDocument[];
  model: ModelSnapshot;
  views: Record<string, EvaluatedView>;
}

function subject(view: EvaluatedView, qualifiedName: string) {
  const matches = view.correspondence.filter(
    (item) => item.subject.qualifiedName === qualifiedName,
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function portContexts(
  view: EvaluatedView,
  qualifiedName: string,
  primaryName = 'primary',
) {
  const matches = view.correspondence.filter(
    (item) => item.subject.qualifiedName === qualifiedName,
  );
  const expectedOccurrences = view.view === 'AssemblyViews::structure' ? 3 : 2;
  expect(matches).toHaveLength(expectedOccurrences);
  // Shared inherited declaration; only the occurrence path distinguishes usages.
  expect(new Set(matches.map((item) => item.subject.id)).size).toBe(1);
  expect(
    new Set(matches.map((item) => JSON.stringify(item.context))).size,
  ).toBe(expectedOccurrences);
  expect(new Set(matches.map((item) => item.symbol)).size).toBe(
    expectedOccurrences,
  );
  for (const match of matches) expect(match.subject.origin).toBeDefined();
  const ownerNames = matches
    .map(
      (match) =>
        view.correspondence.find(
          (candidate) => candidate.subject.id === match.context.at(-2),
        )?.subject.qualifiedName,
    )
    .sort();
  expect(ownerNames).toEqual(
    [
      `Assembly::Station::bay::${primaryName}`,
      'Assembly::Station::bay::standby',
      ...(expectedOccurrences === 3 ? ['Assembly::Station::monitor'] : []),
    ].sort(),
  );
  return matches;
}

async function saveEvidence(testInfo: TestInfo, name: string, value: unknown) {
  const path = testInfo.outputPath(name + '.json');
  await writeFile(path, JSON.stringify(value, null, 2));
  await testInfo.attach(name, { path, contentType: 'application/json' });
}

test('investigates identity across source revisions with the pinned browser workers', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await ready(page);
  const probe = await engineProbe(page);
  const documents: SourceDocument[] = await Promise.all(
    ['model.sysml', 'views.sysml'].map(async (name) => ({
      name,
      text: await readFile(
        new URL(`../../examples/assembly/${name}`, import.meta.url),
        'utf8',
      ),
    })),
  );
  documents.push({
    name: 'notes.sysml',
    text: 'package Notes { part def Marker; part def SpareX :> Assembly::Device; }\n',
  });
  const views = ['AssemblyViews::structure', 'AssemblyViews::devices'];
  const captures: Record<string, Snapshot> = {};
  async function capture(name: string, sources: readonly SourceDocument[]) {
    const result = await probe.snapshot(sources, views);
    captures[name] = result;
    await saveEvidence(testInfo, name, result);
    return result;
  }
  const baseline = await capture('baseline', documents);
  const repeated = await capture('identical-fresh-workers', documents);
  expect(repeated).toEqual(baseline);
  for (const id of views)
    portContexts(baseline.views[id]!, 'Assembly::Device::output');

  const unrelated = await capture(
    'unrelated-file-edit',
    documents.map((doc) =>
      doc.name === 'notes.sysml'
        ? { ...doc, text: doc.text.replace('Marker', 'MarkerChanged') }
        : doc,
    ),
  );
  expect(unrelated.model.modelHash).not.toBe(baseline.model.modelHash);
  for (const id of views) {
    const { modelHash: beforeHash, ...before } = baseline.views[id]!;
    const { modelHash: afterHash, ...after } = unrelated.views[id]!;
    expect(afterHash).not.toBe(beforeHash);
    expect(after).toEqual(before);
  }

  const renamedSources = await probe.rename(
    documents,
    'Assembly::Device',
    'ControllerDriver',
  );
  expect(renamedSources).toEqual(
    documents.map((doc) => ({
      ...doc,
      text: doc.text.replaceAll('Device', 'ControllerDriver'),
    })),
  );
  const renamed = await capture('toolkit-definition-rename', renamedSources);
  const primary = 'Assembly::Station::bay::primary';
  const standby = 'Assembly::Station::bay::standby';
  for (const id of views) {
    const before = subject(baseline.views[id]!, primary);
    const after = subject(renamed.views[id]!, primary);
    expect(after.symbol).toBe(before.symbol);
    expect(after.subject.id).not.toBe(before.subject.id);
    expect(after.context).not.toEqual(before.context);
    portContexts(renamed.views[id]!, 'Assembly::ControllerDriver::output');
  }
  expect(
    renamed.model.elements.find((item) => item.id === primary)?.typeId,
  ).toBe('Assembly::ControllerDriver');

  const usageSources = await probe.rename(documents, primary, 'activeDevice');
  const usage = await capture('toolkit-usage-rename', usageSources);
  for (const id of views) {
    const before = subject(baseline.views[id]!, primary);
    const after = subject(
      usage.views[id]!,
      'Assembly::Station::bay::activeDevice',
    );
    expect(after.symbol).toBe(before.symbol);
    expect(after.subject.id).not.toBe(before.subject.id);
    portContexts(usage.views[id]!, 'Assembly::Device::output', 'activeDevice');
  }
  expect(usageSources[0]!.text).toContain(
    'connect activeDevice.output to standby.input',
  );
  expect(usage.model.elements.some((item) => item.id === primary)).toBe(false);

  const prefix = '// Identity probe: λ and 🔧 shift UTF-8 byte offsets.\n';
  const shifted = await capture(
    'unicode-prefix',
    documents.map((doc) =>
      doc.name === 'model.sysml' ? { ...doc, text: prefix + doc.text } : doc,
    ),
  );
  for (const id of views) {
    const before = subject(baseline.views[id]!, primary);
    const after = subject(shifted.views[id]!, primary);
    expect(after.symbol).toBe(before.symbol);
    expect(after.subject.origin!.offset - before.subject.origin!.offset).toBe(
      Buffer.byteLength(prefix),
    );
    expect(after.context).not.toEqual(before.context);
  }

  const reordered = await capture(
    'reordered-usages',
    documents.map((doc) =>
      doc.name === 'model.sysml'
        ? {
            ...doc,
            text: doc.text.replace(
              'part primary : Device;\n            part standby : Device;',
              'part standby : Device;\n            part primary : Device;',
            ),
          }
        : doc,
    ),
  );
  for (const id of views) {
    const before = subject(baseline.views[id]!, primary);
    const wrongAfter = subject(reordered.views[id]!, standby);
    // Even the combined symbol + origin + context can now name another usage.
    expect(wrongAfter.symbol).toBe(before.symbol);
    expect(wrongAfter.subject.id).toBe(before.subject.id);
    expect(wrongAfter.context).toEqual(before.context);
    expect(subject(reordered.views[id]!, primary).symbol).not.toBe(
      before.symbol,
    );
  }

  const inserted = await capture(
    'inserted-sibling',
    documents.map((doc) =>
      doc.name === 'model.sysml'
        ? {
            ...doc,
            text: doc.text.replace(
              'part primary : Device;',
              'part auxiliary : Device;\n            part primary : Device;',
            ),
          }
        : doc,
    ),
  );
  for (const id of views)
    expect(subject(inserted.views[id]!, primary).symbol).not.toBe(
      subject(baseline.views[id]!, primary).symbol,
    );

  const movedFile = await capture(
    'renamed-source-file',
    documents.map((doc) =>
      doc.name === 'model.sysml' ? { ...doc, name: 'assembly.sysml' } : doc,
    ),
  );
  for (const id of views) {
    const before = subject(baseline.views[id]!, primary);
    const after = subject(movedFile.views[id]!, primary);
    expect(after.subject.id).not.toBe(before.subject.id);
    expect(after.subject.origin?.file).toBe('assembly.sysml');
    expect(after.context).not.toEqual(before.context);
  }

  const retyped = await capture(
    'retyped-usage',
    documents.map((doc) =>
      doc.name === 'model.sysml'
        ? {
            ...doc,
            text: doc.text.replace(
              'part primary : Device;',
              'part primary : Notes::SpareX;',
            ),
          }
        : doc,
    ),
  );
  expect(
    retyped.model.elements.find((item) => item.id === primary)?.typeId,
  ).toBe('Notes::SpareX');
  for (const id of views)
    expect(subject(retyped.views[id]!, primary).symbol).toBe(
      subject(baseline.views[id]!, primary).symbol,
    );

  const movedOwner = await capture(
    'changed-owner',
    documents.map((doc) =>
      doc.name === 'model.sysml'
        ? {
            ...doc,
            text: doc.text
              .replace('        ref part monitor : Device;\n', '')
              .replace(
                'part standby : Device;',
                'part standby : Device;\n            ref part monitor : Device;',
              ),
          }
        : doc,
    ),
  );
  expect(
    movedOwner.model.elements.some(
      (item) => item.id === 'Assembly::Station::monitor',
    ),
  ).toBe(false);
  expect(
    movedOwner.model.elements.find(
      (item) => item.id === 'Assembly::Station::bay::monitor',
    )?.ownerId,
  ).toBe('Assembly::Station::bay');

  const provenance = await Promise.all(
    ['opensysml', 'sysml-toolkit'].map(async (engine) => [
      engine,
      JSON.parse(
        await readFile(
          new URL(
            `../../static/vendor/${engine}/provenance.json`,
            import.meta.url,
          ),
          'utf8',
        ),
      ),
    ]),
  );
  await saveEvidence(
    testInfo,
    'engine-provenance',
    Object.fromEntries(provenance),
  );
  expect(Object.keys(captures)).toHaveLength(11);
});

test('inspects Toolkit rename lineage and replays its UTF-8 byte splices', async ({
  page,
}, testInfo) => {
  await ready(page);
  const documents = await Promise.all(
    ['model.sysml', 'views.sysml'].map(async (name) => ({
      name,
      text:
        (name === 'model.sysml' ? '// Unicode before the edits: λ 🔧\n' : '') +
        (await readFile(
          new URL(`../../examples/assembly/${name}`, import.meta.url),
          'utf8',
        )),
    })),
  );
  const probe = await engineProbe(page);
  const transformed = await probe.rename(
    documents,
    'Assembly::Device',
    'ControllerDriver',
  );
  const evidence = await page.evaluate(async (documents) => {
    const base = '/vendor/sysml-toolkit/';
    const toolkit = await import(base + 'sysmlv2.js');
    await toolkit.default({ module_or_path: base + 'sysmlv2_bg.wasm' });
    async function unzip(name: string) {
      const response = await fetch(base + 'stdlib/' + name);
      if (!response.ok || !response.body)
        throw new Error('Toolkit library unavailable.');
      const decompressed =
        response.headers.get('content-encoding') === 'gzip'
          ? response
          : new Response(
              response.body.pipeThrough(new DecompressionStream('gzip')),
            );
      return new Uint8Array(await decompressed.arrayBuffer());
    }
    const [prepared, bundle, cache] = await Promise.all([
      unzip('sysml-library.prepared.gz'),
      unzip('sysml-library.json.gz'),
      unzip('sysml-library.libcache.gz'),
    ]);
    const library = toolkit.PreparedLibrary.fromSnapshot(
      prepared,
      new TextDecoder().decode(bundle),
      cache,
    );
    const session = toolkit.Session.fromSourcesWithPreparedLibrary(
      JSON.stringify(documents),
      library,
    );
    function identity(qualifiedName: string) {
      const handle = session.resolve(qualifiedName);
      if (!handle) throw new Error('Toolkit did not resolve ' + qualifiedName);
      try {
        return {
          qualifiedName,
          id: session.elementId(handle),
          path: JSON.parse(session.revealPath(JSON.stringify(qualifiedName))),
        };
      } finally {
        handle.free();
      }
    }
    try {
      const names = [
        'Assembly::Device',
        'Assembly::Device::input',
        'Assembly::Device::output',
        'Assembly::Device::service',
        'Assembly::Station::bay::primary',
        'Assembly::Station::bay::standby',
      ];
      const before = names.map(identity);
      const units = JSON.parse(session.units()) as {
        name: string;
        unit: number;
      }[];
      const operations = JSON.stringify([
        { op: 'rename', target: names[0], newName: 'ControllerDriver' },
      ]);
      const preview = JSON.parse(session.checkEdit(operations));
      const result = JSON.parse(session.edit(operations));
      const after = names.map((name) =>
        identity(
          name.replace('Assembly::Device', 'Assembly::ControllerDriver'),
        ),
      );
      const sources = units.map((unit) => ({
        name: unit.name,
        text: session.source(unit.unit) as string,
      }));
      return { before, after, units, preview, result, sources };
    } finally {
      session.free();
    }
  }, documents);
  // Retain the full SDK result before assertions, including on a failed probe.
  await saveEvidence(testInfo, 'toolkit-rename-report', {
    documents,
    ...evidence,
  });
  expect(evidence.sources).toEqual(transformed);
  expect(evidence.preview.wouldCommit).toBe(true);
  expect(evidence.preview.findings).toEqual([]);
  expect(evidence.result.findings).toEqual([]);
  expect(evidence.preview.splices).toEqual(evidence.result.splices);
  expect(evidence.preview.idMap).toEqual(evidence.result.idMap);
  expect(evidence.result.splices.length).toBeGreaterThan(0);
  for (const splice of evidence.result.splices as { unit: string }[]) {
    expect(
      documents.filter((document) => document.name === splice.unit),
      'Every splice must belong to exactly one input source',
    ).toHaveLength(1);
  }
  expect(evidence.result.idMap).toContainEqual([
    evidence.before[0]!.id,
    evidence.after[0]!.id,
  ]);
  // This rename maps only the four changed UUIDs; untouched usage UUIDs are
  // stable here and omitted. Absence from idMap alone is not proof of identity.
  const changed = evidence.before.flatMap((before, index) =>
    before.id !== evidence.after[index]!.id
      ? [[before.id, evidence.after[index]!.id]]
      : [],
  );
  expect(changed).toHaveLength(4);
  expect(evidence.result.idMap).toEqual(expect.arrayContaining(changed));
  expect(evidence.result.idMap).toHaveLength(changed.length);
  for (const document of documents) {
    const unit = evidence.units.find((item) => item.name === document.name);
    expect(unit).toBeDefined();
    const splices = (
      evidence.result.splices as {
        unit: string;
        start: number;
        end: number;
        text: string;
      }[]
    )
      .filter((splice) => splice.unit === document.name)
      .sort((a, b) => b.start - a.start);
    let bytes = Buffer.from(document.text);
    let boundary = bytes.length;
    for (const splice of splices) {
      expect(
        Number.isInteger(splice.start) && Number.isInteger(splice.end),
      ).toBe(true);
      expect(splice.start).toBeGreaterThanOrEqual(0);
      expect(splice.end).toBeGreaterThanOrEqual(splice.start);
      expect(splice.end).toBeLessThanOrEqual(boundary);
      expect(bytes.subarray(splice.start, splice.end).toString('utf8')).toBe(
        'Device',
      );
      bytes = Buffer.concat([
        bytes.subarray(0, splice.start),
        Buffer.from(splice.text),
        bytes.subarray(splice.end),
      ]);
      boundary = splice.start;
    }
    expect(bytes.toString('utf8')).toBe(
      transformed.find((item) => item.name === document.name)!.text,
    );
  }

  const views = ['AssemblyViews::structure', 'AssemblyViews::devices'];
  const before = await probe.snapshot(documents, views);
  const after = await probe.snapshot(transformed, views);
  checkPostconditions(before.model, after.model, {
    kind: 'rename',
    target: 'Assembly::Device',
    name: 'ControllerDriver',
  });
  for (const [index, element] of evidence.before.entries()) {
    expect(
      before.model.elements.filter((item) => item.id === element.qualifiedName),
    ).toHaveLength(1);
    expect(
      after.model.elements.filter(
        (item) => item.id === evidence.after[index]!.qualifiedName,
      ),
    ).toHaveLength(1);
  }
  const mappings: Record<
    string,
    {
      before: string;
      after: string;
      subject: string | undefined;
      context: readonly string[];
    }[]
  > = {};
  for (const view of views) {
    const oldView = before.views[view]!;
    const newView = after.views[view]!;
    const origins = new Map<
      string,
      NonNullable<EvaluatedView['correspondence'][number]['subject']['origin']>
    >();
    for (const item of oldView.correspondence) {
      expect(item.subject.origin).toBeDefined();
      const existing = origins.get(item.subject.id);
      if (existing) expect(item.subject.origin).toEqual(existing);
      origins.set(item.subject.id, item.subject.origin!);
    }
    function transportOrigin(key: string) {
      const origin = origins.get(key);
      expect(
        origin,
        'Every matched subject/context must have a recorded origin',
      ).toBeDefined();
      const splices = evidence.result.splices as {
        unit: string;
        start: number;
        end: number;
        text: string;
      }[];
      let start = origin!.offset;
      let end = start + origin!.length;
      for (const splice of splices.filter(
        (item) => item.unit === origin!.file,
      )) {
        const delta =
          Buffer.byteLength(splice.text) - (splice.end - splice.start);
        if (splice.end <= origin!.offset) {
          start += delta;
          end += delta;
        } else if (splice.start >= origin!.offset + origin!.length) continue;
        else {
          // Only a verified name replacement wholly inside a declaration is
          // accepted here. This experiment does not match arbitrary text edits.
          expect(splice.start).toBeGreaterThanOrEqual(origin!.offset);
          expect(splice.end).toBeLessThanOrEqual(
            origin!.offset + origin!.length,
          );
          end += delta;
        }
      }
      return `${origin!.file}@${start}:${end - start}`;
    }
    const used = new Set<string>();
    mappings[view] = oldView.correspondence.map((item) => {
      const subjectId = transportOrigin(item.subject.id);
      const context = item.context.map(transportOrigin);
      const candidates = newView.correspondence.filter(
        (next) =>
          next.subject.id === subjectId &&
          JSON.stringify(next.context) === JSON.stringify(context),
      );
      expect(
        candidates,
        'Verified splices must identify exactly one occurrence',
      ).toHaveLength(1);
      const candidate = candidates[0]!;
      const oldName = item.subject.qualifiedName;
      const target = 'Assembly::Device';
      const renamedSubject =
        oldName && (oldName === target || oldName.startsWith(target + '::'))
          ? 'Assembly::ControllerDriver' + oldName.slice(target.length)
          : oldName;
      expect(candidate.subject.qualifiedName).toBe(renamedSubject);
      expect(
        used.has(candidate.symbol),
        'Two old symbols must never share a new match',
      ).toBe(false);
      used.add(candidate.symbol);
      return {
        before: item.symbol,
        after: candidate.symbol,
        subject: candidate.subject.qualifiedName,
        context: candidate.context,
      };
    });
    expect(used.size).toBe(newView.correspondence.length);
    portContexts(newView, 'Assembly::ControllerDriver::output');
  }
  await saveEvidence(testInfo, 'verified-rename-candidates', {
    before,
    after,
    mappings,
  });
});
