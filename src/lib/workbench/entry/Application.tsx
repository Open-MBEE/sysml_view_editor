import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { Landing } from './Landing';
const Workbench = lazy(() =>
  import('../shell/Workbench').then((module) => ({
    default: module.Workbench,
  })),
);
export type EntryRequest = { id: number; kind: 'launcher' | 'example' };

export function Application() {
  const [inApp, setInApp] = useState(() =>
    ['/app', '/app/'].includes(window.location.pathname),
  );
  const [started, setStarted] = useState(inApp);
  const [entry, setEntry] = useState<EntryRequest>(() => ({
    id: 1,
    kind:
      new URL(window.location.href).searchParams.get('example') === '1'
        ? 'example'
        : 'launcher',
  }));
  useLayoutEffect(() => {
    // An example link expresses one opening action, not an instruction to replace
    // recovery with the example every time the page is reloaded.
    if (
      inApp &&
      (window.location.pathname !== '/app' ||
        new URL(window.location.href).searchParams.has('example'))
    )
      window.history.replaceState(null, '', '/app');
    const pop = () => {
      const app = ['/app', '/app/'].includes(window.location.pathname);
      setInApp(app);
      if (app) setStarted(true);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    document.title = inApp
      ? 'Workspace | OpenMBEE View Editor'
      : 'OpenMBEE View Editor | SysML v2 workspace';
  }, [inApp]);
  function open(example = false) {
    window.history.pushState(null, '', '/app');
    setEntry((previous) => ({
      id: previous.id + 1,
      kind: example ? 'example' : 'launcher',
    }));
    setStarted(true);
    setInApp(true);
  }
  function home() {
    window.history.pushState(null, '', '/');
    setInApp(false);
  }
  return (
    <>
      {!inApp && <Landing onOpen={open} />}
      {started && (
        <div className="route-surface" hidden={!inApp} inert={!inApp}>
          <Suspense
            fallback={
              <main className="entry-loading" role="status">
                Opening workspace…
              </main>
            }
          >
            <Workbench active={inApp} entryRequest={entry} onHome={home} />
          </Suspense>
        </div>
      )}
    </>
  );
}
