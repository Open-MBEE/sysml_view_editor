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

export const airWorkshopView = 'CompressorViews::overview';
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
export const airWorkshopProject: ProjectBundle = {
  format: 'sysmlv2-view-project',
  version: 1,
  name: 'Smart air workshop',
  documents,
  drafts: documents,
  presentations: {},
};

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

export const roverGuide: Record<string, string> = {
  'RoverViews::architecture':
    '1 · Meet the rover. Follow battery power into mobility, autonomy and inspection. Component values are authored design declarations. Next: mission.',
  'RoverViews::mission':
    '2 · Follow an inspection mission: check reserve, patrol, detect, capture, report, return and recharge. This is declared order, not a running simulation. Next: lifecycle.',
  'RoverViews::lifecycle':
    '3 · Explore normal operation and the safe-stop path. Low reserve sends the rover home; charging returns it to docked. Next: requirements.',
  'RoverViews::requirements':
    '4 · Trace reserve, speed, clearance and image quality to the exact rover parts. Satisfaction is declared, not test evidence. Next: definitions.',
  'RoverViews::definitions':
    '5 · Compare reusable components. Two drives share one type; Drive specializes Actuator, and Lidar and Camera specialize Sensor.',
};
