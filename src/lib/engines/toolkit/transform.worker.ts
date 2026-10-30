import type { SemanticCommand } from '$lib/workspace/editing';
import { sourceDigest } from '$lib/workspace/project';
import { readTransformationResult } from '$lib/workspace/editing/evidence';
interface Session {
  resolve(name: string): { free(): void } | undefined;
  qualifiedName(handle: { free(): void }): string | undefined;
  memberExtent(handle: { free(): void }): string | undefined;
  checkEdit(ops: string): string;
  edit(ops: string): string;
  units(): string;
  source(unit: number): string | undefined;
  free(): void;
}
interface Toolkit {
  default(options: { module_or_path: string }): Promise<unknown>;
  PreparedLibrary: {
    fromSnapshot(
      prepared: Uint8Array,
      bundle: string,
      cache: Uint8Array,
    ): unknown;
  };
  Session: {
    fromSourcesWithPreparedLibrary(sources: string, library: unknown): Session;
  };
}
const identifier = /^[A-Za-z_]\w*$/,
  qualified = /^[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*$/;
function operation(command: SemanticCommand): object {
  if (!identifier.test(command.name))
    throw new Error('Use a simple SysML identifier.');
  if (command.kind === 'rename') {
    if (!qualified.test(command.target))
      throw new Error('This rename requires a simple qualified target.');
    return { op: 'rename', target: command.target, newName: command.name };
  }
  if (command.kind === 'createPart')
    return {
      op: 'insertMember',
      owner: command.owner,
      text: `part ${command.name} : ${command.type};`,
    };
  if (command.kind === 'connectPorts')
    return {
      op: 'insertMember',
      owner: command.owner,
      text: `connection ${command.name} connect ${command.from.usage}.${command.from.port} to ${command.to.usage}.${command.to.port};`,
    };
  if (
    !qualified.test(command.owner) ||
    !qualified.test(command.subject) ||
    !['GeneralView', 'InterconnectionView'].includes(command.family)
  )
    throw new Error(
      'Choose a source package, subject and supported view kind.',
    );
  return {
    op: 'insertMember',
    owner: command.owner,
    text: `view ${command.name} : StandardViewDefinitions::${command.family} { expose ${command.subject}; }`,
  };
}
self.onmessage = async (event: MessageEvent<unknown>) => {
  let session: Session | undefined;
  try {
    const { base, documents, command } = readTransformRequest(event.data);
    const toolkit = (await import(
      /* @vite-ignore */ base + 'sysmlv2.js'
    )) as Toolkit;
    await toolkit.default({ module_or_path: base + 'sysmlv2_bg.wasm' });
    async function unzip(name: string) {
      const response = await fetch(base + 'stdlib/' + name);
      if (!response.ok || !response.body)
        throw new Error('Toolkit library asset is unavailable.');
      return new Uint8Array(
        await (
          response.headers.get('content-encoding') === 'gzip'
            ? response
            : new Response(
                response.body.pipeThrough(new DecompressionStream('gzip')),
              )
        ).arrayBuffer(),
      );
    }
    const [prepared, bundle, cache] = await Promise.all([
      unzip('sysml-library.prepared.gz'),
      unzip('sysml-library.json.gz'),
      unzip('sysml-library.libcache.gz'),
    ]);
    const library = toolkit.PreparedLibrary.fromSnapshot(
      prepared!,
      new TextDecoder().decode(bundle),
      cache!,
    );
    session = toolkit.Session.fromSourcesWithPreparedLibrary(
      JSON.stringify(documents),
      library,
    );
    let owner;
    if (command.kind !== 'rename') {
      const handle = session.resolve(command.owner);
      if (!handle)
        throw new Error('The selected source owner did not resolve.');
      try {
        if (session.qualifiedName(handle) !== command.owner)
          throw new Error('The selected source owner is ambiguous.');
        const raw = session.memberExtent(handle);
        if (!raw) throw new Error('The owner has no editable source extent.');
        const extent = JSON.parse(raw) as {
          unit: number;
          start: number;
          end: number;
        };
        const units = JSON.parse(session.units()) as {
          unit: number;
          name: string;
        }[];
        const matches = units.filter((item) => item.unit === extent.unit);
        if (matches.length !== 1)
          throw new Error('The owner has no unique source unit.');
        owner = {
          id: command.owner,
          unit: matches[0]!.name,
          start: extent.start,
          end: extent.end,
        };
      } finally {
        handle.free();
      }
    }
    const operations = JSON.stringify([operation(command)]),
      preview = JSON.parse(session.checkEdit(operations));
    if (!preview.wouldCommit || preview.findings?.length)
      throw new Error(
        'The transformation was refused: ' + JSON.stringify(preview),
      );
    const result = JSON.parse(session.edit(operations));
    if (result.findings?.length || !result.splices?.length)
      throw new Error('The complete requested transformation did not commit.');
    const units = JSON.parse(session.units()) as {
      name: string;
      unit: number;
    }[];
    const value = documents.map((document) => {
      const matching = units.filter((unit) => unit.name === document.name);
      const text =
        matching.length === 1 ? session!.source(matching[0]!.unit) : undefined;
      if (text === undefined)
        throw new Error('The transformation omitted a source file.');
      return { name: document.name, text };
    });
    self.postMessage({
      value: readTransformationResult({
        documents: value,
        evidence: {
          beforeHash: await sourceDigest(documents),
          afterHash: await sourceDigest(value),
          splices: result.splices,
          ...(owner ? { owner } : {}),
        },
      }),
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    session?.free();
  }
};
import { readTransformRequest } from '../workers/schema';
