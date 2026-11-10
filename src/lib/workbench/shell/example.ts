import type { ProjectBundle } from '$lib/workspace/persistence';
import roverSystem from '../../../../examples/inspection-rover/system.sysml?raw';
import roverComponents from '../../../../examples/inspection-rover/components.sysml?raw';
import roverTypes from '../../../../examples/inspection-rover/types.sysml?raw';
import roverBehavior from '../../../../examples/inspection-rover/behavior.sysml?raw';
import roverRequirements from '../../../../examples/inspection-rover/requirements.sysml?raw';
import roverViews from '../../../../examples/inspection-rover/views.sysml?raw';
const roverDocuments = [
  { name: 'system.sysml', text: roverSystem },
  { name: 'components.sysml', text: roverComponents },
  { name: 'types.sysml', text: roverTypes },
  { name: 'behavior.sysml', text: roverBehavior },
  { name: 'requirements.sysml', text: roverRequirements },
  { name: 'views.sysml', text: roverViews },
];
export const exampleView = 'RoverViews::architecture';
export const exampleProject: ProjectBundle = {
  format: 'sysmlv2-view-project',
  version: 1,
  name: 'Inspection rover',
  documents: roverDocuments,
  drafts: roverDocuments,
  presentations: {},
};
