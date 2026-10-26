import { createWorkspace } from '$lib/workspace/createWorkspace';
import { createSemanticEngine } from '$lib/engines/opensysml';
import { createTransformationEngine } from '$lib/engines/toolkit';
/** Composition is the only workbench location that constructs engine adapters. */
export function createBrowserWorkspace() {
  return createWorkspace({
    semantic: createSemanticEngine(
      new URL('vendor/opensysml/', document.baseURI).href,
    ),
    transformations: createTransformationEngine(
      new URL('vendor/sysml-toolkit/', document.baseURI).href,
    ),
  });
}
