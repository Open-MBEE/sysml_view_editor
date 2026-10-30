import system from '../../../../examples/air-compressor/system.sysml?raw';
import components from '../../../../examples/air-compressor/components.sysml?raw';
import types from '../../../../examples/air-compressor/types.sysml?raw';
import behavior from '../../../../examples/air-compressor/behavior.sysml?raw';
import requirements from '../../../../examples/air-compressor/requirements.sysml?raw';
import usecases from '../../../../examples/air-compressor/use-cases.sysml?raw';
import views from '../../../../examples/air-compressor/views.sysml?raw';
import sequence from '../../../../examples/air-compressor/sequence.sysml?raw';
import geometry from '../../../../examples/air-compressor/geometry.sysml?raw';
import type { ProjectBundle } from '$lib/workspace/persistence';

export const exampleView = 'CompressorViews::pneumatics';
const documents = [
  { name: 'system.sysml', text: system },
  { name: 'components.sysml', text: components },
  { name: 'types.sysml', text: types },
  { name: 'behavior.sysml', text: behavior },
  { name: 'requirements.sysml', text: requirements },
  { name: 'use-cases.sysml', text: usecases },
  { name: 'views.sysml', text: views },
  { name: 'sequence.sysml', text: sequence },
  { name: 'geometry.sysml', text: geometry },
];
export const exampleProject: ProjectBundle = {
  format: 'sysmlv2-view-project',
  version: 1,
  name: 'Smart air workshop',
  documents,
  drafts: documents,
  presentations: {},
};
