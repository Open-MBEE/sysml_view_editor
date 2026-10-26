import type { SemanticEngine } from '$lib/workspace/editing';
import { readModelSnapshot } from '$lib/workspace/project';
import { validateEvaluation } from '$lib/workspace/views';
import { requestWorker } from '../workers/request';
export function createSemanticEngine(base: string): SemanticEngine {
  return {
    parse(documents, signal) {
      return requestWorker(
        new Worker(new URL('./semantic.worker.ts', import.meta.url), {
          type: 'module',
        }),
        { protocolVersion: 1, operation: 'parse', documents, base },
        readModelSnapshot,
        signal,
      );
    },
    evaluate(documents, modelHash, view, signal) {
      return requestWorker(
        new Worker(new URL('./semantic.worker.ts', import.meta.url), {
          type: 'module',
        }),
        {
          protocolVersion: 1,
          operation: 'evaluate',
          documents,
          modelHash,
          view,
          base,
        },
        (value) => validateEvaluation(value, modelHash, view),
        signal,
      );
    },
  };
}
