import type { SemanticCommand } from '$lib/workspace/editing';
import type { SourceDocument } from '$lib/workspace/project';
interface Session {
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
    self.postMessage({ value });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    session?.free();
  }
};
import { readTransformRequest } from '../workers/schema';
