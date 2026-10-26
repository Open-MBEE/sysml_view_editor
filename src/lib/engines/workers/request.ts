/** Every request owns a disposable worker, timeout and cancellation lifetime. */
export function requestWorker<T>(
  worker: Worker,
  input: unknown,
  validate: (value: unknown) => T,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = () => {
      if (done) return false;
      done = true;
      clearTimeout(timer);
      worker.terminate();
      signal?.removeEventListener('abort', abort);
      return true;
    };
    const abort = () => {
      if (finish()) reject(new Error('Engine operation cancelled.'));
    };
    const timer = setTimeout(() => {
      if (finish())
        reject(new Error('Engine operation timed out after 60 seconds.'));
    }, 60_000);
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = (event) => {
      if (finish()) reject(new Error(event.message || 'Engine worker failed.'));
    };
    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (!finish()) return;
      try {
        const reply = readWorkerReply(event.data);
        if ('error' in reply) reject(new Error(reply.error));
        else resolve(validate(reply.value));
      } catch (error) {
        reject(error);
      }
    };
    worker.postMessage(input);
  });
}
import { readWorkerReply } from './schema';
