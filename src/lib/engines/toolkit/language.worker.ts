import { Type } from 'typebox';
import { validator } from '$lib/contracts/validation';
import {
  SourceDocumentsSchema,
  validateDocuments,
} from '$lib/workspace/project';
import {
  LanguageQuerySchema,
  readLanguageQuery,
} from '$lib/workspace/language';
import { sourcePosition, sourceURI } from '$lib/workspace/language/positions';
import { normalizeLanguage } from './language-normalize';
const readRequest = validator(
  Type.Object(
    {
      protocolVersion: Type.Literal(1),
      documents: SourceDocumentsSchema,
      query: LanguageQuerySchema,
      base: Type.String({ minLength: 1 }),
    },
    { additionalProperties: false },
  ),
  'Invalid language request',
);
interface Server {
  handle(input: string): string[];
  setWorkspace(input: string): void;
  free(): void;
}
interface Library {
  free(): void;
}
interface Toolkit {
  default(options: { module_or_path: string }): Promise<unknown>;
  PreparedLibrary: {
    fromSnapshot(
      prepared: Uint8Array,
      bundle: string,
      cache: Uint8Array,
      keepHostParts: boolean,
    ): Library;
  };
  LspServer: { withPreparedLibrary(library: Library): Server };
}
self.onmessage = async (event: MessageEvent<unknown>) => {
  let server: Server | undefined, library: Library | undefined;
  try {
    const request = readRequest(event.data),
      sources = validateDocuments(request.documents),
      query = readLanguageQuery(request.query);
    const file = sources.find((s) => s.name === query.file);
    if (!file) throw new Error('Language query source is unavailable.');
    const position = sourcePosition(file.text, query.offset),
      base = request.base;
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
    library = toolkit.PreparedLibrary.fromSnapshot(
      prepared!,
      new TextDecoder().decode(bundle),
      cache!,
      true,
    );
    server = toolkit.LspServer.withPreparedLibrary(library);
    let id = 0;
    function send(method: string, params: unknown): unknown {
      const current = ++id;
      const replies = server!
        .handle(JSON.stringify({ jsonrpc: '2.0', id: current, method, params }))
        .map((value) => JSON.parse(value) as Record<string, unknown>);
      const reply = replies.find((value) => value.id === current);
      if (!reply || reply.error !== undefined || !('result' in reply))
        throw new Error('Language server request failed.');
      return reply.result;
    }
    const initialize = send('initialize', {
      processId: null,
      rootUri: 'file:///workspace/',
      capabilities: { general: { positionEncodings: ['utf-16'] } },
    }) as { capabilities?: { positionEncoding?: unknown } };
    if (initialize?.capabilities?.positionEncoding !== 'utf-16')
      throw new Error('Language server did not confirm UTF-16 positions.');
    server.handle(
      JSON.stringify({ jsonrpc: '2.0', method: 'initialized', params: {} }),
    );
    const files = sources.map((s) => ({
      name: sourceURI(s.name),
      text: s.text,
    }));
    server.setWorkspace(JSON.stringify(files));
    for (const file of files)
      server.handle(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'textDocument/didOpen',
          params: {
            textDocument: {
              uri: file.name,
              languageId: 'sysml',
              version: 1,
              text: file.text,
            },
          },
        }),
      );
    const raw = send('textDocument/' + query.kind, {
      textDocument: { uri: sourceURI(query.file) },
      position,
    });
    self.postMessage({ value: normalizeLanguage(sources, query, raw) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    server?.free();
    library?.free();
  }
};
