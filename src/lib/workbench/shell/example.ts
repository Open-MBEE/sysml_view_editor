import model from '../../../../examples/workshop/model.sysml?raw';
import views from '../../../../examples/workshop/views.sysml?raw';
import type { ProjectBundle } from '$lib/workspace/persistence';
export const exampleProject: ProjectBundle = {
  format: 'sysmlv2-view-project',
  version: 1,
  name: 'Workshop',
  documents: [
    { name: 'model.sysml', text: model },
    { name: 'views.sysml', text: views },
  ],
  drafts: [
    { name: 'model.sysml', text: model },
    { name: 'views.sysml', text: views },
  ],
  presentations: {},
};
