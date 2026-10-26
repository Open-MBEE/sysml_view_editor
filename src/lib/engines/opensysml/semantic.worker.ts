import type {
  SourceDocument,
  Diagnostic,
  ModelElement,
} from '$lib/workspace/project';
import type { EvaluatedView } from '$lib/workspace/views';
interface GoRuntime {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<unknown>;
}
interface EngineSymbol {
  id: string;
  name: string;
  kind: string;
  childIds?: string[];
  typeInfo?: { resolvedId?: string };
}
interface ParseReply {
  modelHash: string;
  roots: { childIds?: string[] }[];
  diagnostics?: {
    severity: string;
    message: string;
    span?: { file?: string; startLine?: number };
  }[];
}
self.onmessage = async (event: MessageEvent<unknown>) => {
  try {
    const request = readSemanticRequest(event.data);
    const { base, documents, operation } = request;
    await import(/* @vite-ignore */ base + 'wasm_exec.js');
    const host = globalThis as typeof globalThis & {
      Go: new () => GoRuntime;
      sysmlWasm: { call(method: string, params: string): string };
    };
    const go = new host.Go(),
      response = await fetch(base + 'sysml-wasm.wasm');
    if (!response.ok)
      throw new Error('OpenSysML browser assets are unavailable.');
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, go.importObject);
    void go
      .run(instance)
      .catch((reason) => self.postMessage({ error: String(reason) }));
    function call<T>(method: string, params: object): T {
      const reply = JSON.parse(
        host.sysmlWasm.call(method, JSON.stringify(params)),
      );
      if (reply.error)
        throw new Error(reply.error.message || 'Engine request failed.');
      return reply.result as T;
    }
    const parsed = call<ParseReply>('ParseSources', {
      documents: documents.map((item) => ({
        name: item.name,
        content: item.text,
        language: 'sysml',
      })),
      strictConformance: true,
    });
    const diagnostics: Diagnostic[] = (parsed.diagnostics ?? []).map(
      (item) => ({
        severity: item.severity,
        message: item.message,
        file: item.span?.file,
        line: item.span?.startLine,
      }),
    );
    if (operation === 'evaluate') {
      if (parsed.modelHash !== request.modelHash)
        throw new Error('View request no longer matches source.');
      const value = call<EvaluatedView>('EvaluateView', {
        modelHash: parsed.modelHash,
        view: request.view,
      });
      self.postMessage({ value });
      return;
    }
    const elements: ModelElement[] = [];
    if (!diagnostics.some((item) => item.severity === 'error')) {
      const pending = parsed.roots.flatMap((root) =>
          (root.childIds ?? []).map((id) => ({
            id,
            ownerId: null as string | null,
          })),
        ),
        seen = new Set<string>();
      while (pending.length) {
        const item = pending.shift()!;
        if (seen.has(item.id) || item.id.endsWith('::')) continue;
        if (seen.size >= 2000)
          throw new Error(
            'This foundation supports at most 2,000 declarations.',
          );
        seen.add(item.id);
        const { symbol } = call<{ symbol?: EngineSymbol }>('GetSymbol', {
          modelHash: parsed.modelHash,
          symbolId: item.id,
        });
        if (!symbol) throw new Error('The engine omitted a declaration.');
        elements.push({
          id: symbol.id,
          name: symbol.name,
          kind: symbol.kind,
          ownerId: item.ownerId,
          ...(symbol.typeInfo?.resolvedId
            ? { typeId: symbol.typeInfo.resolvedId }
            : {}),
        });
        pending.push(
          ...(symbol.childIds ?? []).map((id) => ({ id, ownerId: symbol.id })),
        );
      }
    }
    self.postMessage({
      value: { modelHash: parsed.modelHash, elements, diagnostics },
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
import { readSemanticRequest } from '../workers/schema';
