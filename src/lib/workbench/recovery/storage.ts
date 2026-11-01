export interface RecoveryStorage {
  read(): Promise<string | null>;
  /** Atomically replace only the value previously read by this session. */
  compareAndSwap(
    expected: string | null,
    next: string | null,
  ): Promise<boolean>;
  close?(): void;
}

/** A single durable snapshot per browser origin. No workspace data leaves the browser. */
export function indexedDbRecoveryStorage(
  factory: IDBFactory = globalThis.indexedDB,
): RecoveryStorage {
  let closed = false;
  let database: Promise<IDBDatabase> | undefined;
  const connect = (): Promise<IDBDatabase> => {
    if (closed)
      return Promise.reject(new Error('Local recovery storage is closed.'));
    if (database) return database;
    let failed = false;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open('sysml-view-recovery', 1);
      const fail = (error: Error) => {
        failed = true;
        reject(error);
      };
      request.onupgradeneeded = () =>
        request.result.createObjectStore('recovery');
      request.onerror = () =>
        fail(request.error ?? new Error('Cannot open local recovery.'));
      request.onblocked = () =>
        fail(
          new Error(
            'Local recovery is blocked by another tab. Close it and retry.',
          ),
        );
      request.onsuccess = () => {
        const db = request.result;
        if (closed || failed) {
          db.close();
          fail(new Error('Local recovery storage is closed.'));
          return;
        }
        db.onversionchange = () => {
          db.close();
          database = undefined;
        };
        resolve(db);
      };
    });
    database = opening;
    void opening.catch(() => {
      if (database === opening) database = undefined;
    });
    return opening;
  };
  const run = async (
    expected?: string | null,
    next?: string | null,
  ): Promise<string | null | boolean> => {
    const db = await connect();
    if (closed) throw new Error('Local recovery storage is closed.');
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        'recovery',
        expected === undefined ? 'readonly' : 'readwrite',
      );
      const store = transaction.objectStore('recovery');
      let result: string | null | boolean = null;
      let failure: Error | null = null;
      const request = store.get('latest');
      request.onsuccess = () => {
        const value: unknown = request.result;
        if (value !== undefined && typeof value !== 'string') {
          failure = new Error(
            'Local recovery contains an unsupported storage value.',
          );
          transaction.abort();
          return;
        }
        const raw = typeof value === 'string' ? value : null;
        if (expected === undefined) result = raw;
        else {
          result = raw === expected;
          if (result) {
            if (next === null) store.delete('latest');
            else store.put(next, 'latest');
          }
        }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = transaction.onerror = () =>
        reject(
          failure ??
            transaction.error ??
            new Error('Local recovery transaction failed.'),
        );
    });
  };
  return {
    read: () => run() as Promise<string | null>,
    compareAndSwap: (expected, next) => run(expected, next) as Promise<boolean>,
    close() {
      closed = true;
      void database?.then(
        (db) => db.close(),
        () => undefined,
      );
    },
  };
}
