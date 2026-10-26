import type { Static } from 'typebox';
import type { ReadonlyData } from '$lib/contracts/validation';
import { validateDocuments } from '../project';
import { ProjectBundleSchema, validateProjectBundle } from './schema';
export type ProjectBundle = ReadonlyData<Static<typeof ProjectBundleSchema>>;
export function readProject(text: string): ProjectBundle {
  if (new TextEncoder().encode(text).length > 24 * 1024 * 1024)
    throw new Error('Project bundle exceeds 24 MiB.');
  const input = validateProjectBundle(JSON.parse(text));
  if (!input.name.trim()) throw new Error('Enter a project name.');
  const documents = validateDocuments(input.documents),
    drafts = validateDocuments(input.drafts);
  if (
    documents.some((file) => !drafts.some((draft) => draft.name === file.name))
  )
    throw new Error('Drafts must retain applied files.');
  return {
    format: input.format,
    version: 1,
    name: input.name.trim(),
    documents,
    drafts,
    presentations: input.presentations,
  };
}
export function serializeProject(project: ProjectBundle): string {
  return JSON.stringify(readProject(JSON.stringify(project)), null, 2);
}
