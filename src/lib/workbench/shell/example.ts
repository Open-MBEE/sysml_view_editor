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
