import { useLayoutEffect, useRef } from 'react';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
import { Button } from '$lib/ui/primitives/button';
import { AppearanceSettings } from '$lib/ui/AppearanceSettings';
import { Brand, repository } from './Brand';

export function Landing({ onOpen }: { onOpen: (example?: boolean) => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    heading.current?.focus();
  }, []);
  function link(event: React.MouseEvent<HTMLAnchorElement>, example = false) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    onOpen(example);
  }
  return (
    <div className="entry-page landing-page">
      <a className="skip-link" href="#landing-content">
        Skip to content
      </a>
      <header className="entry-header">
        <Brand onHome={() => heading.current?.focus()} />
        <nav aria-label="Product navigation">
          <AppearanceSettings />
          <Button asChild>
            <a href="/app" onClick={link}>
              Open app <ArrowUpRight aria-hidden="true" />
            </a>
          </Button>
        </nav>
      </header>
      <main id="landing-content">
        <section className="landing-intro" aria-labelledby="landing-title">
          <div className="landing-title">
            <span className="stage-label">Sandbox</span>
            <h1 id="landing-title" ref={heading} tabIndex={-1}>
              OpenMBEE
              <br />
              View Editor
            </h1>
            <p>SysML v2 modeling workspace</p>
          </div>
          <div className="landing-description">
            <h2>
              Write SysML, explore connected views, and understand your system.
            </h2>
            <p>
              Work with source, inspect named views, and review graphical
              changes in one local workspace.
            </p>
            <Button asChild variant="outline" size="lg">
              <a href="/app?example=1" onClick={(event) => link(event, true)}>
                Try an example <ArrowRight aria-hidden="true" />
              </a>
            </Button>
          </div>
        </section>
        <section className="landing-guide" aria-label="Getting started">
          <article>
            <h2>Start with a model</h2>
            <p>
              Open SysML source files or a project bundle. Explore the built-in
              example, or start with a new source project.
            </p>
            <a href={`${repository}/blob/develop/README.md`}>
              Read the guide <ArrowUpRight aria-hidden="true" />
            </a>
          </article>
          <article>
            <h2>Built to learn with you</h2>
            <p>
              This is a sandbox. Features and interfaces are still evolving.
              Keep downloaded copies of your work and share reproducible
              feedback.
            </p>
            <a href={`${repository}/issues`}>
              Share feedback <ArrowUpRight aria-hidden="true" />
            </a>
          </article>
          <article>
            <h2>Open source, with attribution</h2>
            <p>
              The application is Apache-2.0 licensed. Bundled engines and
              libraries retain their own licenses and notices.
            </p>
            <div className="landing-links">
              <a href={`${repository}/blob/develop/LICENSE`}>License</a>
              <a href={`${repository}/blob/develop/NOTICE`}>Notices</a>
              <a href={repository}>
                Source <ArrowUpRight aria-hidden="true" />
              </a>
            </div>
          </article>
        </section>
      </main>
      <footer className="entry-footer">
        <span>OpenMBEE</span>
        <span>Source, model and presentation, connected.</span>
      </footer>
    </div>
  );
}
