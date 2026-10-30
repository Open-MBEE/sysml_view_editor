import type { TransformationEngine } from '$lib/workspace/editing';
import { readTransformationResult } from '$lib/workspace/editing/evidence';
import { requestWorker } from '../workers/request';
export function createTransformationEngine(base: string): TransformationEngine {
  return {
    propose(documents, command, signal) {
      return requestWorker(
        new Worker(new URL('./transform.worker.ts', import.meta.url), {
          type: 'module',
        }),
        { protocolVersion: 1, documents, command, base },
        readTransformationResult,
        signal,
      );
    },
  };
}
