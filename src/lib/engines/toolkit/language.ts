import type { SourceLanguageEngine } from '$lib/workspace/language';
import { readLanguageResult } from '$lib/workspace/language';
import { requestWorker } from '../workers/request';
export function createSourceLanguageEngine(base: string): SourceLanguageEngine {
  return {
    query(documents, query, signal) {
      return requestWorker(
        new Worker(new URL('./language.worker.ts', import.meta.url), {
          type: 'module',
        }),
        { protocolVersion: 1, documents, query, base },
        readLanguageResult,
        signal,
      );
    },
  };
}
