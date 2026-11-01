import type { Workspace } from '$lib/workspace/createWorkspace';
import { readProject, type ProjectBundle } from '$lib/workspace/persistence';

export function createLocalProject(projectName: string): ProjectBundle {
  const normalized =
      projectName.trim().replace(/[^A-Za-z0-9_]/g, '') || 'Model',
    name = /^[A-Za-z_]/.test(normalized) ? normalized : 'Model' + normalized;
  const documents = [{ name: 'model.sysml', text: `package ${name} {\n\n}\n` }];
  return {
    format: 'sysmlv2-view-project',
    version: 1,
    name: projectName.trim() || 'My project',
    documents,
    drafts: documents,
    presentations: {},
  };
}

export async function readProjectFiles(
  chosen: readonly File[],
): Promise<ProjectBundle> {
  if (chosen.length === 1 && chosen[0]!.name.endsWith('.json'))
    return readProject(await chosen[0]!.text());
  const documents = await Promise.all(
    chosen.map(async (item) => ({
      name: item.webkitRelativePath || item.name,
      text: await item.text(),
    })),
  );
  return {
    format: 'sysmlv2-view-project',
    version: 1,
    name: chosen[0]!.name.replace(/\.sysml$/, ''),
    documents,
    drafts: documents,
    presentations: {},
  };
}

export function downloadProject(session: Workspace) {
  const serialized = session.serialize(),
    url = URL.createObjectURL(
      new Blob([serialized], { type: 'application/json' }),
    ),
    link = document.createElement('a');
  link.href = url;
  link.download =
    (session.snapshot().project?.name.replace(/[^A-Za-z0-9_-]/g, '-') ||
      'model') + '.sysml-project.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  session.markSaved(serialized);
}
