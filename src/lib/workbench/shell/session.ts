import { createWorkspace } from '$lib/workspace/createWorkspace';
import { createSemanticEngine } from '$lib/engines/opensysml';
import { createTransformationEngine } from '$lib/engines/toolkit';
import { createSourceLanguageEngine } from '$lib/engines/toolkit/language';
/** Composition is the only workbench location that constructs engine adapters. */
export function createBrowserSession() {
  const toolkitBase = new URL('vendor/sysml-toolkit/', document.baseURI).href;
  const semantic = createSemanticEngine(
    new URL('vendor/opensysml/', document.baseURI).href,
  );
  return {
    workspace: createWorkspace({
      semantic,
      exploration: semantic,
      requirements: semantic,
      transformations: createTransformationEngine(toolkitBase),
    }),
    language: createSourceLanguageEngine(toolkitBase),
  };
}
/** Existing consumers that only need semantic transactions remain compatible. */
export function createBrowserWorkspace() {
  return createBrowserSession().workspace;
}
